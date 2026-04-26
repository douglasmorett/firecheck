import pkg from 'pg';
const { Pool } = pkg;
import { GoogleGenerativeAI } from "@google/generative-ai";
import { uploadImage } from './firebase-admin.js';

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
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS camera_expiration TIMESTAMP");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS video_plays (
          id SERIAL PRIMARY KEY,
          ip VARCHAR(255),
          play_date DATE,
          UNIQUE(ip, play_date)
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS site_visits (
          id SERIAL PRIMARY KEY,
          ip VARCHAR(255),
          visit_date DATE,
          UNIQUE(ip, visit_date)
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS quiz_video_plays (
          id SERIAL PRIMARY KEY,
          ip VARCHAR(255),
          play_date DATE,
          UNIQUE(ip, play_date)
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS live_pings (
          ip VARCHAR(255) PRIMARY KEY,
          last_ping TIMESTAMP
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS quiz_responses (
          id SERIAL PRIMARY KEY,
          session_id VARCHAR(255) UNIQUE,
          ip VARCHAR(255),
          created_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'),
          last_updated_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'),
          last_step INTEGER DEFAULT -1,
          q1_answer VARCHAR(255),
          q2_answer VARCHAR(255),
          q3_answer VARCHAR(255),
          q4_answer VARCHAR(255),
          completed BOOLEAN DEFAULT FALSE,
          clicked_cta BOOLEAN DEFAULT FALSE
        )
      `);
      await pool.query("ALTER TABLE quiz_responses ADD COLUMN IF NOT EXISTS clicked_cta BOOLEAN DEFAULT FALSE");
      migrationsRun = true;
    } catch (e) { console.error('Migration error:', e); }
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
       const { rows: everSubs } = await pool.query('SELECT checklist_id, MAX(employee_name) as employee_name FROM checklist_submissions WHERE store = $1 GROUP BY checklist_id', [store]);
       
       return res.status(200).json(checklists.map(r => {
         let isCompleted = false;
         let completedBy = null;
         if (r.recurrence === 'unico') {
             const sub = everSubs.find(s => s.checklist_id === r.id);
             if (sub) { isCompleted = true; completedBy = sub.employee_name; }
         } else {
             const sub = todaySubs.find(s => s.checklist_id === r.id);
             if (sub) { isCompleted = true; completedBy = sub.employee_name; }
         }
         return { ...r, tasks: typeof r.tasks === 'string' ? JSON.parse(r.tasks) : (r.tasks || []), completedToday: isCompleted, completedBy };
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

          // Adiciona a coluna para expiração do módulo de câmeras se não existir
          await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS camera_expiration TIMESTAMP");

          if (newStatus === 'active') {
             const productName = payload?.data?.product?.name || payload?.product?.name || '';
             const isCameraModule = String(productName).toLowerCase().includes('camera') || String(productName).toLowerCase().includes('câmera');

             if (isCameraModule) {
               await pool.query(`
                 UPDATE users 
                 SET camera_expiration = NOW() + INTERVAL '30 days'
                 WHERE email = $1
               `, [customerEmail]);
               console.log(`[CAKTO] Usuário ${customerEmail} teve o MÓDULO DE CÂMERAS renovado por 30 dias!`);
             } else {
               await pool.query(`
                 UPDATE users 
                 SET status = 'active', 
                     expiration_date = NOW() + CASE WHEN plan = 'anual' THEN INTERVAL '365 days' ELSE INTERVAL '30 days' END 
                 WHERE email = $1
               `, [customerEmail]);
               console.log(`[CAKTO] Usuário ${customerEmail} teve status atualizado para ACTIVE e renovado!`);
             }
          } else if (newStatus) {
            // Se for bloqueio, bloqueia a conta principal (que indiretamente bloqueia tudo)
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

    if (url.includes('/api/signup')) {
      if (method === 'POST') {
        const { name, email, password, store, phone } = req.body;
        // status = 'trial'
        const { rows } = await pool.query(
          'INSERT INTO users (name, email, password, role, store, status, phone) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, email, role, store, status, phone, created_at', 
          [name, email, password, 'admin', store, 'trial', phone]
        );
        return res.status(200).json({ status: 'success', user: rows[0] });
      }
    }

    if (url.match(/\/api\/users\/([^\/?]+)/)) {
      const match = url.match(/\/api\/users\/([^\/?]+)/);
      const id = match[1];
      if (method === 'DELETE') {
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        return res.status(200).json({ success: true });
      }
      if (method === 'PUT') {
        const { plan, status } = req.body;
        // Se mudou para ativo, renova de acordo com o plano
        if (status === 'active') {
          await pool.query(`
            UPDATE users SET plan = $1, status = $2, 
            expiration_date = NOW() + CASE WHEN $1 = 'anual' THEN INTERVAL '365 days' ELSE INTERVAL '30 days' END
            WHERE id = $3
          `, [plan, status, id]);
        } else {
          await pool.query('UPDATE users SET plan = $1, status = $2 WHERE id = $3', [plan, status, id]);
        }
        return res.status(200).json({ success: true });
      }
    } else if (url.includes('/api/users')) {
      if (method === 'POST') {
        const { name, email, password, role, store, plan } = req.body;
        const { rows } = await pool.query('INSERT INTO users (name, email, password, role, store, plan) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, store', [name, email, password, role, store, plan]);
        return res.status(200).json(rows[0]);
      }
      const store = searchParams.get('store');
      const { rows } = await pool.query('SELECT id, name, email, role, store, plan, phone, status, created_at, expiration_date, camera_expiration FROM users' + (store ? ' WHERE store = $1' : '') + ' ORDER BY created_at DESC', store ? [store] : []);
      return res.status(200).json(rows);
    }

    if (url.includes('/api/financials')) {
      const { rows } = await pool.query("SELECT plan FROM users WHERE status = 'active' AND role = 'admin'");
      let vendasMes = 0;
      rows.forEach(u => {
         const valor = u.plan === 'anual' ? 1764 : 197;
         vendasMes += valor;
      });
      // Receita Real descontando aproximadamente 8% de taxa Cakto
      const receitaReal = vendasMes * 0.92;
      
      return res.status(200).json({
        vendasMes,
        receitaReal,
        totalArrecadado: vendasMes, // Retroativo baseado na assinatura atual
        clientesAtivos: rows.length
      });
    }

    if (url.includes('/api/ping')) {
      const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
      await pool.query(`
        INSERT INTO live_visitors (ip, last_ping) 
        VALUES ($1, NOW()) 
        ON CONFLICT (ip) DO UPDATE SET last_ping = NOW()
      `, [ip]);

      await pool.query(`
        INSERT INTO daily_visitors (ip, visit_date) 
        VALUES ($1, CURRENT_DATE) 
        ON CONFLICT (ip, visit_date) DO NOTHING
      `, [ip]);

      return res.status(200).json({ success: true });
    }

    if (url.includes('/api/track-video')) {
      const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
      await pool.query(`
        INSERT INTO video_plays (ip, play_date) 
        VALUES ($1, CURRENT_DATE) 
        ON CONFLICT (ip, play_date) DO NOTHING
      `, [ip]);
      return res.status(200).json({ success: true });
    }

    if (url.includes('/api/live-visitors')) {
      // Deleta visitantes mais antigos que 20 segundos
      await pool.query(`DELETE FROM live_visitors WHERE last_ping < NOW() - INTERVAL '20 seconds'`);
      const { rows: liveRows } = await pool.query('SELECT COUNT(*) as count FROM live_visitors');
      const { rows: dailyRows } = await pool.query('SELECT COUNT(*) as count FROM daily_visitors WHERE visit_date = CURRENT_DATE');
      const { rows: videoRows } = await pool.query('SELECT COUNT(*) as count FROM video_plays');
      
      return res.status(200).json({ 
        visitors: parseInt(liveRows[0].count, 10),
        today: parseInt(dailyRows[0].count, 10),
        videoPlays: parseInt(videoRows[0].count, 10)
      });
    }

    if (url.includes('/api/finalize')) {
      if (method === 'POST') {
        const { employeeName, store, tasks, feedbackInfo, selfie, checklistId } = req.body;
        
        // --- INTEGRAÇÃO FIREBASE STORAGE ---
        // Faz o upload das fotos das tasks
        const updatedTasks = await Promise.all(tasks.map(async (task) => {
          if (task.photo && task.photo.startsWith('data:image')) {
            const firebaseUrl = await uploadImage(task.photo, `tasks/${store}`);
            return { ...task, photo: firebaseUrl };
          }
          return task;
        }));

        // Faz o upload da selfie
        let finalSelfie = selfie;
        if (selfie && selfie.startsWith('data:image')) {
          finalSelfie = await uploadImage(selfie, `selfies/${store}`);
        }
        // ------------------------------------

        const today = new Date().toISOString().split('T')[0];
        const checkDupe = await pool.query('SELECT employee_name FROM checklist_submissions WHERE checklist_id = $1 AND store = $2 AND created_at >= $3', [checklistId, store, today + ' 00:00:00']);
        if (checkDupe.rows.length > 0) return res.status(400).json({ message: `Este checklist já foi realizado hoje por ${checkDupe.rows[0].employee_name}.` });
        
        const { rows } = await pool.query(
          'INSERT INTO checklist_submissions (employee_name, store, tasks, feedback_info, selfie, checklist_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', 
          [employeeName, store, JSON.stringify(updatedTasks), JSON.stringify(feedbackInfo || {}), finalSelfie, checklistId]
        );

        // --- ROTINA DE LIMPEZA AUTOMÁTICA (90 DIAS) ---
        // Remove submissões muito antigas para não lotar o banco
        try {
          const ninetyDaysAgo = new Date();
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
          await pool.query('DELETE FROM checklist_submissions WHERE created_at < $1', [ninetyDaysAgo]);
        } catch (cleanErr) { console.error('Erro na limpeza automática:', cleanErr); }
        // ----------------------------------------------

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
        const retryCount = (submission.retry_count || 0) + 1;
        
        // Se já tentou muitas vezes, marca como erro para não travar o painel
        if (retryCount > 5) {
          await pool.query('UPDATE checklist_submissions SET feedback_info = $1 WHERE id = $2', [JSON.stringify({ global_error: "IA Temporariamente Indisponível (Limite de tentativas excedido)" }), submissionId]);
          return res.status(200).json({ success: false, error: "Max retries exceeded" });
        }

        const tasks = typeof submission.tasks === 'string' ? JSON.parse(submission.tasks) : submission.tasks;
        const feedbackInfo = {};
        let hasErrors = false;

        // Atualiza contagem de retentativa
        await pool.query('UPDATE checklist_submissions SET retry_count = $1 WHERE id = $2', [retryCount, submissionId]);

        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) throw new Error('API Key não configurada');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        // 2. Processa cada foto
        for (const task of tasks) {
          if (task.photo && !task.forceOverride) {
            try {
              let base64Data = '';
              let mimeType = "image/jpeg";

              if (task.photo.startsWith('http')) {
                const imgRes = await fetch(task.photo);
                const arrayBuffer = await imgRes.arrayBuffer();
                base64Data = Buffer.from(arrayBuffer).toString('base64');
                mimeType = imgRes.headers.get('content-type') || "image/jpeg";
              } else {
                base64Data = task.photo.split(',')[1] || task.photo;
              }

              const prompt = `Você é um auditor objetivo de tarefas. Analise a foto para verificar se o que foi explicitamente pedido na tarefa "${task.text}" está presente na imagem.
              Regras:
              1. Foque APENAS em verificar se a instrução principal foi cumprida.
              2. Se o item pedido está na foto, "approved": true e message deve ser um elogio curto.
              3. Se o item pedido NÃO está na foto, "approved": false e explique rapidamente o que faltou.
              Responda ESTRITAMENTE em JSON: {"approved": boolean, "message": "string"}.`;

              const result = await model.generateContent([ prompt, { inlineData: { data: base64Data, mimeType } } ]);
              const response = await result.response;
              const aiResponse = JSON.parse(response.text().match(/\{[\s\S]*\}/)?.[0] || response.text());
              
              feedbackInfo[task.id] = { status: aiResponse.approved ? 'success' : 'warning', message: aiResponse.message };
              if (!aiResponse.approved) hasErrors = true;
            } catch (error) {
              console.error(`Erro na IA background (Tentativa ${retryCount}):`, error.message);
              // Não preenchemos para esta tarefa, forçando retentativa pelo robô do painel se houver fotos sem feedback
            }
          }
        }

        // 3. Salva o resultado no banco
        if (Object.keys(feedbackInfo).length > 0) {
           await pool.query('UPDATE checklist_submissions SET feedback_info = $1 WHERE id = $2', [JSON.stringify(feedbackInfo), submissionId]);
        }

        return res.status(200).json({ success: true, processed: Object.keys(feedbackInfo).length, hasErrors });
      }
    }

    if (url.includes('/api/submissions')) {
      const store = searchParams.get('store');
      const { rows } = await pool.query('SELECT * FROM checklist_submissions' + (store ? ' WHERE store = $1' : '') + ' ORDER BY created_at DESC LIMIT 50', store ? [store] : []);
      return res.status(200).json(rows.map(r => ({ ...r, tasks: typeof r.tasks === 'string' ? JSON.parse(r.tasks) : r.tasks, feedback_info: typeof r.feedback_info === 'string' ? JSON.parse(r.feedback_info) : r.feedback_info })));
    }

    if (url.includes('/api/cameras')) {
      const store = searchParams.get('store');
      if (method === 'GET') {
        const { rows } = await pool.query('SELECT * FROM store_cameras' + (store ? ' WHERE store = $1' : '') + ' ORDER BY id DESC', store ? [store] : []);
        return res.status(200).json(rows.map(r => ({ ...r, ai_commands: typeof r.ai_commands === 'string' ? JSON.parse(r.ai_commands) : r.ai_commands })));
      }
      if (method === 'POST') {
        const { store, name, url: camUrl, username, password, ai_commands } = req.body;
        await pool.query('INSERT INTO store_cameras (store, name, url, username, password, ai_commands) VALUES ($1, $2, $3, $4, $5, $6)', 
          [store, name, camUrl, username, password, JSON.stringify(ai_commands || [])]);
        return res.status(200).json({ success: true });
      }
      if (method === 'PUT') {
        const { id, store, name, url: camUrl, ai_commands } = req.body;
        await pool.query('UPDATE store_cameras SET name = $1, url = $2, ai_commands = $3 WHERE id = $4 AND store = $5', 
          [name, camUrl, JSON.stringify(ai_commands || []), id, store]);
        return res.status(200).json({ success: true });
      }
      if (method === 'DELETE') {
        const camId = url.split('/').pop();
        await pool.query('DELETE FROM store_cameras WHERE id = $1', [camId]);
        return res.status(200).json({ success: true });
      }
    }

    if (url.includes('/api/process-camera-ai')) {
      if (method === 'POST') {
        const { store, cameraName, photoBase64, commands } = req.body;
        
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'API Key ausente' });
        
        try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
          
          const base64Data = photoBase64.split(',')[1] || photoBase64;
          const prompt = `Você é um sistema de monitoramento de segurança e auditoria operacional em tempo real.
          Sua tarefa é analisar o frame atual da câmera "${cameraName}" e verificar as seguintes regras operacionais:
          ${commands.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n')}
          
          Responda ESTRITAMENTE em formato JSON com uma lista de alertas. 
          Se uma regra for DESCUMPRIDA ou o evento solicitado ESTIVER ACONTECENDO (ex: "tem muito lixo", "porta aberta"), adicione um alerta.
          Se estiver tudo normal, retorne um array vazio [].
          Formato: [{"command": "A regra quebrada", "alert": "O que você viu na imagem que quebra a regra"}]`;

          const result = await model.generateContent([ prompt, { inlineData: { data: base64Data, mimeType: "image/jpeg" } } ]);
          const response = await result.response;
          const aiResponse = JSON.parse(response.text().match(/\[[\s\S]*\]/)?.[0] || '[]');
          
          return res.status(200).json({ alerts: aiResponse });
        } catch (error) {
          console.error('Erro na IA da Câmera:', error);
          return res.status(500).json({ error: 'Falha no processamento da IA' });
        }
      }
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
    // --- Tracking Endpoints ---
    if (url.includes('/api/ping')) {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      await pool.query('INSERT INTO live_pings (ip, last_ping) VALUES ($1, NOW()) ON CONFLICT (ip) DO UPDATE SET last_ping = NOW()', [clientIp]);
      await pool.query("INSERT INTO site_visits (ip, visit_date) VALUES ($1, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date) ON CONFLICT (ip, visit_date) DO NOTHING", [clientIp]);
      return res.status(200).json({ success: true });
    }

    if (url.includes('/api/track-video')) {
      if (method === 'POST') {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        await pool.query("INSERT INTO video_plays (ip, play_date) VALUES ($1, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date) ON CONFLICT (ip, play_date) DO NOTHING", [clientIp]);
        return res.status(200).json({ success: true });
      }
    }

    if (url.includes('/api/track-quiz-video')) {
      if (method === 'POST') {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        await pool.query("INSERT INTO quiz_video_plays (ip, play_date) VALUES ($1, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date) ON CONFLICT (ip, play_date) DO NOTHING", [clientIp]);
        return res.status(200).json({ success: true });
      }
    }

    if (url.includes('/api/live-visitors')) {
      const { rows: live } = await pool.query("SELECT COUNT(*) FROM live_pings WHERE last_ping > NOW() - INTERVAL '30 seconds'");
      const { rows: today } = await pool.query("SELECT COUNT(*) FROM site_visits WHERE visit_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date");
      const { rows: video } = await pool.query("SELECT COUNT(*) FROM video_plays WHERE play_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date");
      return res.status(200).json({
        visitors: parseInt(live[0].count),
        today: parseInt(today[0].count),
        videoPlays: parseInt(video[0].count)
      });
    }
    // --- Quiz Analytics ---
    if (url.includes('/api/track-quiz')) {
      if (method === 'POST') {
        const { sessionId, step, q1, q2, q3, q4, completed, clickedCta } = req.body;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        
        await pool.query(`
          INSERT INTO quiz_responses (session_id, ip, last_step, q1_answer, q2_answer, q3_answer, q4_answer, completed, clicked_cta)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (session_id) DO UPDATE SET 
            last_updated_at = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'),
            last_step = $3,
            q1_answer = COALESCE($4, quiz_responses.q1_answer),
            q2_answer = COALESCE($5, quiz_responses.q2_answer),
            q3_answer = COALESCE($6, quiz_responses.q3_answer),
            q4_answer = COALESCE($7, quiz_responses.q4_answer),
            completed = $8,
            clicked_cta = COALESCE($9, quiz_responses.clicked_cta)
        `, [sessionId, clientIp, step, q1, q2, q3, q4, completed, clickedCta]);
        
        return res.status(200).json({ success: true });
      }
    }

    if (url.includes('/api/quiz-stats')) {
      const { rows } = await pool.query(`
        SELECT *, 
               to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') as created_at_local,
               to_char(last_updated_at, 'YYYY-MM-DD"T"HH24:MI:SS') as last_updated_at_local 
        FROM quiz_responses 
        ORDER BY last_updated_at DESC
      `);
      const { rows: online } = await pool.query("SELECT COUNT(*) FROM quiz_responses WHERE last_updated_at > (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '45 seconds'");
      const { rows: quizVideo } = await pool.query("SELECT COUNT(*) FROM quiz_video_plays WHERE play_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date");
      return res.status(200).json({ stats: rows, online: parseInt(online[0].count), quizVideoPlays: parseInt(quizVideo[0].count) });
    }

    return res.status(200).json({ status: 'online' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}
