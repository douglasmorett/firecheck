import pkg from 'pg';
const { Pool } = pkg;
import { GoogleGenerativeAI } from "@google/generative-ai";

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_YymnUpK7OED8@ep-green-fog-anfbkql2-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
  max: 1
});

let migrationsRun = false;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!migrationsRun) {
    try {
      await pool.query('ALTER TABLE checklist_submissions ADD COLUMN IF NOT EXISTS checklist_id INTEGER');
      migrationsRun = true;
    } catch (e) { }
  }

  try {
    const { method } = req;
    const url = req.url || '';
    const searchParams = new URL(url, `http://${req.headers.host}`).searchParams;

    // --- LOGIN / AUTH (CORRIGIDO PARA O QUE O SITE ESPERA) ---
    if (url.includes('/api/auth')) {
      if (method === 'POST') {
        const { email, password } = req.body;
        const { rows } = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND password = $2', [email, password]);
        if (rows.length > 0) {
          return res.status(200).json({ status: 'success', user: rows[0] });
        }
        return res.status(401).json({ status: 'error', error: 'E-mail ou senha incorretos.' });
      }
    }

    if (url.includes('/api/stats')) {
      const store = searchParams.get('store');
      const start = searchParams.get('start');
      const end = searchParams.get('end');
      let params = [];
      let dateQuery = '';
      let storeQuery = '';
      if (start && end) {
        dateQuery = ' WHERE created_at BETWEEN $1 AND $2';
        params = [start + ' 00:00:00', end + ' 23:59:59'];
      }
      if (store && store !== 'undefined' && store !== 'null') {
        storeQuery = (params.length > 0 ? ' AND' : ' WHERE') + ' store = $' + (params.length + 1);
        params.push(store);
      }
      const subQuery = await pool.query('SELECT feedback_info, resolved FROM checklist_submissions' + dateQuery + storeQuery, params);
      let alertasCount = 0;
      subQuery.rows.forEach(row => {
        if (row.resolved) return;
        try {
          const feedback = typeof row.feedback_info === 'string' ? JSON.parse(row.feedback_info) : (row.feedback_info || {});
          if (Object.values(feedback).some(f => f.status === 'warning' || f.status === 'error')) alertasCount++;
        } catch (e) { }
      });
      return res.status(200).json({
        checklistsHoje: 0,
        concluidos: subQuery.rows.length,
        alertasIA: alertasCount,
        colaboradores: 0,
        conformidade: subQuery.rows.length > 0 ? Math.round(((subQuery.rows.length - alertasCount) / subQuery.rows.length) * 100) : 100
      });
    }

    if (url.includes('/api/checklists')) {
       if (method === 'POST') {
          const { title, store, tasks, recurrence, scheduledDate } = req.body;
          const { rows } = await pool.query(
            'INSERT INTO checklists (title, store, tasks, recurrence, scheduled_date) VALUES ($1, $2, $3, $4, $5) RETURNING *', 
            [title, store, JSON.stringify(tasks), recurrence, scheduledDate]
          );
          return res.status(200).json(rows[0]);
       }
       const store = searchParams.get('store');
       const { rows: checklists } = await pool.query('SELECT * FROM checklists' + (store ? ' WHERE LOWER(store) = LOWER($1)' : '') + ' ORDER BY id DESC', store ? [store] : []);
       const today = new Date().toISOString().split('T')[0];
       const { rows: todaySubs } = await pool.query('SELECT checklist_id, employee_name FROM checklist_submissions WHERE store = $1 AND created_at >= $2', [store, today + ' 00:00:00']);
       return res.status(200).json(checklists.map(r => {
         const sub = todaySubs.find(s => s.checklist_id === r.id);
         return { ...r, tasks: typeof r.tasks === 'string' ? JSON.parse(r.tasks) : (r.tasks || []), completedToday: !!sub, completedBy: sub ? sub.employee_name : null };
       }));
    }

    if (url.includes('/api/users')) {
      if (method === 'POST') {
        const { name, email, password, role, store, plan } = req.body;
        const { rows } = await pool.query('INSERT INTO users (name, email, password, role, store, plan) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, store', [name, email, password, role, store, plan]);
        return res.status(200).json(rows[0]);
      }
      const store = searchParams.get('store');
      const { rows } = await pool.query('SELECT id, name, email, role, store, plan FROM users' + (store ? ' WHERE store = $1' : '') + ' ORDER BY name ASC', store ? [store] : []);
      return res.status(200).json(rows);
    }

    if (url.includes('/api/finalize')) {
      if (method === 'POST') {
        const { employeeName, store, tasks, feedbackInfo, selfie, checklistId } = req.body;
        const today = new Date().toISOString().split('T')[0];
        const checkDupe = await pool.query('SELECT employee_name FROM checklist_submissions WHERE checklist_id = $1 AND store = $2 AND created_at >= $3', [checklistId, store, today + ' 00:00:00']);
        if (checkDupe.rows.length > 0) return res.status(400).json({ message: `Este checklist já foi realizado hoje por ${checkDupe.rows[0].employee_name}.` });
        const { rows } = await pool.query('INSERT INTO checklist_submissions (employee_name, store, tasks, feedback_info, selfie, checklist_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [employeeName, store, JSON.stringify(tasks), JSON.stringify(feedbackInfo), selfie, checklistId]);
        return res.status(200).json({ success: true, id: rows[0].id });
      }
    }

    if (url.includes('/api/submissions')) {
      const store = searchParams.get('store');
      const { rows } = await pool.query('SELECT * FROM checklist_submissions' + (store ? ' WHERE store = $1' : '') + ' ORDER BY created_at DESC LIMIT 50', store ? [store] : []);
      return res.status(200).json(rows.map(r => ({ ...r, tasks: typeof r.tasks === 'string' ? JSON.parse(r.tasks) : r.tasks, feedback_info: typeof r.feedback_info === 'string' ? JSON.parse(r.feedback_info) : r.feedback_info })));
    }

    if (url.includes('/api/audit')) {
      if (method === 'POST') {
        const { taskId, taskText, photoBase64 } = req.body;
        
        // Prioriza variável de ambiente, mas usa a chave fornecida como fallback para garantir o funcionamento imediato
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || 'AIzaSyDQjcenNrC2Aw1up7l7xlzlP8r88rMlhrQ';

        if (!apiKey) {
          return res.status(200).json({ 
            approved: false, 
            message: 'ERRO DE CONFIGURAÇÃO: Chave da IA (GEMINI_API_KEY) não encontrada. A auditoria não pôde ser realizada.' 
          });
        }

        try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

          // Remover o prefixo data:image/jpeg;base64,
          const base64Data = photoBase64.split(',')[1] || photoBase64;

          const prompt = `Analise esta foto de uma tarefa de checklist: "${taskText}". 
          Responda estritamente em JSON no formato: {"approved": boolean, "message": "string"}.
          No campo message, explique detalhadamente o motivo em português.
          IMPORTANTE: Seja extremamente rigoroso. Se a foto não provar 100% que a tarefa foi feita conforme o texto, REPROVE.`;

          const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
          ]);

          const response = await result.response;
          const text = response.text();
          
          // Tentar extrair JSON da resposta do Gemini
          const jsonMatch = text.match(/\{.*\}/s);
          const aiResponse = jsonMatch ? JSON.parse(jsonMatch[0]) : { approved: false, message: 'Não foi possível analisar a imagem no momento. Tente novamente.' };

          return res.status(200).json(aiResponse);
        } catch (error) {
          console.error('Erro na auditoria Gemini:', error);
          return res.status(200).json({ 
            approved: false, 
            message: 'Erro na análise de imagem. Por favor, verifique a conexão e reenvie a foto.' 
          });
        }
      }
    }

    return res.status(200).json({ status: 'online' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}
