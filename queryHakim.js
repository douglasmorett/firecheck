import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_YymnUpK7OED8@ep-green-fog-anfbkql2-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

pool.query("SELECT email, password, name, role, store FROM users")
  .then(res => {
    console.log("All users:");
    console.dir(res.rows, { maxArrayLength: null });
    process.exit(0);
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
