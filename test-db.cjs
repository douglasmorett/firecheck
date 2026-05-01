require('dotenv').config(); 
const { Pool } = require('pg'); 
const pool = new Pool({ connectionString: process.env.DATABASE_URL + '?sslmode=require' }); 
pool.query("SELECT * FROM quiz_responses WHERE last_step = 'landing' ORDER BY created_at DESC LIMIT 5")
  .then(res => { console.log(res.rows); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
