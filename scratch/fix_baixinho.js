import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_YymnUpK7OED8@ep-green-fog-anfbkql2-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    await pool.query("UPDATE checklist_submissions SET created_at = '2026-05-03 23:59:00' WHERE id IN (20,21,22,23,24,25)");
    console.log("Updated dates for Baixinho!");
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

run();
