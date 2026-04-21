import express from 'express';
import cors from 'cors';
import pg from 'pg';
const { Pool } = pg;

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Configuração Robusta do Banco de Dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_YymnUpK7OED8@ep-green-fog-anfbkql2-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

// Endpoint de Status (Para teste rápido)
app.get('/api/status', (req, res) => {
  res.status(200).json({ status: 'online', timestamp: new Date().toISOString() });
});

// Endpoint de Login (Onde está o erro do usuário)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
  }

  try {
    const { rows } = await pool.query('SELECT id, name, email, role, store, password, status FROM users WHERE email = $1', [email]);
    
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const user = rows[0];

    if (user.password !== password) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    // Retorno de sucesso
    res.json({ 
      status: 'success', 
      user: { id: user.id, name: user.name, email: user.email, role: user.role, store: user.store } 
    });

  } catch (err) {
    console.error('Erro no banco de dados:', err);
    res.status(500).json({ error: 'Erro de conexão com o banco de dados. Tente novamente em instantes.' });
  }
});

// Handler para Vercel
export default app;
