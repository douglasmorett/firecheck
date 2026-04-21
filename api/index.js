import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/status', (req, res) => {
  res.json({ status: 'online', diagnostics: 'Servidor respondendo sem dependencias externas' });
});

app.post('/api/login', (req, res) => {
  res.json({ status: 'success', user: { id: 1, name: 'Douglas', email: 'douglas@firecheck.com', role: 'admin' } });
});

export default app;
