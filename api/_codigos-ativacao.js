// ── Códigos de ativação (venda pelo Mercado Livre) ─────────────────────────
//
// O ML não cobra assinatura: vende uma licença de N dias. Cada venda entrega
// um código (o Mercado Turbo manda um por venda, de um arquivo de texto), e a
// pessoa resgata em /ativar. Conta nova nasce já no plano do produto, sem teste
// antes; conta existente soma os dias ao vencimento que já tem.
//
// Este arquivo é usado pela API (api/index.js) e pelo script que gera os lotes
// (scripts/gerar-codigos.mjs). O "_" no nome impede a Vercel de publicá-lo
// como uma função à parte.
import crypto from 'crypto';

// Sem 0/O, 1/I/L: o código é digitado por gente lendo no celular.
export const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export const PRODUTOS = {
  checklists: { prefixo: 'CHK', nome: 'Checklist inteligente', plano: 'checklists_mensal' },
  ponto: { prefixo: 'PNT', nome: 'Controle de ponto do funcionário', plano: 'ponto_mensal' },
};

export function produtoDoPrefixo(prefixo) {
  return Object.keys(PRODUTOS).find((p) => PRODUTOS[p].prefixo === prefixo) || null;
}

function bloco(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += ALFABETO[crypto.randomInt(ALFABETO.length)];
  return s;
}

/** FC-CHK-7Q4M-9XKD: 8 sorteados de 31 símbolos (~8,5 × 10¹¹ combinações por produto). */
export function novoCodigo(produto) {
  const p = PRODUTOS[produto];
  if (!p) throw new Error(`Produto desconhecido: ${produto}`);
  return `FC-${p.prefixo}-${bloco(4)}-${bloco(4)}`;
}

/**
 * O que a pessoa digitou → o formato gravado. Aceita minúsculas, espaços e sem
 * hífens ("fcchk7q4m9xkd"). Devolve null quando nem tem o formato de um código.
 */
export function normalizarCodigo(texto) {
  const limpo = String(texto || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (limpo.length !== 13 || !limpo.startsWith('FC')) return null;
  const prefixo = limpo.slice(2, 5);
  const resto = limpo.slice(5);
  if (!produtoDoPrefixo(prefixo)) return null;
  if (![...resto].every((c) => ALFABETO.includes(c))) return null;
  return `FC-${prefixo}-${resto.slice(0, 4)}-${resto.slice(4)}`;
}

export async function garantirTabelasDeCodigos(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS codigos_ativacao (
      id SERIAL PRIMARY KEY,
      codigo VARCHAR(32) UNIQUE NOT NULL,
      produto VARCHAR(20) NOT NULL CHECK (produto IN ('checklists', 'ponto')),
      dias INTEGER NOT NULL DEFAULT 30 CHECK (dias > 0),
      origem VARCHAR(30) NOT NULL DEFAULT 'mercadolivre',
      lote VARCHAR(60),
      criado_em TIMESTAMPTZ DEFAULT NOW(),
      criado_por TEXT,
      usado_por_user_id INTEGER,
      usado_por_store TEXT,
      usado_por_email TEXT,
      usado_em TIMESTAMPTZ,
      plano_antes TEXT,
      plano_depois TEXT,
      validade_depois TIMESTAMP
    )
  `);
  await db.query('CREATE INDEX IF NOT EXISTS idx_codigos_ativacao_lote ON codigos_ativacao (lote)');
  // Cada código errado conta contra a origem (ver /api/ativar). No banco, e não
  // na memória, porque na Vercel cada instância tem a sua.
  await db.query(`
    CREATE TABLE IF NOT EXISTS codigos_ativacao_falhas (
      id SERIAL PRIMARY KEY,
      origem TEXT NOT NULL,
      criado_em TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.query('CREATE INDEX IF NOT EXISTS idx_codigos_falhas_origem ON codigos_ativacao_falhas (origem, criado_em)');
}

/** Grava `quantidade` códigos novos e devolve a lista, na ordem. */
export async function gerarLote(db, { produto, quantidade, dias = 30, lote, origem = 'mercadolivre', criadoPor = null }) {
  if (!PRODUTOS[produto]) throw new Error("Produto tem de ser 'checklists' ou 'ponto'.");
  const qtd = Number(quantidade);
  const d = Number(dias);
  if (!Number.isInteger(qtd) || qtd < 1 || qtd > 1000) throw new Error('Quantidade de 1 a 1000 por lote.');
  if (!Number.isInteger(d) || d < 1 || d > 366) throw new Error('Dias de 1 a 366.');
  const nomeDoLote = String(lote || '').trim().slice(0, 60) || `${origem}-${produto}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;

  const codigos = [];
  while (codigos.length < qtd) {
    const sorteados = [...new Set(Array.from({ length: qtd - codigos.length }, () => novoCodigo(produto)))];
    // Colisão com código antigo é quase impossível; se vier, o ON CONFLICT
    // pula e a volta seguinte sorteia o que faltou.
    const { rows } = await db.query(
      `INSERT INTO codigos_ativacao (codigo, produto, dias, origem, lote, criado_por)
       SELECT c, $2, $3, $4, $5, $6 FROM unnest($1::text[]) AS c
       ON CONFLICT (codigo) DO NOTHING RETURNING codigo`,
      [sorteados, produto, d, origem, nomeDoLote, criadoPor]
    );
    const gravados = new Set(rows.map((r) => r.codigo));
    codigos.push(...sorteados.filter((c) => gravados.has(c)));
  }
  return { lote: nomeDoLote, codigos };
}
