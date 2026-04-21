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

  // Auto-migração: Garante que as colunas existam
  try {
    await pool.query('ALTER TABLE checklists ADD COLUMN IF NOT EXISTS tasks TEXT');
    await pool.query('ALTER TABLE checklists ADD COLUMN IF NOT EXISTS recurrence TEXT');
    await pool.query('ALTER TABLE checklists ADD COLUMN IF NOT EXISTS scheduled_date TEXT');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT');
  } catch (migErr) {
    console.error('Migration Error:', migErr);
  }

  const url = req.url;
  const { searchParams } = new URL(url, `http://${req.headers.host}`);
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');

  try {
    // Rota de Login
    if (url.includes('/api/auth')) {
      const { email, password } = req.body;
      const lowerEmail = email?.toLowerCase();
      
      // Fallback Douglas (Sempre Master)
      if ((lowerEmail === 'douglas@firecheck.com' || lowerEmail === 'contatohakim@gmail.com') && (password === '12345678' || password === 'Hakim@2024')) {
        return res.status(200).json({ status: 'success', user: { id: 1, name: 'Douglas Hakim', email: lowerEmail, role: 'master', store: 'Sistema Master' } });
      }

      // Fallback Duga Burguer (Sempre Dono)
      if (lowerEmail === 'dugaburguer@gmail.com' && password === '12345678') {
        return res.status(200).json({ status: 'success', user: { id: 2, name: 'Duga Burguer', email: lowerEmail, role: 'admin', store: 'Duga Burguer' } });
      }

      const { rows } = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND password = $2', [email, password]);
      if (rows.length > 0) return res.status(200).json({ status: 'success', user: rows[0] });
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Estatísticas Filtradas por Data
    if (url.includes('/api/stats')) {
      const store = searchParams.get('store');
      let dateQuery = '';
      let params = [];
      let storeQuery = '';
      
      if (startDate && endDate) {
        dateQuery = ' WHERE created_at BETWEEN $1 AND $2';
        params = [startDate + ' 00:00:00', endDate + ' 23:59:59'];
        if (store && store !== 'undefined' && store !== 'null') {
          storeQuery = ' AND store = $3';
          params.push(store);
        }
      } else if (store && store !== 'undefined' && store !== 'null') {
        storeQuery = ' WHERE store = $1';
        params = [store];
      }
      
      const checklists = await pool.query('SELECT count(*) FROM checklists' + dateQuery + storeQuery, params);
      
      let userParams = [];
      let userQuery = '';
      if (store && store !== 'undefined' && store !== 'null') {
        userQuery = ' WHERE store = $1';
        userParams = [store];
      }
      const users = await pool.query('SELECT count(*) FROM users' + userQuery, userParams);
      
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
       // Se for POST, cria um novo ou atualiza
       if (req.method === 'POST') {
          const { title, store, tasks, recurrence, scheduledDate } = req.body;
          // Tenta inserir. Se der erro de coluna, o catch vai capturar.
          try {
            const { rows } = await pool.query(
              'INSERT INTO checklists (title, store, tasks, recurrence, scheduled_date) VALUES ($1, $2, $3, $4, $5) RETURNING *', 
              [title, store, JSON.stringify(tasks), recurrence, scheduledDate]
            );
            return res.status(200).json(rows[0]);
          } catch (dbErr) {
            // Fallback caso a coluna scheduled_date não exista ainda no Neon
            const { rows } = await pool.query(
              'INSERT INTO checklists (title, store, tasks, recurrence) VALUES ($1, $2, $3, $4) RETURNING *', 
              [title, store, JSON.stringify(tasks), recurrence]
            );
            return res.status(200).json(rows[0]);
          }
       }
       const store = searchParams.get('store');
       let queryCl = 'SELECT * FROM checklists';
       let queryParams = [];
       
       if (store && store !== 'undefined' && store !== 'null') {
         queryCl += ' WHERE LOWER(store) = LOWER($1)';
         queryParams = [store];
       }
       
       queryCl += ' ORDER BY id DESC';
       const { rows } = await pool.query(queryCl, queryParams);
       
       // Converte tasks de string para objeto de forma segura
       const formattedRows = rows.map(r => {
         let tasks = [];
         try {
           tasks = typeof r.tasks === 'string' ? JSON.parse(r.tasks) : (r.tasks || []);
         } catch (e) {
           console.error('JSON Parse Error for checklist', r.id, e);
           tasks = []; // Fallback para lista vazia se o JSON estiver quebrado
         }
         return { ...r, tasks };
       });
       
       return res.status(200).json(formattedRows);
    }

    // Gestão de Usuários (Criar Cliente Manual)
    if (url.includes('/api/users')) {
      if (req.method === 'POST') {
        const { name, email, password, role, store, plan } = req.body;
        try {
          // Verifica se e-mail já existe (case-insensitive)
          const checkEmail = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
          if (checkEmail.rows.length > 0) {
            return res.status(400).json({ message: 'Este e-mail já está cadastrado no sistema.' });
          }

          const { rows } = await pool.query(
            'INSERT INTO users (name, email, password, role, store, plan) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, store, plan', 
            [name, email, password, role, store, plan]
          );
          return res.status(200).json(rows[0]);
        } catch (dbErr) {
          const { rows } = await pool.query(
            'INSERT INTO users (name, email, password, role, store) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, store', 
            [name, email, password, role, store]
          );
          return res.status(200).json(rows[0]);
        }
      }
      if (req.method === 'DELETE') {
        const id = url.split('/').pop();
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        return res.status(200).json({ success: true });
      }
      const store = searchParams.get('store');
      let queryUsers = 'SELECT id, name, email, role, store, plan FROM users';
      let queryParams = [];
      
      if (store && store !== 'undefined' && store !== 'null') {
        queryUsers += ' WHERE store = $1';
        queryParams = [store];
      }
      
      queryUsers += ' ORDER BY name ASC';
      const { rows } = await pool.query(queryUsers, queryParams);
      return res.status(200).json(rows);
    }

    return res.status(200).json({ status: 'online' });

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ message: err.message });
  }
}
