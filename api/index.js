import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_YymnUpK7OED8@ep-green-fog-anfbkql2-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
  max: 1
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Se for POST, é uma tentativa de login
  if (req.method === 'POST') {
    const { email, password } = req.body;
    
    // Fallback de Emergência (Garante seu acesso de qualquer jeito)
    if ((email === 'douglas@firecheck.com' || email === 'dugaburguer@gmail.com' || email === 'contatohakim@gmail.com') && 
        (password === '12345678' || password === 'Hakim@2024')) {
      return res.status(200).json({ 
        status: 'success', 
        user: { id: 1, name: 'Douglas Hakim', email, role: 'admin', store: 'Loja Matriz' } 
      });
    }

    try {
      const { rows } = await pool.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
      if (rows.length > 0) {
        const user = rows[0];
        return res.status(200).json({ 
          status: 'success', 
          user: { id: user.id, name: user.name, email: user.email, role: user.role, store: user.store } 
        });
      }
      return res.status(401).json({ error: 'Credenciais inválidas' });
    } catch (err) {
      // Se o banco falhar, o administrador ainda entra
      if (email === 'douglas@firecheck.com' || email === 'contatohakim@gmail.com') {
         return res.json({ status: 'success', user: { id: 1, name: 'Douglas Hakim', email, role: 'admin', store: 'Loja Matriz' } });
      }
      return res.status(500).json({ error: err.message });
    }
  }

  // Se for GET, podemos retornar um status do servidor
  return res.status(200).json({ status: 'online', info: 'FireCheck API' });
}
