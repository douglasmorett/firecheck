import pg from 'pg';
const { Pool } = pg;
const p = new Pool({connectionString: process.env.DATABASE_URL, ssl: {rejectUnauthorized: false}}); 

async function run() {
  const res = await p.query('SELECT id, feedback_info, created_at, tasks FROM checklist_submissions ORDER BY id DESC LIMIT 5');
  console.log(JSON.stringify(res.rows, null, 2));
  p.end();
}
run().catch(console.error);
