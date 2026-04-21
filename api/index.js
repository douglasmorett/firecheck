import express from 'express';
import cors from 'cors';
import pg from 'pg';
const { Pool } = pg;
import { GoogleGenerativeAI } from '@google/generative-ai';
import admin from 'firebase-admin';

// Inicializando Firebase Admin (Push Notifications)
try {
  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Firebase Admin inicializado via Variável de Ambiente.');
    } else if (process.env.NODE_ENV !== 'production') {
      // Fallback para arquivo local (apenas dev)
      admin.initializeApp({
        credential: admin.credential.cert('./api/firebase-service-account.json')
      });
      console.log('✅ Firebase Admin inicializado via Arquivo Local.');
    }
  }
} catch (e) {
  console.log('⚠️ Erro ao inicializar Firebase:', e.message);
}

const sendPush = async (userId, title, body) => {
  try {
    const { rows } = await pool.query('SELECT token FROM push_tokens WHERE user_id = $1', [userId]);
    const tokens = rows.map(r => r.token);
    
    if (tokens.length > 0) {
      const message = {
        notification: { title, body },
        tokens: tokens,
      };
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`🚀 ${response.successCount} notificações enviadas para o usuário ${userId}`);
    }
  } catch (err) {
    console.error('❌ Erro ao enviar Push:', err);
  }
};

const app = express();
const port = process.env.PORT || 3000;

// Inicializando a Inteligência Artificial (Gemini Oficial)
const GEMINI_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCYQsSbZUuzqzghLu8k8kmHxAHELsUiZZo';
const ai = new GoogleGenerativeAI(GEMINI_KEY);

// Configurações
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Inicializando o Banco de Dados Nuvem (Neon PostgreSQL)
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_YymnUpK7OED8@ep-green-fog-anfbkql2-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Obrigatório para Vercel + Neon
});

// Criar tabelas iniciais
const initDb = async () => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, 
      name TEXT, 
      email TEXT UNIQUE, 
      role TEXT, 
      store TEXT, 
      password TEXT, 
      plan TEXT DEFAULT 'start', 
      status TEXT DEFAULT 'pending',
      asaas_customer_id TEXT,
      asaas_subscription_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expiration_date TIMESTAMP,
      owner_id INTEGER
    )`);
    
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_id INTEGER`);
    
    await pool.query(`CREATE TABLE IF NOT EXISTS checklists (id SERIAL PRIMARY KEY, title TEXT, store TEXT, recurrence TEXT, scheduledDate TEXT, status TEXT DEFAULT 'ativo')`);
    await pool.query(`CREATE TABLE IF NOT EXISTS tasks (id SERIAL PRIMARY KEY, checklist_id INTEGER, text TEXT, type TEXT, requirePhoto BOOLEAN, timeLimit TEXT, notifyDelay BOOLEAN, options TEXT, FOREIGN KEY(checklist_id) REFERENCES checklists(id))`);
    
    await pool.query(`CREATE TABLE IF NOT EXISTS push_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // --- NOVO: MONITORAMENTO POR CÂMERAS ---
    await pool.query(`CREATE TABLE IF NOT EXISTS cameras (
      id SERIAL PRIMARY KEY,
      store TEXT,
      name TEXT,
      url TEXT,
      rules TEXT,
      status TEXT DEFAULT 'active',
      last_check TIMESTAMP,
      is_premium_active BOOLEAN DEFAULT false
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS camera_logs (
      id SERIAL PRIMARY KEY,
      camera_id INTEGER,
      image_url TEXT,
      detection_text TEXT,
      is_violation BOOLEAN,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(camera_id) REFERENCES cameras(id)
    )`);

    console.log('✅ Banco de dados Neon PostgreSQL conectado e tabelas prontas.');
  } catch (err) {
    console.error('❌ Erro ao inicializar Neon:', err.message);
  }
};
initDb();

app.get('/api/status', (req, res) => {
  res.json({ status: 'online', message: 'Servidor FireCheck rodando com Neon PostgreSQL!' });
});

// --- AUTENTICAÇÃO E LOGIN ---
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query(`SELECT * FROM users WHERE email = $1 AND password = $2`, [email, password]);
    if (rows.length === 0) return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    
    const user = rows[0];

    // Travas de Segurança
    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Pagamento pendente. Verifique seu e-mail.' });
    }
    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Sua assinatura está bloqueada por falta de pagamento.' });
    }
    if (user.expiration_date && new Date(user.expiration_date) < new Date()) {
       return res.status(403).json({ error: 'Seu tempo de acesso expirou. Por favor, renove sua assinatura.' });
    }

    res.json({ status: 'success', user: { id: user.id, name: user.name, email: user.email, role: user.role, owner_id: user.owner_id } });
  } catch (err) {
    console.error('❌ Erro no Login:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor: ' + err.message });
  }
});

// --- GERENCIAMENTO DE CHECKLISTS ---
app.get('/api/checklists', async (req, res) => {
  const query = `
    SELECT c.*, t.id as task_id, t.text as task_text, t.type as task_type, 
           t.requirephoto as require_photo, t.timelimit as time_limit, t.notifydelay as notify_delay, t.options as task_options
    FROM checklists c
    LEFT JOIN tasks t ON c.id = t.checklist_id
  `;
  try {
    const { rows } = await pool.query(query);
    const checklists = rows.reduce((acc, row) => {
      const { id, title, store, recurrence, scheduleddate, status, ...task } = row;
      if (!acc[id]) acc[id] = { id, title, store, recurrence, scheduledDate: scheduleddate, status, tasks: [] };
      if (task.task_id) {
        acc[id].tasks.push({
          id: task.task_id,
          text: task.task_text,
          type: task.task_type,
          requirePhoto: !!task.require_photo,
          timeLimit: task.time_limit,
          notifyDelay: !!task.notify_delay,
          options: JSON.parse(task.task_options || '[]')
        });
      }
      return acc;
    }, {});
    res.json(Object.values(checklists));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/checklists', async (req, res) => {
  const { id, title, store, recurrence, scheduledDate, tasks } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let checklistId = id;
    if (id) {
      await client.query(`UPDATE checklists SET title = $1, store = $2, recurrence = $3, scheduledDate = $4 WHERE id = $5`, [title, store, recurrence, scheduledDate, id]);
      await client.query(`DELETE FROM tasks WHERE checklist_id = $1`, [id]);
    } else {
      const result = await client.query(`INSERT INTO checklists (title, store, recurrence, scheduledDate) VALUES ($1, $2, $3, $4) RETURNING id`, [title, store, recurrence, scheduledDate]);
      checklistId = result.rows[0].id;
    }

    for (const t of tasks) {
      await client.query(`INSERT INTO tasks (checklist_id, text, type, requirePhoto, timeLimit, notifyDelay, options) VALUES ($1, $2, $3, $4, $5, $6, $7)`, 
        [checklistId, t.text, t.type, t.requirePhoto ? true : false, t.timeLimit, t.notifyDelay ? true : false, JSON.stringify(t.options || [])]);
    }
    
    await client.query('COMMIT');
    res.json({ status: 'success', id: checklistId });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --- EXECUÇÃO E AUDITORIA ---
const auditHandler = async (req, res) => {
  try {
    const { taskText, photoBase64 } = req.body;
    if (!photoBase64) return res.status(200).json({ status: 'error', message: 'Foto não recebida.' });
    const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
    
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent([
      `Tarefa: "${taskText}". Responda apenas: APROVADO ou REPROVADO + motivo curto.`,
      { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
    ]);
    
    const response = await result.response;
    const text = response.text();
    const isApproved = text.toUpperCase().includes('APROVADO');
    res.json({ status: 'success', approved: isApproved, message: text });
  } catch (error) {
    console.error('Erro Auditoria:', error);
    res.json({ status: 'error', approved: false, message: 'IA Indisponível' });
  }
};

app.post('/api/audit', auditHandler);
app.post('/api/finalize', async (req, res) => {
  const { employeeName, store, tasks, selfie, checklist_id, checklist_title, owner_id } = req.body;
  try {
    const hasRejection = tasks.some(t => t.aiStatus === 'reprovado' || t.forceOverride === true);
    const status = hasRejection ? 'reprovado' : 'aprovado';

    await pool.query(
      `INSERT INTO checklist_executions (checklist_id, checklist_title, employee_name, store, status, results, selfie_url, owner_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [checklist_id, checklist_title, employeeName, store, status, JSON.stringify(tasks), selfie, owner_id]
    );

    if (status === 'reprovado' && owner_id) {
      sendPush(owner_id, '🚨 Alerta de Irregularidade', `O colaborador ${employeeName} enviou um checklist com falhas.`);
    }

    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default app;
