// Teste dos códigos de ativação (venda no Mercado Livre), contra um ambiente
// local descartável (ver ambiente.mjs). Nada aqui encosta em produção.
//
//   npx vite build --outDir tutoriais/.dist --emptyOutDir
//   node tutoriais/ambiente/ambiente.mjs subir 12
//   node tutoriais/ambiente/teste-codigo-ativacao.mjs 12
//
// Cobre: lote pelo script e pela rota do master, conta nova, extensão sem perder
// dias, virar Combo, teste grátis, conta vencida, código repetido/inexistente/de
// outro produto, assinatura da Cakto do mesmo produto, limite de tentativas,
// dois resgates ao mesmo tempo, e o login liberando até a data e travando depois.
process.env.TZ = 'UTC'; // o mesmo fuso do servidor do ambiente (e da Vercel)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { chromium } from 'playwright';

const n = Number(process.argv[2] || 12);
const BASE = `http://127.0.0.1:${3170 + n}`;
const BANCO = `postgres://${['postgres', 'postgres'].join(':')}@127.0.0.1:${5470 + n}/postgres?sslmode=disable`;
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHROME = 'C:/Users/Micro/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const RODADA = Date.now().toString(36);
const DIA = 86400000;
// O servidor lê TIMESTAMP sem fuso como UTC (como na Vercel/Neon); o PGlite local
// herda o fuso do Windows. Hora "de agora" para gravar direto no banco:
const AGORA_UTC = "(NOW() AT TIME ZONE 'UTC')";

let falhas = 0, total = 0;
function confere(nome, ok, detalhe = '') {
  total += 1;
  if (!ok) falhas += 1;
  console.log(`${ok ? '  ok' : '  FALHOU'}  ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
}

// Cada cenário fala de uma "origem" própria, para o limite de tentativas de um
// não contaminar o outro (nem a rodada anterior).
async function api(caminho, { token, metodo = 'GET', corpo, ip = `ip-${RODADA}` } = {}) {
  const r = await fetch(BASE + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', 'x-real-ip': ip, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  let dados = null;
  try { dados = await r.json(); } catch { /* vazio */ }
  return { status: r.status, dados };
}
const email = (nome) => `${nome}-${RODADA}@teste.local`;
const login = (e, senha = 'senha123') => api('/api/auth', { metodo: 'POST', corpo: { email: e, password: senha } });
const ativarNova = (codigo, nome, extra = {}) => api('/api/ativar', {
  metodo: 'POST', corpo: { codigo, modo: 'nova', empresa: `Loja ${nome}`, nome: `Dono ${nome}`, email: email(nome), senha: 'senha123', whatsapp: '21999998888', ...extra },
});
const ativarExistente = (codigo, e, confirmar, extra = {}) => api('/api/ativar', {
  metodo: 'POST', corpo: { codigo, modo: 'existente', email: e, senha: 'senha123', confirmar, ...extra },
});
const perto = (a, b, ms = 120000) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= ms;

async function main() {
  const banco = new pg.Client({ connectionString: BANCO });
  await banco.connect();
  const conta = async (e) => (await banco.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [e])).rows[0];
  const naoUsado = async (c) => (await banco.query('SELECT usado_em FROM codigos_ativacao WHERE codigo = $1', [c])).rows[0]?.usado_em === null;

  // A primeira chamada cria as tabelas.
  await api('/api/ativar', { metodo: 'POST', corpo: { codigo: 'x' }, ip: `boot-${RODADA}` });

  // ── 1. Lote pelo script: grava no banco e cospe um código por linha ──
  console.log('\nLote pelo script');
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'codigos-'));
  const gerar = (produto, qtd, dias, nome) => {
    const arquivo = path.join(pasta, `${nome}.txt`);
    execFileSync(process.execPath, ['scripts/gerar-codigos.mjs', produto, String(qtd), String(dias), '--lote', `${nome}-${RODADA}`, '--saida', arquivo],
      { cwd: RAIZ, env: { ...process.env, DATABASE_URL: BANCO }, stdio: 'pipe' });
    return fs.readFileSync(arquivo, 'utf8').trim().split('\n');
  };
  const chk = gerar('checklists', 8, 30, 'chk');
  const pnt = gerar('ponto', 5, 30, 'pnt');
  confere('arquivo com um código por linha', chk.length === 8 && pnt.length === 5, `${chk.length} + ${pnt.length}`);
  confere('formato FC-CHK-XXXX-XXXX sem letras ambíguas', chk.every((c) => /^FC-CHK-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/.test(c)), chk[0]);
  confere('formato FC-PNT-...', pnt.every((c) => /^FC-PNT-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/.test(c)), pnt[0]);
  const { rows: gravados } = await banco.query('SELECT produto, dias, origem, lote FROM codigos_ativacao WHERE codigo = ANY($1)', [[...chk, ...pnt]]);
  confere('todos gravados no banco, 30 dias, origem mercadolivre', gravados.length === 13 && gravados.every((g) => g.dias === 30 && g.origem === 'mercadolivre'));

  // ── 2. Conta nova ──
  console.log('\nConta nova');
  const antes = Date.now();
  const nova = await ativarNova(chk[0].toLowerCase().replace(/-/g, ' '), 'nova'); // digitado do jeito que vier
  const ana = await conta(email('nova'));
  confere('cria a conta e já entra (token)', nova.status === 200 && !!nova.dados?.token, nova.dados?.error);
  confere('plano checklists_mensal, ativo, sem teste', ana?.plan === 'checklists_mensal' && ana?.status === 'active' && !ana?.trial_ends_at, `${ana?.plan}/${ana?.status}`);
  confere('validade = hoje + 30 dias', perto(ana?.expiration_date, antes + 30 * DIA), String(ana?.expiration_date));
  confere('ponto desligado no Checklist', ana?.ponto_active === false);
  confere('checklists ilimitados e 30 colaboradores', ana?.checklist_limit >= 999999 && ana?.ponto_limit === 30, `${ana?.checklist_limit}/${ana?.ponto_limit}`);
  confere('nome da empresa vira store_name', ana?.store_name === 'Loja nova');
  const { rows: [usado] } = await banco.query('SELECT * FROM codigos_ativacao WHERE codigo = $1', [chk[0]]);
  confere('código marcado com quem usou', !!usado.usado_em && usado.usado_por_user_id === ana?.id && usado.usado_por_email === email('nova'));
  confere('login entra', (await login(email('nova'))).status === 200);

  // ── 3. Erros de código ──
  console.log('\nCódigo errado');
  const rep = await ativarNova(chk[0], 'repetido');
  confere('código repetido: recusa e diz que já foi usado', rep.status === 409 && /já foi usado/.test(rep.dados?.error), rep.dados?.error);
  confere('código repetido não cria conta', !(await conta(email('repetido'))));
  const inex = await ativarNova('FC-CHK-2222-2222', 'inexistente');
  confere('código inexistente: 404 com mensagem clara', inex.status === 404 && /não encontrado/.test(inex.dados?.error), inex.dados?.error);
  const lixo = await ativarNova('ABC', 'lixo');
  confere('texto que nem é código: 400', lixo.status === 400, lixo.dados?.error);
  const outro = await ativarNova(pnt[0], 'outroproduto', { produto: 'checklists' });
  confere('código de outro produto: recusa e diz qual é', outro.status === 409 && /Controle de ponto/.test(outro.dados?.error), outro.dados?.error);
  confere('código de outro produto não é gasto', await naoUsado(pnt[0]));
  const dup = await ativarNova(chk[1], 'nova');
  confere('e-mail que já tem conta: manda usar "Já tenho conta"', dup.status === 409 && /Já tenho conta/.test(dup.dados?.error), dup.dados?.error);
  confere('e-mail repetido não gasta o código', await naoUsado(chk[1]));

  // ── 4. Conta existente: soma sem perder os dias que restam ──
  console.log('\nExtensão');
  const venceAntes = (await conta(email('nova'))).expiration_date;
  const pre = await ativarExistente(chk[1], email('nova'), false);
  confere('prévia antes de gastar', pre.dados?.status === 'previa' && await naoUsado(chk[1]), pre.dados?.explicacao);
  confere('prévia mostra vencimento atual + 30', new Date(pre.dados?.depois?.validade).getTime() === new Date(venceAntes).getTime() + 30 * DIA);
  const ext = await ativarExistente(chk[1], email('nova'), true);
  const anaExt = await conta(email('nova'));
  confere('confirma e soma exatamente 30 dias ao vencimento', ext.status === 200 && new Date(anaExt.expiration_date).getTime() === new Date(venceAntes).getTime() + 30 * DIA, String(anaExt.expiration_date));
  confere('plano continua checklists_mensal', anaExt.plan === 'checklists_mensal');

  // Checklist + Ponto vira Combo
  const venceAntes2 = anaExt.expiration_date;
  const preCombo = await ativarExistente(pnt[1], email('nova'), false);
  confere('prévia explica que vira Combo', /Combo/.test(preCombo.dados?.explicacao || ''), preCombo.dados?.explicacao);
  const combo = await ativarExistente(pnt[1], email('nova'), true);
  const anaCombo = await conta(email('nova'));
  confere('checklists + ponto = combo_mensal com ponto ligado', combo.status === 200 && anaCombo.plan === 'combo_mensal' && anaCombo.ponto_active === true, anaCombo.plan);
  confere('combo: 50 colaboradores e +30 dias', anaCombo.ponto_limit === 50 && new Date(anaCombo.expiration_date).getTime() === new Date(venceAntes2).getTime() + 30 * DIA);

  // ── 5. Teste grátis: os dias de teste que faltam não se perdem ──
  console.log('\nTeste grátis');
  const cad = await api('/api/signup', { metodo: 'POST', corpo: { name: 'Bia', email: email('teste'), password: 'senha123', store: `Loja teste ${RODADA}`, phone: '21988887777', plan: 'trial' } });
  const bia = await conta(email('teste'));
  const fimDoTeste = new Date(bia.created_at).getTime() + 7 * DIA;
  const tst = await ativarExistente(pnt[2], email('teste'), true);
  const biaDepois = await conta(email('teste'));
  confere('teste + código de ponto = ponto_mensal ativo', cad.status === 200 && tst.status === 200 && biaDepois.plan === 'ponto_mensal' && biaDepois.status === 'active' && biaDepois.ponto_active === true, tst.dados?.error);
  confere('vale do fim do teste + 30', perto(biaDepois.expiration_date, fimDoTeste + 30 * DIA), String(biaDepois.expiration_date));

  // ── 6. Conta vencida: login trava, o código destrava a partir de hoje ──
  console.log('\nVencida e login');
  await banco.query(`UPDATE users SET expiration_date = ${AGORA_UTC} - INTERVAL '3 days' WHERE id = $1`, [biaDepois.id]);
  const travado = await login(email('teste'));
  confere('vencida: login recusa com plan_expired', travado.status === 403 && travado.dados?.plan_expired === true);
  const agora = Date.now();
  const volta = await ativarExistente(pnt[3], email('teste'), true);
  const biaVolta = await conta(email('teste'));
  confere('vencida: código vale de hoje + 30 (não do vencimento velho)', volta.status === 200 && perto(biaVolta.expiration_date, agora + 30 * DIA), String(biaVolta.expiration_date));
  confere('login volta a entrar', (await login(email('teste'))).status === 200);
  // O relógio andando: um minuto antes do fim ainda entra; passou, trava.
  await banco.query(`UPDATE users SET expiration_date = ${AGORA_UTC} + INTERVAL '1 minute' WHERE id = $1`, [biaVolta.id]);
  confere('um minuto antes do vencimento: entra', (await login(email('teste'))).status === 200);
  await banco.query(`UPDATE users SET expiration_date = ${AGORA_UTC} - INTERVAL '1 second' WHERE id = $1`, [biaVolta.id]);
  const depois = await login(email('teste'));
  confere('passou do vencimento: bloqueia e manda renovar', depois.status === 403 && depois.dados?.plan_expired === true, depois.dados?.error);

  // ── 7. Quem não pode ──
  console.log('\nTravas');
  const senhaErrada = await api('/api/ativar', { metodo: 'POST', corpo: { codigo: chk[2], modo: 'existente', email: email('nova'), senha: 'errada', confirmar: true } });
  confere('senha errada: 401 e não gasta', senhaErrada.status === 401 && await naoUsado(chk[2]));
  const hash = await bcrypt.hash('senha123', 4);
  await banco.query("INSERT INTO users (name, email, password, role, store, status) VALUES ('Func', $1, $2, 'funcionario', $3, 'active')", [email('func'), hash, anaCombo.store]);
  const func = await ativarExistente(chk[2], email('func'), true);
  confere('funcionário não ativa código', func.status === 403 && await naoUsado(chk[2]), func.dados?.error);
  // Assinatura da Cakto do mesmo produto valendo: não gasta o código.
  await banco.query("UPDATE users SET cakto_subscription_id = 'sub_teste' WHERE id = $1", [anaCombo.id]);
  const cakto = await ativarExistente(chk[2], email('nova'), true);
  confere('assina o mesmo produto pela Cakto: recusa sem gastar', cakto.status === 409 && /NÃO foi usado/.test(cakto.dados?.error) && await naoUsado(chk[2]), cakto.dados?.error);
  await banco.query('UPDATE users SET cakto_subscription_id = NULL WHERE id = $1', [anaCombo.id]);

  // ── 8. Dois resgates do mesmo código ao mesmo tempo: só um vale ──
  const [a, b] = await Promise.all([ativarNova(chk[3], 'corrida1'), ativarNova(chk[3], 'corrida2')]);
  confere('mesmo código em paralelo: um só cria conta', [a.status, b.status].sort().join(',') === '200,409', `${a.status}/${b.status}`);

  // ── 9. Limite de tentativas por origem ──
  console.log('\nLimite de tentativas');
  const ip = `bruto-${RODADA}`;
  const tentativas = [];
  for (let i = 0; i < 10; i++) tentativas.push((await api('/api/ativar', { metodo: 'POST', ip, corpo: { codigo: `FC-CHK-ZZZZ-ZZ${'23456789AB'[i]}${'23456789AB'[i]}`, modo: 'nova' } })).status);
  confere('10 códigos errados respondem 404', tentativas.every((s) => s === 404), tentativas.join(','));
  const barrado = await api('/api/ativar', { metodo: 'POST', ip, corpo: { codigo: chk[4], modo: 'nova', empresa: 'X', nome: 'X', email: email('barrado'), senha: 'senha123', whatsapp: '21999998888' } });
  confere('11ª tentativa da mesma origem: 429, mesmo com código bom', barrado.status === 429 && await naoUsado(chk[4]), barrado.dados?.error);
  const outraOrigem = await ativarNova(chk[4], 'outraorigem');
  confere('outra origem segue normal', outraOrigem.status === 200);

  // ── 10. Rota do master ──
  console.log('\nTela do master');
  await banco.query("INSERT INTO users (name, email, password, role, store, status) VALUES ('Master', $1, $2, 'master', 'Produção', 'active')", [email('master'), hash]);
  const tokMaster = (await login(email('master'))).dados?.token;
  const tokDono = (await login(email('nova'))).dados?.token;
  const negado = await api('/api/codigos-ativacao', { token: tokDono, metodo: 'POST', corpo: { produto: 'ponto', quantidade: 3, dias: 30 } });
  confere('dono de loja não gera código', negado.status === 403);
  const lote = await api('/api/codigos-ativacao', { token: tokMaster, metodo: 'POST', corpo: { produto: 'ponto', quantidade: 3, dias: 30, lote: `tela-${RODADA}` } });
  confere('master gera lote pela tela', lote.status === 200 && lote.dados?.codigos?.length === 3, lote.dados?.error);
  const lista = await api('/api/codigos-ativacao', { token: tokMaster });
  const linha = lista.dados?.lotes?.find((l) => l.lote === `chk-${RODADA}`);
  confere('lista os lotes com usados/total', !!linha && linha.total === 8 && linha.usados === 4, linha ? `${linha.usados}/${linha.total}` : 'sem lote');

  // ── 11. A página /ativar no navegador ──
  console.log('\nPágina /ativar');
  const navegador = await chromium.launch({ executablePath: CHROME, headless: true });
  try {
    const pagina = await navegador.newPage();
    await pagina.goto(`${BASE}/ativar?codigo=${pnt[4]}`);
    await pagina.getByText('Código do Controle de ponto do funcionário').waitFor({ timeout: 30000 });
    confere('link com ?codigo= já preenche e diz o produto', true);
    const campos = pagina.locator('input.input-field');
    await campos.nth(1).fill('Padaria da Página');
    await campos.nth(2).fill('Dona Página');
    await campos.nth(3).fill('21977776666');
    await campos.nth(4).fill(email('pagina'));
    await campos.nth(5).fill('senha123');
    await pagina.getByRole('button', { name: 'Criar conta e ativar' }).click();
    const ok = await pagina.getByTestId('ativado').innerText({ timeout: 30000 }).catch(() => '');
    confere('cria a conta pela página e mostra até quando vale', /Controle de ponto do funcionário ativo até/.test(ok), ok.split('\n')[0]);
    await pagina.getByRole('button', { name: 'Entrar no painel' }).click();
    await pagina.waitForURL('**/admin', { timeout: 30000 });
    confere('"Entrar no painel" leva ao painel já logado', true);
    const semPreco = !/R\$/.test(await pagina.goto(`${BASE}/ativar`).then(() => pagina.content()));
    confere('a página não mostra preço', semPreco);
  } finally {
    await navegador.close();
    await banco.end();
  }

  console.log(`\n${total - falhas} de ${total} ok${falhas ? `, ${falhas} FALHARAM` : ''}`);
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
