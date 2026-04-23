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

    // ── Webhook CAKTO (Bloqueio Automático) ──────────────────────────
    if (url.includes('/api/webhooks/cakto')) {
      if (method === 'POST') {
        try {
          const payload = req.body;
          console.log('[CAKTO WEBHOOK] Recebido:', JSON.stringify(payload));
          
          // A Cakto envia dados de diferentes formas dependendo do evento.
          // Tentamos capturar o email do comprador
          const customerEmail = payload?.data?.customer?.email || payload?.customer?.email || payload?.email;
          const status = payload?.data?.status || payload?.status || payload?.event;
          
          if (!customerEmail) {
            return res.status(400).json({ error: 'E-mail não encontrado no payload' });
          }

          // Garante que a coluna status exista na tabela
          await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'");

          // Regra de Bloqueio/Liberação
          // Se o pagamento for aprovado, pago, ou assinatura ativa
          const activeStatuses = ['paid', 'approved', 'authorized', 'active', 'charge.paid', 'subscription.active'];
          const blockedStatuses = ['refunded', 'chargeback', 'refused', 'canceled', 'overdue', 'charge.refunded', 'subscription.canceled'];

          const lowerStatus = String(status).toLowerCase();
          
          let newStatus = null;
          if (activeStatuses.some(s => lowerStatus.includes(s))) newStatus = 'active';
          if (blockedStatuses.some(s => lowerStatus.includes(s))) newStatus = 'blocked';

          if (newStatus) {
            await pool.query('UPDATE users SET status = $1 WHERE email = $2', [newStatus, customerEmail]);
            console.log(`[CAKTO] Usuário ${customerEmail} teve status atualizado para: ${newStatus}`);
          }

          return res.status(200).json({ received: true });
        } catch (error) {
          console.error('[CAKTO ERROR]', error);
          return res.status(500).json({ error: error.message });
        }
      }
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
        const { rows } = await pool.query('INSERT INTO checklist_submissions (employee_name, store, tasks, feedback_info, selfie, checklist_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [employeeName, store, JSON.stringify(tasks), JSON.stringify(feedbackInfo || {}), selfie, checklistId]);
        return res.status(200).json({ success: true, id: rows[0].id });
      }
    }

    if (url.includes('/api/process-audit-background')) {
      if (method === 'POST') {
        const { submissionId } = req.body;
        
        // 1. Busca a submissão
        const { rows } = await pool.query('SELECT * FROM checklist_submissions WHERE id = $1', [submissionId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
        
        const submission = rows[0];
        const tasks = typeof submission.tasks === 'string' ? JSON.parse(submission.tasks) : submission.tasks;
        const feedbackInfo = {};
        let hasErrors = false;

        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) throw new Error('API Key não configurada');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        // 2. Processa cada foto
        for (const task of tasks) {
          if (task.photo && !task.forceOverride) {
            try {
              const base64Data = task.photo.split(',')[1] || task.photo;
              const prompt = `Você é um auditor objetivo de tarefas. Analise a foto para verificar se o que foi explicitamente pedido na tarefa "${task.text}" está presente na imagem.
              Regras:
              1. Foque APENAS em verificar se a instrução principal foi cumprida. Ignore bagunça de fundo, itens irrelevantes, qualidade do enquadramento ou iluminação.
              2. Se o item pedido está na foto, "approved": true e message deve ser um elogio curto.
              3. Se o item pedido NÃO está na foto, "approved": false e explique rapidamente o que faltou.
              Responda ESTRITAMENTE em JSON no formato: {"approved": boolean, "message": "string"}.`;

              const result = await model.generateContent([ prompt, { inlineData: { data: base64Data, mimeType: "image/jpeg" } } ]);
              const response = await result.response;
              const text = response.text();
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              const aiResponse = JSON.parse(jsonMatch ? jsonMatch[0] : text);
              
              feedbackInfo[task.id] = { status: aiResponse.approved ? 'success' : 'warning', message: aiResponse.message };
              if (!aiResponse.approved) hasErrors = true;
            } catch (error) {
              console.error('Erro na IA background (Será reprocessado automaticamente depois):', error.message || error);
              // Não preenchemos o feedbackInfo para esta tarefa.
              // Como ele ficará vazio, a foto continuará 'Pendente' e o sistema tentará de novo depois.
            }
          }
        }

        // 3. Salva o resultado no banco apenas se conseguimos processar algo
        if (Object.keys(feedbackInfo).length > 0) {
           await pool.query('UPDATE checklist_submissions SET feedback_info = $1 WHERE id = $2', [JSON.stringify(feedbackInfo), submissionId]);
        }

        // 4. Se houver falhas, dispara notificação para os donos da loja (Admin)
        if (hasErrors) {
          console.log(`[PUSH NOTIFICATION TRIGGERED] Enviando alerta para a loja ${submission.store} sobre falha no checklist de ${submission.employee_name}`);
          // TODO: Integrar OneSignal ou Firebase Admin SDK para disparar o Push Notification real para o aplicativo do Dono.
        }

        return res.status(200).json({ success: true, processed: Object.keys(feedbackInfo).length, hasErrors });
      }
    }

    if (url.includes('/api/submissions')) {
      const store = searchParams.get('store');
      const { rows } = await pool.query('SELECT * FROM checklist_submissions' + (store ? ' WHERE store = $1' : '') + ' ORDER BY created_at DESC LIMIT 50', store ? [store] : []);
      return res.status(200).json(rows.map(r => ({ ...r, tasks: typeof r.tasks === 'string' ? JSON.parse(r.tasks) : r.tasks, feedback_info: typeof r.feedback_info === 'string' ? JSON.parse(r.feedback_info) : r.feedback_info })));
    }

    if (url.includes('/api/resolve-submission')) {
      if (method === 'POST') {
        const { id, resolvedBy } = req.body;
        await pool.query('ALTER TABLE checklist_submissions ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(255)');
        await pool.query('UPDATE checklist_submissions SET resolved = true, resolved_by = $2 WHERE id = $1', [id, resolvedBy]);
        return res.status(200).json({ success: true });
      }
    }
    if (url.includes('/api/audit')) {
      if (method === 'POST') {
        const { taskId, taskText, photoBase64 } = req.body;
        
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

        if (!apiKey) {
          return res.status(200).json({ 
            approved: false, 
            message: 'ERRO DE CONFIGURAÇÃO: Chave da IA (GEMINI_API_KEY) não encontrada. A auditoria não pôde ser realizada.' 
          });
        }

        let retries = 2;
        let lastError = '';

        while (retries > 0) {
          try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ 
              model: "gemini-3-flash-preview",
              safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
              ]
            });

            const base64Data = photoBase64.split(',')[1] || photoBase64;
            const prompt = `Você é um auditor objetivo de tarefas. Analise a foto para verificar se o que foi explicitamente pedido na tarefa "${taskText}" está presente na imagem.
            Regras:
            1. Foque APENAS em verificar se a instrução principal foi cumprida. Ignore bagunça de fundo, itens irrelevantes, qualidade do enquadramento ou iluminação.
            2. Se o item pedido está na foto, "approved": true e message deve ser um elogio curto.
            3. Se o item pedido NÃO está na foto, "approved": false e explique rapidamente o que faltou.
            Responda ESTRITAMENTE em JSON no formato: {"approved": boolean, "message": "string"}.`;

            const result = await model.generateContent([
              prompt,
              { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
            ]);

            const response = await result.response;
            const text = response.text();
            
            // Extração robusta de JSON para evitar quebra com markdown (```json ... ```)
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            const cleanJson = jsonMatch ? jsonMatch[0] : text;
            
            const aiResponse = JSON.parse(cleanJson);
            return res.status(200).json(aiResponse);

          } catch (error) {
            lastError = error.message || 'Erro desconhecido';
            retries--;
            if (retries === 0) {
              console.error('Falha definitiva na auditoria SDK:', error);
              // Limpar a mensagem para remover a URL longa e mostrar apenas o erro real
              const cleanError = lastError.includes('[') ? lastError.split(': [')[1] || lastError : lastError;
              return res.status(200).json({ 
                approved: false, 
                message: `Falha: [${cleanError}` 
              });
            }
          }
        }
      }
    }

    return res.status(200).json({ status: 'online' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}
