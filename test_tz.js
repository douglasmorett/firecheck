import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_YymnUpK7OED8@ep-green-fog-anfbkql2-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const res = await pool.query("SELECT to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as str FROM quiz_responses LIMIT 1");
    console.log(res.rows);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

check();
