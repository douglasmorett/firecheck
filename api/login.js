const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_YymnUpK7OED8@ep-green-fog-anfbkql2-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const { email, password } = req.body;
  
  // Fallback de Emergência
  if (email === 'dugaburguer@gmail.com' && password === '12345678') {
    return res.status(200).json({ 
      status: 'success', 
      user: { id: 1, name: 'Douglas', email, role: 'admin', store: 'Loja Matriz' } 
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
    // Se o banco falhar, o fallback ainda salva o acesso do administrador
    if (email === 'dugaburguer@gmail.com') {
      return res.status(200).json({ 
        status: 'success', 
        user: { id: 1, name: 'Douglas', email, role: 'admin', store: 'Loja Matriz' } 
      });
    }
    return res.status(500).json({ error: err.message });
  }
};
