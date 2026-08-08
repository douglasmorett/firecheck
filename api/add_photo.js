const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/firecheck' });
async function checkAndAdd() {
  const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='photo'");
  if (res.rows.length === 0) {
    await pool.query("ALTER TABLE users ADD COLUMN photo TEXT");
    console.log('Added photo column');
  } else {
    console.log('Photo column already exists');
  }
  process.exit(0);
}
checkAndAdd().catch(console.error);
