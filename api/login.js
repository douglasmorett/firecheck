import pkg from 'pg';
const { Pool } = pkg;

// Configuração de Conexão Ultra-Estável para Serverless
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_YymnUpK7OED8@ep-green-fog-anfbkql2-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
  max: 1, // Limita a 1 conexão para não estourar o limite da Vercel
  idleTimeoutMillis: 1000, // Fecha a conexão rápido
  connectionTimeoutMillis: 5000,
});

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    const client = await pool.connect();
    try {
      const { rows } = await client.query('SELECT id, name, email, role, store, password FROM users WHERE email = $1', [email]);
      
      if (rows.length === 0 || rows[0].password !== password) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }

      const user = rows[0];
      return res.status(200).json({ 
        status: 'success', 
        user: { id: user.id, name: user.name, email: user.email, role: user.role, store: user.store } 
      });
    } finally {
      client.release(); // Garante que a conexão volte para o pool imediatamente
    }

  } catch (err) {
    console.error('Erro de Servidor:', err.message);
    return res.status(500).json({ error: 'Erro interno: ' + err.message });
  }
}
