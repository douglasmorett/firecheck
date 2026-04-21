import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_YymnUpK7OED8@ep-green-fog-anfbkql2-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

// Suporte a múltiplas rotas para evitar erro de redirecionamento
const statusHandler = (req, res) => res.status(200).json({ status: 'online' });
app.get('/api/status', statusHandler);
app.get('/status', statusHandler);

const loginHandler = async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (rows.length === 0 || rows[0].password !== password) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }
    const user = rows[0];
    res.json({ status: 'success', user: { id: user.id, name: user.name, email: user.email, role: user.role, store: user.store } });
  } catch (err) {
    res.status(500).json({ error: 'Erro no banco: ' + err.message });
  }
};

app.post('/api/login', loginHandler);
app.post('/login', loginHandler);

export default app;
