// Prova, por HTTP, as correções da auditoria da API do FireCheck (api/index.js).
// Roda contra um ambiente local descartável (tutoriais/ambiente/ambiente.mjs):
// banco PGlite e nenhuma chave real (nem WhatsApp, nem e-mail, nem Cakto, nem IA).
//
//   node tutoriais/ambiente/ambiente.mjs subir 21
//   eval "$(node tutoriais/ambiente/ambiente.mjs variaveis 21)"
//   node scripts/teste-auditoria-api.mjs                 # BASE = TUTORIAL_BASE (ambiente 21)
//   node scripts/teste-auditoria-api.mjs --so=1,2,13     # só alguns itens
//
// Variáveis: TUTORIAL_BASE (URL do app), TUTORIAL_DATABASE_URL (banco local; a
// conexão recusa qualquer host que não seja local), RAIZ (pasta do código que
// sobe a segunda instância, a dos "canais falsos": WhatsApp e e-mail de mentira
// que este script mesmo escuta; padrão = pasta atual).
//
// Cada conta e loja do teste leva o sufixo da rodada: não apaga nem usa o que o
// ambiente já tinha, e pode rodar várias vezes seguidas.
process.env.TZ = 'UTC'; // o mesmo fuso do servidor do ambiente (e da Vercel)
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawn } from 'node:child_process';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const BASE = process.env.TUTORIAL_BASE || 'http://127.0.0.1:3191';
const URL_DO_BANCO = process.env.TUTORIAL_DATABASE_URL;
const RAIZ = path.resolve(process.env.RAIZ || process.cwd());
const SO = new Set(((process.argv.find((a) => a.startsWith('--so=')) || '').slice(5)).split(',').filter(Boolean));
const RODADA = Date.now().toString(36);
const SENHA = 'senha1234';

if (!URL_DO_BANCO) throw new Error('Falta TUTORIAL_DATABASE_URL (rode o `eval "$(node tutoriais/ambiente/ambiente.mjs variaveis 21)"`).');
if (!['127.0.0.1', 'localhost'].includes(new URL(URL_DO_BANCO).hostname)) throw new Error('Este teste só roda em banco local.');
const db = new pg.Client({ connectionString: URL_DO_BANCO });
await db.connect();
const q = (sql, p) => db.query(sql, p);
const hash = await bcrypt.hash(SENHA, 4);

let falhas = 0, total = 0;
const rodar = (item) => SO.size === 0 || SO.has(String(item));
function confere(nome, ok, detalhe = '') {
  total += 1;
  if (!ok) falhas += 1;
  console.log(`${ok ? '  ok    ' : '  FALHOU'}  ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
}
const secao = (titulo) => console.log(`\n# ${titulo}`);

let contadorDeIp = 0;
async function api(caminho, { token, metodo = 'GET', corpo, base = BASE, cabecalhos = {} } = {}) {
  // Uma "origem" nova por chamada: o freio de login/recuperação não contamina os cenários.
  const r = await fetch(base + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', 'x-real-ip': `ip-${RODADA}-${contadorDeIp++}`, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...cabecalhos },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  let dados = null;
  try { dados = await r.json(); } catch { /* corpo vazio ou não JSON */ }
  return { status: r.status, dados };
}

const email = (nome) => `${nome}-${RODADA}@auditoria.local`.toLowerCase();
let seq = 0;
/** Cria uma conta direto no banco (a rota de cadastro é parte do que se testa em outros itens). */
async function conta({ nome = 'Pessoa', papel = 'funcionario', loja, status = 'active', plano = 'combo_mensal', expira = 'NOW() + INTERVAL \'30 days\'', criadaHa = 5, extra = {} } = {}) {
  seq += 1;
  const e = extra.email || email(`${papel}${seq}`);
  const campos = { name: nome, email: e, password: hash, role: papel, store: loja, store_name: loja, status, plan: plano, ponto_active: true, ponto_limit: 50, checklist_limit: 999999, phone: '2199990000', ...extra };
  delete campos.email;
  const colunas = ['email', ...Object.keys(campos)];
  const valores = [e, ...Object.values(campos)];
  const { rows: [u] } = await q(
    `INSERT INTO users (${colunas.join(', ')}, expiration_date, created_at) VALUES (${colunas.map((_, i) => `$${i + 1}`).join(', ')}, ${expira}, NOW() - INTERVAL '${criadaHa} days') RETURNING id, email`,
    valores
  );
  return { id: u.id, email: u.email, loja };
}
async function entrar(c, senha = SENHA) {
  const r = await api('/api/auth', { metodo: 'POST', corpo: { email: c.email, password: senha } });
  c.token = r.dados?.token;
  c.loginStatus = r.status;
  return c;
}
/** Uma loja com dono, gestor e funcionário já logados. */
async function loja(nome, { status = 'active', plano = 'combo_mensal' } = {}) {
  const L = `${nome} ${RODADA}`;
  const dono = await entrar(await conta({ nome: `Dono ${nome}`, papel: 'admin', loja: L, status, plano }));
  const gestor = await entrar(await conta({ nome: `Gestor ${nome}`, papel: 'gestor', loja: L, status, plano }));
  const func = await entrar(await conta({ nome: `Func ${nome}`, papel: 'funcionario', loja: L, status, plano }));
  return { nome: L, dono, gestor, func };
}
const master = await entrar(await conta({ nome: 'Master', papel: 'master', loja: null, plano: 'master' }));
const col = async (sql, p) => (await q(sql, p)).rows[0];

// ── Canais falsos: WhatsApp (Evolution) e e-mail (Resend) de mentira ────────────
// O app de verdade sobe numa segunda porta apontando para este servidorzinho, que
// só anota o que lhe mandaram. Nada sai da máquina.
const caixa = { whatsapp: [], emails: [], whatsappLento: false, whatsappFalha: false };
const instancias = {}; // nome → { base, parar }
const pararTudo = () => Object.values(instancias).forEach((i) => i.parar());
process.on('exit', pararTudo);
const limparCaixa = () => { caixa.whatsapp.length = 0; caixa.emails.length = 0; caixa.whatsappLento = false; caixa.whatsappFalha = false; };
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
/** sistemaEnvia: o interruptor WHATSAPP_DO_SISTEMA_ENVIA (desligado = como está em produção). */
// deslocMin: adianta/atrasa o relógio do SERVIDOR (só dele) em N minutos, para os crons
// poderem ser provados em qualquer hora em que o teste rode (ver o pré-carregamento abaixo).
async function subirCanais(nome, { sistemaEnvia = false, porta, extras = {}, deslocMin = 0 } = {}) {
  if (instancias[nome]) return instancias[nome];
  const relogio = path.join(os.tmpdir(), `relogio-falso-${RODADA}.mjs`);
  fs.writeFileSync(relogio, [
    'const Real = Date; const desloc = Number(process.env.RELOGIO_DESLOC_MIN || 0) * 60000;',
    'class Falso extends Real { constructor(...a) { if (a.length === 0) super(Real.now() + desloc); else super(...a); } static now() { return Real.now() + desloc; } }',
    'globalThis.Date = Falso;',
  ].join('\n'));
  const falso = http.createServer((req, res) => {
    let corpo = '';
    req.on('data', (d) => { corpo += d; });
    req.on('end', () => {
      let j = {}; try { j = JSON.parse(corpo); } catch { /* ignora */ }
      if (/\/message\/sendText\//.test(req.url)) {
        caixa.whatsapp.push({ instancia: req.url.split('/').pop(), numero: j.number, texto: j.text });
        if (caixa.whatsappLento) return; // nunca responde: prova o teto de tempo
        if (caixa.whatsappFalha) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end('{"message":"falha de mentira"}'); }
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ key: { id: `fake-${caixa.whatsapp.length}` } }));
      }
      if (/\/emails/.test(req.url)) {
        caixa.emails.push({ para: j.to, assunto: j.subject, html: j.html });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ id: `mail-${caixa.emails.length}` }));
      }
      res.writeHead(404); res.end('{}');
    });
  });
  await new Promise((ok) => falso.listen(0, '127.0.0.1', ok));
  const portaFalsa = falso.address().port;
  process.env.TUTORIAL_IA_CHAVE = process.env.TUTORIAL_IA_CHAVE || 'fake';
  // ambiente.mjs lê process.argv como comando (subir/parar...): importa sem os argumentos do teste.
  const argvDoTeste = process.argv;
  process.argv = argvDoTeste.slice(0, 2);
  const { ambiente } = await import(`file:///${RAIZ.replace(/\\/g, '/')}/tutoriais/ambiente/ambiente.mjs`);
  process.argv = argvDoTeste;
  const a = ambiente(Number(process.env.TUTORIAL_AMBIENTE || 21));
  const filho = spawn(process.execPath, ['--import', `file:///${relogio.replace(/\\/g, '/')}`, 'tutoriais/ambiente/servidor.mjs'], {
    // TESTE_LOG_SERVIDOR=arquivo guarda o log do app que este teste sobe (para investigar uma falha).
    cwd: RAIZ, windowsHide: true, stdio: process.env.TESTE_LOG_SERVIDOR ? ['ignore', fs.openSync(process.env.TESTE_LOG_SERVIDOR, 'a'), fs.openSync(process.env.TESTE_LOG_SERVIDOR, 'a')] : ['ignore', 'ignore', 'ignore'],
    env: {
      ...process.env, ...a.doServidor, PORT: String(porta),
      EVOLUTION_API_URL: `http://127.0.0.1:${portaFalsa}`, EVOLUTION_API_KEY: 'chave-falsa', EVOLUTION_INSTANCE: 'sistema-falso',
      RELOGIO_DESLOC_MIN: String(deslocMin), WHATSAPP_DO_SISTEMA_ENVIA: sistemaEnvia ? 'true' : '', RESEND_API_KEY: 'chave-falsa', RESEND_API_URL: `http://127.0.0.1:${portaFalsa}/emails`,
      ...extras,
    },
  });
  const url = `http://127.0.0.1:${porta}`;
  for (let i = 0; i < 80; i++) {
    const r = await fetch(`${url}/api/ping`).catch(() => null);
    if (r && r.status < 500) break;
    await new Promise((ok) => setTimeout(ok, 500));
  }
  instancias[nome] = { base: url, parar: () => { try { filho.kill(); } catch { /* já saiu */ } falso.close(); falso.closeAllConnections?.(); } };
  return instancias[nome];
}

// ═════════════════════════════════════════════════════════════════════════════
if (rodar(1)) {
  secao('1. Só o master prorroga teste (trialDays/trialEndsAt)');
  const L = await loja('Trial', { status: 'trial', plano: 'trial' });
  let r = await api(`/api/users/${L.dono.id}`, { token: L.dono.token, metodo: 'PUT', corpo: { trialDays: 365, name: 'Nome Trocado' } });
  const u = await col('SELECT trial_ends_at, name FROM users WHERE id = $1', [L.dono.id]);
  confere('dono em teste NÃO estende o próprio teste (403)', r.status === 403, `HTTP ${r.status}`);
  confere('trial_ends_at continua vazio', u.trial_ends_at === null);
  confere('o 403 vem antes de gravar o resto do corpo', u.name !== 'Nome Trocado', `nome=${u.name}`);
  r = await api(`/api/users/${L.dono.id}`, { token: L.dono.token, metodo: 'PUT', corpo: { trialEndsAt: '2099-01-01' } });
  confere('trialEndsAt em 2099 também é recusado', r.status === 403, `HTTP ${r.status}`);
  r = await api(`/api/users/${L.dono.id}`, { token: master.token, metodo: 'PUT', corpo: { trialDays: 10 } });
  const m = await col('SELECT trial_ends_at FROM users WHERE id = $1', [L.dono.id]);
  confere('master continua estendendo o teste', r.status === 200 && m.trial_ends_at !== null, `HTTP ${r.status}`);
}

// ═════════════════════════════════════════════════════════════════════════════
if (rodar(2)) {
  secao('2. Gestor não edita contato do dono; telefone trocado fica registrado');
  const L = await loja('Gestor');
  const antes = await col('SELECT phone, whatsapp_phone, contador_email FROM users WHERE id = $1', [L.dono.id]);
  const celularDoGestor = '21988887777';
  let r = await api(`/api/users/${L.dono.id}`, { token: L.gestor.token, metodo: 'PUT', corpo: { phone: celularDoGestor } });
  let d = await col('SELECT phone FROM users WHERE id = $1', [L.dono.id]);
  confere('gestor trocar o phone do dono (403)', r.status === 403 && d.phone === antes.phone, `HTTP ${r.status}, phone=${d.phone}`);
  r = await api(`/api/users/${L.dono.id}`, { token: L.gestor.token, metodo: 'PUT', corpo: { whatsapp_phone: celularDoGestor } });
  d = await col('SELECT whatsapp_phone FROM users WHERE id = $1', [L.dono.id]);
  confere('gestor trocar o whatsapp_phone do dono (403)', r.status === 403 && d.whatsapp_phone === antes.whatsapp_phone, `HTTP ${r.status}`);
  r = await api(`/api/users/${L.dono.id}`, { token: L.gestor.token, metodo: 'PUT', corpo: { contador_email: 'gestor@mal.com' } });
  d = await col('SELECT contador_email FROM users WHERE id = $1', [L.dono.id]);
  confere('gestor trocar o e-mail do contador do dono (403)', r.status === 403 && d.contador_email === antes.contador_email, `HTTP ${r.status}`);
  r = await api(`/api/users/${L.dono.id}`, { token: L.gestor.token, metodo: 'PUT', corpo: { phone: antes.phone } });
  confere('reenviar o MESMO phone não é mudança (200, a tela reenvia a ficha inteira)', r.status === 200, `HTTP ${r.status}`);
  r = await api(`/api/users/${L.func.id}`, { token: L.gestor.token, metodo: 'PUT', corpo: { phone: '21977776666' } });
  confere('gestor continua editando o telefone de um funcionário', r.status === 200, `HTTP ${r.status}`);
  r = await api(`/api/users/${L.dono.id}`, { token: L.dono.token, metodo: 'PUT', corpo: { phone: '21966665555' } });
  d = await col("SELECT phone, to_jsonb(users)->>'phone_changed_at' AS phone_changed_at FROM users WHERE id = $1", [L.dono.id]);
  confere('o dono troca o próprio telefone (200) e a troca fica carimbada', r.status === 200 && d.phone === '21966665555' && !!d.phone_changed_at, `HTTP ${r.status}`);
}

// ═════════════════════════════════════════════════════════════════════════════
if (rodar(3)) {
  secao('3. Webhook da Cakto sem cadastro prévio: loja própria');
  const compra = (n, produto) => ({ data: { status: 'paid', customer: { email: email(`comprador${n}`), name: `Comprador ${n}`, phone: '21999990000' }, product: { name: produto }, subscription: { id: `sub-${RODADA}-${n}` } } });
  let r1 = await api('/api/webhooks/cakto', { metodo: 'POST', corpo: compra(1, 'Combo Tudo em 1 mensal') });
  let r2 = await api('/api/webhooks/cakto', { metodo: 'POST', corpo: compra(2, 'Só Ponto Eletrônico mensal') });
  const a = await col('SELECT store, store_name, ponto_active, ponto_limit, checklist_limit, plan, status FROM users WHERE email = $1', [email('comprador1')]);
  const b = await col('SELECT store, store_name, ponto_active, ponto_limit, plan FROM users WHERE email = $1', [email('comprador2')]);
  confere('webhook respondeu 200 às duas compras', r1.status === 200 && r2.status === 200, `HTTP ${r1.status}/${r2.status}`);
  confere('nenhum comprador cai em "Minha Empresa"', a?.store !== 'Minha Empresa' && b?.store !== 'Minha Empresa', `lojas: "${a?.store}" e "${b?.store}"`);
  confere('cada comprador tem a SUA loja (chaves diferentes)', !!a?.store && !!b?.store && a.store !== b.store);
  confere('store_name preenchido', !!a?.store_name && !!b?.store_name);
  confere('Combo: ponto ligado, 50 colaboradores, checklists ilimitados', a?.ponto_active === true && Number(a?.ponto_limit) === 50 && Number(a?.checklist_limit) === 999999, JSON.stringify(a));
  confere('Só Ponto: ponto ligado e 30 colaboradores', b?.ponto_active === true && Number(b?.ponto_limit) === 30, JSON.stringify(b));
}

// ═════════════════════════════════════════════════════════════════════════════
if (rodar(4)) {
  secao('4. GET /api/cameras não entrega usuário e senha a funcionário');
  const L = await loja('Cameras');
  await q('INSERT INTO store_cameras (store, name, url, username, password) VALUES ($1, $2, $3, $4, $5)', [L.nome, 'Cozinha', 'rtsp://x/1', 'usuario-cam', 'senha-da-camera']);
  let r = await api(`/api/cameras?store=${encodeURIComponent(L.nome)}`, { token: L.func.token });
  confere('funcionário lista as câmeras (200) mas sem credenciais', r.status === 200 && Array.isArray(r.dados) && r.dados.length === 1 && !JSON.stringify(r.dados).includes('senha-da-camera') && !JSON.stringify(r.dados).includes('usuario-cam'), `HTTP ${r.status} ${JSON.stringify(r.dados).slice(0, 120)}`);
  r = await api(`/api/cameras?store=${encodeURIComponent(L.nome)}`, { token: L.gestor.token });
  confere('gestor continua vendo as credenciais para editar', r.status === 200 && JSON.stringify(r.dados).includes('senha-da-camera'));
  r = await api(`/api/cameras?store=${encodeURIComponent(L.nome)}`, { token: L.dono.token });
  confere('dono continua vendo as credenciais', r.status === 200 && JSON.stringify(r.dados).includes('senha-da-camera'));
}

// ═════════════════════════════════════════════════════════════════════════════
if (rodar(5)) {
  secao('5. Plano do cadastro: whitelist; Só Ponto regrava o plano');
  const novo = (plano) => ({ name: 'Cliente', email: email(`signup-${plano}`), password: 'senha1234', store: `Loja ${plano} ${RODADA}`, phone: '21999990000', plan: plano });
  let r = await api('/api/signup', { metodo: 'POST', corpo: novo('enterprise') });
  let c = await col('SELECT plan, status FROM users WHERE email = $1', [email('signup-enterprise')]);
  confere('cadastro com plan "enterprise" não vira plano real', !c || c.plan !== 'enterprise', `HTTP ${r.status}, plano gravado: ${c?.plan}`);
  r = await api('/api/signup', { metodo: 'POST', corpo: novo('master') });
  c = await col('SELECT plan FROM users WHERE email = $1', [email('signup-master')]);
  confere('cadastro com plan "master" também não', !c || c.plan !== 'master', `HTTP ${r.status}`);
  r = await api('/api/signup', { metodo: 'POST', corpo: novo('combo_mensal') });
  c = await col('SELECT plan, status FROM users WHERE email = $1', [email('signup-combo_mensal')]);
  confere('plano de checkout continua aceito (pendente até pagar)', r.status === 200 && c?.plan === 'combo_mensal' && c?.status === 'pending', `HTTP ${r.status} ${JSON.stringify(c)}`);
  r = await api('/api/signup', { metodo: 'POST', corpo: novo('trial') });
  c = await col('SELECT plan, status FROM users WHERE email = $1', [email('signup-trial')]);
  // Sem teste grátis desde 21/11/2026: o cadastro com trial é recusado e não cria conta.
  confere('sem teste grátis: cadastro com trial é recusado (400) e não cria conta', r.status === 400 && !c, `HTTP ${r.status}`);

  // Conta antiga/enganada com plano enterprise e pagamento pendente, comprando Só Ponto.
  const velha = await conta({ papel: 'admin', loja: `Plano ${RODADA}`, status: 'pending', plano: 'enterprise', extra: { ponto_active: false, ponto_limit: 5, checklist_limit: 300 } });
  r = await api('/api/webhooks/cakto', { metodo: 'POST', corpo: { data: { status: 'paid', customer: { email: velha.email, name: 'Velha' }, product: { name: 'Só Ponto Eletrônico mensal' }, subscription: { id: `sub-${RODADA}-p` } } } });
  c = await col('SELECT plan, status, ponto_active, ponto_limit FROM users WHERE id = $1', [velha.id]);
  confere('Só Ponto pago: plan vira ponto_mensal (não fica enterprise)', c.status === 'active' && c.plan === 'ponto_mensal' && c.ponto_active === true, JSON.stringify(c));
}

// ═════════════════════════════════════════════════════════════════════════════
if (rodar(6)) {
  secao('6. Ponto: a loja é a do token, não a do corpo');
  const A = await loja('PontoA');
  const B = await loja('PontoB');
  const batida = { type: 'entrada', latitude: -22.5, longitude: -41.9, accuracy: 10 };
  let r = await api(`/api/ponto?store=${encodeURIComponent(A.nome)}`, { token: A.func.token, metodo: 'POST', corpo: { ...batida, store: B.nome } });
  let naB = await col('SELECT COUNT(*)::int AS n FROM ponto_records WHERE store = $1', [B.nome]);
  confere('POST /api/ponto com store de outra loja no corpo não grava nela', naB.n === 0, `HTTP ${r.status}, batidas em B: ${naB.n}`);
  // Funcionário de A que bate com o corpo certo continua batendo normalmente.
  const A2 = await loja('PontoA2');
  r = await api('/api/ponto', { token: A2.func.token, metodo: 'POST', corpo: { ...batida, store: A2.nome } });
  const naA2 = await col('SELECT COUNT(*)::int AS n FROM ponto_records WHERE store = $1 AND user_id = $2', [A2.nome, A2.func.id]);
  confere('a batida normal (store do corpo = loja do token) grava na própria loja', r.status === 200 && naA2.n === 1, `HTTP ${r.status}`);
  // Manual (gestor): query certa + corpo apontando para a outra loja.
  r = await api(`/api/ponto/manual?store=${encodeURIComponent(A.nome)}`, { token: A.gestor.token, metodo: 'POST', corpo: { userId: A.func.id, userName: 'Func', store: B.nome, type: 'entrada', timestamp: '2026-10-20 08:00:00' } });
  naB = await col('SELECT COUNT(*)::int AS n FROM ponto_records WHERE store = $1', [B.nome]);
  confere('POST /api/ponto/manual com store de outra loja no corpo não grava nela', naB.n === 0, `HTTP ${r.status}, batidas em B: ${naB.n}`);
  r = await api('/api/ponto/manual', { token: A.gestor.token, metodo: 'POST', corpo: { userId: A.func.id, userName: 'Func', store: A.nome, type: 'entrada', timestamp: '2026-10-20 08:00:00' } });
  const naA = await col('SELECT COUNT(*)::int AS n FROM ponto_records WHERE store = $1 AND is_manual', [A.nome]);
  confere('lançamento manual normal continua valendo', r.status === 200 && naA.n === 1, `HTTP ${r.status}`);
}

// ═════════════════════════════════════════════════════════════════════════════
if (rodar(7)) {
  secao('7. Recuperação de senha com e-mail de reserva; troca de senha logado');
  // — WhatsApp do sistema DESLIGADO (o padrão de produção): só o e-mail entrega.
  const B = await subirCanais('sem-whatsapp', { porta: 3194 });
  limparCaixa();
  const L = await loja('Senha');
  let r = await api('/api/forgot-password', { metodo: 'POST', corpo: { email: L.dono.email }, base: B.base });
  const tempMail = caixa.emails.at(-1)?.html.match(/<strong>([0-9A-F]{8})<\/strong>/)?.[1];
  confere('WhatsApp do sistema desligado: o e-mail do cadastro recebe a senha temporária', r.status === 200 && caixa.emails.at(-1)?.para === L.dono.email && !!tempMail, `HTTP ${r.status}, e-mails: ${caixa.emails.length}`);
  const entrou = tempMail ? await api('/api/auth', { metodo: 'POST', corpo: { email: L.dono.email, password: tempMail } }) : { status: 0 };
  confere('a senha do e-mail entra de verdade', entrou.status === 200 && !!entrou.dados?.token, `HTTP ${entrou.status}`);

  // — WhatsApp do sistema LIGADO.
  const A = await subirCanais('com-whatsapp', { sistemaEnvia: true, porta: 3193 });
  limparCaixa();
  const L2 = await loja('Senha2');
  const fone = (await col('SELECT phone FROM users WHERE id = $1', [L2.dono.id])).phone;
  r = await api('/api/forgot-password', { metodo: 'POST', corpo: { email: L2.dono.email }, base: A.base });
  confere('com WhatsApp: a senha vai pelo WhatsApp (e não duplica por e-mail)', r.status === 200 && caixa.whatsapp.length === 1 && caixa.emails.length === 0, `whatsapp ${caixa.whatsapp.length}, e-mail ${caixa.emails.length}`);
  limparCaixa(); caixa.whatsappFalha = true;
  r = await api('/api/forgot-password', { metodo: 'POST', corpo: { email: L2.dono.email }, base: A.base });
  confere('WhatsApp falhou: cai para o e-mail', r.status === 200 && caixa.emails.length === 1, `HTTP ${r.status}, e-mails: ${caixa.emails.length}`);
  // — Telefone trocado há pouco: a senha NÃO vai para o WhatsApp.
  limparCaixa();
  await q("UPDATE users SET phone_changed_at = NOW() WHERE id = $1", [L2.dono.id]).catch(() => {});
  r = await api('/api/forgot-password', { metodo: 'POST', corpo: { email: L2.dono.email }, base: A.base });
  confere('telefone trocado há pouco: nada vai para o WhatsApp, só para o e-mail do cadastro', caixa.whatsapp.length === 0 && caixa.emails.length === 1, `whatsapp ${caixa.whatsapp.length}, e-mail ${caixa.emails.length}`);
  // — O ataque inteiro: o gestor tenta trocar o telefone do dono e pedir a senha.
  limparCaixa();
  const L3 = await loja('Senha3');
  await api(`/api/users/${L3.dono.id}`, { token: L3.gestor.token, metodo: 'PUT', corpo: { phone: '21955554444' } });
  await api('/api/forgot-password', { metodo: 'POST', corpo: { email: L3.dono.email }, base: A.base });
  confere('ataque do gestor: nenhuma mensagem chega ao celular do gestor', !caixa.whatsapp.some((m) => String(m.numero).includes('55554444')), `mensagens: ${caixa.whatsapp.map((m) => m.numero).join(',') || 'nenhuma'}`);

  // — Webhook da Cakto: quem compra sem cadastro recebe os dados por e-mail.
  limparCaixa();
  const compra = { data: { status: 'paid', customer: { email: email('comprador-mail'), name: 'Comprador Mail', phone: '21999990000' }, product: { name: 'Combo Tudo em 1 mensal' } } };
  r = await api('/api/webhooks/cakto', { metodo: 'POST', corpo: compra, base: B.base });
  confere('conta criada pelo webhook: a senha chega por e-mail (WhatsApp do sistema desligado)', r.status === 200 && caixa.emails.some((m) => m.para === email('comprador-mail') && /Senha temporária/.test(m.html)), `e-mails: ${caixa.emails.length}`);

  // — Troca de senha logado.
  const U = await conta({ papel: 'admin', loja: `Troca ${RODADA}` });
  await entrar(U);
  const tokenAntigo = U.token;
  r = await api('/api/change-password', { token: U.token, metodo: 'POST', corpo: { currentPassword: 'errada1234', newPassword: 'nova-senha-123' } });
  confere('senha atual errada: 401', r.status === 401, `HTTP ${r.status}`);
  r = await api('/api/change-password', { token: U.token, metodo: 'POST', corpo: { currentPassword: SENHA, newPassword: 'curta' } });
  confere('nova senha com menos de 8 caracteres: 400', r.status === 400, `HTTP ${r.status}`);
  r = await api('/api/change-password', { token: U.token, metodo: 'POST', corpo: { currentPassword: SENHA, newPassword: SENHA } });
  confere('nova senha igual à atual: 400', r.status === 400, `HTTP ${r.status}`);
  r = await api('/api/change-password', { metodo: 'POST', corpo: { currentPassword: SENHA, newPassword: 'nova-senha-123' } });
  confere('sem token: 401', r.status === 401, `HTTP ${r.status}`);
  await dormir(2200); // o token antigo precisa ter nascido antes da troca
  r = await api('/api/change-password', { token: U.token, metodo: 'POST', corpo: { currentPassword: SENHA, newPassword: 'nova-senha-123' } });
  confere('troca válida: 200 com token novo', r.status === 200 && r.dados?.success === true && !!r.dados?.token, `HTTP ${r.status}`);
  const tokenNovo = r.dados?.token;
  r = await api('/api/quota', { token: tokenNovo });
  confere('o token novo continua valendo', r.status !== 401, `HTTP ${r.status}`);
  r = await api('/api/quota', { token: tokenAntigo });
  confere('o token antigo cai (sessões antigas derrubadas)', r.status === 401, `HTTP ${r.status}`);
  r = await api('/api/auth', { metodo: 'POST', corpo: { email: U.email, password: SENHA } });
  confere('a senha antiga não entra mais', r.status === 401, `HTTP ${r.status}`);
  r = await api('/api/auth', { metodo: 'POST', corpo: { email: U.email, password: 'nova-senha-123' } });
  confere('a senha nova entra', r.status === 200, `HTTP ${r.status}`);
}

// ═════════════════════════════════════════════════════════════════════════════
if (rodar(9)) {
  secao('9. Papel e bloqueio valem pelo BANCO, não pelo token de 7 dias');
  const vale = async (c) => (await api('/api/quota', { token: c.token })).status;
  // Cada cenário: três pessoas logadas com a loja em dia; DEPOIS a loja muda de situação.
  const cenario = async (nome, mudar, { status = 'active', plano = 'combo_mensal' } = {}) => {
    const L = await loja(nome, { status, plano });
    const antes = [await vale(L.dono), await vale(L.gestor), await vale(L.func)];
    if (mudar) await q(mudar, [L.nome]);
    const depois = [await vale(L.dono), await vale(L.gestor), await vale(L.func)];
    return { L, antes, depois };
  };
  let c = await cenario('Ativa', null);
  confere('loja ativa: dono, gestor e funcionário entram (200)', c.depois.every((x) => x === 200), c.depois.join('/'));
  c = await cenario('EmTeste', null, { status: 'trial', plano: 'trial' });
  confere('loja em teste (dia 5 de 7): todos entram (200)', c.depois.every((x) => x === 200), c.depois.join('/'));
  c = await cenario('SemValidade', "UPDATE users SET expiration_date = NULL WHERE store = $1");
  confere('loja ativa sem data de validade: todos entram (200)', c.depois.every((x) => x === 200), c.depois.join('/'));
  const mestre = await api('/api/codigos-ativacao', { token: master.token }); // rota só do master
  confere('master entra (200)', mestre.status === 200, `HTTP ${mestre.status}`);
  c = await cenario('Bloqueada', "UPDATE users SET status = 'blocked' WHERE store = $1 AND role = 'admin'");
  confere('loja bloqueada depois do login: dono, gestor e funcionário caem (401)', c.antes.every((x) => x === 200) && c.depois.every((x) => x === 401), `antes ${c.antes} / depois ${c.depois}`);
  c = await cenario('Vencida', "UPDATE users SET expiration_date = NOW() - INTERVAL '1 day' WHERE store = $1 AND role = 'admin'");
  confere('plano vencido depois do login: todos caem (401)', c.depois.every((x) => x === 401), `depois ${c.depois}`);
  c = await cenario('TesteAcabou', "UPDATE users SET created_at = NOW() - INTERVAL '10 days' WHERE store = $1 AND role = 'admin'", { status: 'trial', plano: 'trial' });
  confere('teste vencido depois do login: todos caem (401)', c.depois.every((x) => x === 401), `depois ${c.depois}`);
  c = await cenario('TesteEstendido', "UPDATE users SET created_at = NOW() - INTERVAL '10 days', trial_ends_at = NOW() + INTERVAL '5 days' WHERE store = $1 AND role = 'admin'", { status: 'trial', plano: 'trial' });
  confere('teste estendido pelo suporte (trial_ends_at no futuro): continua entrando', c.depois.every((x) => x === 200), `depois ${c.depois}`);
  c = await cenario('Pendente', "UPDATE users SET status = 'pending' WHERE store = $1 AND role = 'admin'");
  confere('pagamento pendente: todos caem (401), como no login', c.depois.every((x) => x === 401), `depois ${c.depois}`);
  // O login continua recusando com a mesma regra (a régua é uma só).
  const bloqueado = await api('/api/auth', { metodo: 'POST', corpo: { email: c.L.func.email, password: SENHA } });
  confere('o login da mesma loja pendente também recusa (403)', bloqueado.status === 403, `HTTP ${bloqueado.status}`);

  // Papel: o gestor rebaixado a funcionário perde o poder na hora.
  const L = await loja('Rebaixa');
  let r = await api(`/api/users/${L.func.id}`, { token: L.gestor.token, metodo: 'PUT', corpo: { name: 'Antes Do Rebaixamento' } });
  confere('gestor edita funcionário (200) antes do rebaixamento', r.status === 200, `HTTP ${r.status}`);
  await q("UPDATE users SET role = 'funcionario' WHERE id = $1", [L.gestor.id]);
  r = await api(`/api/users/${L.func.id}`, { token: L.gestor.token, metodo: 'PUT', corpo: { name: 'Depois Do Rebaixamento' } });
  const nome = await col('SELECT name FROM users WHERE id = $1', [L.func.id]);
  confere('gestor REBAIXADO com o token antigo não edita mais ninguém (403)', r.status === 403 && nome.name === 'Antes Do Rebaixamento', `HTTP ${r.status}, nome: ${nome.name}`);
}

// ═════════════════════════════════════════════════════════════════════════════
/** Loja com WhatsApp próprio "conectado" (o gateway é o servidor falso) e telefones só dela. */
async function lojaComWhatsapp(nome) {
  const L = await loja(nome);
  // Números só desta rodada: os crons varrem TODAS as lojas do banco, inclusive as de rodadas anteriores.
  const tel = (n) => `219${(Number.parseInt(RODADA, 36) % 100000).toString().padStart(5, '0')}${((seq * 10 + n) % 1000).toString().padStart(3, '0')}`;
  L.fones = { dono: tel(1), gestor: tel(2), func: tel(3) };
  await q('UPDATE users SET phone = $2::varchar, whatsapp_phone = $2::varchar, whatsapp_loja = $3::jsonb WHERE id = $1', [L.dono.id, L.fones.dono, JSON.stringify({ instancia: 'loja-falsa', conectado: true })]);
  await q('UPDATE users SET phone = $2::varchar, whatsapp_phone = $2::varchar WHERE id = $1', [L.gestor.id, L.fones.gestor]);
  await q('UPDATE users SET phone = $2::varchar, whatsapp_phone = $2::varchar WHERE id = $1', [L.func.id, L.fones.func]);
  return L;
}
const paraEle = (L, quem, filtro = () => true) => caixa.whatsapp.filter((m) => String(m.numero).endsWith(L.fones[quem]) && filtro(m));
const hhmmSP = (deslocMin = 0, base = 0) => {
  const d = new Date(Date.now() + (base + deslocMin) * 60000);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' });
};

if (rodar(8) || rodar(21)) {
  secao('8/21. Crons: aviso uma vez por dia (loja, tipo); atraso de checklist com folga');
  // O relógio do servidor vai para as 14:00 de São Paulo de hoje: os crons dependem da hora do
  // dia, e o teste tem de dar o mesmo resultado às 00:01 ou às 23:50.
  const agoraSP = (() => { const [h, m] = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }).split(':').map(Number); return h * 60 + m; })();
  const DESLOC = 14 * 60 - agoraSP;
  const A = await subirCanais('relogio-14h', { sistemaEnvia: true, porta: 3195, deslocMin: DESLOC });
  limparCaixa();
  const cron = (caminho) => api(caminho, { base: A.base });
  // — Ausência de ponto.
  const L = await lojaComWhatsapp('Ausencia');
  await q("INSERT INTO ponto_records (user_id, user_name, store, type, timestamp) VALUES ($1, 'Func', $2, 'entrada', NOW() - INTERVAL '2 days')", [L.func.id, L.nome]);
  let r = await cron('/api/cron/ponto-ausencia');
  const aposPrimeira = paraEle(L, 'dono').length;
  confere('ponto-ausencia: a primeira chamada avisa o dono da ausência', r.status === 200 && aposPrimeira >= 1 && /não registraram entrada/.test(paraEle(L, 'dono')[0]?.texto || ''), `HTTP ${r.status}, mensagens ao dono: ${aposPrimeira}`);
  await cron('/api/cron/ponto-ausencia');
  await cron('/api/cron/ponto-ausencia');
  confere('ponto-ausencia: chamar de novo (mesmo dia, mesmos ausentes) NÃO reenvia', paraEle(L, 'dono').length === aposPrimeira && paraEle(L, 'gestor').length >= 1, `dono recebeu ${paraEle(L, 'dono').length} (esperado ${aposPrimeira})`);

  // — Checklist atrasado: dentro dos 30 min (dedupe) e 75 min depois do limite (folga).
  {
    const L2 = await lojaComWhatsapp('Atraso');
    const novo = async (titulo, deslocMin) => {
      const tarefas = [{ id: 1, text: 'Tarefa', type: 'boolean', timeLimit: hhmmSP(deslocMin, DESLOC), notifyDelay: true }];
      const { rows: [c] } = await q("INSERT INTO checklists (store, title, tasks, recurrence, category) VALUES ($1, $2, $3, 'daily', 'geral') RETURNING id", [L2.nome, titulo, JSON.stringify(tarefas)]);
      return c.id;
    };
    await novo('Checklist 20min', -20);
    await novo('Checklist 75min', -75);
    await novo('Checklist 3h', -180);
    await novo('Checklist futuro', 60);
    r = await cron('/api/cron/checklists-delayed');
    const avisos = (titulo) => paraEle(L2, 'dono', (m) => m.texto.includes(titulo)).length;
    confere('checklist 20 min atrasado: avisa o dono', r.status === 200 && avisos('Checklist 20min') === 1, `avisos: ${avisos('Checklist 20min')}`);
    confere('checklist 75 min atrasado (a rodada chegou tarde): AINDA avisa', avisos('Checklist 75min') === 1, `avisos: ${avisos('Checklist 75min')}`);
    confere('checklist 3 h atrasado (fora da janela) e o que vence daqui a 1 h: não avisam', avisos('Checklist 3h') === 0 && avisos('Checklist futuro') === 0);
    await cron('/api/cron/checklists-delayed');
    await cron('/api/cron/checklists-delayed');
    confere('chamar o cron de novo NÃO repete nenhum aviso (um por checklist e dia)', avisos('Checklist 20min') === 1 && avisos('Checklist 75min') === 1, `20min: ${avisos('Checklist 20min')}, 75min: ${avisos('Checklist 75min')}`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
if (rodar(10)) {
  secao('10. Reprocessar auditoria de IA: só submissão da própria loja');
  const A = await loja('AuditA');
  const B = await loja('AuditB');
  const submissao = async (L) => (await col("INSERT INTO checklist_submissions (employee_name, store, tasks, resolved) VALUES ('Alguém', $1, '[]', FALSE) RETURNING id", [L.nome])).id;
  const idDeB = await submissao(B);
  let r = await api('/api/process-audit-background', { token: A.func.token, metodo: 'POST', corpo: { submissionId: idDeB } });
  let b = await col('SELECT feedback_info FROM checklist_submissions WHERE id = $1', [idDeB]);
  confere('funcionário da loja A não reprocessa a submissão da loja B (403) e ela fica intacta', r.status === 403 && b.feedback_info === null, `HTTP ${r.status}, feedback_info de B: ${JSON.stringify(b.feedback_info)}`);
  const idDeA = await submissao(A);
  r = await api('/api/process-audit-background', { token: A.func.token, metodo: 'POST', corpo: { submissionId: idDeA } });
  b = await col('SELECT feedback_info FROM checklist_submissions WHERE id = $1', [idDeA]);
  confere('a própria loja continua reprocessando a sua (200)', r.status === 200 && b.feedback_info !== null, `HTTP ${r.status}`);
  r = await api('/api/process-audit-background', { token: master.token, metodo: 'POST', corpo: { submissionId: idDeB } });
  confere('master (suporte) continua alcançando qualquer loja (200)', r.status === 200, `HTTP ${r.status}`);
}

// ═════════════════════════════════════════════════════════════════════════════
if (rodar(11) || rodar(12)) {
  secao('11/12. Webhook da Cakto: status por palavra inteira; segredo fora do log');
  const evento = (e, status, extra = {}) => ({ data: { status, customer: { email: e, name: 'Cliente' }, product: { name: 'Checklist inteligente mensal' }, ...extra } });
  const pendente = async (nome) => conta({ papel: 'admin', loja: `${nome} ${RODADA}`, status: 'pending', plano: 'checklists_mensal' });
  for (const falso of ['unpaid', 'disapproved', 'unauthorized', 'inactive']) {
    const c = await pendente(`Falso-${falso}`);
    await api('/api/webhooks/cakto', { metodo: 'POST', corpo: evento(c.email, falso) });
    const depois = await col('SELECT status FROM users WHERE id = $1', [c.id]);
    confere(`status "${falso}" NÃO ativa a conta`, depois.status === 'pending', `status: ${depois.status}`);
  }
  for (const bom of ['paid', 'approved', 'purchase_approved', 'charge.paid']) {
    const c = await pendente(`Bom-${bom}`);
    await api('/api/webhooks/cakto', { metodo: 'POST', corpo: evento(c.email, bom) });
    const depois = await col('SELECT status, expiration_date FROM users WHERE id = $1', [c.id]);
    confere(`status "${bom}" continua ativando`, depois.status === 'active' && !!depois.expiration_date, `status: ${depois.status}`);
  }
  for (const mau of ['canceled', 'cancelled', 'refunded', 'chargeback', 'subscription.canceled']) {
    const c = await conta({ papel: 'admin', loja: `Mau-${mau} ${RODADA}`, status: 'active', plano: 'checklists_mensal' });
    await api('/api/webhooks/cakto', { metodo: 'POST', corpo: evento(c.email, mau) });
    const depois = await col('SELECT status FROM users WHERE id = $1', [c.id]);
    confere(`status "${mau}" continua bloqueando`, depois.status === 'blocked', `status: ${depois.status}`);
  }
  // O segredo do corpo não pode ir para o banco de logs. (A tabela webhook_logs não é criada
  // pelo api/index.js, só existe em produção: aqui ela é criada, no banco descartável, só para o teste.)
  await q('CREATE TABLE IF NOT EXISTS webhook_logs (id SERIAL PRIMARY KEY, payload TEXT, created_at TIMESTAMP DEFAULT NOW())');
  const quem = email('log-segredo');
  const SEGREDO = `segredo-${RODADA}-nao-gravar`;
  await api('/api/webhooks/cakto', { metodo: 'POST', corpo: { ...evento(quem, 'paid', { secret: SEGREDO }), secret: SEGREDO } });
  const log = await col("SELECT COUNT(*)::int AS n FROM webhook_logs WHERE payload::text LIKE $1", [`%${SEGREDO}%`]);
  const logDoEvento = await col("SELECT COUNT(*)::int AS n FROM webhook_logs WHERE payload::text LIKE $1", [`%${quem}%`]);
  confere('o webhook foi registrado em webhook_logs, mas sem o segredo', logDoEvento.n >= 1 && log.n === 0, `com o evento: ${logDoEvento.n}, com o segredo: ${log.n}`);
}

// ═════════════════════════════════════════════════════════════════════════════
async function escala(L, { tipo = 'fixed', entrada = '08:00', saida = '17:00', almoco = ['12:00', '13:00'] } = {}) {
  const { rows: [e] } = await q(
    `INSERT INTO work_schedules (store, name, type, hora_entrada, hora_saida, intervalo_inicio, intervalo_fim, tolerancia, saturday_active, sunday_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 10, TRUE, TRUE) RETURNING id`,
    [L.nome, `Escala ${tipo} ${seq++}`, tipo, entrada, saida, almoco?.[0] || null, almoco?.[1] || null]
  );
  return e.id;
}
const batida = (uid, nome, L, tipo, quando) => q("INSERT INTO ponto_records (user_id, user_name, store, type, timestamp) VALUES ($1, $2, $3, $4, $5)", [uid, nome, L.nome, tipo, quando]);

if (rodar(13)) {
  secao('13. Banco de horas: almoço não vira hora extra');
  const L = await loja('Banco');
  const esc = await escala(L);
  await q('UPDATE users SET schedule_id = $2 WHERE id = $1', [L.func.id, esc]);
  // seg 02/11: só entrada e saída (08–17) · ter 03/11: quatro batidas (08–12, 13–17) · qua 04/11: 08–12 (meio expediente)
  // qui 05/11: entrada 13:00 e saída 17:00 (par que NÃO cobre o almoço) · sex 06/11: 08–17 com almoço batido de verdade
  await batida(L.func.id, 'Func', L, 'entrada', '2026-11-02 08:00:00'); await batida(L.func.id, 'Func', L, 'saida', '2026-11-02 17:00:00');
  for (const [t, h] of [['entrada', '08:00'], ['saida', '12:00'], ['entrada', '13:00'], ['saida', '17:00']]) await batida(L.func.id, 'Func', L, t, `2026-11-03 ${h}:00`);
  await batida(L.func.id, 'Func', L, 'entrada', '2026-11-04 08:00:00'); await batida(L.func.id, 'Func', L, 'saida', '2026-11-04 12:00:00');
  await batida(L.func.id, 'Func', L, 'entrada', '2026-11-05 13:00:00'); await batida(L.func.id, 'Func', L, 'saida', '2026-11-05 17:00:00');
  const r = await api(`/api/ponto/saldo?userId=${L.func.id}&inicio=2026-11-02&fim=2026-11-05`, { token: L.gestor.token });
  const dia = (d) => r.dados?.funcionarios?.[0]?.dias?.find((x) => x.data === d);
  confere('GET /api/ponto/saldo responde 200', r.status === 200, `HTTP ${r.status}`);
  confere('08:00–17:00 com um único par: trabalhado 8 h (o almoço sai) e saldo 0', dia('2026-11-02')?.trabalhado_min === 480 && dia('2026-11-02')?.saldo_min === 0, `trabalhado ${dia('2026-11-02')?.trabalhado_min}, saldo ${dia('2026-11-02')?.saldo_min}`);
  confere('quatro batidas (almoço batido): 8 h e saldo 0, como antes', dia('2026-11-03')?.trabalhado_min === 480 && dia('2026-11-03')?.saldo_min === 0, `trabalhado ${dia('2026-11-03')?.trabalhado_min}, saldo ${dia('2026-11-03')?.saldo_min}`);
  confere('meio expediente (08–12): 4 h e saldo -4 h, como antes', dia('2026-11-04')?.trabalhado_min === 240 && dia('2026-11-04')?.saldo_min === -240, `trabalhado ${dia('2026-11-04')?.trabalhado_min}, saldo ${dia('2026-11-04')?.saldo_min}`);
  confere('par que não cobre o almoço (13–17): nada é descontado', dia('2026-11-05')?.trabalhado_min === 240 && dia('2026-11-05')?.saldo_min === -240, `trabalhado ${dia('2026-11-05')?.trabalhado_min}`);
  confere('os totais do período batem com os dias', r.dados?.funcionarios?.[0]?.totais?.saldo_min === -480, `saldo total ${r.dados?.funcionarios?.[0]?.totais?.saldo_min}`);
}

// ═════════════════════════════════════════════════════════════════════════════
if (rodar(14)) {
  secao('14. Escala 12x36 também vale no cron de ausência');
  const dia = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const agoraSP = (() => { const [h, m] = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }).split(':').map(Number); return h * 60 + m; })();
  const A = await subirCanais('relogio-14h', { sistemaEnvia: true, porta: 3195, deslocMin: 14 * 60 - agoraSP });
  limparCaixa();
  const L = await lojaComWhatsapp('Doze36');
  const esc = await escala(L, { tipo: '12x36', entrada: '07:00', saida: '19:00', almoco: null });
  const trabalha = await conta({ nome: 'Escalado Hoje', papel: 'funcionario', loja: L.nome });
  const folga = await conta({ nome: 'Folguista Hoje', papel: 'funcionario', loja: L.nome });
  await q('UPDATE users SET schedule_id = $2, ponto_last_worked_day = $3 WHERE id = $1', [trabalha.id, esc, dia(0)]);   // trabalhou hoje (cadência par)
  await q('UPDATE users SET schedule_id = $2, ponto_last_worked_day = $3 WHERE id = $1', [folga.id, esc, dia(-1)]);      // trabalhou ontem: hoje é a folga dele
  await q("UPDATE users SET schedule_id = NULL, ponto_hora_entrada = '23:00', ponto_hora_saida = '23:30' WHERE id IN ($1, $2)", [L.func.id, L.gestor.id]); // os outros não entram na conta
  await q("INSERT INTO ponto_records (user_id, user_name, store, type, timestamp) VALUES ($1, 'Func', $2, 'entrada', NOW() - INTERVAL '2 days')", [L.func.id, L.nome]);
  await q("DELETE FROM users WHERE id IN ($1, $2)", [L.func.id, L.gestor.id]);
  const r = await api('/api/cron/ponto-ausencia', { base: A.base });
  const texto = paraEle(L, 'dono')[0]?.texto || '';
  confere('o cron avisa quem é de trabalhar hoje e não bateu', r.status === 200 && texto.includes('Escalado Hoje'), `texto: ${texto.split('\n').join(' ').slice(0, 140)}`);
  confere('o cron NÃO avisa quem está na folga da 12x36', !texto.includes('Folguista Hoje'), texto.includes('Folguista Hoje') ? 'o folguista apareceu na lista de ausentes' : '');
}

// ═════════════════════════════════════════════════════════════════════════════
if (rodar(15)) {
  secao('15. Fuso horário inválido não derruba a batida nem os crons');
  const L = await loja('Fuso');
  let r = await api(`/api/users/${L.dono.id}`, { token: L.dono.token, metodo: 'PUT', corpo: { timezone: 'Brasil', name: 'Nome com fuso ruim' } });
  let d = await col('SELECT timezone, name FROM users WHERE id = $1', [L.dono.id]);
  confere('PUT com timezone "Brasil" é recusado (400) e nada é gravado', r.status === 400 && d.timezone !== 'Brasil' && d.name !== 'Nome com fuso ruim', `HTTP ${r.status}, timezone: ${d.timezone}`);
  r = await api(`/api/users/${L.dono.id}`, { token: L.dono.token, metodo: 'PUT', corpo: { timezone: 'America/Manaus' } });
  d = await col('SELECT timezone FROM users WHERE id = $1', [L.dono.id]);
  confere('um fuso de verdade (America/Manaus) continua sendo aceito', r.status === 200 && d.timezone === 'America/Manaus', `HTTP ${r.status}`);

  // Uma loja que JÁ está com o fuso estragado no banco (gravado antes desta correção).
  const ruim = await loja('FusoRuim');
  await q("UPDATE users SET timezone = 'Brasil' WHERE id = $1", [ruim.dono.id]);
  r = await api('/api/ponto', { token: ruim.func.token, metodo: 'POST', corpo: { type: 'entrada', latitude: -22.5, longitude: -41.9, accuracy: 10, store: ruim.nome } });
  confere('a batida da loja com fuso estragado funciona (200), em vez de 500', r.status === 200, `HTTP ${r.status}`);
  r = await api(`/api/ponto/today?userId=${ruim.func.id}&store=${encodeURIComponent(ruim.nome)}`, { token: ruim.func.token });
  confere('a tela do ponto dessa loja também abre (200)', r.status === 200, `HTTP ${r.status}`);

  // O cron de ausência passa por uma loja ruim e ainda avisa a boa.
  const agoraSP = (() => { const [h, m] = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }).split(':').map(Number); return h * 60 + m; })();
  const A = await subirCanais('relogio-14h', { sistemaEnvia: true, porta: 3195, deslocMin: 14 * 60 - agoraSP });
  limparCaixa();
  const boa = await lojaComWhatsapp('FusoBoa');
  await q("INSERT INTO ponto_records (user_id, user_name, store, type, timestamp) VALUES ($1, 'Func', $2, 'entrada', NOW() - INTERVAL '2 days')", [boa.func.id, boa.nome]);
  r = await api('/api/cron/ponto-ausencia', { base: A.base });
  confere('o cron de ausência responde 200 mesmo com uma loja de fuso estragado', r.status === 200, `HTTP ${r.status}`);
  confere('e a loja de fuso bom recebe o aviso dela', paraEle(boa, 'dono').length === 1, `mensagens ao dono: ${paraEle(boa, 'dono').length}`);
}

// ═════════════════════════════════════════════════════════════════════════════
if (rodar(16)) {
  secao('16. Compras: só gestão cria/edita/apaga; edição é atômica');
  const L = await loja('Compras');
  const lista = { title: 'Lista da semana', recurrence: 'weekly', items: [{ name: 'Farinha', unit: 'kg', minStock: 10 }, { name: 'Queijo', unit: 'kg', minStock: 4 }] };
  let r = await api('/api/shopping', { token: L.func.token, metodo: 'POST', corpo: lista });
  confere('funcionário NÃO cria lista de compras (403)', r.status === 403, `HTTP ${r.status}`);
  r = await api('/api/shopping', { token: L.gestor.token, metodo: 'POST', corpo: lista });
  const id = r.dados?.id;
  confere('gestor cria a lista (200) com os dois itens', r.status === 200 && r.dados?.items?.length === 2, `HTTP ${r.status}`);
  r = await api(`/api/shopping/${id}`, { token: L.func.token, metodo: 'DELETE' });
  const ativa = await col('SELECT active FROM shopping_lists WHERE id = $1', [id]);
  confere('funcionário NÃO apaga a lista (403) e ela segue ativa', r.status === 403 && ativa.active === true, `HTTP ${r.status}, active: ${ativa.active}`);
  r = await api('/api/shopping', { token: L.func.token, metodo: 'POST', corpo: { ...lista, id, title: 'Reescrita pelo funcionário', items: [] } });
  const titulo = await col('SELECT title FROM shopping_lists WHERE id = $1', [id]);
  confere('funcionário NÃO reescreve itens e mínimos (403)', r.status === 403 && titulo.title === 'Lista da semana', `HTTP ${r.status}`);
  r = await api('/api/shopping', { token: L.gestor.token, metodo: 'POST', corpo: { ...lista, id, items: [{ name: 'Farinha', unit: 'kg', minStock: 'dez' }] } });
  let itens = await col('SELECT COUNT(*)::int AS n FROM shopping_items WHERE shopping_list_id = $1', [id]);
  confere('mínimo não numérico: 400 e a lista continua com os 2 itens', r.status === 400 && itens.n === 2, `HTTP ${r.status}, itens: ${itens.n}`);
  // Falha NO MEIO da gravação (unidade maior que a coluna aceita): nada pode ficar pela metade.
  r = await api('/api/shopping', { token: L.gestor.token, metodo: 'POST', corpo: { ...lista, id, items: [{ name: 'Novo 1', unit: 'kg', minStock: 1 }, { name: 'Novo 2', unit: 'u'.repeat(80), minStock: 1 }] } });
  itens = await col("SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE name IN ('Farinha', 'Queijo'))::int AS antigos FROM shopping_items WHERE shopping_list_id = $1", [id]);
  confere('falha no meio da edição: tudo volta ao que era (os 2 itens antigos, nenhum novo)', r.status >= 400 && itens.n === 2 && itens.antigos === 2, `HTTP ${r.status}, itens: ${itens.n} (antigos: ${itens.antigos})`);
  r = await api('/api/shopping', { token: L.gestor.token, metodo: 'POST', corpo: { ...lista, id, items: [{ name: 'Farinha', unit: 'kg', minStock: 12 }, { name: 'Ovos', unit: 'cx', minStock: 3 }] } });
  itens = await col('SELECT COUNT(*)::int AS n FROM shopping_items WHERE shopping_list_id = $1', [id]);
  confere('edição normal do gestor continua funcionando (200, 2 itens)', r.status === 200 && itens.n === 2, `HTTP ${r.status}`);
  r = await api(`/api/shopping/${id}`, { token: L.gestor.token, metodo: 'DELETE' });
  confere('gestor desativa a lista (200)', r.status === 200, `HTTP ${r.status}`);
}

// ═════════════════════════════════════════════════════════════════════════════
if (rodar(17)) {
  secao('17. /api/whatsapp/testar só para admin/gestor');
  const L = await loja('Testar');
  let r = await api('/api/whatsapp/testar', { token: L.func.token, metodo: 'POST', corpo: { telefone: '21999998888' } });
  confere('funcionário não dispara o teste (403)', r.status === 403, `HTTP ${r.status}`);
  r = await api('/api/whatsapp/testar', { token: L.gestor.token, metodo: 'POST', corpo: { telefone: 'abc' } });
  confere('gestor continua usando o teste (200, avisa que o número é inválido)', r.status === 200 && r.dados?.ok === false, `HTTP ${r.status}`);
  r = await api('/api/whatsapp/testar', { token: L.dono.token, metodo: 'POST', corpo: { telefone: 'abc' } });
  confere('dono continua usando o teste (200)', r.status === 200, `HTTP ${r.status}`);
}

// ═════════════════════════════════════════════════════════════════════════════
if (rodar(18)) {
  secao('18. Ocorrências: o dia vai de 00:00 a 23:59 (hora de São Paulo)');
  const L = await loja('Ocorrencias');
  const grava = (quando, descricao) => q("INSERT INTO ocorrencias (store, tipo, employee_name, descricao, created_at) VALUES ($1, 'ocorrencia', 'Alguém', $2, $3)", [L.nome, descricao, quando]);
  await grava('2026-11-09 23:30:00', 'antes-do-dia');
  await grava('2026-11-10 00:20:00', 'madrugada');
  await grava('2026-11-10 02:59:00', 'madrugada-tardia');
  await grava('2026-11-10 14:00:00', 'tarde');
  await grava('2026-11-10 23:59:30', 'fim-do-dia');
  await grava('2026-11-11 00:10:00', 'depois-do-dia');
  const r = await api('/api/ocorrencias?start=2026-11-10&end=2026-11-10', { token: L.gestor.token });
  const quais = (r.dados || []).map((o) => o.descricao).sort();
  const esperado = ['fim-do-dia', 'madrugada', 'madrugada-tardia', 'tarde'];
  confere('o filtro do dia 10/11 traz exatamente as 4 ocorrências desse dia', r.status === 200 && JSON.stringify(quais) === JSON.stringify(esperado), `vieram: ${quais.join(', ')}`);
}

// ═════════════════════════════════════════════════════════════════════════════
if (rodar(19)) {
  secao('19. /api/finalize: gateway lento não segura a resposta; limpeza fora do envio');
  const A = await subirCanais('com-whatsapp', { sistemaEnvia: true, porta: 3193 });
  limparCaixa();
  const L = await lojaComWhatsapp('Finalize');
  const envio = (extra = {}) => api('/api/finalize', { base: A.base, token: L.func.token, metodo: 'POST', corpo: { employeeName: 'Func Finalize', tasks: [{ id: 1, text: 'Tarefa', type: 'boolean', done: true }], feedbackInfo: {}, ...extra } });
  // O checklist antigo (100 dias) já na loja, para ver quem o apaga.
  await q("INSERT INTO checklist_submissions (employee_name, store, tasks, created_at) VALUES ('Antigo', $1, '[]', NOW() - INTERVAL '100 days')", [L.nome]);
  let r = await envio();
  confere('envio normal (200) e o dono recebe o aviso no WhatsApp', r.status === 200 && paraEle(L, 'dono').length >= 1, `HTTP ${r.status}, avisos ao dono: ${paraEle(L, 'dono').length}`);
  const antigo = await col("SELECT COUNT(*)::int AS n FROM checklist_submissions WHERE employee_name = 'Antigo' AND store = $1", [L.nome]);
  confere('o envio NÃO apaga mais submissões antigas de todas as lojas', antigo.n === 1, `submissão de 100 dias ainda existe: ${antigo.n === 1}`);
  // A limpeza roda uma vez por dia (marca em avisos_enviados): em reexecuções do teste no mesmo dia, zera a marca.
  await q("DELETE FROM avisos_enviados WHERE tipo = 'limpeza_submissoes_90_dias'").catch(() => {});
  await api('/api/cron/ponto-diario', { base: A.base });
  const depois = await col("SELECT COUNT(*)::int AS n FROM checklist_submissions WHERE employee_name = 'Antigo' AND store = $1", [L.nome]);
  confere('a limpeza de 90 dias acontece no cron diário', depois.n === 0, `ainda existe: ${depois.n}`);
  // Gateway que nunca responde.
  caixa.whatsappLento = true;
  const L2 = await lojaComWhatsapp('FinalizeLento');
  const t0 = Date.now();
  const lento = await Promise.race([
    api('/api/finalize', { base: A.base, token: L2.func.token, metodo: 'POST', corpo: { employeeName: 'Func', tasks: [{ id: 1, text: 'Tarefa', type: 'boolean', done: true }], feedbackInfo: {} } }),
    new Promise((ok) => setTimeout(() => ok({ status: 'sem resposta em 25 s' }), 25000)),
  ]);
  const seg = Math.round((Date.now() - t0) / 1000);
  confere('gateway de WhatsApp parado: a resposta ao funcionário sai em menos de 20 s (200)', lento.status === 200 && seg < 20, `HTTP ${lento.status} em ${seg} s`);
  caixa.whatsappLento = false;
  // fcm_token: o push de reprovação nunca saía porque a consulta da cota não trazia a coluna.
  const fonte = fs.readFileSync(path.join(RAIZ, 'api/index.js'), 'utf8');
  const inicioDaConsulta = fonte.indexOf('SELECT id, checklist_limit, checklists_used, quota_reset_date, status, plan, role');
  const consulta = inicioDaConsulta < 0 ? '' : fonte.slice(inicioDaConsulta, fonte.indexOf('LIMIT 1', inicioDaConsulta));
  confere('(estático) a consulta de cota do finalize lê fcm_token, que o push usa', consulta.includes('fcm_token'), consulta ? '' : 'consulta não encontrada');
}

// ═════════════════════════════════════════════════════════════════════════════
if (rodar(20)) {
  secao('20. Batida do app: guarda de 60 s e entrada sobre entrada em aberto');
  const L = await loja('Duplicada');
  const gps = { latitude: -22.5, longitude: -41.9, accuracy: 10 };
  const bate = (c, type) => api('/api/ponto', { token: c.token, metodo: 'POST', corpo: { ...gps, type, store: L.nome } });
  const contaPonto = (c) => col("SELECT COUNT(*)::int AS n FROM ponto_records WHERE user_id = $1", [c.id]).then((x) => x.n);
  // Duplo toque.
  let r = await bate(L.func, 'entrada');
  confere('primeira entrada: 200', r.status === 200, `HTTP ${r.status}`);
  r = await bate(L.func, 'entrada');
  confere('a MESMA batida de novo dentro de 60 s: 409 e nada gravado', r.status === 409 && (await contaPonto(L.func)) === 1, `HTTP ${r.status}, batidas: ${await contaPonto(L.func)}`);
  r = await bate(L.func, 'saida');
  confere('até a saída logo depois da entrada (menos de 60 s) é recusada: 409', r.status === 409, `HTTP ${r.status}`);
  // Entrada em aberto há 3 h (a batida de 60 s já passou).
  const aberta = await conta({ nome: 'Entrada aberta', papel: 'funcionario', loja: L.nome }); await entrar(aberta);
  await batida(aberta.id, 'Entrada aberta', L, 'entrada', (await col("SELECT ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '3 hours') AS t")).t);
  r = await bate(aberta, 'entrada');
  confere('nova ENTRADA com a anterior (de 3 h atrás) ainda aberta: 409', r.status === 409 && (await contaPonto(aberta)) === 1, `HTTP ${r.status}`);
  r = await bate(aberta, 'saida');
  confere('a SAÍDA dessa entrada aberta passa (200)', r.status === 200, `HTTP ${r.status}`);
  // Esqueceu a saída de ontem: a entrada de hoje não pode ficar travada.
  const esquecida = await conta({ nome: 'Esqueceu a saída', papel: 'funcionario', loja: L.nome }); await entrar(esquecida);
  await batida(esquecida.id, 'Esqueceu a saída', L, 'entrada', (await col("SELECT ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '20 hours') AS t")).t);
  r = await bate(esquecida, 'entrada');
  confere('saída esquecida há 20 h: a entrada de hoje passa (200)', r.status === 200, `HTTP ${r.status}`);
  // Volta do almoço: entrada depois de uma saída.
  const almoco = await conta({ nome: 'Almoço', papel: 'funcionario', loja: L.nome }); await entrar(almoco);
  const t = async (h) => (await col("SELECT ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') - ($1 || ' hours')::interval) AS t", [String(h)])).t;
  await batida(almoco.id, 'Almoço', L, 'entrada', await t(4)); await batida(almoco.id, 'Almoço', L, 'saida', await t(1));
  r = await bate(almoco, 'entrada');
  confere('volta do almoço (entrada depois de saída): 200', r.status === 200, `HTTP ${r.status}`);
}

// ═════════════════════════════════════════════════════════════════════════════
if (rodar(22)) {
  secao('22. Escopo de loja: veículos, finalize, e conta sem loja');
  const A = await loja('EscopoA');
  const B = await loja('EscopoB');
  const veiculo = async (L, placa) => (await col("INSERT INTO vehicles (store, plate, model, status) VALUES ($1, $2, 'Moto', 'ativo') RETURNING id", [L.nome, placa])).id;
  const veiculoDeA = await veiculo(A, 'AAA-0001');
  const veiculoDeB = await veiculo(B, 'BBB-0002');
  let r = await api('/api/vehicles/solicit', { token: A.func.token, metodo: 'POST', corpo: { vehicleId: veiculoDeB } });
  let v = await col('SELECT last_requested_at FROM vehicles WHERE id = $1', [veiculoDeB]);
  confere('solicitar o veículo de OUTRA loja: 404 e nada é marcado', r.status === 404 && v.last_requested_at === null, `HTTP ${r.status}`);
  r = await api('/api/vehicles/solicit', { token: A.func.token, metodo: 'POST', corpo: { vehicleId: veiculoDeA } });
  v = await col('SELECT last_requested_at FROM vehicles WHERE id = $1', [veiculoDeA]);
  confere('solicitar o veículo da própria loja continua funcionando (200)', r.status === 200 && v.last_requested_at !== null, `HTTP ${r.status}`);

  const checklistDeB = (await col("INSERT INTO checklists (store, title, tasks, recurrence, category) VALUES ($1, 'Checklist da B', '[]', 'daily', 'geral') RETURNING id", [B.nome])).id;
  const checklistDeA = (await col("INSERT INTO checklists (store, title, tasks, recurrence, category) VALUES ($1, 'Checklist da A', '[]', 'daily', 'geral') RETURNING id", [A.nome])).id;
  const tarefas = [{ id: 1, text: 'Tarefa', type: 'boolean', done: true }];
  r = await api('/api/finalize', { token: A.func.token, metodo: 'POST', corpo: { employeeName: 'Func', tasks: tarefas, feedbackInfo: {}, vehicleId: veiculoDeB } });
  let feitos = await col('SELECT COUNT(*)::int AS n FROM checklist_submissions WHERE vehicle_id = $1', [veiculoDeB]);
  confere('enviar vistoria com o veículo de outra loja: 403 e nada gravado', r.status === 403 && feitos.n === 0, `HTTP ${r.status}, gravadas: ${feitos.n}`);
  r = await api('/api/finalize', { token: A.func.token, metodo: 'POST', corpo: { employeeName: 'Func', tasks: tarefas, feedbackInfo: {}, checklistId: checklistDeB } });
  feitos = await col('SELECT COUNT(*)::int AS n FROM checklist_submissions WHERE checklist_id = $1', [checklistDeB]);
  confere('enviar com o checklist de outra loja: 403 e nada gravado', r.status === 403 && feitos.n === 0, `HTTP ${r.status}, gravadas: ${feitos.n}`);
  r = await api('/api/finalize', { token: A.func.token, metodo: 'POST', corpo: { employeeName: 'Func', tasks: tarefas, feedbackInfo: {}, checklistId: checklistDeA } });
  confere('enviar o checklist da própria loja continua funcionando (200)', r.status === 200, `HTTP ${r.status}`);
  r = await api('/api/finalize', { token: A.func.token, metodo: 'POST', corpo: { employeeName: 'Func', tasks: tarefas, feedbackInfo: {}, checklistId: 99999999 } });
  confere('checklist que não existe mais (fila offline) segue aceito (200)', r.status === 200, `HTTP ${r.status}`);

  // Conta sem loja (store nulo): antes o filtro sumia e a consulta somava todas as lojas.
  await q('INSERT INTO store_cameras (store, name, url) VALUES ($1, $2, $3)', [A.nome, 'Cam A', 'rtsp://a']);
  const semLoja = await entrar(await conta({ nome: 'Sem loja', papel: 'funcionario', loja: null }));
  const lista = async (caminho) => api(caminho, { token: semLoja.token });
  r = await lista('/api/stats');
  confere('/api/stats sem loja: zeros, não a soma de todas as lojas', r.status === 200 && r.dados?.colaboradores === 0 && r.dados?.concluidos === 0, JSON.stringify(r.dados));
  r = await lista('/api/submissions');
  confere('/api/submissions sem loja: lista vazia', r.status === 200 && Array.isArray(r.dados) && r.dados.length === 0, `HTTP ${r.status}, itens: ${Array.isArray(r.dados) ? r.dados.length : '?'}`);
  r = await lista('/api/cameras');
  confere('/api/cameras sem loja: lista vazia', r.status === 200 && Array.isArray(r.dados) && r.dados.length === 0, `HTTP ${r.status}, itens: ${Array.isArray(r.dados) ? r.dados.length : '?'}`);
  r = await api('/api/stats', { token: A.dono.token });
  confere('a loja com cadastro normal continua vendo os números dela (200)', r.status === 200 && r.dados?.colaboradores === 2, JSON.stringify(r.dados));
}

// ═════════════════════════════════════════════════════════════════════════════
if (rodar(23)) {
  secao('23. Métricas só para o master; limite de corpo do container');
  const L = await loja('Metricas');
  for (const rota of ['/api/live-visitors', '/api/quiz-stats']) {
    let r = await api(rota);
    confere(`${rota} sem login: 401`, r.status === 401, `HTTP ${r.status}`);
    r = await api(rota, { token: L.dono.token });
    confere(`${rota} com login de cliente (dono): 403`, r.status === 403, `HTTP ${r.status}`);
    r = await api(rota, { token: master.token });
    confere(`${rota} com o master: 200`, r.status === 200, `HTTP ${r.status}`);
  }
  let r = await api('/api/track-event', { metodo: 'POST', corpo: { sessionId: `s-${RODADA}`, eventType: 'click', eventData: { lixo: 'x'.repeat(20000) }, page: '/', deviceType: 'mobile' } });
  confere('evento público gigante (20 KB): 413, não grava', r.status === 413, `HTTP ${r.status}`);
  r = await api('/api/track-event', { metodo: 'POST', corpo: { sessionId: `s-${RODADA}`, eventType: 'click', eventData: { botao: 'ok' }, page: '/', deviceType: 'mobile' } });
  confere('evento público normal continua gravando (200)', r.status === 200, `HTTP ${r.status}`);

  // O limite do JSON é do server.js (container). Sobe o server.js desta pasta numa porta própria.
  process.env.TUTORIAL_IA_CHAVE = process.env.TUTORIAL_IA_CHAVE || 'fake';
  const argvDoTeste = process.argv; process.argv = argvDoTeste.slice(0, 2);
  const { ambiente } = await import(`file:///${RAIZ.split(path.sep).join('/')}/tutoriais/ambiente/ambiente.mjs`);
  process.argv = argvDoTeste;
  const a = ambiente(Number(process.env.TUTORIAL_AMBIENTE || 21));
  const filho = spawn(process.execPath, ['server.js'], { cwd: RAIZ, windowsHide: true, stdio: 'ignore', env: { ...process.env, ...a.doServidor, PORT: '3196' } });
  const containerUrl = 'http://127.0.0.1:3196';
  for (let i = 0; i < 80; i++) { const p = await fetch(`${containerUrl}/healthz`).catch(() => null); if (p) break; await dormir(500); }
  const grande = (mb) => JSON.stringify({ email: 'ninguem@auditoria.local', password: 'a'.repeat(mb * 1024 * 1024) });
  const post = (corpo) => fetch(`${containerUrl}/api/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-real-ip': `ip-${RODADA}-corpo${contadorDeIp++}` }, body: corpo }).then((x) => x.status).catch((e) => `erro ${e.cause?.code || e.message}`);
  const seis = await post(grande(6));
  const dezesseis = await post(grande(16));
  confere('container: corpo de 6 MB (um checklist com muitas fotos) ainda entra na API (não é 413)', seis !== 413 && typeof seis === 'number', `HTTP ${seis}`);
  confere('container: corpo de 16 MB é recusado (413)', dezesseis === 413, `HTTP ${dezesseis}`);
  try { filho.kill(); } catch { /* já saiu */ }
}

// ═════════════════════════════════════════════════════════════════════════════
if (rodar(25)) {
  secao('25. Itens menores: erro 500 sem detalhe do banco, escala de outra loja, anexo, assignedTo');
  const A = await loja('MenoresA');
  const B = await loja('MenoresB');
  // — erro interno sem o texto do Postgres
  const lista = (unit) => ({ title: 'Lista', recurrence: 'weekly', items: [{ name: 'Item', unit, minStock: 1 }] });
  let r = await api('/api/shopping', { token: A.gestor.token, metodo: 'POST', corpo: lista('u'.repeat(80)) });
  const texto = JSON.stringify(r.dados);
  confere('falha do Postgres: 500 sem nome de coluna/tipo na resposta', r.status === 500 && !/character|varying|column|relation|violates|value too long/i.test(texto), `HTTP ${r.status} ${texto.slice(0, 100)}`);
  // — schedule_id de outra loja
  const escB = await escala(B);
  const escA = await escala(A);
  r = await api(`/api/users/${A.func.id}`, { token: A.gestor.token, metodo: 'PUT', corpo: { schedule_id: escB } });
  let d = await col('SELECT schedule_id FROM users WHERE id = $1', [A.func.id]);
  confere('gestor vincula o funcionário a uma escala de OUTRA loja: 403 e nada muda', r.status === 403 && d.schedule_id === null, `HTTP ${r.status}, schedule_id: ${d.schedule_id}`);
  r = await api(`/api/users/${A.func.id}`, { token: A.gestor.token, metodo: 'PUT', corpo: { schedule_id: escA } });
  d = await col('SELECT schedule_id FROM users WHERE id = $1', [A.func.id]);
  confere('escala da própria loja continua valendo (200)', r.status === 200 && d.schedule_id === escA, `HTTP ${r.status}`);
  r = await api(`/api/users/${A.func.id}`, { token: A.gestor.token, metodo: 'PUT', corpo: { schedule_id: null } });
  confere('desvincular a escala (null) continua valendo (200)', r.status === 200, `HTTP ${r.status}`);
  // — anexo do abono: HTML/SVG não entram no bucket público
  const abono = (arquivo) => api('/api/ponto/abonos', { token: A.gestor.token, metodo: 'POST', corpo: { tipo: 'atestado', userId: A.func.id, data: '2026-11-03', observacao: 'teste', ...(arquivo ? { arquivo } : {}) } });
  // (SEM_UPLOAD=1 pula os dois casos abaixo: no código antigo eles chegariam ao upload do Firebase, que é um serviço externo)
  if (!process.env.SEM_UPLOAD) {
  r = await abono('data:text/html;base64,PGgxPm9pPC9oMT4=');
  confere('anexo text/html: 400', r.status === 400, `HTTP ${r.status}`);
  r = await abono('data:image/svg+xml;base64,PHN2Zy8+');
  confere('anexo image/svg+xml: 400', r.status === 400, `HTTP ${r.status}`);
  }
  r = await abono(null);
  confere('abono sem anexo continua valendo (200)', r.status === 200, `HTTP ${r.status}`);
  // — assignedTo com JSON quebrado deixava de restringir e virava "toda a equipe"
  const ck = (assignedTo) => api('/api/checklists', { token: A.gestor.token, metodo: 'POST', corpo: { title: `Atribuído ${seq++}`, tasks: [{ id: 1, text: 'T', type: 'boolean' }], recurrence: 'daily', category: 'geral', assignedTo } });
  r = await ck('[ "joao@x.com"');
  confere('assignedTo com JSON quebrado: 400 (não vira "toda a equipe")', r.status === 400, `HTTP ${r.status}`);
  r = await ck([A.func.email]);
  confere('assignedTo com a lista de e-mails continua valendo (200) e fica gravado', r.status === 200 && String(r.dados?.assigned_to || '').includes(A.func.email), `HTTP ${r.status}`);
  r = await ck(null);
  confere('sem assignedTo (toda a equipe de propósito): 200', r.status === 200, `HTTP ${r.status}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// (as demais seções entram abaixo, uma por item da auditoria)

console.log(`\n${total - falhas}/${total} verificações ok${falhas ? `, ${falhas} FALHARAM` : ''}`);
pararTudo();
await db.end();
process.exit(falhas ? 1 : 0);
