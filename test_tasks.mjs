import pg from 'pg';
const p = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
p.query('SELECT tasks FROM checklist_submissions ORDER BY id DESC LIMIT 1').then(r => { console.log(r.rows[0].tasks); p.end(); }).catch(e => console.error(e));
