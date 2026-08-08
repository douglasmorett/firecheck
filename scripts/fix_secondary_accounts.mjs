/**
 * Script para converter contas secundárias que foram criadas erroneamente como admin/trial
 * para gestor/active, vinculando-as à conta pagante (Dany Menezes - Pet Nature).
 * 
 * Executar com: node scripts/fix_secondary_accounts.mjs
 * Requer: variável DATABASE_URL definida no .env.production.local
 */
import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carrega DATABASE_URL do .env.production.local manualmente
const envFile = readFileSync(resolve(__dirname, '..', '.env.production.local'), 'utf8');
const dbLine = envFile.split('\n').find(l => l.trim().startsWith('DATABASE_URL='));
if (!dbLine) { console.error('❌ DATABASE_URL não encontrada no .env.production.local'); process.exit(1); }
const eqIdx = dbLine.indexOf('=');
const DATABASE_URL = dbLine.substring(eqIdx + 1).trim().replace(/^"|"$/g, '').replace(/\\"/g, '"');

const { Pool } = pg;
const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fixSecondaryAccounts() {
  console.log('🔍 Buscando contas para corrigir...\n');

  // 1. Identificar a conta pagante (admin ativo) da loja Pet Nature
  const { rows: owners } = await pool.query(
    "SELECT id, name, email, role, status, store FROM users WHERE LOWER(store) LIKE '%pet nature%' AND role = 'admin' AND status = 'active'"
  );

  if (owners.length === 0) {
    console.log('❌ Nenhum admin ativo encontrado para "Pet Nature". Verificando todas as contas...');
    const { rows: all } = await pool.query(
      "SELECT id, name, email, role, status, store FROM users WHERE LOWER(store) LIKE '%pet nature%' ORDER BY created_at"
    );
    console.table(all);
    pool.end();
    return;
  }

  console.log('✅ Admin pagante encontrado:');
  console.table(owners);

  // 2. Encontrar as contas secundárias (admins trial na mesma loja)
  const { rows: secondaries } = await pool.query(
    "SELECT id, name, email, role, status, store FROM users WHERE LOWER(store) LIKE '%pet nature%' AND role = 'admin' AND status = 'trial'"
  );

  if (secondaries.length === 0) {
    console.log('\n✅ Nenhuma conta secundária para corrigir. Tudo certo!');
    pool.end();
    return;
  }

  console.log(`\n⚠️  ${secondaries.length} conta(s) secundária(s) encontrada(s) para converter:`);
  console.table(secondaries);

  // 3. Converter de admin/trial para gestor/active
  for (const sec of secondaries) {
    console.log(`\n🔄 Convertendo: ${sec.name} (${sec.email})`);
    console.log(`   admin/trial → gestor/active`);
    
    await pool.query(
      "UPDATE users SET role = 'gestor', status = 'active' WHERE id = $1",
      [sec.id]
    );
    
    console.log(`   ✅ Convertido com sucesso!`);
  }

  // 4. Verificar resultado final
  console.log('\n📋 Estado final de todas as contas "Pet Nature":');
  const { rows: final } = await pool.query(
    "SELECT id, name, email, role, status, store FROM users WHERE LOWER(store) LIKE '%pet nature%' ORDER BY created_at"
  );
  console.table(final);

  console.log('\n🎉 Correção concluída com sucesso!');
  pool.end();
}

fixSecondaryAccounts().catch(err => {
  console.error('❌ Erro:', err);
  pool.end();
  process.exit(1);
});
