import pg from 'pg';
const { Pool } = pg;
const p = new Pool({connectionString: process.env.DATABASE_URL, ssl: {rejectUnauthorized: false}}); 
async function run() {
  await p.query("DELETE FROM users WHERE email = 'demo@firecheck.com'");
  await p.query("DELETE FROM checklists WHERE title = 'Auditoria de Fechamento' AND store = 'Duga Burguer'");
  console.log('Demo cleared');
  p.end();
}
run().catch(console.error);
