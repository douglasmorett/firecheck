import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_YymnUpK7OED8@ep-green-fog-anfbkql2-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  // Rota de Status
  if (pathname.includes('/status')) {
    return res.status(200).json({ status: 'online', mode: 'native' });
  }

  // Rota de Login
  if (pathname.includes('/login') && req.method === 'POST') {
    const { email, password } = req.body;
    try {
      const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      if (rows.length === 0 || rows[0].password !== password) {
        return res.status(401).json({ error: 'E-mail ou senha incorretos' });
      }
      const user = rows[0];
      return res.status(200).json({ 
        status: 'success', 
        user: { id: user.id, name: user.name, email: user.email, role: user.role, store: user.store } 
      });
    } catch (err) {
      return res.status(500).json({ error: 'Erro no banco: ' + err.message });
    }
  }

  res.status(404).json({ error: 'Rota não encontrada' });
}
