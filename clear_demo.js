import pg from 'pg';
const { Pool } = pg;
const p = new Pool({connectionString: 'postgresql://neondb_owner:npg_YymnUpK7OED8@ep-green-fog-anfbkql2-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require', ssl: {rejectUnauthorized: false}}); 
async function run() {
  await p.query("DELETE FROM users WHERE email = 'demo@firecheck.com'");
  await p.query("DELETE FROM checklists WHERE title = 'Auditoria de Fechamento' AND store = 'Duga Burguer'");
  console.log('Demo cleared');
  p.end();
}
run().catch(console.error);
