import pkg from 'pg';
const { Pool } = pkg;
import { GoogleGenerativeAI } from "@google/generative-ai";
import admin from './firebase-admin.js';

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

  // Auto-migração: Garante que as colunas existam (roda apenas uma vez por instância)
  if (!migrationsRun) {
    try {
      await pool.query('ALTER TABLE checklists ADD COLUMN IF NOT EXISTS tasks TEXT');
      await pool.query('ALTER TABLE checklists ADD COLUMN IF NOT EXISTS recurrence TEXT');
      await pool.query('ALTER TABLE checklists ADD COLUMN IF NOT EXISTS scheduled_date TEXT');
      await pool.query('ALTER TABLE checklists ADD COLUMN IF NOT EXISTS require_selfie BOOLEAN DEFAULT FALSE');
      await pool.query('ALTER TABLE checklists ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_active BOOLEAN DEFAULT TRUE');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(50)');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS wa_ponto_atraso BOOLEAN DEFAULT TRUE');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS wa_checklist_reprovado BOOLEAN DEFAULT TRUE');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS wa_checklist_atrasado BOOLEAN DEFAULT TRUE');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS wa_ponto_diario BOOLEAN DEFAULT TRUE');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS upgrade_alert_sent BOOLEAN DEFAULT FALSE");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS ponto_limit INTEGER DEFAULT 5");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS cakto_subscription_id VARCHAR(100)");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS cakto_ponto_subscription_id VARCHAR(100)");
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS checklist_submissions (
          id SERIAL PRIMARY KEY,
          employee_name TEXT,
          store TEXT,
          tasks TEXT,
          feedback_info TEXT,
          selfie TEXT,
          resolved BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query('ALTER TABLE checklist_submissions ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT FALSE');
      await pool.query('ALTER TABLE checklist_submissions ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0');
      await pool.query('UPDATE checklist_submissions SET resolved = FALSE WHERE resolved IS NULL');
      migrationsRun = true;
      console.log('Migrations completed successfully.');
    } catch (migErr) {
      console.error('Migration Error:', migErr);
    }
  }

  const url = req.url;
  const { searchParams } = new URL(url, `http://${req.headers.host}`);
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');

  try {
    // Rota de Login
    if (url.includes('/api/auth')) {
      const { email, password } = req.body;
      const lowerEmail = email?.toLowerCase();
      
      // Fallback Douglas (Sempre Master)
      if ((lowerEmail === 'douglas@firecheck.com' || lowerEmail === 'contatohakim@gmail.com') && (password === '12345678' || password === 'Hakim@2024')) {
        return res.status(200).json({ status: 'success', user: { id: 1, name: 'Douglas Hakim', email: lowerEmail, role: 'master', store: 'Sistema Master' } });
      }

      // Fallback Duga Burguer (Sempre Dono)
      if (lowerEmail === 'dugaburguer@gmail.com' && password === '12345678') {
        return res.status(200).json({ status: 'success', user: { id: 2, name: 'Duga Burguer', email: lowerEmail, role: 'admin', store: 'Duga Burguer' } });
      }

      // Fallback Google Reviewer
      if (lowerEmail === 'tester@firecheck.com' && password === 'google2024') {
        return res.status(200).json({ status: 'success', user: { id: 999, name: 'Google Reviewer', email: lowerEmail, role: 'admin', store: 'Loja de Teste' } });
      }

      const { rows } = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND password = $2', [email, password]);
      if (rows.length > 0) {
        const user = rows[0];
        // Bloqueio automático via Cakto
        if (user.status === 'blocked') {
          return res.status(403).json({ error: 'Acesso suspenso. Verifique o pagamento da sua assinatura.' });
        }
        return res.status(200).json({ status: 'success', user });
      }
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Estatísticas Filtradas por Data
    if (url.includes('/api/stats')) {
      const store = searchParams.get('store');
      let dateQuery = '';
      let params = [];
      let storeQuery = '';
      
      if (startDate && endDate) {
        dateQuery = ' WHERE created_at BETWEEN $1 AND $2';
        params = [startDate + ' 00:00:00', endDate + ' 23:59:59'];
        if (store && store !== 'undefined' && store !== 'null') {
          storeQuery = ' AND store = $3';
          params.push(store);
        }
      } else if (store && store !== 'undefined' && store !== 'null') {
        storeQuery = ' WHERE store = $1';
        params = [store];
      }
      
      // Tenta buscar contagem de checklists (templates)
      let checklistsCount = 0;
      try {
        const checklists = await pool.query('SELECT count(*) FROM checklists' + storeQuery, storeQuery ? [store] : []);
        checklistsCount = parseInt(checklists.rows[0].count);
      } catch (e) { console.error('Erro ao contar checklists templates:', e); }
      
      // Busca submissões para calcular alertas e conclusão
      let totalSubmissions = 0;
      let alertasCount = 0;
      try {
        const subQuery = await pool.query('SELECT feedback_info, resolved FROM checklist_submissions' + dateQuery + storeQuery, params);
        totalSubmissions = subQuery.rows.length;
        
        subQuery.rows.forEach(row => {
          if (row.resolved) return; // Pula se já foi resolvido
          try {
            const feedback = typeof row.feedback_info === 'string' ? JSON.parse(row.feedback_info) : (row.feedback_info || {});
            const hasError = Object.values(feedback).some(f => f.status === 'warning' || f.status === 'error');
            if (hasError) {
              alertasCount++;
            }
          } catch (e) { }
        });
        console.log(`[STATS] Total: ${totalSubmissions}, Alertas Ativos: ${alertasCount}`);
      } catch (e) { console.error('Erro ao buscar submissões para stats:', e); }

      const conformidade = totalSubmissions > 0 
        ? Math.round(((totalSubmissions - alertasCount) / totalSubmissions) * 100) 
        : 100;

      let userParams = [];
      let userQuery = '';
      if (store && store !== 'undefined' && store !== 'null') {
        userQuery = ' WHERE store = $1';
        userParams = [store];
      }
      const users = await pool.query('SELECT count(*) FROM users' + userQuery, userParams);
      
      return res.status(200).json({
        checklistsHoje: checklistsCount,
        concluidos: totalSubmissions,
        alertasIA: alertasCount,
        colaboradores: users.rows[0].count,
        conformidade: conformidade
      });
    }

    // Listagem de Checklists
    if (url.includes('/api/checklists')) {
       // Se for POST, cria um novo ou atualiza
       if (req.method === 'POST') {
          const { id, title, store, tasks, recurrence, scheduledDate, requireSelfie, category, requireSignature, assignedTo } = req.body;
          if (id) {
             try {
                const { rows } = await pool.query(
                  'UPDATE checklists SET title = $1, store = $2, tasks = $3, recurrence = $4, scheduled_date = $5, require_selfie = $6, category = $7, require_signature = $8, assigned_to = $9 WHERE id = $10 RETURNING *', 
                  [title, store, JSON.stringify(tasks), recurrence, scheduledDate, requireSelfie || false, category || 'geral', requireSignature || false, assignedTo ? JSON.stringify(assignedTo) : null, id]
                );
                return res.status(200).json(rows[0]);
             } catch (dbErr) {
                const { rows } = await pool.query(
                  'UPDATE checklists SET title = $1, store = $2, tasks = $3, recurrence = $4 WHERE id = $5 RETURNING *', 
                  [title, store, JSON.stringify(tasks), recurrence, id]
                );
                return res.status(200).json(rows[0]);
             }
          }

          // Tenta inserir. Se der erro de coluna, o catch vai capturar.
          try {
            const { rows } = await pool.query(
              'INSERT INTO checklists (title, store, tasks, recurrence, scheduled_date, require_selfie, category, require_signature, assigned_to) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *', 
              [title, store, JSON.stringify(tasks), recurrence, scheduledDate, requireSelfie || false, category || 'geral', requireSignature || false, assignedTo ? JSON.stringify(assignedTo) : null]
            );
            return res.status(200).json(rows[0]);
          } catch (dbErr) {
            // Fallback caso a coluna scheduled_date não exista ainda no Neon
            try {
               const { rows } = await pool.query(
                 'INSERT INTO checklists (title, store, tasks, recurrence, scheduled_date) VALUES ($1, $2, $3, $4, $5) RETURNING *', 
                 [title, store, JSON.stringify(tasks), recurrence, scheduledDate]
               );
               return res.status(200).json(rows[0]);
            } catch (err2) {
               const { rows } = await pool.query(
                 'INSERT INTO checklists (title, store, tasks, recurrence) VALUES ($1, $2, $3, $4) RETURNING *', 
                 [title, store, JSON.stringify(tasks), recurrence]
               );
               return res.status(200).json(rows[0]);
            }
          }
       }
       const store = searchParams.get('store');
       let queryCl = 'SELECT * FROM checklists';
       let queryParams = [];
       
       if (store && store !== 'undefined' && store !== 'null') {
         queryCl += ' WHERE LOWER(store) = LOWER($1)';
         queryParams = [store];
       }
       
       queryCl += ' ORDER BY id DESC';
       const { rows } = await pool.query(queryCl, queryParams);
       
       // Converte tasks de string para objeto de forma segura
       const formattedRows = rows.map(r => {
         let tasks = [];
         try {
           tasks = typeof r.tasks === 'string' ? JSON.parse(r.tasks) : (r.tasks || []);
         } catch (e) {
           console.error('JSON Parse Error for checklist', r.id, e);
           tasks = []; // Fallback para lista vazia se o JSON estiver quebrado
         }
         return { ...r, tasks };
       });
       
       return res.status(200).json(formattedRows);
    }

    // Gestão de Usuários (Criar Cliente Manual)
    if (url.includes('/api/users')) {
      if (req.method === 'POST') {
        const { name, email, password, role, store, plan } = req.body;
        try {
          // Verifica se e-mail já existe (case-insensitive)
          const checkEmail = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
          if (checkEmail.rows.length > 0) {
            return res.status(400).json({ message: 'Este e-mail já está cadastrado no sistema.' });
          }

          const { rows } = await pool.query(
            'INSERT INTO users (name, email, password, role, store, plan) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, store, plan', 
            [name, email, password, role, store, plan]
          );
          return res.status(200).json(rows[0]);
        } catch (dbErr) {
          const { rows } = await pool.query(
            'INSERT INTO users (name, email, password, role, store) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, store', 
            [name, email, password, role, store]
          );
          return res.status(200).json(rows[0]);
        }
      }
      if (req.method === 'DELETE') {
        const id = url.split('/').pop();
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        return res.status(200).json({ success: true });
      }
      const store = searchParams.get('store');
      let queryUsers = 'SELECT id, name, email, role, store, plan FROM users';
      let queryParams = [];
      
      if (store && store !== 'undefined' && store !== 'null') {
        queryUsers += ' WHERE store = $1';
        queryParams = [store];
      }
      
      queryUsers += ' ORDER BY name ASC';
      const { rows } = await pool.query(queryUsers, queryParams);
      return res.status(200).json(rows);
    }

    // Registro de Token FCM (Push)
    if (url.includes('/api/register-token')) {
      if (req.method === 'POST') {
        const { email, fcmToken } = req.body;
        await pool.query('UPDATE users SET fcm_token = $1 WHERE LOWER(email) = LOWER($2)', [fcmToken, email]);
        return res.status(200).json({ success: true });
      }
    }

    // Resolver Ocorrência
    if (url.includes('/api/resolve-submission')) {
      if (req.method === 'POST') {
        const { id } = req.body;
        await pool.query('UPDATE checklist_submissions SET resolved = TRUE WHERE id = $1', [id]);
        return res.status(200).json({ success: true });
      }
    }

    // Listagem de Submissões (Resultados)
    if (url.includes('/api/submissions')) {
      const store = searchParams.get('store');
      let querySub = 'SELECT * FROM checklist_submissions';
      let queryParams = [];
      
      if (store && store !== 'undefined' && store !== 'null') {
        querySub += ' WHERE store = $1';
        queryParams = [store];
      }
      
      querySub += ' ORDER BY created_at DESC LIMIT 50';
      const { rows } = await pool.query(querySub, queryParams);
      
      // Formatar JSONs
      const formatted = rows.map(r => ({
        ...r,
        tasks: typeof r.tasks === 'string' ? JSON.parse(r.tasks) : r.tasks,
        feedback_info: typeof r.feedback_info === 'string' ? JSON.parse(r.feedback_info) : r.feedback_info
      }));
      
      return res.status(200).json(formatted);
    }

    // Auditoria de Foto (IA Real com Gemini)
    if (url.includes('/api/audit')) {
      if (req.method === 'POST') {
        const { taskId, taskText, photoBase64 } = req.body;
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) throw new Error('API Key não configurada');

        if (!apiKey) {
          return res.status(200).json({
            approved: false,
            message: 'ERRO: Sistema de auditoria por IA não configurado (Falta GEMINI_API_KEY).'
          });
        }

        let retries = 2;
        let lastError = '';

        while (retries > 0) {
          try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ 
              model: "gemini-2.5-flash",
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
            Responda ESTRITAMENTE em JSON no formato: {"approved": boolean, "message": "string"}.
            NUNCA dê respostas neutras. Não use formatação markdown fora do JSON.`;

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

    // Finalização de Checklist
    if (url.includes('/api/finalize')) {
      if (req.method === 'POST') {
        const { employeeName, store, tasks, feedbackInfo, selfie } = req.body;
        const { rows } = await pool.query(
          'INSERT INTO checklist_submissions (employee_name, store, tasks, feedback_info, selfie) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [employeeName, store, JSON.stringify(tasks), JSON.stringify(feedbackInfo), selfie]
        );

        // Lógica de Notificação Push para o Dono
        const hasWarnings = Object.values(feedbackInfo || {}).some(f => f.status === 'warning' || f.status === 'error');
        if (hasWarnings) {
           try {
             // Busca o dono da loja para pegar o token FCM
             const ownerQuery = await pool.query('SELECT fcm_token FROM users WHERE store = $1 AND role = $2 AND fcm_token IS NOT NULL', [store, 'admin']);
             if (ownerQuery.rows.length > 0) {
                const token = ownerQuery.rows[0].fcm_token;
                console.log(`[PUSH] Enviando alerta para o dono da loja ${store}. Token: ${token}`);
                
                await admin.messaging().send({
                  token: token,
                  notification: {
                    title: '⚠️ Alerta na Operação',
                    body: `Irregularidade detectada na ${store} por ${employeeName}. Verifique o painel.`
                  },
                  data: {
                    url: '/dashboard'
                  },
                  apns: {
                    payload: {
                      aps: {
                        sound: 'default',
                        badge: 1
                      }
                    }
                  }
                });
             }
            } catch (e) { console.error('Erro ao processar notificação push:', e); }
         }

        // ── NOTIFICAÇÃO VIA WHATSAPP (DONO E FUNCIONÁRIO) ───────
        try {
          const evoUrl = process.env.EVOLUTION_API_URL;
          const evoKey = process.env.EVOLUTION_API_KEY;
          const evoInstance = process.env.EVOLUTION_INSTANCE || 'firecheck';

          if (evoUrl && evoKey) {
            const feedbackParsed = typeof feedbackInfo === 'string' ? JSON.parse(feedbackInfo) : (feedbackInfo || {});
            const hasWarnings = Object.values(feedbackParsed).some(f => f.status === 'warning' || f.status === 'error');

            // 1. Notificação para os Donos e Gestores (Admin/Master/Gestor)
            const { rows: storeAdmins } = await pool.query(
              "SELECT id, phone, whatsapp_active, whatsapp_phone, wa_checklist_reprovado FROM users WHERE store = $1 AND (role = 'admin' OR role = 'master' OR role = 'gestor')",
              [store]
            );
            for (const adm of storeAdmins) {
              const isWhatsappActive = adm.whatsapp_active !== false;
              const targetPhone = adm.whatsapp_phone || adm.phone;

              if (isWhatsappActive && targetPhone && hasWarnings && adm.wa_checklist_reprovado !== false) {
                const cleanPhone = targetPhone.replace(/\D/g, '');
                const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;

                const textMsg = `⚠️ *FireCheck - Checklist com Irregularidades*\n\n` +
                  `Colaborador: *${employeeName}*\n` +
                  `Loja: *${store}*\n` +
                  `Status: *⚠️ Irregularidades Detectadas*\n\n` +
                  `Acesse o painel em firecheckapp.com.br/login para ver o relatório completo. 🔥`;

                fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                  body: JSON.stringify({ number: fullPhone, text: textMsg })
                }).catch(e => console.error('[WhatsApp Admin Route] Erro:', e.message));
              }
            }

            // 2. Notificação para o Colaborador
            const { rows: employeeDetails } = await pool.query(
              "SELECT phone, whatsapp_active, whatsapp_phone FROM users WHERE store = $1 AND name = $2 LIMIT 1",
              [store, employeeName]
            );
            if (employeeDetails.length > 0) {
              const emp = employeeDetails[0];
              const isWhatsappActive = emp.whatsapp_active !== false;
              const targetPhone = emp.whatsapp_phone || emp.phone;

              if (isWhatsappActive && targetPhone) {
                const cleanPhone = targetPhone.replace(/\D/g, '');
                const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;

                const textMsg = `✅ *FireCheck - Checklist Enviado*\n\n` +
                  `Olá, *${employeeName}*! Seu checklist da loja *${store}* foi finalizado e enviado com sucesso.\n\n` +
                  `Obrigado por manter nossa operação segura! 🚀`;

                fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                  body: JSON.stringify({ number: fullPhone, text: textMsg })
                }).catch(e => console.error('[WhatsApp Funcionario Route] Erro:', e.message));
              }
            }
          }
        } catch (waErr) {
          console.error('Erro geral ao processar notificações do WhatsApp na rota curinga:', waErr);
        }

         return res.status(200).json({ success: true, id: rows[0].id });
      }
    }

    return res.status(200).json({ status: 'online' });

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ message: err.message });
  }
}
