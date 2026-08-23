import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
