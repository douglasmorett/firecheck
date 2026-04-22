import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_YymnUpK7OED8@ep-green-fog-anfbkql2-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
  max: 1
});

let migrationsRun = false;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!migrationsRun) {
    try {
      await pool.query('ALTER TABLE checklists ADD COLUMN IF NOT EXISTS tasks TEXT');
      await pool.query('ALTER TABLE checklists ADD COLUMN IF NOT EXISTS recurrence TEXT');
      await pool.query('ALTER TABLE checklists ADD COLUMN IF NOT EXISTS scheduled_date TEXT');
      await pool.query('ALTER TABLE checklists ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS checklist_submissions (
          id SERIAL PRIMARY KEY,
          employee_name TEXT,
          store TEXT,
          tasks TEXT,
          feedback_info TEXT,
          selfie TEXT,
          resolved BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query('ALTER TABLE checklist_submissions ADD COLUMN IF NOT EXISTS checklist_id INTEGER');
      await pool.query('ALTER TABLE checklist_submissions ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT FALSE');
      await pool.query('UPDATE checklist_submissions SET resolved = FALSE WHERE resolved IS NULL');
      migrationsRun = true;
    } catch (migErr) { console.error('Migration Error:', migErr); }
  }

  try {
    const { method } = req;
    const url = req.url || '';
    const searchParams = new URL(url, `http://${req.headers.host}`).searchParams;

    if (url.includes('/api/stats')) {
      const store = searchParams.get('store');
      const start = searchParams.get('start');
      const end = searchParams.get('end');
      
      let params = [];
      let dateQuery = '';
      let storeQuery = '';
      
      if (start && end) {
        dateQuery = ' WHERE created_at BETWEEN $1 AND $2';
        params = [start + ' 00:00:00', end + ' 23:59:59'];
      }
      
      if (store && store !== 'undefined' && store !== 'null') {
        storeQuery = (params.length > 0 ? ' AND' : ' WHERE') + ' store = $' + (params.length + 1);
        params.push(store);
      }
      
      const checklists = await pool.query('SELECT count(*) FROM checklists' + storeQuery, storeQuery ? [store] : []);
      const subQuery = await pool.query('SELECT feedback_info, resolved FROM checklist_submissions' + dateQuery + storeQuery, params);
      
      let alertasCount = 0;
      subQuery.rows.forEach(row => {
        if (row.resolved) return;
        try {
          const feedback = typeof row.feedback_info === 'string' ? JSON.parse(row.feedback_info) : (row.feedback_info || {});
          if (Object.values(feedback).some(f => f.status === 'warning' || f.status === 'error')) alertasCount++;
        } catch (e) { }
      });

      const users = await pool.query('SELECT count(*) FROM users' + (storeQuery ? ' WHERE store = $1' : ''), storeQuery ? [store] : []);
      
      return res.status(200).json({
        checklistsHoje: checklists.rows[0].count,
        concluidos: subQuery.rows.length,
        alertasIA: alertasCount,
        colaboradores: users.rows[0].count,
        conformidade: subQuery.rows.length > 0 ? Math.round(((subQuery.rows.length - alertasCount) / subQuery.rows.length) * 100) : 100
      });
    }

    if (url.includes('/api/checklists')) {
       if (method === 'POST') {
          const { title, store, tasks, recurrence, scheduledDate } = req.body;
          const { rows } = await pool.query(
            'INSERT INTO checklists (title, store, tasks, recurrence, scheduled_date) VALUES ($1, $2, $3, $4, $5) RETURNING *', 
            [title, store, JSON.stringify(tasks), recurrence, scheduledDate]
          );
          return res.status(200).json(rows[0]);
       }
       const store = searchParams.get('store');
       const { rows: checklists } = await pool.query('SELECT * FROM checklists' + (store ? ' WHERE LOWER(store) = LOWER($1)' : '') + ' ORDER BY id DESC', store ? [store] : []);
       
       // Verifica conclusões de hoje
       const today = new Date().toISOString().split('T')[0];
       const { rows: todaySubs } = await pool.query(
         'SELECT checklist_id, employee_name FROM checklist_submissions WHERE store = $1 AND created_at >= $2',
         [store, today + ' 00:00:00']
       );

       const formatted = checklists.map(r => {
         const sub = todaySubs.find(s => s.checklist_id === r.id);
         return { 
           ...r, 
           tasks: typeof r.tasks === 'string' ? JSON.parse(r.tasks) : (r.tasks || []),
           completedToday: !!sub,
           completedBy: sub ? sub.employee_name : null
         };
       });

       return res.status(200).json(formatted);
    }

    if (url.includes('/api/users')) {
      if (method === 'POST') {
        const { name, email, password, role, store, plan } = req.body;
        const { rows } = await pool.query('INSERT INTO users (name, email, password, role, store, plan) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, store', [name, email, password, role, store, plan]);
        return res.status(200).json(rows[0]);
      }
      if (method === 'DELETE') {
        await pool.query('DELETE FROM users WHERE id = $1', [url.split('/').pop()]);
        return res.status(200).json({ success: true });
      }
      const store = searchParams.get('store');
      const { rows } = await pool.query('SELECT id, name, email, role, store, plan FROM users' + (store ? ' WHERE store = $1' : '') + ' ORDER BY name ASC', store ? [store] : []);
      return res.status(200).json(rows);
    }

    if (url.includes('/api/register-token')) {
      if (method === 'POST') {
        const { email, fcmToken } = req.body;
        await pool.query('UPDATE users SET fcm_token = $1 WHERE LOWER(email) = LOWER($2)', [fcmToken, email]);
        return res.status(200).json({ success: true });
      }
    }

    if (url.includes('/api/finalize')) {
      if (method === 'POST') {
        const { employeeName, store, tasks, feedbackInfo, selfie, checklistId } = req.body;
        
        // Verifica duplicidade no mesmo dia
        const today = new Date().toISOString().split('T')[0];
        const checkDupe = await pool.query(
          'SELECT employee_name FROM checklist_submissions WHERE checklist_id = $1 AND store = $2 AND created_at >= $3',
          [checklistId, store, today + ' 00:00:00']
        );
        
        if (checkDupe.rows.length > 0) {
          return res.status(400).json({ message: `Este checklist já foi realizado hoje por ${checkDupe.rows[0].employee_name}.` });
        }

        const { rows } = await pool.query(
          'INSERT INTO checklist_submissions (employee_name, store, tasks, feedback_info, selfie, checklist_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
          [employeeName, store, JSON.stringify(tasks), JSON.stringify(feedbackInfo), selfie, checklistId]
        );

        // Notificação Push (Simplificada)
        const hasWarnings = Object.values(feedbackInfo || {}).some(f => f.status === 'warning' || f.status === 'error');
        if (hasWarnings) {
           const owner = await pool.query('SELECT fcm_token FROM users WHERE store = $1 AND role = $2 AND fcm_token IS NOT NULL', [store, 'admin']);
           if (owner.rows.length > 0) {
              await fetch('https://fcm.googleapis.com/fcm/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'key=YOUR_SERVER_KEY' },
                body: JSON.stringify({ to: owner.rows[0].fcm_token, notification: { title: '🚨 Alerta IA', body: `Reprovação na loja ${store}.`, sound: 'default' } })
              }).catch(() => {});
           }
        }
        return res.status(200).json({ success: true, id: rows[0].id });
      }
    }

    if (url.includes('/api/submissions')) {
      const store = searchParams.get('store');
      const { rows } = await pool.query('SELECT * FROM checklist_submissions' + (store ? ' WHERE store = $1' : '') + ' ORDER BY created_at DESC LIMIT 50', store ? [store] : []);
      return res.status(200).json(rows.map(r => ({ ...r, tasks: typeof r.tasks === 'string' ? JSON.parse(r.tasks) : r.tasks, feedback_info: typeof r.feedback_info === 'string' ? JSON.parse(r.feedback_info) : r.feedback_info })));
    }

    if (url.includes('/api/audit')) {
      if (method === 'POST') {
        const isProblem = req.body.taskText.toLowerCase().includes('preto');
        return res.status(200).json({ approved: !isProblem, message: isProblem ? 'Cor incorreta detectada.' : 'Validado.' });
      }
    }

    return res.status(200).json({ status: 'online' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}
