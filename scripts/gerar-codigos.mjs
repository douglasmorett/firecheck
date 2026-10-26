/**
 * Gera um lote de códigos de ativação e grava um arquivo de texto com um
 * código por linha — o formato que o Mercado Turbo carrega em "Envio automático
 * de links e licenças" (um código por venda).
 *
 *   node scripts/gerar-codigos.mjs <checklists|ponto> <quantidade> [dias=30] [--lote nome] [--saida arquivo.txt]
 *
 * O banco é o de DATABASE_URL. Exemplo (PowerShell):
 *   $env:DATABASE_URL = "postgresql://..."; node scripts/gerar-codigos.mjs checklists 50 30
 */
import fs from 'node:fs';
import pg from 'pg';
import { garantirTabelasDeCodigos, gerarLote, PRODUTOS } from '../api/_codigos-ativacao.js';

const args = process.argv.slice(2);
const opcao = (nome) => {
  const i = args.indexOf(nome);
  if (i === -1) return null;
  const valor = args[i + 1];
  args.splice(i, 2);
  return valor;
};
const lote = opcao('--lote');
const saida = opcao('--saida');
const [produto, quantidade, dias = '30'] = args;

if (!PRODUTOS[produto] || !quantidade) {
  console.error('Uso: node scripts/gerar-codigos.mjs <checklists|ponto> <quantidade> [dias=30] [--lote nome] [--saida arquivo.txt]');
  process.exit(2);
}
const CONN = process.env.DATABASE_URL;
if (!CONN) {
  console.error('ERRO: defina DATABASE_URL (o banco onde os códigos vão valer).');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: CONN.includes('sslmode=') ? CONN : CONN + (CONN.includes('?') ? '&' : '?') + 'sslmode=require',
  ssl: { rejectUnauthorized: false },
  max: 1,
});

try {
  await garantirTabelasDeCodigos(pool);
  const r = await gerarLote(pool, {
    produto, quantidade: Number(quantidade), dias: Number(dias), lote, criadoPor: 'script',
  });
  const arquivo = saida || `codigos-${r.lote}.txt`;
  fs.writeFileSync(arquivo, r.codigos.join('\n') + '\n');
  const host = new URL(CONN).hostname;
  console.log(`${r.codigos.length} códigos de "${PRODUTOS[produto].nome}" (${dias} dias), lote ${r.lote}, no banco ${host}.`);
  console.log(`Arquivo: ${arquivo}`);
} catch (e) {
  console.error('Falhou:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
