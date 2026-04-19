const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { GoogleGenAI } = require('@google/genai');

const app = express();
const port = process.env.PORT || 3000;

// Inicializando a Inteligência Artificial
const ai = new GoogleGenAI({ apiKey: 'AIzaSyCYQsSbZUuzqzghLu8k8kmHxAHELsUiZZo' });

// Configurações
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Configuração do Asaas Sandbox
const ASAAS_API_KEY = '$7079881e-a33c-492d-9e5b-e6e664f9aba4';
const ASAAS_URL = 'https://sandbox.asaas.com/api/v3';

// Inicializando o Banco de Dados Local (SQLite)
const db = new sqlite3.Database('./firecheck.db', (err) => {
  if (err) {
    console.error('Erro ao abrir o banco', err.message);
  } else {
    console.log('✅ Banco de dados local conectado.');
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, role TEXT, store TEXT, password TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS checklists (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, store TEXT, recurrence TEXT, scheduledDate TEXT, status TEXT DEFAULT 'ativo')`);
    db.run(`CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, checklist_id INTEGER, text TEXT, type TEXT, requirePhoto INTEGER, timeLimit TEXT, notifyDelay INTEGER, options TEXT, FOREIGN KEY(checklist_id) REFERENCES checklists(id))`);
    console.log('✅ Tabelas do sistema prontas.');
  }
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'online', message: 'Servidor FireCheck rodando!' });
});

// --- GERENCIAMENTO DE CHECKLISTS ---

app.get('/api/checklists', (req, res) => {
  const query = `
    SELECT c.*, t.id as task_id, t.text as task_text, t.type as task_type, 
           t.requirePhoto, t.timeLimit, t.notifyDelay, t.options as task_options
    FROM checklists c
    LEFT JOIN tasks t ON c.id = t.checklist_id
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const checklists = rows.reduce((acc, row) => {
      const { id, title, store, recurrence, scheduledDate, status, ...task } = row;
      if (!acc[id]) acc[id] = { id, title, store, recurrence, scheduledDate, status, tasks: [] };
      if (task.task_id) {
        acc[id].tasks.push({
          id: task.task_id,
          text: task.task_text,
          type: task.task_type,
          requirePhoto: !!task.requirePhoto,
          timeLimit: task.timeLimit,
          notifyDelay: !!task.notifyDelay,
          options: JSON.parse(task.task_options || '[]')
        });
      }
      return acc;
    }, {});
    res.json(Object.values(checklists));
  });
});

app.post('/api/checklists', (req, res) => {
  const { id, title, store, recurrence, scheduledDate, tasks } = req.body;
  db.serialize(() => {
    if (id) {
      db.run(`UPDATE checklists SET title = ?, store = ?, recurrence = ?, scheduledDate = ? WHERE id = ?`, [title, store, recurrence, scheduledDate, id]);
      db.run(`DELETE FROM tasks WHERE checklist_id = ?`, [id]);
      const stmt = db.prepare(`INSERT INTO tasks (checklist_id, text, type, requirePhoto, timeLimit, notifyDelay, options) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      tasks.forEach(t => stmt.run(id, t.text, t.type, t.requirePhoto ? 1 : 0, t.timeLimit, t.notifyDelay ? 1 : 0, JSON.stringify(t.options || [])));
      stmt.finalize();
      res.json({ status: 'success' });
    } else {
      db.run(`INSERT INTO checklists (title, store, recurrence, scheduledDate) VALUES (?, ?, ?, ?)`, [title, store, recurrence, scheduledDate], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const checklistId = this.lastID;
        const stmt = db.prepare(`INSERT INTO tasks (checklist_id, text, type, requirePhoto, timeLimit, notifyDelay, options) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        tasks.forEach(t => stmt.run(checklistId, t.text, t.type, t.requirePhoto ? 1 : 0, t.timeLimit, t.notifyDelay ? 1 : 0, JSON.stringify(t.options || [])));
        stmt.finalize();
        res.json({ status: 'success', id: checklistId });
      });
    }
  });
});

// --- GERENCIAMENTO DE EQUIPE ---

app.get('/api/users', (req, res) => {
  db.all(`SELECT id, name, email, role, store FROM users`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/users', (req, res) => {
  const { name, email, role, store, password } = req.body;
  db.run(`INSERT INTO users (name, email, role, store, password) VALUES (?, ?, ?, ?, ?)`, [name, email, role || 'funcionario', store, password || '123456'], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ status: 'success', id: this.lastID });
  });
});

app.delete('/api/users/:id', (req, res) => {
  db.run(`DELETE FROM users WHERE id = ?`, [req.params.id], err => res.json({ status: err ? 'error' : 'success' }));
});

// --- ASAAS INTEGRATION ---

app.post('/api/checkout', async (req, res) => {
  const { name, email, cpfCnpj, phone, plan, cycle, amount, password } = req.body;
  console.log(`\n💳 Gerando Cobrança REAL no Sandbox Asaas para: ${name}`);
  try {
    const customerRes = await fetch(`${ASAAS_URL}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify({ name, email, cpfCnpj, mobilePhone: phone })
    });
    const customer = await customerRes.json();
    if (customer.errors) throw new Error(customer.errors[0].description);

    const subscriptionRes = await fetch(`${ASAAS_URL}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify({
        customer: customer.id,
        billingType: 'UNDEFINED',
        value: amount,
        nextDueDate: new Date(Date.now() + 86400000 * 8).toISOString().split('T')[0], // Começa a cobrar após 8 dias (7 dias de trial + 1 dia)
        cycle: cycle === 'annual' ? 'YEARLY' : 'MONTHLY',
        description: `FireCheck - Plano ${plan.toUpperCase()} (7 dias grátis)`,
      })
    });
    const subscription = await subscriptionRes.json();
    if (subscription.errors) throw new Error(subscription.errors[0].description);

    const paymentRes = await fetch(`${ASAAS_URL}/payments?subscription=${subscription.id}`, {
      headers: { 'access_token': ASAAS_API_KEY }
    });
    const payments = await paymentRes.json();
    const invoiceUrl = payments.data[0]?.invoiceUrl || `https://sandbox.asaas.com/i/${subscription.id}`;

    console.log(`✅ Assinatura gerada: ${invoiceUrl}`);

    // --- CRIAR CONTA NO SISTEMA ---
    db.run(
      `INSERT INTO users (name, email, role, store, password) VALUES (?, ?, ?, ?, ?)`,
      [name, email, 'admin', 'Loja Matriz', password],
      function(err) {
        if (err) {
          console.error('⚠️ Usuário já existe ou erro no banco:', err.message);
          // Não paramos o processo pois o pagamento já foi gerado
        } else {
          console.log(`👤 Conta criada para: ${email}`);
        }
      }
    );

    res.json({ status: 'success', invoiceUrl });
  } catch (error) {
    console.error('❌ Erro no checkout:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// --- AUDITORIA IA ---

app.post('/api/audit', async (req, res) => {
  const { taskText, photoBase64 } = req.body;
  try {
    const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
    const prompt = `Analise se esta foto comprova a execução da tarefa: "${taskText}". Responda começando com APROVADO: ou REPROVADO: e uma breve justificativa.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { data: base64Data, mimeType: 'image/jpeg' } }] }]
    });
    const text = response.text;
    res.json({ status: 'success', approved: text.toUpperCase().includes('APROVADO'), message: text });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Erro na IA.' });
  }
});

// --- AUTENTICAÇÃO E RECUPERAÇÃO ---

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email, password], (err, user) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    if (!user) return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    res.json({ status: 'success', user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });
});

app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;
  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    if (!user) return res.status(404).json({ error: 'E-mail não encontrado' });
    
    // MOCK: Envio de email (Simulação)
    console.log(`📧 [MOCK EMAIL] Enviando recuperação para: ${email}`);
    console.log(`🔗 Link: https://firecheck-grupohakim.vercel.app/reset-password?token=XYZ123`);
    
    res.json({ status: 'success', message: 'Instruções enviadas para o seu e-mail.' });
  });
});

app.post('/api/finalize', async (req, res) => {
  console.log(`\n✅ Checklist Finalizado: ${req.body.store} por ${req.body.employeeName}`);
  res.json({ status: 'success' });
});

app.listen(port, () => console.log(`🔥 FireCheck Backend rodando na porta ${port}`));
