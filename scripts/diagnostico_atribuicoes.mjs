/**
 * Diagnóstico e reparo das atribuições de checklist (assigned_to).
 *
 * Contexto: até a correção de 2026-08-22, o cadastro de um novo colaborador
 * injetava o e-mail dele em TODOS os checklists restritos da loja. Com isso,
 * restrições legítimas foram sendo dissolvidas a cada contratação.
 *
 * Este script NÃO altera nada por padrão. Ele mostra o estado atual para revisão.
 *
 *   Somente leitura:  node scripts/diagnostico_atribuicoes.mjs
 *   Uma loja só:      node scripts/diagnostico_atribuicoes.mjs --loja "Nome da Loja"
 *   Aplicar reparo:   node scripts/diagnostico_atribuicoes.mjs --aplicar
 *
 * O reparo converte para NULL ("toda a equipe") apenas os checklists cuja lista
 * contém a equipe inteira — situação que, na prática, só o auto-append produzia,
 * e que hoje equivale a não ter restrição nenhuma. Restrições parciais NUNCA são
 * tocadas: elas precisam de conferência humana, porque não há como distinguir
 * "o lojista quis essas 3 pessoas" de "eram 2 e o bug acrescentou a terceira".
 */

import pg from 'pg';

const { Pool } = pg;

const CONN = process.env.DATABASE_URL;
if (!CONN) {
  console.error('ERRO: defina DATABASE_URL no ambiente antes de rodar.');
  console.error('  PowerShell:  $env:DATABASE_URL = "postgresql://..."');
  console.error('  bash:        export DATABASE_URL="postgresql://..."');
  process.exit(1);
}

const APLICAR = process.argv.includes('--aplicar');
const idxLoja = process.argv.indexOf('--loja');
const LOJA = idxLoja !== -1 ? process.argv[idxLoja + 1] : null;

const pool = new Pool({
  connectionString: CONN.includes('sslmode=') ? CONN : CONN + '?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

const norm = (v) => String(v || '').toLowerCase().trim();

function parseAssigned(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function run() {
  const params = [];
  let where = '';
  if (LOJA) {
    where = 'WHERE LOWER(TRIM(store)) = LOWER(TRIM($1))';
    params.push(LOJA);
  }

  const { rows: lojas } = await pool.query(
    `SELECT DISTINCT store FROM checklists ${where} ORDER BY store`,
    params
  );

  if (lojas.length === 0) {
    console.log('Nenhuma loja encontrada com esse filtro.');
    return;
  }

  let totalIrrestritos = 0;
  let totalEquipeInteira = 0;
  let totalRestritos = 0;
  let totalOrfaos = 0;
  const paraReparar = [];

  for (const { store } of lojas) {
    const { rows: equipe } = await pool.query(
      `SELECT id, name, email, role FROM users
       WHERE LOWER(TRIM(store)) = LOWER(TRIM($1))
         AND role IN ('funcionario', 'employee', 'gestor')
       ORDER BY name`,
      [store]
    );

    const { rows: checklists } = await pool.query(
      `SELECT id, title, assigned_to FROM checklists
       WHERE LOWER(TRIM(store)) = LOWER(TRIM($1))
       ORDER BY id`,
      [store]
    );

    const emailsEquipe = equipe.map((u) => norm(u.email)).filter(Boolean);

    console.log('\n' + '='.repeat(72));
    console.log(`LOJA: ${store}`);
    console.log(`Equipe executora: ${equipe.length} pessoa(s)`);
    for (const u of equipe) console.log(`   - ${u.name} <${u.email}> [${u.role}]`);
    console.log(`Checklists: ${checklists.length}`);
    console.log('='.repeat(72));

    for (const cl of checklists) {
      const lista = parseAssigned(cl.assigned_to);

      if (!lista || lista.length === 0) {
        totalIrrestritos++;
        console.log(`  #${cl.id} "${cl.title}"\n      TODA A EQUIPE (assigned_to nulo) — alcança futuros contratados. OK.`);
        continue;
      }

      const listaNorm = lista.map(norm);
      // Alguém na lista que não existe mais na equipe (demitido, ou atribuição por nome)
      const orfaos = lista.filter((e) => !emailsEquipe.includes(norm(e)));
      const cobreEquipeInteira =
        emailsEquipe.length > 0 && emailsEquipe.every((e) => listaNorm.includes(e));

      if (cobreEquipeInteira) {
        totalEquipeInteira++;
        paraReparar.push({ id: cl.id, title: cl.title, store, lista });
        console.log(
          `  #${cl.id} "${cl.title}"\n      ⚠️  Lista contém a EQUIPE INTEIRA (${lista.length} e-mails).` +
            `\n      Efeito prático: todos veem. Assinatura típica do auto-append.` +
            `\n      Reparo sugerido: converter para "toda a equipe" (NULL).`
        );
      } else {
        totalRestritos++;
        console.log(
          `  #${cl.id} "${cl.title}"\n      🔒 Restrito a ${lista.length} de ${equipe.length}: ${lista.join(', ')}` +
            `\n      CONFERIR: o bug pode ter acrescentado gente aqui. Só o lojista sabe o certo.`
        );
      }

      if (orfaos.length > 0) {
        totalOrfaos++;
        console.log(`      ℹ️  Não batem com nenhum e-mail da equipe atual: ${orfaos.join(', ')}`);
      }
    }
  }

  console.log('\n' + '='.repeat(72));
  console.log('RESUMO');
  console.log('='.repeat(72));
  console.log(`  Toda a equipe (já corretos) ......... ${totalIrrestritos}`);
  console.log(`  Lista cobre a equipe inteira ........ ${totalEquipeInteira}  <- reparo automático seguro`);
  console.log(`  Restrição parcial ................... ${totalRestritos}  <- precisa de conferência humana`);
  console.log(`  Com e-mails órfãos .................. ${totalOrfaos}`);

  if (paraReparar.length === 0) {
    console.log('\nNada a reparar automaticamente.');
    return;
  }

  if (!APLICAR) {
    console.log(`\n${paraReparar.length} checklist(s) podem ser convertidos para "toda a equipe".`);
    console.log('Nada foi alterado. Para aplicar:');
    console.log('   node scripts/diagnostico_atribuicoes.mjs --aplicar');
    return;
  }

  console.log(`\nAplicando reparo em ${paraReparar.length} checklist(s)...`);
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    for (const c of paraReparar) {
      await cliente.query('UPDATE checklists SET assigned_to = NULL WHERE id = $1', [c.id]);
      console.log(`   #${c.id} "${c.title}" -> toda a equipe`);
    }
    await cliente.query('COMMIT');
    console.log('\nReparo concluído.');
  } catch (err) {
    await cliente.query('ROLLBACK');
    console.error('\nFalhou, nenhuma alteração foi gravada:', err.message);
    process.exitCode = 1;
  } finally {
    cliente.release();
  }
}

run()
  .catch((err) => {
    console.error('Erro:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
