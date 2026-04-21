import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_YymnUpK7OED8@ep-green-fog-anfbkql2-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
  max: 1
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url;
  const { searchParams } = new URL(url, `http://${req.headers.host}`);
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');

  try {
    // Rota de Login
    if (url.includes('/api/auth')) {
      const { email, password } = req.body;
      
      // Fallback Douglas
      if ((email === 'douglas@firecheck.com' || email === 'contatohakim@gmail.com') && (password === '12345678' || password === 'Hakim@2024')) {
        return res.status(200).json({ status: 'success', user: { id: 1, name: 'Douglas Hakim', email, role: 'admin', store: 'Sistema Master' } });
      }

      const { rows } = await pool.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
      if (rows.length > 0) return res.status(200).json({ status: 'success', user: rows[0] });
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Estatísticas Filtradas por Data
    if (url.includes('/api/stats')) {
      let dateQuery = '';
      let params = [];
      if (startDate && endDate) {
        dateQuery = ' WHERE created_at BETWEEN $1 AND $2';
        params = [startDate + ' 00:00:00', endDate + ' 23:59:59'];
      }
      
      const checklists = await pool.query('SELECT count(*) FROM checklists' + dateQuery, params);
      const users = await pool.query('SELECT count(*) FROM users'); // Usuários não filtram por data geralmente
      
      return res.status(200).json({
        checklistsHoje: checklists.rows[0].count,
        concluidos: 0,
        alertasIA: 0,
        colaboradores: users.rows[0].count,
        conformidade: 100
      });
    }

    // Listagem de Checklists
    if (url.includes('/api/checklists')) {
       // Se for POST, cria um novo
       if (req.method === 'POST') {
          const { title, store, tasks, recurrence } = req.body;
          const { rows } = await pool.query('INSERT INTO checklists (title, store, tasks, recurrence) VALUES ($1, $2, $3, $4) RETURNING *', [title, store, tasks, recurrence]);
          return res.status(200).json(rows[0]);
       }
       const { rows } = await pool.query('SELECT * FROM checklists ORDER BY id DESC');
       return res.status(200).json(rows);
    }

    // Gestão de Usuários (Criar Cliente Manual)
    if (url.includes('/api/users')) {
      if (req.method === 'POST') {
        const { name, email, password, role, store } = req.body;
        const { rows } = await pool.query('INSERT INTO users (name, email, password, role, store) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, store', [name, email, password, role, store]);
        return res.status(200).json(rows[0]);
      }
      if (req.method === 'DELETE') {
        const id = url.split('/').pop();
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        return res.status(200).json({ success: true });
      }
      const { rows } = await pool.query('SELECT id, name, email, role, store FROM users ORDER BY name ASC');
      return res.status(200).json(rows);
    }

    return res.status(200).json({ status: 'online' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
