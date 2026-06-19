import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_YymnUpK7OED8@ep-green-fog-anfbkql2-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const { rows } = await pool.query("SELECT id, name, email, password, role, store, status, plan FROM users ORDER BY id");
    console.table(rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
