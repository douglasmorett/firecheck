// Teste de ponta a ponta: Checklist e Controle de ponto ligados no FireHub e
// pagos no boleto de lá (Douglas, 28/10/2026). Os dois sistemas rodam aqui, cada
// um no seu ambiente descartável; nada encosta em produção.
//
//   FireCheck (esta pasta):  npx vite build --outDir tutoriais/.dist --emptyOutDir
//                            node tutoriais/ambiente/ambiente.mjs subir 15
//   FireHub (worktree dele): npx next build
//                            FIRECHECK_API_URL=http://127.0.0.1:3185 FIRECHECK_URL_DO_FIREHUB=http://localhost:3145 \
//                              node tutoriais/ambiente/ambiente.mjs subir 15
//                            (+ semente.mjs da loja demo)
//   node tutoriais/ambiente/teste-firehub-boleto.mjs 15 15
//
// Cobre: ligar já cria a conta (o login é o do FireHub, nasce parada), a senha
// do FireHub entrando no FireCheck, o "Abrir o FireCheck" (bilhete de uso único),
// ligar com termo, combo,
// desligar no teste (corta na hora), checklist desligado travado no servidor,
// mensalidade em aberto bloqueando tudo e voltando ao pagar, Cakto valendo
// recusando, cancelamento da Cakto ignorado, desconectar recusado com módulo
// ligado e o dono sem conseguir ligar o ponto pelo cadastro.
process.env.TZ = 'UTC';
import pg from 'pg';
import jwt from 'jsonwebtoken';

const nFc = Number(process.argv[2] || 15), nFh = Number(process.argv[3] || 15);
const FC = `http://127.0.0.1:${3170 + nFc}`;
const FH = `http://localhost:${3130 + nFh}`;
const acesso = ['postgres', 'postgres'].join(':');
const BANCO_FC = `postgres://${acesso}@127.0.0.1:${5470 + nFc}/postgres?sslmode=disable`;
const BANCO_FH = `postgres://${acesso}@127.0.0.1:${5460 + nFh}/postgres?sslmode=disable`;
const LOJA = { email: 'demo@tutorial.local', senha: 'tutorial123' };
const RODADA = Date.now().toString(36);

let falhas = 0, total = 0;
function confere(nome, ok, detalhe = '') {
  total += 1;
  if (!ok) falhas += 1;
  console.log(`${ok ? '  ok' : '  FALHOU'}  ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(r) { try { return await r.json(); } catch { return null; } }

// ── FireHub: login pelo NextAuth guardando os cookies ─────────────────────
const cookies = new Map();
function guardar(r) { for (const c of r.headers.getSetCookie()) { const [par] = c.split(';'); const i = par.indexOf('='); cookies.set(par.slice(0, i), par.slice(i + 1)); } }
const cabecalhoDeCookie = () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
async function fh(caminho, { metodo = 'GET', corpo } = {}) {
  const r = await fetch(FH + caminho, {
    method: metodo, redirect: 'manual',
    headers: { 'Content-Type': 'application/json', Cookie: cabecalhoDeCookie() },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  guardar(r);
  return { status: r.status, dados: await json(r) };
}
async function entrarNoFirehub() {
  const r1 = await fetch(`${FH}/api/auth/csrf`); guardar(r1);
  const { csrfToken } = await r1.json();
  const r2 = await fetch(`${FH}/api/auth/callback/credentials`, {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cabecalhoDeCookie() },
    body: new URLSearchParams({ csrfToken, email: LOJA.email, password: LOJA.senha, json: 'true' }),
  });
  guardar(r2);
  return [...cookies.keys()].some((k) => k.includes('session-token'));
}

// ── FireCheck ──────────────────────────────────────────────────────────────
async function fc(caminho, { token, metodo = 'GET', corpo, chave } = {}) {
  const r = await fetch(FC + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', 'x-real-ip': `ip-${RODADA}`, ...(token ? { Authorization: `Bearer ${token}` } : chave ? { Authorization: `Bearer ${chave}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, dados: await json(r) };
}

const bfc = new pg.Client({ connectionString: BANCO_FC });
const bfh = new pg.Client({ connectionString: BANCO_FH });
await bfc.connect();
await bfh.connect();
const dono = async () => (await bfc.query("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [LOJA.email])).rows[0];

// Começo limpo: tira o que uma rodada anterior deixou nos dois lados.
const { rows: [lojaFh] } = await bfh.query('SELECT id FROM "User" WHERE email = $1', [LOJA.email]);
if (!lojaFh) throw new Error('Rode a semente da loja demo no ambiente do FireHub antes.');
await bfh.query('UPDATE "User" SET "firecheckIntegracao" = NULL, "planPercent" = 2 WHERE id = $1', [lojaFh.id]);
await bfh.query('DELETE FROM "FranchiseeBillingCycle" WHERE "franchiseeId" = $1', [lojaFh.id]);
await bfh.query('CREATE TABLE IF NOT EXISTS "FireCheckAssinatura" ("franchiseeId" TEXT PRIMARY KEY, "trechos" JSONB NOT NULL DEFAULT \'[]\', "testes" JSONB NOT NULL DEFAULT \'{}\', "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)');
await bfh.query('DELETE FROM "FireCheckAssinatura" WHERE "franchiseeId" = $1', [lojaFh.id]);
await fc('/api/health').catch(() => null); // acorda o FireCheck (e as colunas novas)
await bfc.query("DELETE FROM integracao_firehub WHERE firehub_loja_id = $1", [lojaFh.id]);
await bfc.query("DELETE FROM users WHERE LOWER(email) = LOWER($1)", [LOJA.email]);

console.log('\n1) Ligar já cria a conta, com o login do FireHub');
confere('entra no FireHub', await entrarNoFirehub());
let r = await fh('/api/store/firecheck/modulos');
confere('GET módulos: desconectado, os dois desligados', r.status === 200 && !r.dados.conectado && !r.dados.estado.modulos.checklists.ativo && !r.dados.estado.modulos.ponto.ativo, JSON.stringify(r.dados).slice(0, 160));
confere('preços: 149 por módulo, combo 197, 7 dias', r.dados?.precos?.porModulo?.ponto === 149 && r.dados?.precos?.combo === 197 && r.dados?.precos?.diasDeTeste === 7);
r = await fh('/api/store/firecheck/modulos', { metodo: 'POST', corpo: { modulo: 'checklists', ligar: true } });
confere('ligar sem o termo: recusa', r.status === 400 && r.dados?.precisaDoTermo === true, `${r.status} ${r.dados?.error}`);
let d = await dono();
confere('a conta do FireCheck já nasceu: e-mail da loja, parada (desligado) e seguindo o FireHub', d?.status === 'blocked' && d?.cobranca_firehub === true && d?.firehub_motivo === 'desligado' && d?.role === 'admin');
r = await fh('/api/store/firecheck/modulos');
confere('GET módulos: conectado, com o mesmo login do FireHub', r.dados?.conectado?.email === LOJA.email && r.dados?.conectado?.mesmoLogin === true, JSON.stringify(r.dados?.conectado));
r = await fc('/api/auth', { metodo: 'POST', corpo: { email: LOJA.email, password: LOJA.senha } });
confere('login no FireCheck com a senha do FIREHUB: confere (403 só porque está desligado no FireHub)', r.status === 403 && r.dados?.firehub === true && /desligado no FireHub/.test(r.dados?.error || ''), `${r.status} ${r.dados?.error}`);
r = await fc('/api/auth', { metodo: 'POST', corpo: { email: LOJA.email, password: 'senha-errada-123' } });
confere('senha errada: 401', r.status === 401, `${r.status} ${r.dados?.error}`);
r = await fh('/api/store/firecheck/modulos', { metodo: 'POST', corpo: { acao: 'criar-conta' } });
const { rows: [{ n: contasDoEmail }] } = await bfc.query('SELECT COUNT(*)::int AS n FROM users WHERE LOWER(email) = LOWER($1)', [LOJA.email]);
confere('tela velha ("Criar minha conta"): devolve a mesma conta, sem duplicar', r.status === 200 && r.dados?.conta?.senha === 'a mesma do FireHub' && contasDoEmail === 1, `${r.status} ${JSON.stringify(r.dados)} contas=${contasDoEmail}`);

console.log('\n2) Ligar o Checklist');
r = await fh('/api/store/firecheck/modulos', { metodo: 'POST', corpo: { modulo: 'checklists', ligar: true, aceite: { versao: '2026-10-28' } } });
confere('ligar com o termo: ok, em teste, e o FireCheck sincronizou', r.status === 200 && r.dados?.estado?.modulos?.checklists?.ativo && r.dados?.estado?.modulos?.checklists?.emTeste && r.dados?.sincronizado === true, `${r.status} ${JSON.stringify(r.dados).slice(0, 200)}`);
d = await dono();
confere('FireCheck: ativo, checklists_mensal, sem vencimento, checklist ligado, ponto desligado, 30 colaboradores',
  d.status === 'active' && d.plan === 'checklists_mensal' && d.expiration_date === null && d.checklists_active === true && d.ponto_active === false && Number(d.ponto_limit) === 30,
  `${d.status} ${d.plan} ${d.expiration_date} ${d.checklists_active} ${d.ponto_active} ${d.ponto_limit}`);
r = await fc('/api/auth', { metodo: 'POST', corpo: { email: LOJA.email, password: LOJA.senha } });
const token = r.dados?.token;
confere('login no FireCheck com a senha do FireHub: entra, e o perfil já vem com o plano do FireHub', r.status === 200 && !!token && r.dados?.user?.plan === 'checklists_mensal', `${r.status} ${r.dados?.error || ''}`);
r = await fc('/api/checklists', { token, metodo: 'POST', corpo: { title: `Abertura ${RODADA}`, tasks: [{ text: 'Ligar a chapa' }], recurrence: 'daily' } });
confere('criar checklist com o Checklist ligado: passa', r.status === 200 || r.status === 201, `${r.status} ${r.dados?.error || ''}`);

console.log('\n2b) "Abrir o FireCheck" no painel do FireHub');
r = await fh('/api/store/firecheck/modulos', { metodo: 'POST', corpo: { acao: 'abrir' } });
const link = r.dados?.url || '';
confere('o FireHub devolve o link de entrada, com o bilhete depois do #', r.status === 200 && link.startsWith(`${FC}/login#firehub=`), `${r.status} ${link.slice(0, 80)} ${r.dados?.error || ''}`);
const bilhete = new URLSearchParams(link.split('#')[1] || '').get('firehub');
r = await fc('/api/users', { token: bilhete });
confere('o bilhete não vale como token de sessão', r.status === 401, `${r.status}`);
r = await fc('/api/integracoes/firehub/entrar', { metodo: 'POST', corpo: { bilhete } });
const tokenDoBotao = r.dados?.token;
confere('o bilhete entra como o dono, com o plano do FireHub', r.status === 200 && !!tokenDoBotao && r.dados?.user?.email === LOJA.email && r.dados?.user?.plan === 'checklists_mensal' && !r.dados?.user?.password, `${r.status} ${r.dados?.error || ''}`);
r = await fc('/api/users', { token: tokenDoBotao });
confere('o token que veio do botão funciona', r.status === 200, `${r.status}`);
r = await fc('/api/integracoes/firehub/entrar', { metodo: 'POST', corpo: { bilhete } });
confere('o mesmo bilhete de novo: recusa (uso único)', r.status === 401 && /já foi usado ou venceu/.test(r.dados?.error || ''), `${r.status} ${r.dados?.error}`);
const forjado = jwt.sign({ id: d.id, marca: null }, 'tutoriais-local', { expiresIn: '2m' });
r = await fc('/api/integracoes/firehub/entrar', { metodo: 'POST', corpo: { bilhete: forjado } });
confere('bilhete assinado com o segredo das sessões: recusa', r.status === 401, `${r.status}`);

console.log('\n3) Ligar o Ponto (combo)');
r = await fh('/api/store/firecheck/modulos', { metodo: 'POST', corpo: { modulo: 'ponto', ligar: true, aceite: { versao: '2026-10-28' } } });
confere('ligar o ponto: ok', r.status === 200 && r.dados?.estado?.modulos?.ponto?.ativo, `${r.status} ${r.dados?.error || ''}`);
d = await dono();
confere('FireCheck: combo_mensal, ponto ligado, 50 colaboradores', d.plan === 'combo_mensal' && d.ponto_active === true && d.checklists_active === true && Number(d.ponto_limit) === 50, `${d.plan} ${d.ponto_active} ${d.ponto_limit}`);
const { rows: [integ] } = await bfc.query('SELECT chave FROM integracao_firehub WHERE firehub_loja_id = $1', [lojaFh.id]);
const lido = await fetch(`${FH}/api/integracoes/firecheck/modulos`, { headers: { Authorization: `Bearer ${integ.chave}` } }).then(json);
confere('FireHub responde ao FireCheck: os dois ligados, não bloqueada, pelo FireHub', lido?.checklists === true && lido?.ponto === true && lido?.bloqueada === false && lido?.peloFirehub === true, JSON.stringify(lido));
const chaveErrada = await fetch(`${FH}/api/integracoes/firecheck/modulos`, { headers: { Authorization: `Bearer ${'x'.repeat(64)}` } });
confere('FireHub recusa chave errada', chaveErrada.status === 401);

console.log('\n4) Desligar o Checklist no teste');
r = await fh('/api/store/firecheck/modulos', { metodo: 'POST', corpo: { modulo: 'checklists', ligar: false } });
confere('desligar no teste: para na hora', r.status === 200 && r.dados?.estado?.modulos?.checklists?.ativo === false && !r.dados?.estado?.modulos?.checklists?.desligaEm, `${r.status} ${JSON.stringify(r.dados?.estado?.modulos?.checklists)}`);
d = await dono();
confere('FireCheck: só ponto (ponto_mensal), checklist desligado, 30 colaboradores', d.plan === 'ponto_mensal' && d.checklists_active === false && d.ponto_active === true && Number(d.ponto_limit) === 30, `${d.plan} ${d.checklists_active}`);
r = await fc('/api/checklists', { token, metodo: 'POST', corpo: { title: `Fechamento ${RODADA}`, tasks: [{ text: 'Desligar a chapa' }], recurrence: 'daily' } });
confere('criar checklist com ele desligado: 403 no servidor', r.status === 403 && r.dados?.checklistDesligado === true, `${r.status} ${r.dados?.error || ''}`);
r = await fc('/api/finalize', { token, metodo: 'POST', corpo: { employeeName: 'Dono', tasks: [{ text: 'x', done: true }], feedbackInfo: {} } });
confere('enviar checklist com ele desligado: 403 no servidor', r.status === 403 && r.dados?.checklistDesligado === true, `${r.status} ${r.dados?.error || ''}`);
r = await fc('/api/users', { token });
const eu = Array.isArray(r.dados) ? r.dados.find((u) => u.email === LOJA.email) : null;
confere('a lista de usuários leva checklists_active e cobranca_firehub para a tela', eu?.checklists_active === false && eu?.cobranca_firehub === true);
r = await fh('/api/store/firecheck/modulos', { metodo: 'POST', corpo: { modulo: 'checklists', ligar: true, aceite: { versao: '2026-10-28' } } });
confere('religar depois de usar o teste: liga, mas sem teste (o mês entra inteiro)', r.status === 200 && r.dados?.estado?.modulos?.checklists?.ativo && !r.dados?.estado?.modulos?.checklists?.emTeste && r.dados?.estado?.modulos?.checklists?.jaTestou, JSON.stringify(r.dados?.estado?.modulos?.checklists));
confere('valor deste mês: o checklist (149), já sem teste; o ponto ainda no teste', r.dados?.estado?.valorEsteMes === 149, `valor ${r.dados?.estado?.valorEsteMes}`);

console.log('\n5) Desconectar com módulo ligado');
r = await fh('/api/store/firecheck/conexao', { metodo: 'DELETE' });
confere('FireHub recusa desconectar com módulo ligado', r.status === 409, `${r.status} ${r.dados?.error || ''}`);

console.log('\n6) Dono tentando ligar o ponto pelo cadastro do FireCheck');
await bfc.query('UPDATE users SET ponto_active = FALSE WHERE id = $1', [d.id]);
r = await fc(`/api/users/${d.id}`, { token, metodo: 'PUT', corpo: { ponto_active: true } });
confere('PUT ponto_active pelo próprio dono: 403', r.status === 403, `${r.status} ${r.dados?.error || ''}`);
await fc('/api/integracoes/firehub/sincronizar', { metodo: 'POST', chave: integ.chave });

console.log('\n7) Cancelamento da Cakto numa conta paga pelo FireHub');
r = await fc('/api/webhooks/cakto', { metodo: 'POST', corpo: { event: 'subscription_canceled', data: { status: 'canceled', customer: { email: LOJA.email }, subscription: { id: 'sub-velha' } } } });
d = await dono();
confere('cancelamento da Cakto não para a conta', d.status === 'active', `${r.status} → ${d.status}`);

console.log('\n8) Mensalidade do FireHub em aberto bloqueia tudo');
await bfh.query(`INSERT INTO "FranchiseeBillingCycle" (id, "franchiseeId", "yearMonth", status, "amountPending", "amountDue", "closedAt", "updatedAt")
                 VALUES ($1, $2, '2026-08', 'CLOSED', 120, 120, '2026-09-01T03:00:00Z', NOW())`, [`ciclo-${RODADA}`, lojaFh.id]);
console.log('     (esperando o cache de 60 s do bloqueio no FireHub)');
await dormir(62000);
r = await fc('/api/integracoes/firehub/sincronizar', { metodo: 'POST', chave: integ.chave });
d = await dono();
confere('FireCheck bloqueado pela mensalidade', r.dados?.status === 'blocked' && d.status === 'blocked' && d.firehub_motivo === 'mensalidade', `${JSON.stringify(r.dados)} ${d.status} ${d.firehub_motivo}`);
r = await fc('/api/users', { token });
confere('o token que já estava logado deixa de valer', r.status === 401, `${r.status}`);
r = await fc('/api/auth', { metodo: 'POST', corpo: { email: LOJA.email, password: LOJA.senha } });
confere('login: 403 dizendo que a mensalidade do FireHub está em aberto', r.status === 403 && /mensalidade do FireHub/.test(r.dados?.error || ''), `${r.status} ${r.dados?.error}`);
await bfh.query(`UPDATE "FranchiseeBillingCycle" SET status = 'PAID', "amountPending" = 0 WHERE id = $1`, [`ciclo-${RODADA}`]);
await dormir(62000);
r = await fc('/api/auth', { metodo: 'POST', corpo: { email: LOJA.email, password: LOJA.senha } });
d = await dono();
confere('pagou: o login volta sozinho e a conta fica como estava (combo)', r.status === 200 && d.status === 'active' && d.plan === 'combo_mensal', `${r.status} ${d.status} ${d.plan}`);

console.log('\n9) Cakto valendo: o FireHub não liga em cima');
const chaveCakto = `cakto-${RODADA}`.padEnd(40, 'x');
await bfc.query(`INSERT INTO users (name, email, password, role, store, store_name, status, plan, expiration_date, ponto_active, cakto_ponto_subscription_id)
                 VALUES ('Cakto', $1, 'x', 'admin', $2, $2, 'active', 'ponto_mensal', NOW() + INTERVAL '20 days', TRUE, 'sub-1')`, [`cakto-${RODADA}@teste.local`, `Loja Cakto ${RODADA}`]);
await bfc.query(`INSERT INTO integracao_firehub (store, firehub_loja_id, firehub_loja_nome, chave, url) VALUES ($1, $2, 'x', $3, $4)`, [`Loja Cakto ${RODADA}`, `fh-${RODADA}`, chaveCakto, FH]);
r = await fc('/api/integracoes/firehub/conta', { chave: chaveCakto });
confere('conta com o ponto na Cakto: o FireCheck avisa (ponto sim, checklist não)', r.status === 200 && r.dados?.cakto?.ponto === true && r.dados?.cakto?.checklists === false, JSON.stringify(r.dados));
r = await fc('/api/integracoes/firehub/conta', { chave: integ.chave });
confere('conta paga pelo FireHub: nada na Cakto', r.status === 200 && r.dados?.cakto?.ponto === false && r.dados?.cakto?.checklists === false, JSON.stringify(r.dados));
r = await fc('/api/integracoes/firehub/criar-conta', { metodo: 'POST', corpo: { chave: 'y'.repeat(64), firehubLojaId: lojaFh.id, urlDoFirehub: FH } });
confere('criar conta com chave que o FireHub não conhece: 401', r.status === 401, `${r.status}`);
r = await fc('/api/integracoes/firehub/criar-conta', { metodo: 'POST', corpo: { chave: integ.chave, firehubLojaId: lojaFh.id, urlDoFirehub: 'https://evil.example.com' } });
confere('criar conta apontando para outro servidor: recusa', r.status === 400, `${r.status}`);
r = await fc('/api/integracoes/firehub/criar-conta', { metodo: 'POST', corpo: { chave: integ.chave, firehubLojaId: lojaFh.id, urlDoFirehub: FH } });
const { rows: [{ n: contasDepois }] } = await bfc.query('SELECT COUNT(*)::int AS n FROM users WHERE LOWER(email) = LOWER($1)', [LOJA.email]);
confere('criar conta de novo para a mesma loja: religa, sem duplicar', r.status === 200 && r.dados?.ok && contasDepois === 1, `${r.status} ${r.dados?.error || ''} contas=${contasDepois}`);
// O e-mail já tem conta no FireCheck, mas sem ligação com esta loja: não liga só pelo e-mail.
const { rows: [ligacaoGuardada] } = await bfc.query('DELETE FROM integracao_firehub WHERE firehub_loja_id = $1 RETURNING *', [lojaFh.id]);
r = await fc('/api/integracoes/firehub/criar-conta', { metodo: 'POST', corpo: { chave: integ.chave, firehubLojaId: lojaFh.id, urlDoFirehub: FH } });
confere('e-mail com conta no FireCheck sem ligação: recusa (contaExiste), não liga só pelo e-mail', r.status === 409 && r.dados?.contaExiste === true, `${r.status} ${r.dados?.error || ''}`);
await bfc.query('INSERT INTO integracao_firehub (store, firehub_loja_id, firehub_loja_nome, chave, url, conectado_por, conectado_em) VALUES ($1, $2, $3, $4, $5, $6, $7)',
  [ligacaoGuardada.store, ligacaoGuardada.firehub_loja_id, ligacaoGuardada.firehub_loja_nome, ligacaoGuardada.chave, ligacaoGuardada.url, ligacaoGuardada.conectado_por, ligacaoGuardada.conectado_em]);
let resp = await fetch(`${FH}/api/integracoes/firecheck/senha`, { method: 'POST', headers: { Authorization: `Bearer ${integ.chave}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'outro@teste.local', senha: LOJA.senha }) });
confere('FireHub: senha certa com OUTRO e-mail não confere (só o da loja da chave)', (await json(resp))?.confere === false);
resp = await fetch(`${FH}/api/integracoes/firecheck/senha`, { method: 'POST', headers: { Authorization: `Bearer ${'z'.repeat(64)}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: LOJA.email, senha: LOJA.senha }) });
confere('FireHub: conferir senha com chave errada: 401', resp.status === 401, `${resp.status}`);
await bfc.query('DELETE FROM integracao_firehub WHERE chave = $1', [chaveCakto]);
await bfc.query('DELETE FROM users WHERE email = $1', [`cakto-${RODADA}@teste.local`]);

console.log('\n10) Desligar tudo depois do teste e desconectar');
// Fim do teste no passado: desligar agora marca para a virada do mês.
await bfh.query(`UPDATE "FireCheckAssinatura" SET testes = '{"checklists":"2026-10-01T00:00:00.000Z","ponto":"2026-10-01T00:00:00.000Z"}'::jsonb WHERE "franchiseeId" = $1`, [lojaFh.id]);
r = await fh('/api/store/firecheck/modulos', { metodo: 'POST', corpo: { modulo: 'ponto', ligar: false } });
confere('desligar depois do teste: continua liberado até a virada', r.status === 200 && r.dados?.estado?.modulos?.ponto?.ativo === true && !!r.dados?.estado?.modulos?.ponto?.desligaEm, JSON.stringify(r.dados?.estado?.modulos?.ponto));
d = await dono();
confere('FireCheck segue com o ponto até a virada', d.ponto_active === true && d.plan === 'combo_mensal');
confere('valor do mês: os dois cobrados = combo 197', r.dados?.estado?.valorEsteMes === 197, `valor ${r.dados?.estado?.valorEsteMes}`);
// A virada chega: o trecho termina no passado (simulado no banco do FireHub).
await bfh.query(`UPDATE "FireCheckAssinatura" SET trechos = (SELECT jsonb_agg(t || jsonb_build_object('ate', '2026-10-01T00:00:00.000Z')) FROM jsonb_array_elements(trechos) t) WHERE "franchiseeId" = $1`, [lojaFh.id]);
r = await fc('/api/integracoes/firehub/sincronizar', { metodo: 'POST', chave: integ.chave });
d = await dono();
confere('passou a virada com tudo desligado: FireCheck parado (desligado)', d.status === 'blocked' && d.firehub_motivo === 'desligado', `${d.status} ${d.firehub_motivo}`);
r = await fh('/api/store/firecheck/conexao', { metodo: 'DELETE' });
confere('desconectar com tudo desligado: ok', r.status === 200, `${r.status} ${r.dados?.error || ''}`);
d = await dono();
confere('FireCheck desconectado: conta parada (desconectado)', d.status === 'blocked' && d.firehub_motivo === 'desconectado', `${d.status} ${d.firehub_motivo}`);

await bfc.end();
await bfh.end();
console.log(`\n${falhas === 0 ? 'TUDO CERTO' : `${falhas} FALHA(S)`}: ${total - falhas}/${total}`);
process.exit(falhas === 0 ? 0 : 1);
