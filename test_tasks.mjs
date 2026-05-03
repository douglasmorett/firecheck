import pg from 'pg';
const p = new pg.Pool({ connectionString: 'postgresql://neondb_owner:npg_YymnUpK7OED8@ep-green-fog-anfbkql2-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require', ssl: { rejectUnauthorized: false } });
p.query('SELECT tasks FROM checklist_submissions ORDER BY id DESC LIMIT 1').then(r => { console.log(r.rows[0].tasks); p.end(); }).catch(e => console.error(e));
