import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_YymnUpK7OED8@ep-green-fog-anfbkql2-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
    
    if (rows.length === 0) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }

    const user = rows[0];
    return res.status(200).json({ 
      status: 'success', 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role, 
        store: user.store || 'Loja Principal'
      } 
    });

  } catch (err) {
    return res.status(500).json({ error: 'Erro de Banco: ' + err.message });
  }
}
