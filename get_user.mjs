import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE LOWER(email) = 'luiz.tavares.nunes.2023@gmail.com'");
    console.log("Admin details:", rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
