// Função real do banco de horas e bloco real da API, com pool em memória.
// Não importa o boot da API, não toca no banco e não faz upload/rede.
// node scripts/teste-falta-justificada-sem-abono.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { FALTA_JUSTIFICADA_SEM_ABONO as JUSTIFICADA, TIPOS_DE_ABONO, tipoParaNovoAbono, minutosAbonadosDoLancamento } from '../api/ponto-abonos.js';

const source = fs.readFileSync('api/index.js', 'utf8');
function funcao(nome) {
  const re = new RegExp(`(?:async )?function ${nome}\\(`);
  const start = source.search(re); assert.ok(start >= 0, `função real encontrada: ${nome}`);
  const end = source.indexOf('\n}', start); assert.ok(end > start);
  return source.slice(start, end + 2);
}
function constante(nome) {
  const start = source.indexOf(`const ${nome} =`); assert.ok(start >= 0);
  const end = source.indexOf('\n};', start); assert.ok(end > start);
  return source.slice(start, end + 3);
}

const dia = '2026-10-20';
let abonos = [], batidas = [], temEscala = true;
const jornada = { isWorkday: true, horaEntrada: '08:00', horaSaida: '17:00', intervaloInicio: '12:00', intervaloFim: '13:00' };
const pessoa = { id: 7, name: 'Funcionária de teste', role: 'funcionario' };
const pool = { query: async (sql) => {
  if (/MIN\(timestamp\)/.test(sql)) return { rows: [{ user_id: 7, dia: '2026-10-01' }] };
  if (/FROM users/.test(sql)) return { rows: [pessoa] };
  if (/FROM ponto_records/.test(sql)) return { rows: batidas };
  if (/FROM ponto_abonos/.test(sql)) return { rows: abonos };
  throw new Error(`SQL inesperado no cálculo: ${sql}`);
} };
const calcular = vm.runInNewContext([
  constante('minutosDoRelogio'), constante('somarDias'),
  funcao('minutosEsperadosDaJornada'), funcao('diasEntre'), funcao('calcularBancoDeHoras'),
  'calcularBancoDeHoras',
].join('\n'), {
  Date, TIPOS_DE_ABONO, minutosAbonadosDoLancamento,
  garantirAbonosDePonto: async () => {},
  carregarEscalaDoFuncionario: async () => temEscala ? { user: {}, schedule: { name: 'Jornada 8h', type: 'fixed' } } : null,
  jornadaNoDia: () => jornada,
});
const lancamento = (tipo, extra = {}) => ({ id: 1, user_id: 7, tipo, data: dia, data_fim: dia, observacao: '', arquivo_url: null, ...extra });
const marcar = (type, hora, day = dia) => ({ id: `${day}-${hora}`, user_id: 7, type, dia: day, hora, seg: Date.parse(`${day}T${hora}:00Z`) / 1000 });
async function saldo(tipo, { horas = 0, coletivo = false, ate = dia } = {}) {
  abonos = tipo ? [lancamento(tipo, { user_id: coletivo ? null : 7, data_fim: ate })] : [];
  batidas = horas ? [marcar('entrada', '08:00'), marcar('saida', horas === 4 ? '12:00' : '16:00')] : [];
  const antes = JSON.stringify({ abonos, batidas });
  const r = await calcular(pool, 'Loja teste', { userId: 7, inicio: dia, fim: ate, tz: 'America/Sao_Paulo' });
  assert.equal(JSON.stringify({ abonos, batidas }), antes, 'cálculo não altera lançamentos ou batidas');
  return r.funcionarios[0];
}

// Regressão: no código antigo qualquer tipo diferente de folga abonava tudo.
let f = await saldo(JUSTIFICADA);
assert.equal(f.dias[0].abonado_min, 0, 'falta justificada nova não abona a jornada');
assert.equal(f.dias[0].saldo_min, -480);
assert.equal(f.dias[0].falta, false, 'justificativa continua impedindo falta injustificada');
assert.equal(f.dias[0].trabalhado_min, 0, 'não inventa horas ou batidas');
assert.equal(f.totais.abonado_min, 0); assert.equal(f.totais.saldo_min, -480); assert.equal(f.totais.faltas, 0);
f = await saldo(JUSTIFICADA, { horas: 4 });
assert.equal(f.totais.trabalhado_min, 240); assert.equal(f.totais.saldo_min, -240, 'comparecimento parcial mantém somente horas realmente batidas');
f = await saldo(JUSTIFICADA, { ate: '2026-10-21' });
assert.equal(f.totais.abonado_min, 0); assert.equal(f.totais.saldo_min, -960, 'período de dois dias também não abona');
f = await saldo('falta_justificada');
assert.equal(f.totais.abonado_min, 480); assert.equal(f.totais.saldo_min, 0, 'tipo histórico mantém o saldo que já tinha');
assert.match(f.dias[0].abono.rotulo, /horas abonadas/);
for (const tipo of ['atestado', 'feriado']) {
  f = await saldo(tipo, { coletivo: tipo === 'feriado' });
  assert.equal(f.totais.abonado_min, 480); assert.equal(f.totais.saldo_min, 0); assert.equal(f.totais.faltas, 0);
}
f = await saldo('feriado', { coletivo: true, horas: 4 });
assert.equal(f.totais.saldo_min, 240, 'feriado trabalhado preserva crédito simples, sem dobra');
f = await saldo('folga_compensada');
assert.equal(f.totais.abonado_min, 0); assert.equal(f.totais.saldo_min, -480); assert.equal(f.totais.faltas, 0);
f = await saldo(null);
assert.equal(f.totais.faltas, 1, 'ausência sem lançamento permanece falta');
temEscala = false; f = await saldo(JUSTIFICADA);
assert.equal(f.totais.saldo_min, null, 'sem escala não inventa saldo'); temEscala = true;

// Compatibilidade da escrita: antigos clientes não podem criar novos abonos
// com o tipo legado. Tipo cabe na coluna existente e nenhum backfill é feito.
assert.ok(JUSTIFICADA.length <= 30);
assert.equal(tipoParaNovoAbono('falta_justificada'), JUSTIFICADA);
assert.equal(tipoParaNovoAbono(JUSTIFICADA), JUSTIFICADA);
for (const tipo of ['atestado', 'folga_compensada', 'feriado']) assert.equal(tipoParaNovoAbono(tipo), tipo);
for (const tipo of [null, {}, 'outro', 'constructor', '__proto__']) assert.equal(tipoParaNovoAbono(tipo), null);

const start = source.indexOf("    if (url.includes('/api/ponto/abonos')) {");
const end = source.indexOf('\n    // ── Edição ou Exclusão de Registro de Ponto', start);
assert.ok(start >= 0 && end > start, 'bloco real da API encontrado');
const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
const executarRota = new AsyncFunction('d', `const {url,method,req,res,authPonto,searchParams,pool,podeGerirPonto,garantirAbonosDePonto,mesmaLoja,uploadImage,TIPOS_DE_ABONO,tipoParaNovoAbono}=d;${source.slice(start, end)}`);
async function post(tipo, { permitido = true, outraLoja = false } = {}) {
  const inserts = [];
  const res = { code: 0, body: null, status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; } };
  await executarRota({
    url: '/api/ponto/abonos', method: 'POST', req: { body: { tipo, userId: 7, data: dia, observacao: 'Comparecimento', store: 'Loja invasora' } }, res,
    authPonto: { role: 'admin', store: 'Loja teste', email: 'gestor@teste' }, searchParams: new URLSearchParams(),
    pool: { query: async (sql, params) => {
      if (/SELECT id, name, store FROM users/.test(sql)) return { rows: [{ id: 7, name: 'Teste', store: outraLoja ? 'Outra loja' : 'Loja teste' }] };
      if (/INSERT INTO ponto_abonos/.test(sql)) { inserts.push(params); return { rows: [{ id: 99 }] }; }
      throw new Error('SQL inesperado na gravação de teste');
    } },
    podeGerirPonto: async () => permitido, garantirAbonosDePonto: async () => {}, mesmaLoja: (a,b) => a === b,
    uploadImage: async () => { throw new Error('Upload proibido neste teste'); }, TIPOS_DE_ABONO, tipoParaNovoAbono,
  });
  return { res, inserts };
}
for (const tipo of ['falta_justificada', JUSTIFICADA]) {
  const r = await post(tipo);
  assert.equal(r.res.code, 200); assert.equal(r.inserts.length, 1); assert.equal(r.inserts[0][3], JUSTIFICADA, 'API antiga e nova gravam justificativa sem abono');
  assert.equal(r.inserts[0][0], 'Loja teste', 'loja vem da sessão, não do corpo');
}
for (const tipo of ['atestado', 'folga_compensada', 'feriado']) {
  const r = await post(tipo); assert.equal(r.res.code, 200); assert.equal(r.inserts[0][3], tipo);
}
let r = await post(JUSTIFICADA, { permitido: false }); assert.equal(r.res.code, 403); assert.equal(r.inserts.length, 0);
r = await post(JUSTIFICADA, { outraLoja: true }); assert.equal(r.res.code, 403); assert.equal(r.inserts.length, 0);
r = await post('constructor'); assert.equal(r.res.code, 400); assert.equal(r.inserts.length, 0);
console.log('OK: falta justificada sem abono; saldo/cálculo e POST reais, legado preservado, demais tipos e isolamento/permissões mantidos.');
