import pkg from 'pg';
const { Pool } = pkg;
import { GoogleGenerativeAI } from "@google/generative-ai";
import admin, { uploadImage } from './firebase-admin.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// ── Segurança: Connection string via env var (NUNCA hardcoded) ──
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // Numa função serverless cada invocação é isolada e uma conexão basta. Num
  // container de longa duração, max:1 serializaria todas as requisições atrás
  // de uma única conexão.
  max: process.env.VERCEL ? 1 : 10,
  // O compute da Neon suspende quando fica ocioso. Sem estes limites, uma
  // conexão que ficou para trás pendura a requisição indefinidamente em vez de
  // falhar e ser recriada — a tela fica carregando para sempre.
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

// Sem este ouvinte, um erro numa conexão ociosa derruba o processo inteiro,
// porque 'error' sem tratamento é exceção não capturada no Node.
pool.on('error', (err) => {
  console.error('[pg] erro em conexão ociosa:', err.message);
});

// ── JWT Secret ──
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRY = '7d'; // Token válido por 7 dias

// ── Rate Limiting em Memória ──
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minuto
const RATE_LIMIT_MAX = 10; // Máx 10 FALHAS por minuto, por e-mail e origem

// A chave combina origem e e-mail. Só por IP, uma loja inteira atrás da mesma
// conexão dividiria um contador: o colega que erra a senha bloquearia todo mundo.
function rateLimitKey(ip, email) {
  return `${ip}|${String(email || '').toLowerCase().trim()}`;
}

// Só consulta. Login bem-sucedido não consome cota — quem acerta a senha nunca
// é bloqueado, por mais gente que esteja entrando ao mesmo tempo.
function checkRateLimit(key) {
  const record = loginAttempts.get(key);
  if (!record) return true;
  if (Date.now() - record.firstAttempt > RATE_LIMIT_WINDOW) {
    loginAttempts.delete(key);
    return true;
  }
  return record.count <= RATE_LIMIT_MAX;
}

function registerLoginFailure(key) {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || (now - record.firstAttempt > RATE_LIMIT_WINDOW)) {
    loginAttempts.set(key, { count: 1, firstAttempt: now });
  } else {
    record.count++;
  }
}

function clearLoginFailures(key) {
  loginAttempts.delete(key);
}

// Limpar rate limit cache a cada 5 min para evitar memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of loginAttempts) {
    if (now - record.firstAttempt > RATE_LIMIT_WINDOW * 2) loginAttempts.delete(ip);
  }
}, 300000);

function cleanJsonString(str) {
  let inString = false;
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && (i === 0 || str[i - 1] !== '\\')) {
      inString = !inString;
      result += char;
    } else if (inString) {
      if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else if (char.charCodeAt(0) < 32) {
        // Ignora outros caracteres de controle inválidos
      } else {
        result += char;
      }
    } else {
      result += char;
    }
  }
  return result;
}

// ── Middleware de Autenticação JWT ──
// Fim do período de teste de uma conta.
// Quando trial_ends_at está preenchido, ele manda — é assim que o painel estende
// o teste de um cliente sem mexer na data de criação da conta. Sem ele, vale a
// regra original de 7 dias contados a partir de created_at.
function trialExpirado(conta) {
  if (!conta) return false;
  if (conta.trial_ends_at) return new Date(conta.trial_ends_at) < new Date();
  if (!conta.created_at) return false;
  const fim = new Date(conta.created_at);
  fim.setDate(fim.getDate() + 7);
  return fim < new Date();
}

function authenticateToken(req) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

// ── A loja sai do cadastro, não do token ────────────────────────────────
// O JWT carrega o nome da loja e vale sete dias. Quando o lojista renomeia a
// empresa no Perfil, o cadastro e as demais tabelas são atualizados em cascata,
// mas o token não — e todo aparelho já logado continua enviando o nome antigo
// até relogar. Como o nome da loja é a chave que separa um cliente do outro,
// isso quebra dos dois lados: o que se grava nasce carimbado com um nome que
// não existe mais, e o que se lê é procurado justamente por esse nome fantasma.
//
// Foi assim que dois checklists de um cliente novo ficaram invisíveis no painel
// dele: renomeou a loja pela manhã, criou os checklists à tarde com o token da
// manhã. Só o celular dele — que tinha o mesmo token antigo — os enxergava.
//
// Pior: a checagem de cota do envio procura o dono por `WHERE store = $1`. Com a
// loja fantasma não acha ninguém, e o limite do plano deixa de ser aplicado.
//
// O cadastro é a única fonte que a renomeação atualiza, então é dele que a loja
// passa a sair. Custa uma consulta por requisição autenticada.
// Devolve a grafia que o cadastro usa para esta loja.
//
// Só o master pode dizer em qual loja está gravando (o corpo da requisição manda,
// e é assim que o suporte cria coisas para um cliente). Esse nome vem da tela, que
// o leu do navegador — e navegador guarda cópia velha. Passando pelo cadastro, um
// nome desatualizado ou com espaço a mais reencontra a loja de verdade em vez de
// abrir uma loja fantasma parecida.
//
// Nome que não corresponde a nenhuma loja volta como veio: pode ser um cliente
// novo sendo cadastrado agora.
async function lojaCanonica(nome) {
  if (!nome || typeof nome !== 'string') return nome;
  try {
    const { rows } = await pool.query(
      'SELECT store FROM users WHERE LOWER(TRIM(store)) = LOWER(TRIM($1)) LIMIT 1',
      [nome]
    );
    if (rows.length > 0 && rows[0].store) return rows[0].store;
  } catch (e) {
    console.error('[loja] falha ao normalizar o nome da loja:', e.message);
  }
  return nome;
}

// Chave de loja livre, a partir do nome que o cliente digitou no cadastro.
//
// A chave é o que separa uma empresa da outra no banco, então não pode repetir:
// dois cadastros com o mesmo nome — e "Teste", "Loja", "Bomba" se repetem — cairiam
// dentro da mesma loja e passariam a enxergar os checklists um do outro.
//
// O cliente não vê nada disto: o nome que ele escolheu fica em store_name, do jeito
// que ele digitou. O desempate mora só na chave.
async function gerarChaveDeLoja(nome) {
  const base = String(nome || '').trim() || 'Loja';
  for (let n = 1; n <= 50; n++) {
    const tentativa = n === 1 ? base : `${base} (${n})`;
    try {
      const { rows } = await pool.query(
        'SELECT 1 FROM users WHERE LOWER(TRIM(store)) = LOWER(TRIM($1)) LIMIT 1',
        [tentativa]
      );
      if (rows.length === 0) return tentativa;
    } catch (e) {
      // Sem conseguir consultar, é melhor uma chave garantidamente livre do que
      // arriscar entregar a conta nova para dentro de uma loja que já existe.
      console.error('[loja] falha ao procurar chave livre:', e.message);
      return `${base} (${Date.now()})`;
    }
  }
  return `${base} (${Date.now()})`;
}

async function autenticarComLojaAtual(req) {
  const authUser = authenticateToken(req);
  if (!authUser || !authUser.id) return authUser;
  try {
    const { rows } = await pool.query('SELECT store FROM users WHERE id = $1', [authUser.id]);
    if (rows.length > 0 && rows[0].store) return { ...authUser, store: rows[0].store };
  } catch (e) {
    // Banco fora do ar não pode transformar uma requisição legítima em 401: sem
    // resposta, o token segue valendo o que já dizia.
    console.error('[loja] falha ao reler a loja do cadastro:', e.message);
  }
  return authUser;
}

// ── Domínios Permitidos (CORS) ──
const ALLOWED_ORIGINS = [
  'https://firecheckapp.com.br',
  'https://www.firecheckapp.com.br',
  'https://firecheck.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'capacitor://localhost',
  'app://localhost',
  'ionic://localhost',
  'https://localhost',
  'http://localhost'
];

let migrationsRun = false;

// ── Mapeamento de Planos → Limites de Checklists ────────────────
const ILIMITADO = 999999;

const PLAN_LIMITS = {
  // ── Planos comerciais atuais (os mesmos da landing page e do checkout) ──
  // Todos vendem "Checklists ILIMITADOS"; o teto é de colaboradores, não de
  // checklists. Sem estas chaves, uma conta nesses planos caía no padrão de 300
  // e o cliente batia num limite que nunca lhe foi anunciado.
  'checklists_mensal': ILIMITADO, 'checklists_anual': ILIMITADO,
  'combo_mensal': ILIMITADO, 'combo_anual': ILIMITADO,
  // "Só Ponto Eletrônico" não vende checklists ilimitados: o cliente compra o
  // módulo de ponto. Mantém a cota básica, que é o que o webhook de fato concede.
  'ponto_mensal': 300, 'ponto_anual': 300,

  // ── Legado: cotas da tabela antiga, mantidas para contas já existentes ──
  'starter': 300, 'starter_mensal': 300,
  'pro': 600, 'pro_mensal': 600, 'mensal': 600,
  'business': 1500, 'business_mensal': 1500, 'anual': 1500,
  'start': 300,
  'ponto_starter': 300, 'ponto_pro': 600, 'ponto_business': 1500,

  'enterprise': ILIMITADO, 'master': ILIMITADO,
  'trial': ILIMITADO, // Teste = sem limite de checklists
};

function getPlanLimit(plan) {
  return PLAN_LIMITS[(plan || 'starter').toLowerCase()] || 300;
}

function getAiCreationLimit(plan) {
  const p = (plan || 'starter').toLowerCase();
  if (p.includes('pro') || p === 'mensal') return 100;
  if (p.includes('business') || p === 'anual') return 250;
  if (p === 'enterprise' || p === 'master' || p === 'trial') return 999999;
  return 50; // default/starter (mais barato)
}

// ── Disparo de Boas-Vindas Trial via WhatsApp de Suporte (22998851680) ──
async function sendTrialWelcomeMessage(userPhone, userName, userStore) {
  if (!userPhone) return { success: false, reason: 'Telefone não informado' };
  
  const cleanPhone = userPhone.replace(/\D/g, '');
  const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
  const firstName = (userName || '').split(' ')[0] || 'Cliente';
  const storeName = userStore || 'sua loja';

  const welcomeMsg = `👋 *Olá, ${firstName}! Tudo bem?*\n\n` +
    `Seja muito bem-vindo(a) ao período de teste do *FireCheck*! 🚀\n\n` +
    `Meu nome é *Douglas* e sou o atendente responsável por te ajudar e tirar todas as suas dúvidas nesse período de adaptação para a sua loja (*${storeName}*). O que você precisar, é só falar comigo por aqui! 💬\n\n` +
    `💡 *Lembrando:* somos os próprios desenvolvedores do sistema e estamos sempre melhorando o FireCheck com o seu feedback. Qualquer sugestão ou oportunidade de melhoria, pode falar comigo!\n\n` +
    `Estou à disposição para te ajudar a configurar tudo! FireCheck 🔥`;

  const evoUrl = process.env.EVOLUTION_API_URL;
  const evoKey = process.env.EVOLUTION_API_KEY;
  // A instância do número de suporte 22998851680 na Evolution API chama-se 'evopdv'
  const evoInstance = process.env.EVOLUTION_SUPPORT_INSTANCE || 'evopdv';


  if (!evoUrl || !evoKey) {
    console.log(`[WhatsApp Suporte] API não configurada. Mensagem de boas-vindas não enviada para ${fullPhone}`);
    return { success: false, reason: 'Evolution API não configurada' };
  }

  try {
    const response = await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
      body: JSON.stringify({ number: fullPhone, text: welcomeMsg })
    });
    const data = await response.json();
    console.log(`[WhatsApp Suporte] Boas-vindas enviada para ${fullPhone} (instância: ${evoInstance}):`, data?.key?.id || 'ok');
    return { success: true, data };
  } catch (e) {
    console.error(`[WhatsApp Suporte] Falha ao enviar para ${fullPhone}:`, e.message);
    return { success: false, error: e.message };
  }
}


// ── Função de Reset de Cota ─────────────────────────────────────
async function checkAndResetQuota(pool, userId, quotaResetDate) {
  if (quotaResetDate && new Date(quotaResetDate) < new Date()) {
    const nextReset = new Date();
    nextReset.setDate(nextReset.getDate() + 30);
    await pool.query('UPDATE users SET checklists_used = 0, ai_creations_used = 0, upgrade_alert_sent = FALSE, quota_reset_date = $1 WHERE id = $2', [nextReset, userId]);
    return true;
  }
  return false;
}

async function getEmployeeScheduleForDay(pool, userId, date) {
  const { rows: users } = await pool.query('SELECT store, schedule_id, ponto_hora_entrada, ponto_hora_saida, ponto_tolerancia FROM users WHERE id = $1', [userId]);
  if (users.length === 0) return { isWorkday: true };
  const user = users[0];

  if (user.schedule_id) {
    const { rows: schedules } = await pool.query('SELECT * FROM work_schedules WHERE id = $1', [user.schedule_id]);
    if (schedules.length > 0) {
      const schedule = schedules[0];
      // O parâmetro chega ora como Date, ora como texto 'YYYY-MM-DD'.
      // Para o texto, lê as partes direto: new Date('2026-08-23') é meia-noite UTC
      // e em UTC-3 getDay() devolveria o dia anterior.
      let jsDay; // 0 = domingo
      if (date instanceof Date) {
        jsDay = date.getDay();
      } else {
        const [aa, mm, dd] = String(date).slice(0, 10).split('-').map(Number);
        jsDay = (aa && mm && dd)
          ? new Date(Date.UTC(aa, mm - 1, dd)).getUTCDay()
          : new Date(date).getDay();
      }
      const weekdayIndex = jsDay === 0 ? 7 : jsDay;
      // A tela grava domingo como 0 (convenção do JavaScript), mas esta consulta
      // procurava só por 7: a linha de domingo nunca era encontrada e o dia caía
      // no tratamento de folga, mesmo quando o gestor o marcava como trabalho.
      // Aceita os dois índices para funcionar com o que já está gravado.
      const indicesDoDia = jsDay === 0 ? [0, 7] : [jsDay];
      const { rows: weekdays } = await pool.query(
        'SELECT * FROM schedule_weekdays WHERE schedule_id = $1 AND weekday = ANY($2::int[]) ORDER BY weekday DESC LIMIT 1',
        [schedule.id, indicesDoDia]
      );
      
      if (weekdays.length > 0) {
        const wd = weekdays[0];
        if (!wd.is_workday) return { isWorkday: false };
        return {
          isWorkday: true,
          horaEntrada: wd.hora_entrada || schedule.hora_entrada,
          horaSaida: wd.hora_saida || schedule.hora_saida,
          intervaloInicio: wd.intervalo_inicio || schedule.intervalo_inicio,
          intervaloFim: wd.intervalo_fim || schedule.intervalo_fim,
          tolerancia: schedule.tolerancia
        };
      } else {
        if (weekdayIndex === 6 && !schedule.saturday_active) return { isWorkday: false };
        if (weekdayIndex === 7 && !schedule.sunday_active) return { isWorkday: false };
        return {
          isWorkday: true,
          horaEntrada: schedule.hora_entrada,
          horaSaida: schedule.hora_saida,
          intervaloInicio: schedule.intervalo_inicio,
          intervaloFim: schedule.intervalo_fim,
          tolerancia: schedule.tolerancia
        };
      }
    }
  }

  if (user.ponto_hora_entrada && user.ponto_hora_saida) {
     return {
       isWorkday: true,
       horaEntrada: user.ponto_hora_entrada,
       horaSaida: user.ponto_hora_saida,
       tolerancia: user.ponto_tolerancia || 15
     };
  }
  
  const { rows: admins } = await pool.query("SELECT ponto_hora_entrada, ponto_hora_saida, ponto_tolerancia FROM users WHERE store = $1 AND (role = 'admin' OR role = 'master') LIMIT 1", [user.store]);
  if (admins.length > 0) {
    const admin = admins[0];
    return {
       isWorkday: true,
       horaEntrada: admin.ponto_hora_entrada || '08:00',
       horaSaida: admin.ponto_hora_saida || '18:00',
       tolerancia: admin.ponto_tolerancia || 15
    };
  }

  return { isWorkday: true, horaEntrada: '08:00', horaSaida: '18:00', tolerancia: 15 };
}

// ── Função Central de Auditoria IA (Reutilizável) ───────────────
async function processAuditForSubmission(pool, submissionId) {
  const { rows } = await pool.query('SELECT * FROM checklist_submissions WHERE id = $1', [submissionId]);
  if (rows.length === 0) return { success: false, error: 'Not found' };

  const submission = rows[0];
  const retryCount = (submission.retry_count || 0) + 1;

  // Limite de 15 tentativas — depois marca como revisão manual (NÃO erro permanente)
  if (retryCount > 15) {
    const existing = typeof submission.feedback_info === 'string' ? JSON.parse(submission.feedback_info || '{}') : (submission.feedback_info || {});
    if (Object.keys(existing).length === 0) {
      await pool.query('UPDATE checklist_submissions SET feedback_info = $1 WHERE id = $2',
        [JSON.stringify({ _meta: { status: 'revisao_manual', reason: 'IA indisponível após 15 tentativas. Revisão humana necessária.', retries: retryCount } }), submissionId]);
    }
    return { success: false, error: 'Max retries exceeded — marcado para revisão manual' };
  }

  const tasks = typeof submission.tasks === 'string' ? JSON.parse(submission.tasks) : submission.tasks;
  const existingFeedback = typeof submission.feedback_info === 'string' ? JSON.parse(submission.feedback_info || '{}') : (submission.feedback_info || {});
  const feedbackInfo = { ...existingFeedback };
  // Remove meta de erro anterior se existir
  delete feedbackInfo._meta;
  delete feedbackInfo.global_error;
  let hasErrors = false;

  // Nada para auditar: o loop abaixo pula toda tarefa sem foto, então uma submissão
  // sem nenhuma foto termina sem gravar feedback. Como a busca de pendentes usa
  // feedback_info vazio como sinal de "não processado", ela seria repescada a cada
  // rodada até esgotar as 15 tentativas — e só então seria rotulada "IA indisponível",
  // que é falso: a IA nunca foi chamada. Encerra aqui, sem consumir tentativa.
  const auditaveis = (Array.isArray(tasks) ? tasks : []).filter(
    t => t && t.photo && !t.forceOverride && !feedbackInfo[t.id]
  );
  if (auditaveis.length === 0) {
    if (Object.keys(feedbackInfo).length === 0) {
      await pool.query('UPDATE checklist_submissions SET feedback_info = $1 WHERE id = $2', [
        JSON.stringify({ _meta: { status: 'sem_fotos', reason: 'Nenhuma tarefa com foto para auditar.' } }),
        submissionId,
      ]);
    }
    return { success: true, processed: 0, nothingToAudit: true, retryCount: submission.retry_count || 0 };
  }

  await pool.query('UPDATE checklist_submissions SET retry_count = $1 WHERE id = $2', [retryCount, submissionId]);

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return { success: false, error: 'API Key não configurada' };

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const errors = [];
  let processedCount = 0;

  for (const task of tasks) {
    // Pula se já tem feedback para esta task, ou se não tem foto
    if (!task.photo || task.forceOverride || feedbackInfo[task.id]) continue;

    try {
      let base64Data = '';
      let mimeType = "image/jpeg";

      if (task.photo.startsWith('http')) {
        const encodedUrl = encodeURI(task.photo);
        const imgRes = await fetch(encodedUrl);
        if (!imgRes.ok) throw new Error(`Fetch da foto falhou: ${imgRes.status}`);
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

      const result = await model.generateContent([prompt, { inlineData: { data: base64Data, mimeType } }]);
      const response = await result.response;
      const aiResponse = JSON.parse(response.text().match(/\{[\s\S]*\}/)?.[0] || response.text());

      feedbackInfo[task.id] = { status: aiResponse.approved ? 'success' : 'warning', message: aiResponse.message };
      if (!aiResponse.approved) hasErrors = true;
      processedCount++;

      // Delay de 1s entre chamadas para evitar rate-limit do Gemini
      if (tasks.indexOf(task) < tasks.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (error) {
      console.error(`[Auditoria IA] Erro task "${task.text}" (Tentativa ${retryCount}):`, error.message);
      errors.push({ taskId: task.id, error: error.message });
    }
  }

  // Salva resultado parcial ou completo
  if (processedCount > 0 || Object.keys(feedbackInfo).length > 0) {
    await pool.query('UPDATE checklist_submissions SET feedback_info = $1 WHERE id = $2', [JSON.stringify(feedbackInfo), submissionId]);
  }

  // Enviar Notificação Push em caso de irregularidades (warnings/reprovações)
  if (hasErrors) {
    try {
      const { rows: subRows } = await pool.query('SELECT store, employee_name FROM checklist_submissions WHERE id = $1', [submissionId]);
      if (subRows.length > 0) {
        const { store, employee_name: employeeName } = subRows[0];
        const { rows: admins } = await pool.query(
          "SELECT fcm_token FROM users WHERE LOWER(store) = LOWER($1) AND (role = 'admin' OR role = 'master') AND fcm_token IS NOT NULL",
          [store]
        );
        for (const adminUser of admins) {
          try {
            await admin.messaging().send({
              token: adminUser.fcm_token,
              notification: {
                title: '⚠️ Irregularidade no Checklist',
                body: `Reprovação detectada na ${store} por ${employeeName}. Verifique o painel.`
              },
              data: { url: '/admin' },
              apns: { payload: { aps: { sound: 'default', badge: 1 } } }
            });
            console.log(`[Push Auditoria] Alerta enviado para o token do admin: ${adminUser.fcm_token.substring(0, 15)}...`);
          } catch (pushErr) {
            console.error('[Push Auditoria] Erro no envio push do admin:', pushErr.message);
          }
        }
      }
    } catch (err) {
      console.error('[Push Auditoria] Erro ao buscar dados para notificação:', err.message);
    }
  }

  return { success: true, processed: processedCount, hasErrors, errors, retryCount };
}


// ── Aviso ao chefe: alguém enviou sabendo que a foto estava reprovada ──────
//
// Isto não é o alerta de irregularidade que já existe. A diferença é a ciência:
// o funcionário leu na tela o que estava errado, teve a opção de refazer, e
// escolheu enviar assim mesmo. É a única coisa nova que o chefe precisa saber.
//
// Vai por push e por WhatsApp, respeitando a mesma chave que o lojista já usa
// para desligar avisos de reprovação (wa_checklist_reprovado). Nunca derruba o
// envio: o checklist do funcionário já está gravado quando isto roda.
async function avisarEnvioConsciente(store, employeeName, itens) {
  if (!Array.isArray(itens) || itens.length === 0) return;

  const quantos = itens.length;
  const resumo = itens.slice(0, 3).map(i => `• ${i.texto}: ${i.motivo}`).join('\n');
  const sobra = quantos > 3 ? `\n• e mais ${quantos - 3}...` : '';
  const justificativas = itens.filter(i => i.justificativa).map(i => `"${i.justificativa}"`);

  try {
    const { rows: chefes } = await pool.query(
      `SELECT id, name, fcm_token, phone, whatsapp_phone, whatsapp_active, wa_checklist_reprovado
         FROM users
        WHERE LOWER(TRIM(store)) = LOWER(TRIM($1)) AND (role = 'admin' OR role = 'master' OR role = 'gestor')`,
      [store]
    );

    for (const chefe of chefes) {
      if (chefe.fcm_token) {
        try {
          await admin.messaging().send({
            token: chefe.fcm_token,
            notification: {
              title: '🚨 Enviado mesmo reprovado',
              body: `${employeeName} viu o que a IA apontou em ${quantos} ${quantos === 1 ? 'foto' : 'fotos'} e enviou assim mesmo.`,
            },
            data: { url: '/admin' },
            apns: { payload: { aps: { sound: 'default', badge: 1 } } },
          });
        } catch (pushErr) {
          console.error('[Envio consciente] Falha no push:', pushErr.message);
        }
      }

      const telefone = chefe.whatsapp_phone || chefe.phone;
      const querWhats = chefe.whatsapp_active !== false && chefe.wa_checklist_reprovado !== false;
      const evoUrl = process.env.EVOLUTION_API_URL;
      const evoKey = process.env.EVOLUTION_API_KEY;
      const evoInstance = process.env.EVOLUTION_INSTANCE || 'firecheck';

      if (telefone && querWhats && evoUrl && evoKey) {
        const limpo = String(telefone).replace(/\D/g, '');
        const numero = limpo.startsWith('55') ? limpo : '55' + limpo;
        const texto =
          `🚨 *ENVIO CIENTE DA REPROVAÇÃO*\n\n` +
          `*${employeeName}* finalizou um checklist na *${store}* depois de a conferência apontar problema em ` +
          `${quantos} ${quantos === 1 ? 'foto' : 'fotos'}. Ele viu o motivo na tela e confirmou o envio.\n\n` +
          `${resumo}${sobra}\n` +
          (justificativas.length ? `\n_Justificativa dele:_ ${justificativas.join(' / ')}\n` : '') +
          `\nConfira no painel: https://www.firecheckapp.com.br/admin`;

        fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evoKey },
          body: JSON.stringify({ number: numero, text: texto }),
        }).catch(err => console.error('[Envio consciente] Falha no WhatsApp:', err.message));
      }
    }
  } catch (e) {
    console.error('[Envio consciente] Falha ao avisar os responsáveis:', e.message);
  }
}


// ── Aviso de ocorrência ou descarte ao dono da loja ──────────────────────────
// Cada tipo tem a sua chave na aba de Notificações, porque são interesses
// diferentes: um dono pode querer saber de todo descarte e não de toda ocorrência.
async function avisarOcorrencia(store, registro) {
  const ehDescarte = registro.tipo === 'descarte';
  const titulo = ehDescarte ? '📉 Descarte registrado' : '⚠️ Ocorrência registrada';

  const corpoCurto = ehDescarte
    ? `${registro.employee_name} registrou descarte de ${[registro.quantidade, registro.unidade].filter(Boolean).join(' ')} de ${registro.item || 'item'}.`.slice(0, 160)
    : `${registro.employee_name}: ${String(registro.descricao || '').slice(0, 110)}`;

  try {
    const { rows: donos } = await pool.query(
      `SELECT id, name, fcm_token, phone, whatsapp_phone, whatsapp_active, wa_ocorrencia, wa_descarte
         FROM users
        WHERE LOWER(TRIM(store)) = LOWER(TRIM($1)) AND (role = 'admin' OR role = 'master' OR role = 'gestor')`,
      [store]
    );

    for (const dono of donos) {
      const querEste = ehDescarte ? dono.wa_descarte !== false : dono.wa_ocorrencia !== false;
      if (!querEste) continue;

      if (dono.fcm_token) {
        try {
          await admin.messaging().send({
            token: dono.fcm_token,
            notification: { title: titulo, body: corpoCurto },
            data: { url: '/admin' },
            apns: { payload: { aps: { sound: 'default', badge: 1 } } },
          });
        } catch (pushErr) {
          console.error('[Ocorrência] Falha no push:', pushErr.message);
        }
      }

      const telefone = dono.whatsapp_phone || dono.phone;
      const evoUrl = process.env.EVOLUTION_API_URL;
      const evoKey = process.env.EVOLUTION_API_KEY;
      const evoInstance = process.env.EVOLUTION_INSTANCE || 'firecheck';

      if (telefone && dono.whatsapp_active !== false && evoUrl && evoKey) {
        const limpo = String(telefone).replace(/\D/g, '');
        const numero = limpo.startsWith('55') ? limpo : '55' + limpo;

        const texto = ehDescarte
          ? `📉 *DESCARTE REGISTRADO* — ${store}\n\n` +
            `*Quem:* ${registro.employee_name}\n` +
            `*Item:* ${registro.item || '—'}\n` +
            `*Quantidade:* ${[registro.quantidade, registro.unidade].filter(Boolean).join(' ') || '—'}\n` +
            (registro.valor_estimado ? `*Valor estimado:* R$ ${Number(registro.valor_estimado).toFixed(2)}\n` : '') +
            (registro.motivo ? `*Motivo:* ${registro.motivo}\n` : '') +
            (registro.descricao ? `\n${registro.descricao}\n` : '') +
            (registro.photo ? `\n📷 Com foto anexada.` : '') +
            `\n\nVer no painel: https://www.firecheckapp.com.br/admin`
          : `⚠️ *OCORRÊNCIA REGISTRADA* — ${store}\n\n` +
            `*Quem:* ${registro.employee_name}\n\n` +
            `${registro.descricao || '—'}\n` +
            (registro.photo ? `\n📷 Com foto anexada.` : '') +
            `\n\nVer no painel: https://www.firecheckapp.com.br/admin`;

        fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evoKey },
          body: JSON.stringify({ number: numero, text: texto }),
        }).catch(err => console.error('[Ocorrência] Falha no WhatsApp:', err.message));
      }
    }
  } catch (e) {
    console.error('[Ocorrência] Falha ao avisar os responsáveis:', e.message);
  }
}


export default async function handler(req, res) {
  // ── CORS Restrito ──
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Permitir requests sem origin (ex: mobile apps, curl) mas sem cookie sharing
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  // ── Headers de Segurança ──
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!migrationsRun) {
    try {
      await pool.query('ALTER TABLE checklists ADD COLUMN IF NOT EXISTS tasks TEXT');
      await pool.query('ALTER TABLE checklists ADD COLUMN IF NOT EXISTS recurrence TEXT');
      await pool.query('ALTER TABLE checklists ADD COLUMN IF NOT EXISTS scheduled_date TEXT');
      await pool.query('ALTER TABLE checklists ADD COLUMN IF NOT EXISTS require_selfie BOOLEAN DEFAULT FALSE');
      await pool.query('ALTER TABLE checklists ADD COLUMN IF NOT EXISTS weekdays TEXT');
      await pool.query('ALTER TABLE checklist_submissions ADD COLUMN IF NOT EXISTS checklist_id INTEGER');
      await pool.query('ALTER TABLE checklist_submissions ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0');
      // Envio feito depois de a IA ter apontado o erro na tela do funcionário.
      // Fica em coluna própria, e não só dentro do JSON de feedback, porque o
      // painel precisa filtrar e contar isso sem abrir cada submissão.
      await pool.query('ALTER TABLE checklist_submissions ADD COLUMN IF NOT EXISTS enviado_ciente BOOLEAN DEFAULT FALSE');
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS photo TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS camera_expiration TIMESTAMP");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS ponto_active BOOLEAN DEFAULT FALSE");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS finance_active BOOLEAN DEFAULT FALSE");
      // ── O nome da loja deixa de ser duas coisas ao mesmo tempo ──
      // `store` é o que separa um cliente do outro: aparece em treze tabelas e em
      // setenta e oito consultas. Só que era também o nome que o lojista digita e
      // reedita no Perfil da Empresa — ou seja, a identidade da conta mudava toda
      // vez que ele resolvia caprichar no nome, e cada mudança tinha que ser
      // perseguida por todas as tabelas antes que algo ficasse para trás.
      //
      // Pior: como identidade, o nome não é confiável. Duas contas que digitem
      // "Teste" viram, para o banco, a mesma loja — uma passa a enxergar os
      // checklists da outra sem nunca ter feito nada de errado.
      //
      // A partir daqui `store` é chave e não muda mais; `store_name` é o rótulo
      // que o cliente vê e edita à vontade, inclusive repetido. Renomear a empresa
      // deixa de mexer em dado nenhum.
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS store_name TEXT");
      await pool.query("UPDATE users SET store_name = store WHERE store_name IS NULL AND store IS NOT NULL");

      // ── Ocorrências e descartes registrados pelo funcionário ──
      // O checklist cobre o que é previsto. O que sai da rotina — o freezer que
      // descongelou, a caixa de tomate que veio estragada — não tinha onde ser
      // dito, e virava conversa de corredor que não chega ao dono.
      //
      // As duas coisas moram na mesma tabela porque são o mesmo gesto (alguém no
      // chão relatando um fato, com foto opcional) e mudam só nos campos de
      // quantidade e valor. `tipo` separa as duas na leitura.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ocorrencias (
          id SERIAL PRIMARY KEY,
          store TEXT,
          tipo TEXT NOT NULL DEFAULT 'ocorrencia',
          employee_name TEXT,
          employee_id INTEGER,
          descricao TEXT,
          photo TEXT,
          item TEXT,
          quantidade TEXT,
          unidade TEXT,
          valor_estimado NUMERIC(10,2),
          motivo TEXT,
          resolvido BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_ocorrencias_store_data ON ocorrencias (store, created_at DESC)');
      // Avisos novos nascem ligados: quem acabou de registrar um descarte espera
      // que o dono saiba, e o dono desliga se não quiser.
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS wa_ocorrencia BOOLEAN DEFAULT TRUE");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS wa_descarte BOOLEAN DEFAULT TRUE");
      // ── Cota de Checklists ──
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS checklist_limit INTEGER DEFAULT 300");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS checklists_used INTEGER DEFAULT 0");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS quota_reset_date TIMESTAMP");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_creations_used INTEGER DEFAULT 0");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS upgrade_alert_sent BOOLEAN DEFAULT FALSE");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS ponto_limit INTEGER DEFAULT 5");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS ponto_last_worked_day TIMESTAMP");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS cakto_subscription_id VARCHAR(100)");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS cakto_ponto_subscription_id VARCHAR(100)");
      // Migrar limites de ponto para planos existentes
      await pool.query("UPDATE users SET ponto_limit = 15 WHERE plan IN ('pro', 'pro_mensal', 'mensal') AND (ponto_limit IS NULL OR ponto_limit = 5)");
      await pool.query("UPDATE users SET ponto_limit = 50 WHERE plan IN ('business', 'business_mensal', 'anual') AND (ponto_limit IS NULL OR ponto_limit = 5)");
      await pool.query("UPDATE users SET ponto_limit = 999999 WHERE plan = 'enterprise' OR role = 'master'");
      // Migrar planos existentes para os limites corretos
      await pool.query("UPDATE users SET checklist_limit = 600 WHERE plan IN ('mensal', 'pro', 'pro_mensal') AND checklist_limit = 300");
      await pool.query("UPDATE users SET checklist_limit = 1500 WHERE plan IN ('anual', 'business', 'business_mensal') AND checklist_limit = 300");
      await pool.query("UPDATE users SET checklist_limit = 999999 WHERE plan IN ('enterprise') OR role = 'master'");
      // Setar quota_reset_date para quem não tem
      await pool.query("UPDATE users SET quota_reset_date = NOW() + INTERVAL '30 days' WHERE quota_reset_date IS NULL AND role = 'admin'");
      // ── Integração Bill SaaS ──
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bill_user_id TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bill_token TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bill_name TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bill_plan TEXT");
      // ── Permissões do Gestor ──
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT");
      // Fim do período de teste. Quando nulo, vale a regra antiga de 7 dias a
      // partir de created_at. Preenchido, permite estender o teste de um cliente
      // sem falsificar a data de criação da conta.
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP");
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
          last_ping TIMESTAMP,
          device_type VARCHAR(50) DEFAULT 'unknown'
        )
      `);
      await pool.query("ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS device_type VARCHAR(50) DEFAULT 'unknown'");
      await pool.query("ALTER TABLE live_pings ADD COLUMN IF NOT EXISTS device_type VARCHAR(50) DEFAULT 'unknown'");
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
      await pool.query("ALTER TABLE quiz_responses ADD COLUMN IF NOT EXISTS clicked_button VARCHAR(255)");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS behavior_events (
          id SERIAL PRIMARY KEY,
          session_id VARCHAR(255),
          ip VARCHAR(255),
          event_type VARCHAR(100),
          event_data TEXT,
          page VARCHAR(255),
          device_type VARCHAR(50) DEFAULT 'unknown',
          created_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')
        )
      `);
      // ── Tabela de Ponto ──
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ponto_records (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          user_name VARCHAR(255),
          store VARCHAR(255),
          type VARCHAR(10),
          timestamp TIMESTAMP DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'),
          latitude DECIMAL(10, 8),
          longitude DECIMAL(11, 8),
          accuracy DECIMAL(10, 2),
          selfie_url TEXT,
          address TEXT,
          device_info TEXT
        )
      `);
      // ── Migrar colunas com nomes antigos da tabela ponto_records ──
      await pool.query(`
        DO $$ 
        BEGIN
          -- Se punch_type existe, dropar type duplicado e renomear punch_type -> type
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ponto_records' AND column_name = 'punch_type') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ponto_records' AND column_name = 'type') THEN
              ALTER TABLE ponto_records DROP COLUMN type;
            END IF;
            ALTER TABLE ponto_records RENAME COLUMN punch_type TO type;
          END IF;
          -- Se punch_timestamp existe, dropar timestamp duplicado e renomear
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ponto_records' AND column_name = 'punch_timestamp') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ponto_records' AND column_name = 'timestamp') THEN
              ALTER TABLE ponto_records DROP COLUMN "timestamp";
            END IF;
            ALTER TABLE ponto_records RENAME COLUMN punch_timestamp TO "timestamp";
          END IF;
        END $$;
      `);
      // ── Garantir TODAS as colunas na tabela ponto_records ──
      await pool.query("ALTER TABLE ponto_records ADD COLUMN IF NOT EXISTS user_id INTEGER");
      await pool.query("ALTER TABLE ponto_records ADD COLUMN IF NOT EXISTS user_name VARCHAR(255)");
      await pool.query("ALTER TABLE ponto_records ADD COLUMN IF NOT EXISTS store VARCHAR(255)");
      await pool.query("ALTER TABLE ponto_records ADD COLUMN IF NOT EXISTS type VARCHAR(10)");
      await pool.query("ALTER TABLE ponto_records ADD COLUMN IF NOT EXISTS \"timestamp\" TIMESTAMP DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')");
      await pool.query("ALTER TABLE ponto_records ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8)");
      await pool.query("ALTER TABLE ponto_records ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8)");
      await pool.query("ALTER TABLE ponto_records ADD COLUMN IF NOT EXISTS accuracy DECIMAL(10, 2)");
      await pool.query("ALTER TABLE ponto_records ADD COLUMN IF NOT EXISTS selfie_url TEXT");
      await pool.query("ALTER TABLE ponto_records ADD COLUMN IF NOT EXISTS address TEXT");
      await pool.query("ALTER TABLE ponto_records ADD COLUMN IF NOT EXISTS device_info TEXT");
      await pool.query("ALTER TABLE ponto_records ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE");
      await pool.query("ALTER TABLE ponto_records ADD COLUMN IF NOT EXISTS notes TEXT");
      await pool.query("ALTER TABLE ponto_records ADD COLUMN IF NOT EXISTS edited_by TEXT");
      await pool.query("ALTER TABLE ponto_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP");
      // ── Dropar colunas antigas que sobraram (sem dados relevantes) ──
      await pool.query("ALTER TABLE ponto_records DROP COLUMN IF EXISTS punch_type");
      await pool.query("ALTER TABLE ponto_records DROP COLUMN IF EXISTS punch_timestamp");
      // ── Tabela de Câmeras ──
      await pool.query(`
        CREATE TABLE IF NOT EXISTS store_cameras (
          id SERIAL PRIMARY KEY,
          store VARCHAR(255),
          name VARCHAR(255),
          url TEXT,
          username VARCHAR(255),
          password VARCHAR(255),
          ai_commands TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      // ── FCM Token para Push Notifications ──
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT");
      // ── Fuso Horário da Loja ──
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo'");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS contador_email VARCHAR(255)");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS fechamento_dia VARCHAR(50) DEFAULT 'ultimo_dia'");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS ponto_hora_entrada VARCHAR(5) DEFAULT '08:00'");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS ponto_hora_saida VARCHAR(5) DEFAULT '18:00'");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS ponto_tolerancia INTEGER DEFAULT 15");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_active BOOLEAN DEFAULT TRUE");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(50)");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS wa_ponto_atraso BOOLEAN DEFAULT TRUE");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS wa_checklist_reprovado BOOLEAN DEFAULT TRUE");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS wa_checklist_atrasado BOOLEAN DEFAULT TRUE");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS wa_ponto_diario BOOLEAN DEFAULT TRUE");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS wa_ponto_ausencia BOOLEAN DEFAULT TRUE");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS wa_checklist_aprovado BOOLEAN DEFAULT TRUE");
      // ── Tabela de Veículos e melhorias de checklists ──
      await pool.query(`
        CREATE TABLE IF NOT EXISTS vehicles (
          id SERIAL PRIMARY KEY,
          store VARCHAR(255),
          plate VARCHAR(50),
          model VARCHAR(255),
          brand VARCHAR(255),
          color VARCHAR(50),
          year INTEGER,
          current_km DECIMAL(10, 2),
          photo_url TEXT,
          status VARCHAR(50) DEFAULT 'ativo',
          employee_id INTEGER,
          tasks TEXT,
          schedule_type VARCHAR(50) DEFAULT 'manual',
          schedule_data TEXT,
          last_requested_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await pool.query("ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS employee_id INTEGER");
      await pool.query("ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tasks TEXT");
      await pool.query("ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(50) DEFAULT 'manual'");
      await pool.query("ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS schedule_data TEXT");
      await pool.query("ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS last_requested_at TIMESTAMP");
      await pool.query("ALTER TABLE checklists ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'geral'");
      await pool.query("ALTER TABLE checklists ADD COLUMN IF NOT EXISTS assigned_to TEXT");
      await pool.query("ALTER TABLE checklists ADD COLUMN IF NOT EXISTS require_signature BOOLEAN DEFAULT FALSE");
      await pool.query("ALTER TABLE checklists ADD COLUMN IF NOT EXISTS asset_link_type VARCHAR(100)");
      await pool.query("ALTER TABLE checklist_submissions ADD COLUMN IF NOT EXISTS vehicle_id INTEGER");
      await pool.query("ALTER TABLE checklist_submissions ADD COLUMN IF NOT EXISTS signature TEXT");
      // ── Normalização de Atribuição de Checklists/Listas de Compras ──
      await pool.query("UPDATE checklists SET assigned_to = NULL WHERE assigned_to = 'todos' OR assigned_to = '\"todos\"' OR assigned_to = 'pendente' OR assigned_to = '[]' OR assigned_to = 'null' OR assigned_to = '\"null\"' OR assigned_to = ''");
      await pool.query("UPDATE shopping_lists SET assigned_to = NULL WHERE assigned_to = 'todos' OR assigned_to = '\"todos\"' OR assigned_to = 'pendente' OR assigned_to = '[]' OR assigned_to = 'null' OR assigned_to = '\"null\"' OR assigned_to = ''");
      // ── Tabela de Conversas WhatsApp (Chatbot) ──
      await pool.query(`
        CREATE TABLE IF NOT EXISTS wa_conversations (
          id SERIAL PRIMARY KEY,
          phone VARCHAR(50) NOT NULL,
          user_id INTEGER,
          store VARCHAR(255),
          role VARCHAR(20),
          messages JSONB DEFAULT '[]',
          last_intent VARCHAR(100),
          context JSONB DEFAULT '{}',
          updated_at TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await pool.query("CREATE INDEX IF NOT EXISTS idx_wa_conv_phone ON wa_conversations(phone)");
      // ── Tabela de Listas de Compras (Módulo de Compras) ──
      await pool.query(`
        CREATE TABLE IF NOT EXISTS shopping_lists (
          id SERIAL PRIMARY KEY,
          store VARCHAR(255) NOT NULL,
          title VARCHAR(255) NOT NULL,
          recurrence VARCHAR(50) DEFAULT 'weekly',
          weekdays TEXT,
          scheduled_date TEXT,
          assigned_to TEXT,
          category VARCHAR(100) DEFAULT 'compras',
          active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS shopping_items (
          id SERIAL PRIMARY KEY,
          shopping_list_id INTEGER REFERENCES shopping_lists(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          unit VARCHAR(50) DEFAULT 'un',
          min_stock DECIMAL(10,2) DEFAULT 0,
          current_stock DECIMAL(10,2),
          category VARCHAR(100) DEFAULT 'geral',
          sort_order INTEGER DEFAULT 0
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS shopping_submissions (
          id SERIAL PRIMARY KEY,
          shopping_list_id INTEGER REFERENCES shopping_lists(id),
          store VARCHAR(255),
          employee_name VARCHAR(255),
          items JSONB,
          below_minimum JSONB,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS work_schedules (
          id SERIAL PRIMARY KEY,
          store VARCHAR(255) NOT NULL,
          name VARCHAR(100) NOT NULL,
          type VARCHAR(20) DEFAULT 'fixed',
          hora_entrada VARCHAR(5) DEFAULT '08:00',
          hora_saida VARCHAR(5) DEFAULT '18:00',
          intervalo_inicio VARCHAR(5),
          intervalo_fim VARCHAR(5),
          tolerancia INTEGER DEFAULT 15,
          cycle_work_days INTEGER,
          cycle_off_days INTEGER,
          saturday_active BOOLEAN DEFAULT TRUE,
          sunday_active BOOLEAN DEFAULT FALSE,
          color VARCHAR(7) DEFAULT '#3B82F6',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS schedule_weekdays (
          id SERIAL PRIMARY KEY,
          schedule_id INTEGER REFERENCES work_schedules(id) ON DELETE CASCADE,
          weekday INTEGER NOT NULL,
          is_workday BOOLEAN DEFAULT TRUE,
          hora_entrada VARCHAR(5),
          hora_saida VARCHAR(5),
          intervalo_inicio VARCHAR(5),
          intervalo_fim VARCHAR(5)
        )
      `);
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS schedule_id INTEGER;
      `);
      migrationsRun = true;

      // ── Auto-configurar Webhook da Evolution API (chatbot) ──
      try {
        const evoUrl = process.env.EVOLUTION_API_URL;
        const evoKey = process.env.EVOLUTION_API_KEY;
        const evoInstance = process.env.EVOLUTION_INSTANCE || 'firecheck';
        if (evoUrl && evoKey) {
          await fetch(`${evoUrl}/webhook/set/${evoInstance}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
            body: JSON.stringify({
              enabled: true,
              url: 'https://www.firecheckapp.com.br/api/webhooks/whatsapp',
              webhookByEvents: false,
              webhook_by_events: false,
              events: ['MESSAGES_UPSERT', 'messages.upsert']
            })
          });
          console.log('[Evolution] Webhook configurado com sucesso para /api/webhooks/whatsapp');

        }
      } catch (whErr) { console.error('[Evolution] Erro ao configurar webhook:', whErr.message); }


    } catch (e) { console.error('Migration error:', e); }
  }

  try {
    const { method } = req;
    const url = req.url || '';
    const searchParams = new URL(url, `http://${req.headers.host}`).searchParams;

    // --- LOGIN / AUTH (SEGURO: bcrypt + JWT + Rate Limiting) ---
    if (url.includes('/api/auth')) {
      if (method === 'POST') {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ status: 'error', error: 'E-mail e senha são obrigatórios.' });

        // Rate limiting por origem + e-mail, contando apenas falhas.
        // x-forwarded-for pode vir como "cliente, proxy1, proxy2": o primeiro é o cliente.
        const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
        const clientIp = forwarded || req.socket.remoteAddress || 'unknown';
        const rlKey = rateLimitKey(clientIp, email);
        if (!checkRateLimit(rlKey)) {
          return res.status(429).json({ status: 'error', error: 'Muitas tentativas de login. Aguarde 1 minuto e tente novamente.' });
        }

        // Buscar usuário SEM comparar senha na query (bcrypt faz isso em memória)
        const { rows } = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        if (rows.length > 0) {
          const user = rows[0];
          
          // Comparar senha com bcrypt (suporta senha legacy plaintext durante migração)
          let passwordMatch = false;
          if (user.password && user.password.startsWith('$2')) {
            // Senha já hasheada com bcrypt
            passwordMatch = await bcrypt.compare(password, user.password);
          } else {
            // Senha legado em plaintext — comparar direto e hashear para o futuro
            passwordMatch = (password === user.password);
            if (passwordMatch) {
              // Auto-migrar: hashear a senha para bcrypt
              const hash = await bcrypt.hash(password, 12);
              await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, user.id]);
            }
          }

          if (!passwordMatch) {
            registerLoginFailure(rlKey);
            return res.status(401).json({ status: 'error', error: 'E-mail ou senha incorretos.' });
          }

          // ── Verificação de Bloqueio ──────────────────────────
          // Funcionários herdam o status do admin da loja
          if (user.role === 'funcionario' || user.role === 'employee' || user.role === 'gestor') {
            const { rows: admins } = await pool.query(
              "SELECT status, created_at, expiration_date, trial_ends_at FROM users WHERE LOWER(TRIM(store)) = LOWER(TRIM($1)) AND (role = 'admin' OR role = 'master') LIMIT 1",
              [user.store]
            );
            if (admins.length > 0) {
              const adm = admins[0];
              if (adm.status === 'blocked') {
                return res.status(403).json({ status: 'error', error: 'A conta da sua empresa foi suspensa. Entre em contato com o administrador.' });
              }
              if (adm.status === 'pending') {
                return res.status(403).json({ status: 'error', error: 'O pagamento da sua empresa está pendente. Solicite ao administrador que regularize.' });
              }
              if (adm.status === 'trial' && trialExpirado(adm)) {
                return res.status(403).json({ status: 'error', error: 'O período de teste da sua empresa expirou. Peça ao administrador para assinar um plano.' });
              }
              if (adm.status === 'active' && adm.expiration_date) {
                if (new Date(adm.expiration_date) < new Date()) {
                  return res.status(403).json({ status: 'error', error: 'O plano da sua empresa expirou. Solicite renovação ao administrador.' });
                }
              }
            }
          } else if (user.role !== 'master') {
            if (user.status === 'blocked') {
              return res.status(403).json({ status: 'error', error: 'Sua conta foi suspensa. Entre em contato pelo WhatsApp para regularizar.' });
            }
            if (user.status === 'pending') {
              return res.status(403).json({ status: 'error', error: 'Seu pagamento está pendente. Finalize o pagamento para acessar o sistema.' });
            }
            if (user.status === 'trial' && trialExpirado(user)) {
              return res.status(403).json({ status: 'error', plan_expired: true, error: 'Seu período de teste expirou. Assine um plano para continuar usando o FireCheck.' });
            }
            if (user.status === 'active' && user.expiration_date) {
              if (new Date(user.expiration_date) < new Date()) {
                return res.status(403).json({ status: 'error', plan_expired: true, error: 'Seu plano expirou. Renove sua assinatura para continuar usando o sistema.' });
              }
            }
          }

          // Autenticou: zera o histórico de falhas dessa origem para este e-mail.
          clearLoginFailures(rlKey);

          // ── Gerar JWT Token ──
          const tokenPayload = { id: user.id, email: user.email, role: user.role, store: user.store };
          const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

          // ── Retornar SEM senha ──
          const { password: _, ...safeUser } = user;
          return res.status(200).json({ status: 'success', token, user: safeUser });
        }
        // E-mail não existe: conta como falha, senão a enumeração de e-mails fica ilimitada.
        registerLoginFailure(rlKey);
        return res.status(401).json({ status: 'error', error: 'E-mail ou senha incorretos.' });
      }
    }


    if (url.includes('/api/stats')) {
      const authUser = await autenticarComLojaAtual(req);
      if (!authUser) return res.status(401).json({ error: 'Token inválido ou ausente.' });
      let store = authUser.role === 'master' ? searchParams.get('store') : authUser.store;
      if (authUser.role !== 'master') {
        const { rows: userRows } = await pool.query('SELECT store FROM users WHERE id = $1', [authUser.id]);
        if (userRows.length > 0) store = userRows[0].store;
      }
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
        storeQuery = (params.length > 0 ? ' AND' : ' WHERE') + ' LOWER(store) = LOWER($' + (params.length + 1) + ')';
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
      // Calcular checklists de hoje
      const today = new Date().toISOString().split('T')[0];
      let todayParams = [today + ' 00:00:00', today + ' 23:59:59'];
      let todayStoreQuery = '';
      if (store && store !== 'undefined' && store !== 'null') {
        todayStoreQuery = ' AND LOWER(store) = LOWER($3)';
        todayParams.push(store);
      }
      const todayCount = await pool.query('SELECT COUNT(*) FROM checklist_submissions WHERE created_at BETWEEN $1 AND $2' + todayStoreQuery, todayParams);
      // Contar colaboradores
      let colabParams = [];
      let colabQuery = "SELECT COUNT(*) FROM users WHERE (role = 'funcionario' OR role = 'employee' OR role = 'gestor')";
      if (store && store !== 'undefined' && store !== 'null') {
        colabQuery += ' AND LOWER(store) = LOWER($1)';
        colabParams.push(store);
      }
      const colabCount = await pool.query(colabQuery, colabParams);
      return res.status(200).json({
        checklistsHoje: parseInt(todayCount.rows[0].count),
        concluidos: subQuery.rows.length,
        alertasIA: alertasCount,
        colaboradores: parseInt(colabCount.rows[0].count),
        conformidade: subQuery.rows.length > 0 ? Math.round(((subQuery.rows.length - alertasCount) / subQuery.rows.length) * 100) : 100
      });
    }

    if (url.includes('/api/checklists')) {
      const authUser = await autenticarComLojaAtual(req);
      if (!authUser) return res.status(401).json({ error: 'Token inválido ou ausente.' });

      // Verificar se é uma operação em um checklist específico (ex: DELETE /api/checklists/:id)
      const match = url.match(/\/api\/checklists\/([^\/?]+)/);
      if (match) {
        const checklistId = match[1];
        if (method === 'DELETE') {
          if (authUser.role !== 'master') {
            const { rows: target } = await pool.query('SELECT store FROM checklists WHERE id = $1', [checklistId]);
            if (target.length > 0 && String(target[0].store).toLowerCase() !== String(authUser.store).toLowerCase()) {
              return res.status(403).json({ error: 'Você só pode remover checklists da sua própria loja.' });
            }
          }
          await pool.query('DELETE FROM checklists WHERE id = $1', [checklistId]);
          return res.status(200).json({ success: true });
        }
        return res.status(405).json({ error: 'Método não permitido.' });
      }

      if (method === 'POST') {
        const { id, title, store, tasks, recurrence, scheduledDate, requireSelfie, weekdays, category, requireSignature, assetLinkType, assignedTo } = req.body;

        // Criar e editar checklist é ação de quem administra. Antes bastava um
        // token válido de qualquer papel — um funcionário podia reescrever
        // checklists, inclusive removendo a própria restrição de acesso.
        if (!['admin', 'master', 'gestor'].includes(authUser.role)) {
          return res.status(403).json({ error: 'Somente o administrador ou gestor pode criar ou editar checklists.' });
        }

        // A loja vem do token, nunca do corpo — exceto para master, que opera
        // qualquer loja. Sem isto, dava para criar checklist dentro de outro cliente.
        const lojaDono = authUser.role === 'master' ? await lojaCanonica(store || authUser.store) : authUser.store;

        // Ao editar, confirma que o checklist é mesmo da loja de quem está editando.
        // O UPDATE abaixo filtra apenas por id, e os ids são sequenciais: sem esta
        // checagem dava para alterar o checklist de qualquer outro cliente.
        if (id) {
          const { rows: dono } = await pool.query('SELECT store FROM checklists WHERE id = $1', [id]);
          if (dono.length === 0) {
            return res.status(404).json({ error: 'Checklist não encontrado.' });
          }
          if (authUser.role !== 'master') {
            const mesmaLoja = String(dono[0].store || '').trim().toLowerCase() === String(authUser.store || '').trim().toLowerCase();
            if (!mesmaLoja) {
              return res.status(403).json({ error: 'Você só pode editar checklists da sua própria loja.' });
            }
          }
        }

        let assignedToVal = null;
        if (assignedTo && assignedTo !== 'todos' && assignedTo !== 'pendente') {
          if (Array.isArray(assignedTo) && assignedTo.length > 0) {
            assignedToVal = JSON.stringify(assignedTo);
          } else if (typeof assignedTo === 'string' && assignedTo.trim().length > 0) {
            try {
              const parsed = JSON.parse(assignedTo);
              if (Array.isArray(parsed) && parsed.length > 0) {
                assignedToVal = JSON.stringify(parsed);
              }
            } catch(e) {}
          }
        }

        if (id) {
          const { rows } = await pool.query(
            'UPDATE checklists SET title = $1, store = $2, tasks = $3, recurrence = $4, scheduled_date = $5, require_selfie = $6, weekdays = $7, category = $8, require_signature = $9, asset_link_type = $10, assigned_to = $12 WHERE id = $11 RETURNING *',
            [title, lojaDono, JSON.stringify(tasks), recurrence, scheduledDate, requireSelfie || false, weekdays ? JSON.stringify(weekdays) : null, category || 'geral', requireSignature || false, assetLinkType || null, id, assignedToVal]
          );
          return res.status(200).json(rows[0]);
        } else {
          const { rows } = await pool.query(
            'INSERT INTO checklists (title, store, tasks, recurrence, scheduled_date, require_selfie, weekdays, category, require_signature, asset_link_type, assigned_to) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
            [title, lojaDono, JSON.stringify(tasks), recurrence, scheduledDate, requireSelfie || false, weekdays ? JSON.stringify(weekdays) : null, category || 'geral', requireSignature || false, assetLinkType || null, assignedToVal]
          );
          return res.status(200).json(rows[0]);
        }
      }
      const store = authUser.role === 'master' ? searchParams.get('store') : authUser.store;
      if (!store && authUser.role !== 'master') {
        return res.status(200).json([]);
      }

      const today = new Date().toISOString().split('T')[0];

      let checklistsQuery = 'SELECT * FROM checklists';
      let checklistsParams = [];
      let todaySubsQuery = 'SELECT checklist_id, employee_name FROM checklist_submissions WHERE created_at >= $1';
      let todaySubsParams = [today + ' 00:00:00'];
      let everSubsQuery = 'SELECT checklist_id, MAX(employee_name) as employee_name FROM checklist_submissions GROUP BY checklist_id';
      let everSubsParams = [];

      if (store) {
        checklistsQuery += ' WHERE LOWER(TRIM(store)) = LOWER(TRIM($1))';
        checklistsParams.push(store);
        
        todaySubsQuery = 'SELECT checklist_id, employee_name FROM checklist_submissions WHERE LOWER(TRIM(store)) = LOWER(TRIM($1)) AND created_at >= $2';
        todaySubsParams = [store, today + ' 00:00:00'];
        
        everSubsQuery = 'SELECT checklist_id, MAX(employee_name) as employee_name FROM checklist_submissions WHERE LOWER(store) = LOWER($1) GROUP BY checklist_id';
        everSubsParams = [store];
      }

      checklistsQuery += ' ORDER BY id DESC';

      const { rows: checklists } = await pool.query(checklistsQuery, checklistsParams);
      const { rows: todaySubs } = await pool.query(todaySubsQuery, todaySubsParams);
      const { rows: everSubs } = await pool.query(everSubsQuery, everSubsParams);

      const dayMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
      const todayWeekday = dayMap[new Date().getDay()];
      // ── Identidade usada para filtrar ────────────────────────────────────
      // No "Modo Simulação" o painel troca o perfil guardado no navegador, mas a
      // requisição continua levando o token de quem administra — e por isso a
      // simulação mostrava TODOS os checklists da loja, não a visão real do
      // colaborador. Com verComo, o administrador pede explicitamente a visão de
      // alguém da sua própria loja, e o filtro passa a valer como se fosse ele.
      let identidade = { id: authUser.id, email: authUser.email, role: authUser.role };
      const verComo = searchParams.get('verComo');
      if (verComo && ['admin', 'master', 'gestor'].includes(authUser.role)) {
        try {
          const { rows: alvo } = await pool.query(
            'SELECT id, name, email, role, store FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
            [verComo]
          );
          if (alvo.length > 0) {
            const mesmaLoja = String(alvo[0].store || '').trim().toLowerCase() === String(authUser.store || '').trim().toLowerCase();
            // Master enxerga qualquer loja; os demais, apenas a própria.
            if (authUser.role === 'master' || mesmaLoja) {
              identidade = { id: alvo[0].id, email: alvo[0].email, role: alvo[0].role, nome: alvo[0].name };
            }
          }
        } catch (e) {
          console.error('Falha ao resolver verComo:', e);
        }
      }

      const filterToday = searchParams.get('todayOnly') === 'true' || identidade.role === 'funcionario' || identidade.role === 'employee';

      // O JWT carrega apenas { id, email, role, store }. Atribuições antigas foram gravadas
      // pelo nome do colaborador, então buscamos o nome para que elas continuem casando.
      let authUserName = identidade.nome ? String(identidade.nome).toLowerCase().trim() : '';
      if (filterToday && !authUserName) {
        try {
          const { rows: me } = await pool.query('SELECT name FROM users WHERE id = $1', [identidade.id]);
          if (me.length > 0 && me[0].name) authUserName = String(me[0].name).toLowerCase().trim();
        } catch (e) {
          console.error('Falha ao obter nome do usuário para filtro de atribuição:', e);
        }
      }

      // Data de hoje no fuso da loja, para comparar com as âncoras de recorrência.
      const hojeISO = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const [hAno, hMes, hDia] = hojeISO.split('-').map(Number);
      const ultimoDiaDoMes = new Date(Date.UTC(hAno, hMes, 0)).getUTCDate();

      // Data de referência de um checklist: a de execução escolhida pelo lojista
      // ou, na falta dela, a de criação.
      const ancoraDe = (r) => {
        const bruta = r.scheduled_date || r.scheduleddate || r.created_at;
        if (!bruta) return null;
        const iso = String(bruta).slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
      };

      return res.status(200).json(checklists.map(r => {
        if (filterToday && r.recurrence === 'weekdays') {
          let dias = [];
          try {
            dias = typeof r.weekdays === 'string' ? JSON.parse(r.weekdays || '[]') : (r.weekdays || []);
          } catch(e) { dias = []; }
          if (Array.isArray(dias) && dias.length > 0 && !dias.includes(todayWeekday)) return null;
        }

        // ── Recorrências que antes não tinham efeito nenhum ──────────────────
        // 'weekly' e 'monthly' eram aceitos no editor mas nunca filtrados: os três
        // se comportavam como 'daily', e o lojista via todo dia um checklist que
        // configurou como semanal ou mensal. O mesmo valia para a "Data de
        // Execução", que era obrigatória e ignorada.
        if (filterToday && (r.recurrence === 'weekly' || r.recurrence === 'monthly')) {
          const ancora = ancoraDe(r);
          if (ancora) {
            const [aAno, aMes, aDia] = ancora.split('-').map(Number);
            if (r.recurrence === 'weekly') {
              const diaSemanaAncora = new Date(Date.UTC(aAno, aMes - 1, aDia)).getUTCDay();
              const diaSemanaHoje = new Date(Date.UTC(hAno, hMes - 1, hDia)).getUTCDay();
              if (diaSemanaAncora !== diaSemanaHoje) return null;
            } else {
              // Mensal: mesmo dia do mês. Em mês mais curto (dia 31 em fevereiro),
              // cai no último dia, para o checklist não sumir naquele mês.
              const diaEsperado = Math.min(aDia, ultimoDiaDoMes);
              if (hDia !== diaEsperado) return null;
            }
          }
        }

        // Único com data marcada: aparece a partir dela, e não antes. Continua
        // visível nos dias seguintes até ser concluído, para não se perder caso
        // o funcionário não abra o app naquele dia exato.
        if (filterToday && (r.recurrence === 'unico' || !r.recurrence)) {
          const marcada = String(r.scheduled_date || r.scheduleddate || '').slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(marcada) && marcada > hojeISO) return null;
        }

        // Safe parse assigned_to
        let assignedList = null;
        if (r.assigned_to) {
          if (typeof r.assigned_to === 'string') {
            try {
              assignedList = JSON.parse(r.assigned_to);
            } catch(e) {
              assignedList = null;
            }
          } else {
            assignedList = r.assigned_to;
          }
        }

        // Filtrar por assigned_to: apenas funcionários são restringidos.
        // 'gestor' é intencionalmente isento — ele administra a equipe e enxerga a loja inteira.
        // assigned_to nulo ou vazio significa "toda a equipe" e alcança qualquer colaborador.
        if (filterToday && assignedList && Array.isArray(assignedList) && assignedList.length > 0) {
          // Usa a identidade resolvida acima: em simulação, é a do colaborador.
          const userEmail = (identidade.email || '').toLowerCase().trim();
          const userName = authUserName;
          const userId = String(identidade.id || '');

          const matchesUser = assignedList.some(item => {
            if (!item) return false;
            const str = String(item).toLowerCase().trim();
            return (userEmail && str === userEmail) || (userName && str === userName) || (userId && str === userId);
          });

          if (!matchesUser) {
            return null; // Não atribuído a este funcionário
          }
        }

        let isCompleted = false;
        let completedBy = null;
        if (r.recurrence === 'unico' || r.recurrence === '') {
          const sub = everSubs.find(s => s.checklist_id === r.id);
          if (sub) { isCompleted = true; completedBy = sub.employee_name; }
        } else {
          const sub = todaySubs.find(s => s.checklist_id === r.id);
          if (sub) { isCompleted = true; completedBy = sub.employee_name; }
        }

        let wk = [];
        try {
          wk = typeof r.weekdays === 'string' ? JSON.parse(r.weekdays || '[]') : (r.weekdays || []);
        } catch(e) { wk = []; }

        let tasksParsed = [];
        try {
          tasksParsed = typeof r.tasks === 'string' ? JSON.parse(r.tasks) : (r.tasks || []);
        } catch(e) { tasksParsed = []; }

        return { 
          ...r, 
          tasks: tasksParsed, 
          weekdays: wk, 
          completedToday: isCompleted, 
          completedBy, 
          assigned_to: assignedList 
        };
      }).filter(Boolean));
    }

    if (url.includes('/api/vehicles/solicit')) {
      const authUser = await autenticarComLojaAtual(req);
      if (!authUser) return res.status(401).json({ error: 'Token inválido ou ausente.' });
      if (method === 'POST') {
        const { vehicleId } = req.body;
        if (!vehicleId) return res.status(400).json({ error: 'vehicleId obrigatório.' });
        await pool.query('UPDATE vehicles SET last_requested_at = NOW() WHERE id = $1', [vehicleId]);
        return res.status(200).json({ success: true });
      }
      return res.status(405).json({ error: 'Método não permitido.' });
    }

    if (url.includes('/api/vehicles')) {
      const authUser = await autenticarComLojaAtual(req);
      if (!authUser) return res.status(401).json({ error: 'Token inválido ou ausente.' });

      // Funcionário consulta a frota (precisa escolher o veículo na vistoria), mas
      // não cadastra, edita nem exclui. Antes bastava um token válido de qualquer
      // papel, e a única checagem era a loja — nunca o cargo.
      // /api/vehicles/solicit é a solicitação de uso, tratada em rota própria acima.
      if (method !== 'GET' && !['admin', 'master', 'gestor'].includes(authUser.role)) {
        return res.status(403).json({ error: 'Somente o administrador ou gestor pode alterar a frota.' });
      }

      const match = url.match(/\/api\/vehicles\/([^\/?]+)/);
      if (match) {
        const vehicleId = match[1];
        if (method === 'DELETE') {
          if (authUser.role !== 'master') {
            const { rows: target } = await pool.query('SELECT store FROM vehicles WHERE id = $1', [vehicleId]);
            if (target.length > 0 && String(target[0].store).toLowerCase() !== String(authUser.store).toLowerCase()) {
              return res.status(403).json({ error: 'Você só pode remover veículos da sua própria loja.' });
            }
          }
          await pool.query('DELETE FROM vehicles WHERE id = $1', [vehicleId]);
          return res.status(200).json({ success: true });
        }
        return res.status(405).json({ error: 'Método não permitido.' });
      }

      if (method === 'POST') {
        const { id, plate, model, brand, color, year, currentKm, photoUrl, status, employeeId, tasks, scheduleType, scheduleData } = req.body;
        const store = authUser.role === 'master' ? req.body.store : authUser.store;
        if (!store) return res.status(400).json({ error: 'Loja obrigatória.' });

        const empId = employeeId ? parseInt(employeeId) : null;
        const tsk = tasks ? (typeof tasks === 'string' ? tasks : JSON.stringify(tasks)) : null;
        const schedType = scheduleType || 'manual';
        const schedData = scheduleData ? (typeof scheduleData === 'string' ? scheduleData : JSON.stringify(scheduleData)) : null;

        if (id) {
          const { rows } = await pool.query(
            'UPDATE vehicles SET plate = $1, model = $2, brand = $3, color = $4, year = $5, current_km = $6, photo_url = $7, status = $8, employee_id = $9, tasks = $10, schedule_type = $11, schedule_data = $12 WHERE id = $13 AND LOWER(store) = LOWER($14) RETURNING *',
            [plate, model, brand, color, year ? parseInt(year) : null, currentKm ? parseFloat(currentKm) : null, photoUrl || null, status || 'ativo', empId, tsk, schedType, schedData, id, store]
          );
          return res.status(200).json(rows[0]);
        } else {
          const { rows } = await pool.query(
            'INSERT INTO vehicles (store, plate, model, brand, color, year, current_km, photo_url, status, employee_id, tasks, schedule_type, schedule_data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *',
            [store, plate, model, brand, color, year ? parseInt(year) : null, currentKm ? parseFloat(currentKm) : null, photoUrl || null, status || 'ativo', empId, tsk, schedType, schedData]
          );
          return res.status(200).json(rows[0]);
        }
      }

      const store = authUser.role === 'master' ? searchParams.get('store') : authUser.store;
      if (!store && authUser.role !== 'master') {
        return res.status(200).json([]);
      }
      
      const todayStart = new Date().toISOString().split('T')[0] + ' 00:00:00';
      let queryStr = `
        SELECT v.*, u.name as employee_name,
               (SELECT cs.employee_name FROM checklist_submissions cs WHERE cs.vehicle_id = v.id AND cs.created_at >= $1 LIMIT 1) as completed_by,
               EXISTS(SELECT 1 FROM checklist_submissions cs WHERE cs.vehicle_id = v.id AND cs.created_at >= $1) as completed_today
        FROM vehicles v 
        LEFT JOIN users u ON v.employee_id = u.id
      `;
      let queryParams = [todayStart];
      let paramCount = 1;

      if (store) {
        paramCount++;
        queryStr += ` WHERE LOWER(v.store) = LOWER($${paramCount})`;
        queryParams.push(store);
      }

      const employeeIdFilter = searchParams.get('employeeId');
      if (employeeIdFilter) {
        paramCount++;
        if (store) {
          queryStr += ` AND v.employee_id = $${paramCount}`;
        } else {
          queryStr += ` WHERE v.employee_id = $${paramCount}`;
        }
        queryParams.push(parseInt(employeeIdFilter));
      }

      queryStr += ' ORDER BY v.id DESC';
      const { rows } = await pool.query(queryStr, queryParams);
      
      const formattedRows = rows.map(r => ({
        ...r,
        tasks: typeof r.tasks === 'string' ? JSON.parse(r.tasks) : (r.tasks || []),
        schedule_data: typeof r.schedule_data === 'string' ? JSON.parse(r.schedule_data) : (r.schedule_data || null),
        completed_today: r.completed_today || false,
        completed_by: r.completed_by || null
      }));

      return res.status(200).json(formattedRows);
    }

    // ── MÓDULO DE COMPRAS / ESTOQUE ──────────────────────────────
    if (url.includes('/api/shopping')) {
      const authUser = await autenticarComLojaAtual(req);
      
      // ── Submissão (preenchimento pelo funcionário) ──
      if (url.includes('/api/shopping/submit') && method === 'POST') {
        const { shoppingListId, items, employeeName, notes } = req.body;
        const store = authUser?.store || req.body.store;
        
        // Calcular itens abaixo do mínimo
        const belowMinimum = (items || []).filter(item => 
          item.currentStock !== null && item.currentStock !== undefined && 
          item.minStock !== null && item.minStock !== undefined &&
          parseFloat(item.currentStock) < parseFloat(item.minStock)
        );

        // Salvar submissão
        const { rows } = await pool.query(
          'INSERT INTO shopping_submissions (shopping_list_id, store, employee_name, items, below_minimum, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
          [shoppingListId, store, employeeName, JSON.stringify(items), JSON.stringify(belowMinimum), notes || null]
        );

        // Atualizar estoque atual nos itens
        for (const item of (items || [])) {
          if (item.id && item.currentStock !== null && item.currentStock !== undefined) {
            await pool.query('UPDATE shopping_items SET current_stock = $1 WHERE id = $2', [parseFloat(item.currentStock), item.id]);
          }
        }

        // ── Enviar Notificação WhatsApp para os Donos/Gestores ──
        try {
          const { rows: admins } = await pool.query(
            "SELECT * FROM users WHERE LOWER(store) = LOWER($1) AND (role = 'admin' OR role = 'master' OR role = 'gestor') AND whatsapp_active = TRUE",
            [store]
          );

          if (admins.length > 0) {
            const { rows: listInfo } = await pool.query('SELECT title FROM shopping_lists WHERE id = $1', [shoppingListId]);
            const listTitle = listInfo[0]?.title || 'Checklist de Compras';
            const dataHoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            const horaHoje = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

            const evoUrl = process.env.EVOLUTION_API_URL;
            const evoKey = process.env.EVOLUTION_API_KEY;
            const evoInstance = process.env.EVOLUTION_INSTANCE || 'firecheck';

            let msg = '';
            if (belowMinimum.length > 0) {
              msg = `🛒 *FireCheck - Alerta de Checklist de Compras*\n\n` +
                    `📋 Checklist: *${listTitle}*\n` +
                    `👤 Colaborador: *${employeeName}*\n` +
                    `🏪 Loja: *${store}*\n` +
                    `📅 Data: *${dataHoje} às ${horaHoje}*\n\n` +
                    `⚠️ *ITENS QUE PRECISEM SER COMPRADOS (${belowMinimum.length}):*\n` +
                    `━━━━━━━━━━━━━━━━━━\n`;

              belowMinimum.forEach((item, i) => {
                const diff = (parseFloat(item.minStock) - parseFloat(item.currentStock)).toFixed(1);
                msg += `🔴 *${item.name}*\n`;
                msg += `   • Estoque Atual: *${item.currentStock} ${item.unit || 'un'}*\n`;
                msg += `   • Mínimo Exigido: *${item.minStock} ${item.unit || 'un'}*\n`;
                msg += `   • 🚨 *Faltam: ${diff} ${item.unit || 'un'}*\n\n`;
              });

              msg += `━━━━━━━━━━━━━━━━━━\n` +
                     `🛒 *Por favor, providencie a compra desses itens!*`;
            } else {
              msg = `✅ *FireCheck - Checklist de Compras OK*\n\n` +
                    `📋 Checklist: *${listTitle}*\n` +
                    `👤 Colaborador: *${employeeName}*\n` +
                    `🏪 Loja: *${store}*\n` +
                    `📅 Data: *${dataHoje} às ${horaHoje}*\n\n` +
                    `Status: *✅ Todos os itens estão com estoque acima do mínimo!*\n` +
                    `Nenhum item precisa ser comprado no momento. 🚀`;
            }

            for (const admin of admins) {
              const phone = admin.whatsapp_phone || admin.phone;
              if (!phone) continue;
              const cleanPhone = phone.replace(/\D/g, '');
              const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;

              if (evoUrl && evoKey) {
                fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                  body: JSON.stringify({ number: fullPhone, text: msg })
                }).catch(e => console.error('[Shopping] Erro WhatsApp:', e.message));
              }
            }
          }
        } catch (waErr) { console.error('[Shopping] Erro ao notificar WhatsApp:', waErr.message); }

        return res.status(200).json({ success: true, submission: rows[0], belowMinimum });
      }

      // ── Histórico de submissões ──
      if (url.includes('/api/shopping/submissions') && method === 'GET') {
        if (!authUser) return res.status(401).json({ error: 'Token inválido.' });
        const store = authUser.role === 'master' ? searchParams.get('store') : authUser.store;
        const listId = searchParams.get('listId');
        let q = 'SELECT ss.*, sl.title as list_title FROM shopping_submissions ss LEFT JOIN shopping_lists sl ON ss.shopping_list_id = sl.id WHERE ss.store = $1';
        const params = [store];
        if (listId) { q += ' AND ss.shopping_list_id = $2'; params.push(listId); }
        q += ' ORDER BY ss.created_at DESC LIMIT 50';
        const { rows } = await pool.query(q, params);
        return res.status(200).json(rows);
      }

      // ── CRUD Itens de uma lista ──
      if (url.includes('/api/shopping/items') && method === 'GET') {
        const listId = searchParams.get('listId');
        if (!listId) return res.status(400).json({ error: 'listId obrigatório.' });
        const { rows } = await pool.query('SELECT * FROM shopping_items WHERE shopping_list_id = $1 ORDER BY sort_order ASC, id ASC', [listId]);
        return res.status(200).json(rows);
      }

      // ── Delete lista ──
      if (method === 'DELETE') {
        const pathname = new URL(url, `http://${req.headers.host}`).pathname;
        const deleteMatch = pathname.match(/\/api\/shopping\/(\d+)/);
        if (deleteMatch) {
          if (!authUser) return res.status(401).json({ error: 'Token inválido.' });
          await pool.query('DELETE FROM shopping_lists WHERE id = $1', [deleteMatch[1]]);
          return res.status(200).json({ success: true });
        }
      }

      // ── POST: criar/editar lista com itens ──
      if (method === 'POST') {
        if (!authUser) return res.status(401).json({ error: 'Token inválido.' });
        const { id, title, recurrence, weekdays, scheduledDate, assignedTo, items, category } = req.body;
        const store = authUser.role === 'master' ? req.body.store : authUser.store;
        if (!store) return res.status(400).json({ error: 'Loja obrigatória.' });

        const assignedStr = assignedTo ? (typeof assignedTo === 'string' ? assignedTo : JSON.stringify(assignedTo)) : null;
        const weekdaysStr = weekdays ? (typeof weekdays === 'string' ? weekdays : JSON.stringify(weekdays)) : null;

        let listId;
        // Estoque já conferido pelos funcionários, guardado antes de recriar os itens.
        // Editar a lista apaga e reinsere tudo, e a tela de edição não reenvia esses
        // valores — sem isto, um simples ajuste no nome de um item jogava fora a
        // contagem que a equipe tinha acabado de fazer.
        const estoqueAnterior = new Map();
        if (id) {
          const { rows: antigos } = await pool.query(
            'SELECT name, current_stock FROM shopping_items WHERE shopping_list_id = $1',
            [id]
          );
          for (const a of antigos) {
            if (a.current_stock !== null && a.current_stock !== undefined) {
              estoqueAnterior.set(String(a.name || '').trim().toLowerCase(), a.current_stock);
            }
          }
          await pool.query(
            'UPDATE shopping_lists SET title=$1, recurrence=$2, weekdays=$3, scheduled_date=$4, assigned_to=$5, category=$6 WHERE id=$7',
            [title, recurrence || 'weekly', weekdaysStr, scheduledDate || null, assignedStr, category || 'compras', id]
          );
          listId = id;
          // Remover itens antigos e inserir novos
          await pool.query('DELETE FROM shopping_items WHERE shopping_list_id = $1', [listId]);
        } else {
          const { rows: newList } = await pool.query(
            'INSERT INTO shopping_lists (store, title, recurrence, weekdays, scheduled_date, assigned_to, category) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
            [store, title, recurrence || 'weekly', weekdaysStr, scheduledDate || null, assignedStr, category || 'compras']
          );
          listId = newList[0].id;
        }

        // Inserir itens
        if (items && items.length > 0) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            // Mantém o estoque conferido quando o item já existia e a tela não o enviou.
            const enviado = item.currentStock;
            const temEnviado = enviado !== undefined && enviado !== null && enviado !== '';
            const estoqueFinal = temEnviado
              ? enviado
              : (estoqueAnterior.has(String(item.name || '').trim().toLowerCase())
                  ? estoqueAnterior.get(String(item.name || '').trim().toLowerCase())
                  : null);
            await pool.query(
              'INSERT INTO shopping_items (shopping_list_id, name, unit, min_stock, current_stock, category, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)',
              [listId, item.name, item.unit || 'un', item.minStock || 0, estoqueFinal, item.category || 'geral', i]
            );
          }
        }

        const { rows: result } = await pool.query('SELECT * FROM shopping_lists WHERE id = $1', [listId]);
        const { rows: resultItems } = await pool.query('SELECT * FROM shopping_items WHERE shopping_list_id = $1 ORDER BY sort_order', [listId]);
        return res.status(200).json({ ...result[0], items: resultItems });
      }

      // ── GET: listar listas de compras ──
      if (method === 'GET') {
        if (!authUser) return res.status(401).json({ error: 'Token inválido.' });
        const store = (authUser.role === 'master' || !authUser.store) ? (searchParams.get('store') || authUser.store) : authUser.store;
        const today = new Date().toISOString().split('T')[0];
        const { rows } = await pool.query(
          `SELECT sl.*, 
                  (SELECT COUNT(*) FROM shopping_items si WHERE si.shopping_list_id = sl.id) as item_count, 
                  (SELECT COUNT(*) FROM shopping_items si WHERE si.shopping_list_id = sl.id AND si.current_stock IS NOT NULL AND si.current_stock < si.min_stock) as below_min_count,
                  EXISTS(SELECT 1 FROM shopping_submissions ss WHERE ss.shopping_list_id = sl.id AND ss.created_at >= $2) as completed_today,
                  (SELECT employee_name FROM shopping_submissions ss WHERE ss.shopping_list_id = sl.id AND ss.created_at >= $2 ORDER BY ss.id DESC LIMIT 1) as completed_by
           FROM shopping_lists sl 
           WHERE LOWER(TRIM(sl.store)) = LOWER(TRIM($1)) AND sl.active = TRUE 
           ORDER BY sl.id DESC`,
          [store, today + ' 00:00:00']
        );
        
        // Parsear assigned_to e weekdays
        const formatted = rows.map(r => ({
          ...r,
          assigned_to: typeof r.assigned_to === 'string' ? (() => { try { return JSON.parse(r.assigned_to); } catch(e) { return r.assigned_to; }})() : r.assigned_to,
          weekdays: typeof r.weekdays === 'string' ? (() => { try { return JSON.parse(r.weekdays); } catch(e) { return r.weekdays; }})() : r.weekdays
        }));
        
        return res.status(200).json(formatted);
      }
    }

    // Helper para cancelamento automático de assinatura na Cakto via API
    const cancelCaktoSubscription = async (subscriptionId) => {
      const clientId = process.env.CAKTO_CLIENT_ID;
      const clientSecret = process.env.CAKTO_CLIENT_SECRET;
      if (!clientId || !clientSecret || !subscriptionId) {
        console.log('[CAKTO CANCEL] Chaves ou subscriptionId ausentes. Cancelamento automático ignorado.');
        return false;
      }
      try {
        console.log(`[CAKTO CANCEL] Solicitando token OAuth2 para cancelamento...`);
        const tokenRes = await fetch('https://api.cakto.com.br/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'subscriptions'
          })
        });
        if (!tokenRes.ok) {
          console.error(`[CAKTO CANCEL] Erro ao obter Token: ${tokenRes.status} ${tokenRes.statusText}`);
          return false;
        }
        const tokenData = await tokenRes.json();
        const token = tokenData.access_token;
        if (!token) return false;

        console.log(`[CAKTO CANCEL] Enviando requisição de cancelamento da assinatura ${subscriptionId}...`);
        const cancelRes = await fetch(`https://api.cakto.com.br/v1/subscriptions/${subscriptionId}/cancel`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (cancelRes.ok) {
          console.log(`[CAKTO CANCEL] Assinatura ${subscriptionId} cancelada com sucesso na Cakto!`);
          return true;
        }
        console.error(`[CAKTO CANCEL] Falha no cancelamento. Status: ${cancelRes.status}`);
        return false;
      } catch (err) {
        console.error(`[CAKTO CANCEL ERROR] Erro no cancelamento:`, err.message);
        return false;
      }
    };

    // ── Webhook CAKTO (Bloqueio Automático) ──────────────────────────
    if (url.includes('/api/webhooks/cakto')) {
      if (method === 'POST') {
        try {
          const payload = req.body;

          // ── Autenticação do webhook ────────────────────────────────────────
          // Sem isto, qualquer POST da internet ativa um plano pago para si ou
          // cancela o de um cliente. Aceita o segredo por cabeçalho ou por query,
          // porque cada gateway envia de um jeito.
          //
          // Enquanto CAKTO_WEBHOOK_SECRET não estiver definido, a rota continua
          // aberta e apenas registra o aviso — desligá-la sem aviso interromperia
          // o processamento de pagamentos em produção. Configure o segredo na
          // Cakto e na Vercel para fechar de vez.
          const segredoWebhook = process.env.CAKTO_WEBHOOK_SECRET;
          if (segredoWebhook) {
            const enviado =
              req.headers['x-cakto-signature'] ||
              req.headers['x-webhook-secret'] ||
              req.headers['x-hub-signature'] ||
              String(req.headers['authorization'] || '').replace(/^Bearer\s+/i, '') ||
              searchParams.get('secret') ||
              payload?.secret;
            const a = Buffer.from(String(enviado || ''));
            const b = Buffer.from(String(segredoWebhook));
            // Comparação de tempo constante: um === simples vaza o segredo aos poucos.
            const confere = a.length === b.length && crypto.timingSafeEqual(a, b);
            if (!confere) {
              console.error('[CAKTO WEBHOOK] Assinatura inválida. Requisição recusada.');
              return res.status(401).json({ error: 'Assinatura inválida.' });
            }
          } else {
            console.warn('[CAKTO WEBHOOK] CAKTO_WEBHOOK_SECRET não configurado — a rota aceita qualquer requisição. Configure o segredo para fechar esta porta.');
          }

          console.log('[CAKTO WEBHOOK] Recebido:', JSON.stringify(payload));

          // A Cakto envia dados de diferentes formas dependendo do evento.
          // Tentamos capturar o email do comprador
          const customerEmail = payload?.data?.customer?.email || payload?.customer?.email || payload?.email;
          const status = payload?.data?.status || payload?.status || payload?.event;
          const subscriptionId = payload?.data?.subscription?.id || payload?.subscription?.id || payload?.data?.subscription_id || payload?.subscription_id;

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

            // Verifica se o usuário já existe
            const { rows: existingUsers } = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [customerEmail]);

            if (existingUsers.length === 0) {
              if (!isCameraModule) {
                const customerName = payload?.data?.customer?.name || payload?.customer?.name || payload?.name || 'Cliente';
                const customerPhone = payload?.data?.customer?.phone || payload?.customer?.phone || payload?.phone || '';
                
                let detectedPlan = 'pro';
                const lowerProduct = productName.toLowerCase();
                // Reconhece PRIMEIRO os produtos vendidos hoje na landing page.
                // Sem isto, "Combo Tudo em 1" e "Só Ponto Eletrônico" nao casavam com
                // nenhuma regra e caiam no padrao 'pro': quem comprava o Combo ficava
                // sem o modulo de Ponto, e quem comprava So Ponto recebia um plano de
                // checklist sem Ponto nenhum.
                const ehAnual = lowerProduct.includes('anual');
                const ehCombo = lowerProduct.includes('combo') || lowerProduct.includes('tudo em 1') || lowerProduct.includes('completo');
                const ehSoPonto = !ehCombo && (lowerProduct.includes('ponto eletr') || lowerProduct.includes('so ponto') || lowerProduct.includes('só ponto') || lowerProduct.includes('ponto ia'));
                const ehSoChecklist = !ehCombo && !ehSoPonto && (lowerProduct.includes('checklist'));

                if (ehCombo) detectedPlan = ehAnual ? 'combo_anual' : 'combo_mensal';
                else if (ehSoPonto) detectedPlan = ehAnual ? 'ponto_anual' : 'ponto_mensal';
                else if (ehSoChecklist) detectedPlan = ehAnual ? 'checklists_anual' : 'checklists_mensal';
                // ── Chaves legadas, para produtos antigos ainda ativos na Cakto ──
                else if (lowerProduct.includes('ponto_starter') || lowerProduct.includes('ponto starter')) detectedPlan = 'ponto_starter';
                else if (lowerProduct.includes('ponto_pro') || lowerProduct.includes('ponto pro')) detectedPlan = 'ponto_pro';
                else if (lowerProduct.includes('ponto_business') || lowerProduct.includes('ponto business')) detectedPlan = 'ponto_business';
                else if (lowerProduct.includes('starter') || lowerProduct.includes('start')) detectedPlan = 'starter';
                else if (lowerProduct.includes('business')) detectedPlan = 'business';
                
                const isAnnual = lowerProduct.includes('anual');
                
                // Senha aleatória por conta. Antes toda conta criada pelo webhook
                // nascia com '123456' — uma senha pública, igual para todos os
                // clientes, que dava acesso a qualquer conta recém-comprada.
                const senhaInicial = crypto.randomBytes(4).toString('hex').toUpperCase();
                const defaultPasswordHash = await bcrypt.hash(senhaInicial, 12);
                
                await pool.query(`
                  INSERT INTO users (name, email, password, role, store, status, phone, plan, expiration_date, cakto_subscription_id)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() + CASE WHEN $9 = true THEN INTERVAL '365 days' ELSE INTERVAL '30 days' END, $10)
                `, [
                  customerName,
                  customerEmail,
                  defaultPasswordHash,
                  'admin',
                  'Minha Empresa',
                  'active',
                  customerPhone,
                  detectedPlan,
                  isAnnual,
                  subscriptionId
                ]);
                console.log(`[CAKTO] Usuário ${customerEmail} não existia e foi criado automaticamente.`);

                // Entrega a senha ao dono da conta. Sem isto ele não conseguiria
                // entrar, já que a senha agora é aleatória e não mais fixa.
                const evoUrlNovo = process.env.EVOLUTION_API_URL;
                const evoKeyNovo = process.env.EVOLUTION_API_KEY;
                const evoInstNovo = process.env.EVOLUTION_INSTANCE || 'firecheck';
                const foneNovo = String(customerPhone || '').replace(/\D/g, '');
                if (evoUrlNovo && evoKeyNovo && foneNovo) {
                  const foneCompleto = foneNovo.startsWith('55') ? foneNovo : '55' + foneNovo;
                  fetch(`${evoUrlNovo}/message/sendText/${evoInstNovo}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': evoKeyNovo },
                    body: JSON.stringify({
                      number: foneCompleto,
                      text: `🔥 *Bem-vindo ao FireCheck!*\n\nSua conta já está ativa.\n\n📧 E-mail: *${customerEmail}*\n🔑 Senha: *${senhaInicial}*\n\nEntre em https://www.firecheckapp.com.br e altere sua senha no primeiro acesso.`,
                    }),
                  }).catch(e => console.error('[CAKTO] Falha ao enviar a senha por WhatsApp:', e.message));
                } else {
                  console.warn(`[CAKTO] Conta ${customerEmail} criada, mas sem canal para entregar a senha (telefone ou Evolution ausentes). O cliente precisará usar "Esqueci minha senha".`);
                }
              } else {
                console.log(`[CAKTO] Usuário ${customerEmail} comprou o módulo de câmera, mas a conta principal não existe.`);
              }
            } else {
              if (isCameraModule) {
                await pool.query(`
                   UPDATE users 
                   SET camera_expiration = NOW() + INTERVAL '30 days'
                   WHERE email = $1
                 `, [customerEmail]);
                console.log(`[CAKTO] Usuário ${customerEmail} teve o MÓDULO DE CÂMERAS renovado por 30 dias!`);
              } else {
                let detectedPlan = 'pro';
                const lowerProduct = productName.toLowerCase();
                // Reconhece PRIMEIRO os produtos vendidos hoje na landing page.
                // Sem isto, "Combo Tudo em 1" e "Só Ponto Eletrônico" nao casavam com
                // nenhuma regra e caiam no padrao 'pro': quem comprava o Combo ficava
                // sem o modulo de Ponto, e quem comprava So Ponto recebia um plano de
                // checklist sem Ponto nenhum.
                const ehAnual = lowerProduct.includes('anual');
                const ehCombo = lowerProduct.includes('combo') || lowerProduct.includes('tudo em 1') || lowerProduct.includes('completo');
                const ehSoPonto = !ehCombo && (lowerProduct.includes('ponto eletr') || lowerProduct.includes('so ponto') || lowerProduct.includes('só ponto') || lowerProduct.includes('ponto ia'));
                const ehSoChecklist = !ehCombo && !ehSoPonto && (lowerProduct.includes('checklist'));

                if (ehCombo) detectedPlan = ehAnual ? 'combo_anual' : 'combo_mensal';
                else if (ehSoPonto) detectedPlan = ehAnual ? 'ponto_anual' : 'ponto_mensal';
                else if (ehSoChecklist) detectedPlan = ehAnual ? 'checklists_anual' : 'checklists_mensal';
                // ── Chaves legadas, para produtos antigos ainda ativos na Cakto ──
                else if (lowerProduct.includes('ponto_starter') || lowerProduct.includes('ponto starter')) detectedPlan = 'ponto_starter';
                else if (lowerProduct.includes('ponto_pro') || lowerProduct.includes('ponto pro')) detectedPlan = 'ponto_pro';
                else if (lowerProduct.includes('ponto_business') || lowerProduct.includes('ponto business')) detectedPlan = 'ponto_business';
                else if (lowerProduct.includes('starter') || lowerProduct.includes('start')) detectedPlan = 'starter';
                else if (lowerProduct.includes('business')) detectedPlan = 'business';

                // Sem isto, o ramo de usuário existente não detectava compra anual:
                // o CASE do UPDATE comparava detectedPlan com 'anual', valor que ele
                // nunca assume, então quem renovava por um ano recebia 30 dias.
                const isAnnual = lowerProduct.includes('anual');

                // Usa a mesma tabela do resto do sistema, que já conhece os planos
                // atuais como ilimitados. O limitMap local ignorava essas chaves e
                // devolvia 300 checklists a quem comprou "ilimitado".
                const newChecklistLimit = getPlanLimit(detectedPlan);

                // Teto de colaboradores: 50 no Combo, 30 nos planos individuais.
                let newPontoLimit = 5;
                if (detectedPlan.startsWith('combo')) newPontoLimit = 50;
                else if (detectedPlan === 'ponto_mensal' || detectedPlan === 'ponto_anual' || detectedPlan === 'checklists_mensal' || detectedPlan === 'checklists_anual') newPontoLimit = 30;
                else if (detectedPlan === 'ponto_starter') newPontoLimit = 5;
                else if (detectedPlan === 'ponto_pro' || detectedPlan === 'pro') newPontoLimit = 15;
                else if (detectedPlan === 'ponto_business' || detectedPlan === 'business') newPontoLimit = 50;

                // O Combo dá checklists E ponto. O código só sabia tratar um ou
                // outro, então quem comprava o pacote completo ficava sem o Ponto.
                const ehPlanoCombo = detectedPlan.startsWith('combo');
                const isPontoPlan = !ehPlanoCombo && (detectedPlan.startsWith('ponto_') || detectedPlan === 'ponto_mensal' || detectedPlan === 'ponto_anual');

                const { rows: existingDetails } = await pool.query('SELECT name, store, plan, status, phone, whatsapp_phone, checklist_limit, ponto_limit, ponto_active, cakto_subscription_id, cakto_ponto_subscription_id FROM users WHERE email = $1', [customerEmail]);
                if (existingDetails.length > 0) {
                  const oldUser = existingDetails[0];
                  const oldPlan = oldUser.plan;
                  const oldStatus = oldUser.status;
                  const oldSubId = isPontoPlan ? oldUser.cakto_ponto_subscription_id : oldUser.cakto_subscription_id;

                  const isTrialTransition = oldStatus === 'trial';
                  const checklistsResetQuery = isTrialTransition ? ', checklists_used = 0, upgrade_alert_sent = FALSE' : '';

                  // O nome da coluna sai de um booleano interno, nunca da requisição.
                  const subscriptionIdColumn = isPontoPlan ? 'cakto_ponto_subscription_id' : 'cakto_subscription_id';

                  let updateQuery = '';
                  let updateParams = [];
                  // O id da assinatura vem do corpo do webhook e por isso entra como
                  // parâmetro, nunca interpolado no texto do SQL.
                  if (ehPlanoCombo) {
                    // Pacote completo: libera checklists E ponto na mesma gravação.
                    updateQuery = `
                      UPDATE users
                      SET status = 'active',
                          plan = $2,
                          checklist_limit = $3,
                          ponto_limit = $4,
                          ponto_active = TRUE,
                          expiration_date = NOW() + CASE WHEN $5 = true THEN INTERVAL '365 days' ELSE INTERVAL '30 days' END
                          ${checklistsResetQuery}
                          ${subscriptionId ? `, ${subscriptionIdColumn} = $6` : ''}
                      WHERE email = $1
                    `;
                    updateParams = subscriptionId
                      ? [customerEmail, detectedPlan, newChecklistLimit, newPontoLimit, isAnnual, subscriptionId]
                      : [customerEmail, detectedPlan, newChecklistLimit, newPontoLimit, isAnnual];
                  } else if (isPontoPlan) {
                    updateQuery = `
                      UPDATE users
                      SET status = 'active',
                          ponto_limit = $2,
                          ponto_active = TRUE,
                          expiration_date = NOW() + CASE WHEN $3 = true THEN INTERVAL '365 days' ELSE INTERVAL '30 days' END
                          ${checklistsResetQuery}
                          ${subscriptionId ? `, ${subscriptionIdColumn} = $4` : ''}
                      WHERE email = $1
                    `;
                    updateParams = subscriptionId
                      ? [customerEmail, newPontoLimit, isAnnual, subscriptionId]
                      : [customerEmail, newPontoLimit, isAnnual];
                  } else {
                    updateQuery = `
                      UPDATE users
                      SET status = 'active',
                          plan = $2,
                          checklist_limit = $3,
                          expiration_date = NOW() + CASE WHEN $4 = true THEN INTERVAL '365 days' ELSE INTERVAL '30 days' END
                          ${checklistsResetQuery}
                          ${subscriptionId ? `, ${subscriptionIdColumn} = $5` : ''}
                      WHERE email = $1
                    `;
                    updateParams = subscriptionId
                      ? [customerEmail, detectedPlan, newChecklistLimit, isAnnual, subscriptionId]
                      : [customerEmail, detectedPlan, newChecklistLimit, isAnnual];
                  }
                  await pool.query(updateQuery, updateParams);

                  console.log(`[CAKTO] Usuário ${customerEmail} atualizado para ACTIVE com plano ${detectedPlan}!`);

                  const isUpgrade = oldSubId && oldSubId !== subscriptionId;

                  if (isUpgrade && oldStatus === 'active') {
                    let isAutoCancelled = false;
                    if (oldSubId) {
                      isAutoCancelled = await cancelCaktoSubscription(oldSubId);
                    }

                    const evoUrl = process.env.EVOLUTION_API_URL;
                    const evoKey = process.env.EVOLUTION_API_KEY;
                    const evoInstance = process.env.EVOLUTION_INSTANCE || 'firecheck';

                    if (evoUrl && evoKey) {
                      const { rows: masters } = await pool.query("SELECT phone, whatsapp_phone FROM users WHERE role = 'master' LIMIT 1");
                      if (masters.length > 0) {
                        const masterPhone = masters[0].whatsapp_phone || masters[0].phone;
                        if (masterPhone) {
                          const cleanMasterPhone = masterPhone.replace(/\D/g, '');
                          const fullMasterPhone = cleanMasterPhone.startsWith('55') ? cleanMasterPhone : '55' + cleanMasterPhone;

                          const planNameFriendly = isPontoPlan ? `Ponto ${detectedPlan.replace('ponto_', '').toUpperCase()}` : detectedPlan.toUpperCase();

                          const masterMsg = isAutoCancelled 
                            ? `🔄 *UPGRADE DE PLANO AUTOMÁTICO* 🔄\n\n` +
                              `O cliente *${oldUser.name}* (Loja: *${oldUser.store}*), e-mail *${customerEmail}*, mudou para o plano *${planNameFriendly}*.\n` +
                              `✅ A assinatura anterior (*${oldSubId}*) foi cancelada automaticamente na Cakto.`
                            : `🔄 *UPGRADE DE PLANO DETECTADO* 🔄\n\n` +
                              `O cliente *${oldUser.name}* (Loja: *${oldUser.store}*), e-mail *${customerEmail}*, mudou para o plano *${planNameFriendly}*.\n` +
                              `⚠️ *Atenção:* Por favor, verifique no painel da Cakto e cancele a assinatura anterior dele para evitar cobranças duplicadas!`;

                          fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                            body: JSON.stringify({ number: fullMasterPhone, text: masterMsg })
                          }).catch(e => console.error('[Webhook Cakto - Alert Master] Erro:', e.message));
                        }
                      }

                      const clientPhone = oldUser.whatsapp_phone || oldUser.phone;
                      if (clientPhone) {
                        const cleanClientPhone = clientPhone.replace(/\D/g, '');
                        const fullClientPhone = cleanClientPhone.startsWith('55') ? cleanClientPhone : '55' + cleanClientPhone;

                        const planNameFriendly = isPontoPlan ? `Ponto ${detectedPlan.replace('ponto_', '').toUpperCase()}` : detectedPlan.toUpperCase();

                        const clientMsg = isAutoCancelled
                          ? `🎉 *Upgrade de Plano Confirmado!* 🎉\n\n` +
                            `Olá, *${oldUser.name?.split(' ')[0]}*!\n\n` +
                            `Confirmamos a alteração do seu plano para *${planNameFriendly}*.\n\n` +
                            `✅ A sua assinatura do plano anterior foi cancelada automaticamente para evitar cobranças duplicadas.`
                          : `🎉 *Upgrade de Plano Confirmado!* 🎉\n\n` +
                            `Olá, *${oldUser.name?.split(' ')[0]}*!\n\n` +
                            `Confirmamos a alteração do seu plano para *${planNameFriendly}*.\n\n` +
                            `⚠️ *Importante:* Se você tinha uma assinatura ativa do plano anterior, lembre-se de cancelá-la no seu painel da Cakto ou entrar em contato com o suporte para garantir que não ocorra nenhuma cobrança dupla.`;

                        fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                          body: JSON.stringify({ number: fullClientPhone, text: clientMsg })
                        }).catch(e => console.error('[Webhook Cakto - Alert Cliente] Erro:', e.message));
                      }
                    }
                  }
                }
              }
            }
          } else if (newStatus) {
            // ── Cancelamento / bloqueio ────────────────────────────────────────
            // Bloquear direto por e-mail derrubava a conta inteira mesmo quando o
            // cancelamento era de OUTRA assinatura. Quem tem dois planos
            // (checklists e ponto) perdia o acesso ao cancelar apenas um.
            const { rows: contaAlvo } = await pool.query(
              'SELECT id, cakto_subscription_id, cakto_ponto_subscription_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
              [customerEmail]
            );

            if (contaAlvo.length === 0) {
              console.warn(`[CAKTO] Cancelamento recebido para ${customerEmail}, mas a conta não existe.`);
            } else {
              const conta = contaAlvo[0];
              const idChecklists = conta.cakto_subscription_id;
              const idPonto = conta.cakto_ponto_subscription_id;

              if (subscriptionId && idPonto && String(subscriptionId) === String(idPonto)) {
                // Cancelou só o módulo de ponto: desliga o módulo, mantém a conta.
                await pool.query(
                  'UPDATE users SET ponto_active = FALSE, cakto_ponto_subscription_id = NULL WHERE id = $1',
                  [conta.id]
                );
                console.log(`[CAKTO] ${customerEmail}: módulo de Ponto cancelado. A conta segue ativa.`);
              } else if (subscriptionId && idChecklists && String(subscriptionId) !== String(idChecklists)) {
                // O id veio, mas não é nenhuma assinatura registrada nesta conta.
                // Bloquear aqui seria punir o cliente por um evento que não é dele.
                console.warn(`[CAKTO] ${customerEmail}: cancelamento da assinatura ${subscriptionId}, que não corresponde à registrada (${idChecklists}). Nada foi alterado.`);
              } else {
                await pool.query('UPDATE users SET status = $1 WHERE id = $2', [newStatus, conta.id]);
                console.log(`[CAKTO] Usuário ${customerEmail} teve status atualizado para: ${newStatus}`);
              }
            }
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
        const { name, email, password, store, phone, plan } = req.body;

        // Verificar email duplicado
        const { rows: existing } = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        if (existing.length > 0) {
          return res.status(400).json({ status: 'error', error: 'Este e-mail já está cadastrado. Faça login ou use outro e-mail.' });
        }

        // Teste grátis SÓ quando o cliente pediu teste grátis. Qualquer outro plano
        // é uma intenção de compra e nasce aguardando pagamento — o webhook da
        // Cakto ativa a conta quando o pagamento entra.
        //
        // A regra anterior listava apenas 'mensal' e 'anual', chaves antigas: todos
        // os planos atuais (combo_anual, checklists_mensal, ponto_anual...) caíam no
        // else e viravam teste grátis. Quem clicava em "Quero o Combo Completo"
        // ganhava 7 dias de graça e, se abandonasse o checkout, ficava com acesso
        // sem nunca ter pago.
        const planoEscolhido = String(plan || 'trial').toLowerCase();
        const querTesteGratis = planoEscolhido === 'trial' || planoEscolhido === '';
        const initialStatus = querTesteGratis ? 'trial' : 'pending';

        // Hash da senha com bcrypt
        const hashedPassword = await bcrypt.hash(password, 12);
        // A chave da conta nasce aqui e não muda mais. O nome que o cliente
        // digitou vai inteiro para store_name; se outra empresa já ocupa essa
        // chave, o desempate fica só na chave e ele nunca vê a diferença.
        const chaveDaLoja = await gerarChaveDeLoja(store);
        const { rows } = await pool.query(
          'INSERT INTO users (name, email, password, role, store, store_name, status, phone, plan) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, name, email, role, store, store_name, status, phone, created_at',
          [name, email, hashedPassword, 'admin', chaveDaLoja, store, initialStatus, phone, plan || 'trial']
        );

        // ── WhatsApp de Boas-Vindas do Suporte no Trial (fire and forget) ──
        if (phone && initialStatus === 'trial') {
          sendTrialWelcomeMessage(phone, name, store).catch(e => console.error('[WhatsApp Signup Error]', e));
        }

        // Devolve o token junto com a conta: sem ele o cliente recém-cadastrado
        // chegava ao painel sem credencial, toda requisição respondia 401 e ele era
        // jogado de volta para a tela de login logo após pagar. O Checkout já
        // guarda este campo quando ele existe.
        const novaConta = rows[0];

        // Token só para quem já pode usar o sistema. Conta aguardando pagamento não
        // recebe credencial: ela seria uma porta de entrada sem passar pelo caixa.
        // Quem escolheu um plano pago é levado ao checkout logo em seguida e entra
        // depois, com o próprio login, quando o pagamento for confirmado.
        const tokenNovaConta = querTesteGratis
          ? jwt.sign(
              { id: novaConta.id, email: novaConta.email, role: novaConta.role, store: novaConta.store },
              JWT_SECRET,
              { expiresIn: JWT_EXPIRY }
            )
          : undefined;

        return res.status(200).json({ status: 'success', user: novaConta, token: tokenNovaConta });
      }
    }

    // ── Endpoint Manual/Disparo de Teste para Boas-Vindas do Trial ──
    if (url.includes('/api/send-trial-welcome')) {
      try {
        let targetEmail = searchParams.get('email');
        let targetPhone = searchParams.get('phone');
        let targetName = searchParams.get('name');
        let targetStore = searchParams.get('store');

        if (req.method === 'POST' && req.body) {
          targetEmail = req.body.email || targetEmail;
          targetPhone = req.body.phone || targetPhone;
          targetName = req.body.name || targetName;
          targetStore = req.body.store || targetStore;
        }

        if (targetEmail) {
          const { rows } = await pool.query('SELECT name, phone, store FROM users WHERE LOWER(email) = LOWER($1)', [targetEmail]);
          if (rows.length > 0) {
            targetName = targetName || rows[0].name;
            targetPhone = targetPhone || rows[0].phone;
            targetStore = targetStore || rows[0].store;
          }
        }

        const result = await sendTrialWelcomeMessage(targetPhone, targetName, targetStore);
        return res.status(200).json({ status: 'success', result });
      } catch (err) {
        return res.status(500).json({ status: 'error', error: err.message });
      }
    }







    // ── Esqueci Minha Senha ──────────────────────────────────────────
    if (url.includes('/api/forgot-password')) {
      if (method === 'POST') {
        const { email } = req.body;

        // A resposta é sempre a mesma, exista o e-mail ou não: revelar a diferença
        // permitiria descobrir quem tem conta no sistema.
        const RESPOSTA_GENERICA = {
          status: 'success',
          message: 'Se o e-mail estiver cadastrado e houver um WhatsApp no cadastro, enviaremos uma senha temporária para lá. Se não receber em alguns minutos, fale com o administrador da sua loja.',
        };

        if (!email) return res.status(400).json({ status: 'error', error: 'Informe o e-mail.' });

        // Sem limite, esta rota redefine senhas em massa e vira negação de serviço.
        const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
        const ipRecup = fwd || req.socket.remoteAddress || 'unknown';
        const chaveRecup = rateLimitKey(ipRecup, `recuperacao:${email}`);
        if (!checkRateLimit(chaveRecup)) {
          return res.status(429).json({ status: 'error', error: 'Muitas solicitações. Aguarde 1 minuto e tente novamente.' });
        }
        registerLoginFailure(chaveRecup);

        const { rows } = await pool.query('SELECT id, name, phone FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        if (rows.length === 0) return res.status(200).json(RESPOSTA_GENERICA);

        const evoUrl = process.env.EVOLUTION_API_URL;
        const evoKey = process.env.EVOLUTION_API_KEY;
        const evoInstance = process.env.EVOLUTION_INSTANCE || 'firecheck';
        const telefone = (rows[0].phone || '').replace(/\D/g, '');

        // Só redefine a senha se existir canal para entregá-la ao dono da conta.
        // Redefinir sem conseguir entregar apenas tranca o usuário para fora — e
        // devolver a senha na resposta HTTP entregaria a conta a quem pediu.
        if (!evoUrl || !evoKey || !telefone) {
          return res.status(200).json(RESPOSTA_GENERICA);
        }

        const tempPass = crypto.randomBytes(4).toString('hex').toUpperCase();
        const hashedTemp = await bcrypt.hash(tempPass, 12);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedTemp, rows[0].id]);

        const fullPhone = telefone.startsWith('55') ? telefone : '55' + telefone;
        fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
          body: JSON.stringify({ number: fullPhone, text: `🔒 *FireCheck - Recuperação de Senha*\n\nSua nova senha temporária é: *${tempPass}*\n\nUse ela para fazer login e altere sua senha depois.` }),
        }).catch(e => console.error('[WhatsApp] Erro ao enviar senha:', e.message));

        // A senha nunca volta no corpo da resposta.
        return res.status(200).json(RESPOSTA_GENERICA);
      }
    }

    if (url.match(/\/api\/users\/([^\/?]+)/)) {
      // ── Proteção JWT: Somente admin/master pode editar usuários ──
      const authUser = await autenticarComLojaAtual(req);
      if (!authUser) return res.status(401).json({ error: 'Token inválido ou ausente. Faça login novamente.' });
      if (authUser.role !== 'admin' && authUser.role !== 'master' && authUser.role !== 'gestor') {
        return res.status(403).json({ error: 'Sem permissão para esta ação.' });
      }

      const match = url.match(/\/api\/users\/([^\/?]+)/);
      const id = match[1];
      if (method === 'DELETE') {
        // Ninguém apaga a própria conta por aqui, nem o master. Sem esta guarda,
        // o master ficava a um clique de excluir a conta que administra o sistema,
        // sem nenhuma forma de recriá-la pela aplicação.
        if (String(id) === String(authUser.id)) {
          return res.status(403).json({ error: 'Você não pode excluir a sua própria conta.' });
        }
        // Admin/Gestor só pode deletar usuários da própria loja (master pode deletar qualquer)
        if (authUser.role !== 'master') {
          const { rows: target } = await pool.query('SELECT store, role FROM users WHERE id = $1', [id]);
          if (target.length > 0) {
            if (target[0].store?.toLowerCase() !== authUser.store?.toLowerCase()) {
              return res.status(403).json({ error: 'Você só pode remover usuários da sua própria loja.' });
            }
            if (authUser.role === 'gestor' && target[0].role === 'admin') {
              return res.status(403).json({ error: 'Gestores não podem excluir a conta do proprietário.' });
            }
          }
        }
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        return res.status(200).json({ success: true });
      }
      if (method === 'PUT') {
        const { name, store: storeName, storeKey, plan, status, ponto_active, finance_active, checklist_limit, ponto_limit, timezone, contador_email, fechamento_dia, ponto_hora_entrada, ponto_hora_saida, ponto_tolerancia, phone, whatsapp_active, whatsapp_phone, wa_ponto_atraso, wa_checklist_reprovado, wa_checklist_atrasado, wa_ponto_diario, wa_checklist_aprovado, wa_ocorrencia, wa_descarte, role, schedule_id, permissions, expiration_date } = req.body;
        const { rows: current } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        if (current.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
        const user = current[0];

        // Admin/Gestor só pode editar usuários da própria loja (ou a si mesmo)
        if (authUser.role !== 'master' && String(user.id) !== String(authUser.id) && user.store?.toLowerCase() !== authUser.store?.toLowerCase()) {
          return res.status(403).json({ error: 'Sem permissão para editar usuários de outra loja.' });
        }

        // Gestor não pode alterar campos sensíveis de um admin
        if (authUser.role === 'gestor' && user.role === 'admin') {
          // Gestor pode editar dados básicos do admin mas não campos de controle
          if (role !== undefined && role !== user.role) {
            return res.status(403).json({ error: 'Gestores não podem alterar o cargo do proprietário.' });
          }
          if (status !== undefined && status !== user.status) {
            return res.status(403).json({ error: 'Gestores não podem alterar o status do proprietário.' });
          }
        }

        // ── Renomear a empresa não mexe em dado nenhum ──────────────────────
        // O nome que o lojista edita no Perfil é rótulo, e rótulo mora em
        // store_name. A chave da conta (`store`) fica onde está: é ela que aparece
        // nas treze tabelas e nas setenta e oito consultas, e mudá-la era o que
        // fazia checklists sumirem do painel quando o cliente caprichava no nome.
        //
        // O rótulo vale para a loja inteira, não só para quem clicou em salvar —
        // o funcionário também vê o nome da empresa na tela dele.
        if (storeName !== undefined && storeName !== (user.store_name || user.store) && user.store) {
          await pool.query(
            'UPDATE users SET store_name = $1 WHERE LOWER(TRIM(store)) = LOWER(TRIM($2))',
            [storeName, user.store]
          );
        }

        // ── Trocar a CHAVE da loja: manutenção, nunca fluxo normal ──────────
        // Só o master, e só mandando `storeKey` de propósito. Serve para consolidar
        // dados que ficaram numa chave antiga — foi o que aconteceu com um cliente
        // cujos checklists nasceram sob o nome anterior da empresa.
        //
        // Correções acumuladas aqui. Primeira: faltavam seis tabelas (vehicles,
        // work_schedules, ponto_config, cameras, checklist_executions,
        // wa_conversations) — a frota, as escalas e a configuração de ponto ficavam
        // órfãs com o nome antigo e sumiam do painel após a renomeação.
        //
        // Segunda: a comparação era por igualdade exata, mas o mesmo nome aparece no
        // banco com variações de espaço e caixa (há lojas gravadas como "Pet Nature"
        // e "Pet Nature "). As consultas de leitura normalizam com LOWER(TRIM()), e o
        // rename não normalizava — as linhas divergentes ficavam para trás.
        //
        // Terceira, e a razão de este bloco não ter mais uma lista escrita à mão: a
        // lista só está certa enquanto alguém lembrar de acrescentar cada tabela nova
        // que ganhar uma coluna `store`. Esquecer uma não dá erro nem aviso — os dados
        // dela só somem do painel do cliente na próxima vez que a chave mudar, e
        // ninguém liga uma coisa à outra. Quem sabe quais tabelas têm a coluna é o
        // banco, então é a ele que se pergunta.
        //
        // Vai tudo numa transação: uma troca pela metade deixa parte da empresa com a
        // chave nova e parte com a antiga, que é exatamente o estado que se quer
        // evitar. Se falhar, nada muda e a requisição devolve erro.
        if (storeKey !== undefined && storeKey !== user.store && user.store) {
          if (authUser.role !== 'master') {
            return res.status(403).json({ error: 'Somente o suporte pode trocar a chave de uma loja.' });
          }
          const oldStore = user.store;
          // Rede de segurança para o caso de o catálogo não responder.
          const TABELAS_CONHECIDAS = [
            'users', 'checklists', 'checklist_submissions', 'checklist_executions',
            'store_cameras', 'cameras', 'ponto_records', 'ponto_config',
            'shopping_lists', 'shopping_submissions', 'vehicles', 'work_schedules',
            'wa_conversations',
          ];
          const cliente = await pool.connect();
          try {
            let tabelas = [];
            try {
              const { rows } = await cliente.query(`
                SELECT c.table_name
                  FROM information_schema.columns c
                  JOIN information_schema.tables t
                    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
                 WHERE c.table_schema = 'public'
                   AND c.column_name = 'store'
                   AND t.table_type = 'BASE TABLE'
              `);
              tabelas = rows.map(r => r.table_name);
            } catch (err) {
              console.error('[Rename loja] Catálogo indisponível, usando a lista conhecida:', err.message);
            }
            if (tabelas.length === 0) tabelas = TABELAS_CONHECIDAS;

            // O nome vem do catálogo do próprio banco, nunca da requisição; ainda
            // assim só passa identificador simples, e entre aspas.
            const seguras = tabelas.filter(t => /^[a-z_][a-z0-9_]*$/.test(t));

            await cliente.query('BEGIN');
            for (const tabela of seguras) {
              await cliente.query(
                `UPDATE "${tabela}" SET store = $1 WHERE LOWER(TRIM(store)) = LOWER(TRIM($2))`,
                [storeKey, oldStore]
              );
            }
            await cliente.query('COMMIT');
            console.log(`[Chave da loja] "${oldStore}" → "${storeKey}" em ${seguras.length} tabelas.`);
          } catch (err) {
            try { await cliente.query('ROLLBACK'); } catch { /* a conexão já pode ter caído */ }
            console.error('[Chave da loja] Falhou, nada foi alterado:', err.message);
            return res.status(500).json({
              error: 'Não foi possível trocar a chave da loja agora. Nada foi alterado — tente novamente em instantes.',
            });
          } finally {
            cliente.release();
          }
        }

        const finalName = name !== undefined ? name : user.name;
        // A chave só muda pelo caminho de manutenção acima; o campo que o Perfil
        // envia é rótulo e vai para store_name.
        const finalStore = storeKey !== undefined ? storeKey : user.store;
        const finalStoreName = storeName !== undefined ? storeName : (user.store_name || user.store);
        const finalPlan = plan !== undefined ? plan : user.plan;
        const finalStatus = status !== undefined ? status : user.status;
        const finalPonto = ponto_active !== undefined ? ponto_active : user.ponto_active;
        const finalFinance = finance_active !== undefined ? finance_active : user.finance_active;
        const finalLimit = checklist_limit !== undefined ? checklist_limit : user.checklist_limit;
        const finalPontoLimit = ponto_limit !== undefined ? ponto_limit : user.ponto_limit;
        const finalTz = timezone !== undefined ? timezone : user.timezone;
        const finalContador = contador_email !== undefined ? contador_email : user.contador_email;
        const finalFechamento = fechamento_dia !== undefined ? fechamento_dia : user.fechamento_dia;
        const finalScheduleId = schedule_id !== undefined ? schedule_id : user.schedule_id;
        const finalHoraEntrada = (schedule_id !== undefined && schedule_id !== null) ? null : (ponto_hora_entrada !== undefined ? ponto_hora_entrada : user.ponto_hora_entrada);
        const finalHoraSaida = (schedule_id !== undefined && schedule_id !== null) ? null : (ponto_hora_saida !== undefined ? ponto_hora_saida : user.ponto_hora_saida);
        const finalTolerancia = ponto_tolerancia !== undefined ? ponto_tolerancia : user.ponto_tolerancia;
        const finalPhone = phone !== undefined ? phone : user.phone;
        const finalWhatsappActive = whatsapp_active !== undefined ? whatsapp_active : user.whatsapp_active;
        const finalWhatsappPhone = whatsapp_phone !== undefined ? whatsapp_phone : user.whatsapp_phone;
        const finalWaPontoAtraso = wa_ponto_atraso !== undefined ? wa_ponto_atraso : user.wa_ponto_atraso;
        const finalWaChecklistReprovado = wa_checklist_reprovado !== undefined ? wa_checklist_reprovado : user.wa_checklist_reprovado;
        const finalWaChecklistAtrasado = wa_checklist_atrasado !== undefined ? wa_checklist_atrasado : user.wa_checklist_atrasado;
        const finalWaPontoDiario = wa_ponto_diario !== undefined ? wa_ponto_diario : user.wa_ponto_diario;
        const finalWaChecklistAprovado = wa_checklist_aprovado !== undefined ? wa_checklist_aprovado : user.wa_checklist_aprovado;
        const finalWaOcorrencia = wa_ocorrencia !== undefined ? wa_ocorrencia : user.wa_ocorrencia;
        const finalWaDescarte = wa_descarte !== undefined ? wa_descarte : user.wa_descarte;
        // Promoção a 'master' nunca vem do corpo da requisição: só um master
        // concede esse papel. Sem esta trava, qualquer admin ou gestor se
        // promovia a master editando o próprio cadastro.
        let finalRole = role !== undefined ? role : user.role;
        if (finalRole === 'master' && authUser.role !== 'master') {
          return res.status(403).json({ error: 'Somente um usuário master pode conceder o papel de master.' });
        }
        // E ninguém rebaixa um master, exceto outro master.
        if (user.role === 'master' && finalRole !== 'master' && authUser.role !== 'master') {
          return res.status(403).json({ error: 'Somente um usuário master pode alterar o papel de outro master.' });
        }
        
        const finalPermissions = permissions !== undefined ? (typeof permissions === 'string' ? permissions : JSON.stringify(permissions)) : user.permissions;
        let finalPhoto = user.photo;
        if (req.body.photo && req.body.photo.startsWith('data:image')) {
            finalPhoto = await uploadImage(req.body.photo, 'users/' + finalStore);
        } else if (req.body.photo === null || req.body.photo === '') {
            finalPhoto = null;
        }


        if (finalStatus === 'active' && user.status !== 'active') {
          const resetChecklists = user.status === 'trial' ? ', checklists_used = 0, upgrade_alert_sent = FALSE' : '';
          await pool.query(`
            UPDATE users SET plan = $1, status = $2, ponto_active = $3, finance_active = $4, checklist_limit = $5, timezone = $6, contador_email = $7, fechamento_dia = $8,
            ponto_hora_entrada = $9, ponto_hora_saida = $10, ponto_tolerancia = $11, phone = $12, whatsapp_active = $13, whatsapp_phone = $14,
            wa_ponto_atraso = $15, wa_checklist_reprovado = $16, wa_checklist_atrasado = $17, wa_ponto_diario = $18, wa_checklist_aprovado = $19,
            name = $21, store = $22, store_name = $29, wa_ocorrencia = $30, wa_descarte = $31, ponto_limit = $23, role = $24, schedule_id = $25, photo = $27,
            expiration_date = COALESCE($28, NOW() + CASE WHEN $1 = 'anual' OR $1 = 'business' THEN INTERVAL '365 days' ELSE INTERVAL '30 days' END),
            quota_reset_date = COALESCE(quota_reset_date, NOW() + INTERVAL '30 days'),
            permissions = $26
            ${resetChecklists}
            WHERE id = $20
          `, [finalPlan, finalStatus, finalPonto || false, finalFinance || false, finalLimit, finalTz, finalContador, finalFechamento, finalHoraEntrada, finalHoraSaida, finalTolerancia, finalPhone, finalWhatsappActive, finalWhatsappPhone, finalWaPontoAtraso, finalWaChecklistReprovado, finalWaChecklistAtrasado, finalWaPontoDiario, finalWaChecklistAprovado, id, finalName, finalStore, finalPontoLimit, finalRole, finalScheduleId, finalPermissions, finalPhoto, expiration_date, finalStoreName, finalWaOcorrencia, finalWaDescarte]);
        } else {
          await pool.query('UPDATE users SET plan = $1, status = $2, ponto_active = $3, finance_active = $4, checklist_limit = $5, timezone = $6, contador_email = $7, fechamento_dia = $8, ponto_hora_entrada = $9, ponto_hora_saida = $10, ponto_tolerancia = $11, phone = $12, whatsapp_active = $13, whatsapp_phone = $14, wa_ponto_atraso = $15, wa_checklist_reprovado = $16, wa_checklist_atrasado = $17, wa_ponto_diario = $18, wa_checklist_aprovado = $19, name = $21, store = $22, store_name = $29, ponto_limit = $23, role = $24, schedule_id = $25, permissions = $26, photo = $27, expiration_date = COALESCE($28, expiration_date), wa_ocorrencia = $30, wa_descarte = $31 WHERE id = $20', [finalPlan, finalStatus, finalPonto || false, finalFinance || false, finalLimit, finalTz, finalContador, finalFechamento, finalHoraEntrada, finalHoraSaida, finalTolerancia, finalPhone, finalWhatsappActive, finalWhatsappPhone, finalWaPontoAtraso, finalWaChecklistReprovado, finalWaChecklistAtrasado, finalWaPontoDiario, finalWaChecklistAprovado, id, finalName, finalStore, finalPontoLimit, finalRole, finalScheduleId, finalPermissions, finalPhoto, expiration_date, finalStoreName, finalWaOcorrencia, finalWaDescarte]);
        }

        // ── Último dia trabalhado (escala 12x36) ─────────────────────────────
        // A tela enviava este campo e a coluna existe, mas ela não estava em
        // nenhuma das consultas de UPDATE acima: o valor era descartado em
        // silêncio e o app confirmava que havia salvo. A escala 12x36 ficava sem
        // referência para calcular os dias de folga.
        if (req.body.ponto_last_worked_day !== undefined) {
          await pool.query('UPDATE users SET ponto_last_worked_day = $1 WHERE id = $2', [
            req.body.ponto_last_worked_day || null,
            id,
          ]);
        }

        // ── Extensão do período de teste ─────────────────────────────────────
        // Atualização própria, fora das consultas gigantes acima, para manter a
        // mudança pequena e auditável. Aceita um número de dias a partir de agora
        // (trialDays) ou uma data final explícita (trialEndsAt); null limpa o
        // campo e devolve a conta à regra padrão de 7 dias desde a criação.
        if (req.body.trialDays !== undefined || req.body.trialEndsAt !== undefined) {
          if (!['admin', 'master'].includes(authUser.role)) {
            return res.status(403).json({ error: 'Somente o administrador pode alterar o período de teste.' });
          }
          if (req.body.trialDays !== undefined) {
            const dias = parseInt(req.body.trialDays, 10);
            if (Number.isNaN(dias) || dias < 0 || dias > 365) {
              return res.status(400).json({ error: 'Informe entre 0 e 365 dias de teste.' });
            }
            await pool.query(
              `UPDATE users SET trial_ends_at = NOW() + ($1 || ' days')::interval WHERE id = $2`,
              [String(dias), id]
            );
          } else {
            await pool.query('UPDATE users SET trial_ends_at = $1 WHERE id = $2', [req.body.trialEndsAt || null, id]);
          }
        }

        // ── Enviar mensagem de confirmação via WhatsApp quando ativar notificações ──
        const wasWhatsappOff = !user.whatsapp_active || !user.whatsapp_phone;
        const isWhatsappNowOn = finalWhatsappActive && finalWhatsappPhone;
        const phoneChanged = finalWhatsappPhone && finalWhatsappPhone !== user.whatsapp_phone;

        if (finalWhatsappActive && finalWhatsappPhone) {
          const evoUrl = process.env.EVOLUTION_API_URL;
          const evoKey = process.env.EVOLUTION_API_KEY;
          const evoInstance = process.env.EVOLUTION_INSTANCE || 'firecheck';

          if (evoUrl && evoKey) {
            const cleanPhone = finalWhatsappPhone.replace(/\D/g, '');
            const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
            const storeName = user.store || 'sua loja';
            const confirmMsg =
              `✅ *Notificações do FireCheck salvas com sucesso!*\n\n` +
              `Olá, ${user.name?.split(' ')[0] || 'tudo bem'}! 👋\n\n` +
              `A partir de agora, você receberá os alertas da loja *${storeName}* diretamente neste número pelo WhatsApp:\n\n` +
              `🔔 Atrasos de colaboradores no ponto\n` +
              `📋 Checklists com irregularidades\n` +
              `⏰ Checklists pendentes/atrasados\n` +
              `📊 Fechamento diário de ponto\n\n` +
              `💡 *Salve este contato* para não perder nenhuma notificação importante!\n\n` +
              `— Equipe FireCheck 🔥`;

            fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
              body: JSON.stringify({ number: fullPhone, text: confirmMsg })
            }).then(r => r.json()).then(d => {
              console.log(`[WhatsApp] Confirmação enviada para ${fullPhone}:`, d?.key?.id || 'ok');
            }).catch(e => {
              console.error(`[WhatsApp] Falha ao enviar confirmação para ${fullPhone}:`, e.message);
            });
          }
        }

        return res.status(200).json({ success: true });
      }
    } else if (url.includes('/api/schedules')) {
      const authUser = await autenticarComLojaAtual(req);
      if (!authUser) return res.status(401).json({ error: 'Token inválido' });

      const idMatch = url.match(/\/api\/schedules\/(\d+)/);
      const scheduleId = idMatch ? idMatch[1] : null;
      const store = authUser.store;

      if (method === 'GET') {
        const { rows } = await pool.query('SELECT * FROM work_schedules WHERE LOWER(store) = LOWER($1) ORDER BY name', [store]);
        for (let i = 0; i < rows.length; i++) {
          const { rows: wds } = await pool.query('SELECT * FROM schedule_weekdays WHERE schedule_id = $1 ORDER BY weekday', [rows[i].id]);
          rows[i].weekdays = wds;
        }
        return res.status(200).json(rows);
      }
      
      if (method === 'POST') {
        const { name, type, hora_entrada, hora_saida, intervalo_inicio, intervalo_fim, tolerancia, cycle_work_days, cycle_off_days, saturday_active, sunday_active, color, weekdays } = req.body;
        const { rows } = await pool.query(
          `INSERT INTO work_schedules (store, name, type, hora_entrada, hora_saida, intervalo_inicio, intervalo_fim, tolerancia, cycle_work_days, cycle_off_days, saturday_active, sunday_active, color)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
          [store, name, type || 'fixed', hora_entrada || '08:00', hora_saida || '18:00', intervalo_inicio, intervalo_fim, tolerancia || 15, cycle_work_days, cycle_off_days, saturday_active !== false, sunday_active === true, color || '#3B82F6']
        );
        const newSchedule = rows[0];
        
        if (weekdays && Array.isArray(weekdays)) {
          for (const wd of weekdays) {
            await pool.query(
              `INSERT INTO schedule_weekdays (schedule_id, weekday, is_workday, hora_entrada, hora_saida, intervalo_inicio, intervalo_fim)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [newSchedule.id, wd.weekday, wd.is_workday !== false, wd.hora_entrada, wd.hora_saida, wd.intervalo_inicio, wd.intervalo_fim]
            );
          }
        }
        const { rows: savedWds } = await pool.query('SELECT * FROM schedule_weekdays WHERE schedule_id = $1 ORDER BY weekday', [newSchedule.id]);
        newSchedule.weekdays = savedWds;
        return res.status(200).json(newSchedule);
      }

      if (method === 'PUT' && scheduleId) {
        const { name, type, hora_entrada, hora_saida, intervalo_inicio, intervalo_fim, tolerancia, cycle_work_days, cycle_off_days, saturday_active, sunday_active, color, weekdays } = req.body;
        const { rows } = await pool.query(
          `UPDATE work_schedules SET name = $1, type = $2, hora_entrada = $3, hora_saida = $4, intervalo_inicio = $5, intervalo_fim = $6, tolerancia = $7, cycle_work_days = $8, cycle_off_days = $9, saturday_active = $10, sunday_active = $11, color = $12
           WHERE id = $13 AND LOWER(store) = LOWER($14) RETURNING *`,
          [name, type, hora_entrada, hora_saida, intervalo_inicio, intervalo_fim, tolerancia, cycle_work_days, cycle_off_days, saturday_active, sunday_active, color, scheduleId, store]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Escala não encontrada' });
        const updatedSchedule = rows[0];

        await pool.query('DELETE FROM schedule_weekdays WHERE schedule_id = $1', [scheduleId]);
        if (weekdays && Array.isArray(weekdays)) {
          for (const wd of weekdays) {
            await pool.query(
              `INSERT INTO schedule_weekdays (schedule_id, weekday, is_workday, hora_entrada, hora_saida, intervalo_inicio, intervalo_fim)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [updatedSchedule.id, wd.weekday, wd.is_workday !== false, wd.hora_entrada, wd.hora_saida, wd.intervalo_inicio, wd.intervalo_fim]
            );
          }
        }
        const { rows: savedWds } = await pool.query('SELECT * FROM schedule_weekdays WHERE schedule_id = $1 ORDER BY weekday', [updatedSchedule.id]);
        updatedSchedule.weekdays = savedWds;
        return res.status(200).json(updatedSchedule);
      }
      
      if (method === 'DELETE' && scheduleId) {
        await pool.query('UPDATE users SET schedule_id = NULL WHERE schedule_id = $1', [scheduleId]);
        await pool.query('DELETE FROM work_schedules WHERE id = $1 AND LOWER(store) = LOWER($2)', [scheduleId, store]);
        return res.status(200).json({ success: true });
      }

    } else if (url.includes('/api/users')) {
      // ── Proteção JWT ──
      const authUser = await autenticarComLojaAtual(req);
      if (!authUser) return res.status(401).json({ error: 'Token inválido ou ausente. Faça login novamente.' });

      if (method === 'POST') {
        if (authUser.role !== 'admin' && authUser.role !== 'master' && authUser.role !== 'gestor') {
          return res.status(403).json({ error: 'Sem permissão para criar usuários.' });
        }
        const { name, email, password, role: roleBruto, store: storeBruta, plan, phone, permissions } = req.body;

        // Papel e loja não são aceitos como vieram. Sem estas travas, um gestor
        // criava um master, ou cadastrava alguém dentro da loja de outro cliente.
        const role = roleBruto === 'master' && authUser.role !== 'master' ? 'funcionario' : roleBruto;
        if (roleBruto === 'master' && authUser.role !== 'master') {
          return res.status(403).json({ error: 'Somente um usuário master pode criar outro master.' });
        }
        if (roleBruto === 'admin' && !['admin', 'master'].includes(authUser.role)) {
          return res.status(403).json({ error: 'Somente o proprietário ou o master pode criar outro administrador.' });
        }
        // Master pode escolher a loja; os demais criam sempre dentro da sua.
        const store = authUser.role === 'master' ? await lojaCanonica(storeBruta || authUser.store) : authUser.store;

        // Empresa nova com nome já ocupado: recusa em vez de adivinhar.
        //
        // A chave da loja é o que separa um cliente do outro. Se o suporte cadastra
        // um cliente novo com um nome que já existe, ele entra dentro da empresa
        // alheia e passa a ver os checklists dela — em silêncio. As duas intenções
        // possíveis ("é outra empresa com nome parecido" e "é mais um dono da mesma
        // empresa") são indistinguíveis daqui, então quem decide é quem está
        // cadastrando, e não este código.
        if (role === 'admin' && storeBruta) {
          const { rows: jaExiste } = await pool.query(
            "SELECT name, email FROM users WHERE LOWER(TRIM(store)) = LOWER(TRIM($1)) AND (role = 'admin' OR role = 'master') LIMIT 1",
            [store]
          );
          if (jaExiste.length > 0) {
            return res.status(400).json({
              error: `Já existe uma empresa chamada "${store}" (de ${jaExiste[0].name} — ${jaExiste[0].email}). Use um nome diferente, ou cadastre esta pessoa como colaborador daquela empresa.`,
            });
          }
        }

        // Verificar email duplicado antes de inserir
        const { rows: existingEmail } = await pool.query('SELECT id, name, store FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        if (existingEmail.length > 0) {
          return res.status(400).json({ error: `Este e-mail já está cadastrado no sistema (pertence a "${existingEmail[0].name}" da loja "${existingEmail[0].store}"). Use outro e-mail.` });
        }

        if (role === 'funcionario' || role === 'gestor') {
          const { rows: admins } = await pool.query("SELECT id, plan, status, ponto_limit, role FROM users WHERE store = $1 AND (role = 'admin' OR role = 'master') LIMIT 1", [store]);
          if (admins.length > 0) {
            const admin = admins[0];
            const { rows: countRes } = await pool.query("SELECT COUNT(*) FROM users WHERE store = $1 AND (role = 'funcionario' OR role = 'gestor')", [store]);
            const currentCount = parseInt(countRes[0].count);
            const limit = admin.ponto_limit || 5;

            const isUnlimited = limit >= 999999 || admin.status === 'trial' || admin.role === 'master';
            if (!isUnlimited && currentCount >= limit) {
              return res.status(400).json({ error: `Você atingiu o limite de ${limit} colaboradores do seu plano de Ponto eletrônico. Faça upgrade do seu plano de Ponto para cadastrar mais colaboradores.` });
            }
          }
        }

        // Hash da senha do novo funcionário
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Herdar status do admin da loja (gestor/funcionário herda o status active do admin que pagou)
        let inheritedStatus = 'trial'; // default
        if (role === 'funcionario' || role === 'gestor') {
          const { rows: adminRows } = await pool.query(
            "SELECT status FROM users WHERE store = $1 AND (role = 'admin' OR role = 'master') LIMIT 1",
            [store]
          );
          if (adminRows.length > 0 && (adminRows[0].status === 'active' || adminRows[0].status === 'trial')) {
            inheritedStatus = adminRows[0].status;
          }
        }
        
        const permissionsJson = (role === 'gestor' && permissions) ? JSON.stringify(permissions) : null;
        // O colaborador entra na loja já existente: herda a chave e também o rótulo
        // dela. Sem o rótulo, ele veria a chave da conta no lugar do nome da empresa.
        const { rows: rotuloDaLoja } = await pool.query(
          'SELECT store_name FROM users WHERE LOWER(TRIM(store)) = LOWER(TRIM($1)) AND store_name IS NOT NULL LIMIT 1',
          [store]
        );
        const storeNameHerdado = rotuloDaLoja.length > 0 ? rotuloDaLoja[0].store_name : store;
        const { rows } = await pool.query('INSERT INTO users (name, email, password, role, store, store_name, plan, phone, status, permissions) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, name, email, role, store, store_name, phone, status, permissions', [name, email, hashedPassword, role, store, storeNameHerdado, plan, phone || null, inheritedStatus, permissionsJson]);
        
        // NÃO propagar o novo colaborador para checklists restritos.
        // Um checklist com assigned_to preenchido é uma restrição explícita do lojista;
        // injetar o novo e-mail nela dissolveria a restrição a cada contratação.
        // Checklists destinados à equipe inteira têm assigned_to = NULL e já alcançam
        // qualquer colaborador futuro sem nenhuma escrita adicional.

        return res.status(200).json(rows[0]);
      }
      // GET users: admin vê só da sua loja, master vê tudo
      let store = authUser.role === 'master' ? searchParams.get('store') : authUser.store;
      if (authUser.role !== 'master') {
        const { rows: userRows } = await pool.query('SELECT store FROM users WHERE id = $1', [authUser.id]);
        if (userRows.length > 0) store = userRows[0].store;
      }
      const { rows } = await pool.query(`
        SELECT u.id, u.name, u.email, u.role, u.store, COALESCE(u.store_name, u.store) AS store_name, u.plan, u.phone, u.status, u.created_at, u.expiration_date, u.camera_expiration, u.ponto_active, u.finance_active, u.checklist_limit, u.checklists_used, u.quota_reset_date, u.timezone, u.contador_email, u.fechamento_dia, u.ponto_hora_entrada, u.ponto_hora_saida, u.ponto_tolerancia, u.whatsapp_active, u.whatsapp_phone, u.wa_ponto_atraso, u.wa_checklist_reprovado, u.wa_checklist_atrasado, u.wa_ponto_diario, u.wa_checklist_aprovado, u.wa_ocorrencia, u.wa_descarte, u.schedule_id, u.ponto_last_worked_day, u.permissions, u.photo, u.trial_ends_at, ws.name AS schedule_name, ws.color AS schedule_color
        FROM users u
        LEFT JOIN work_schedules ws ON u.schedule_id = ws.id
        ${store ? 'WHERE LOWER(u.store) = LOWER($1)' : ''}
        ORDER BY u.created_at DESC
      `, store ? [store] : []);
      return res.status(200).json(rows);
    }


    // Endpoints de tracking duplicados removidos daqui

    // ── Endpoint de Cota ─────────────────────────────────────────
    if (url.includes('/api/quota')) {
      const store = searchParams.get('store');
      if (!store) return res.status(400).json({ error: 'Store obrigatória' });
      const { rows: admins } = await pool.query(
        "SELECT id, checklist_limit, checklists_used, quota_reset_date, status, plan, ai_creations_used FROM users WHERE store = $1 AND (role = 'admin' OR role = 'master') LIMIT 1",
        [store]
      );
      if (admins.length === 0) return res.status(404).json({ error: 'Loja não encontrada' });
      const admin = admins[0];
      // Check e reset automático
      const wasReset = await checkAndResetQuota(pool, admin.id, admin.quota_reset_date);
      const used = wasReset ? 0 : (admin.checklists_used || 0);
      const limit = admin.checklist_limit || getPlanLimit(admin.plan);
      const remaining = Math.max(0, limit - used);
      const resetDate = wasReset ? new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0] : (admin.quota_reset_date ? new Date(admin.quota_reset_date).toISOString().split('T')[0] : null);
      
      const aiLimit = getAiCreationLimit(admin.plan);
      const aiUsed = wasReset ? 0 : (admin.ai_creations_used || 0);

      return res.status(200).json({
        limit: limit >= 999999 ? 'ilimitado' : limit,
        used,
        remaining: limit >= 999999 ? 'ilimitado' : remaining,
        resetDate,
        percentUsed: limit >= 999999 ? 0 : Math.round((used / limit) * 100),
        plan: admin.plan,
        isUnlimited: limit >= 999999 || admin.status === 'trial',
        aiLimit: aiLimit >= 999999 ? 'ilimitado' : aiLimit,
        aiUsed,
        aiRemaining: aiLimit >= 999999 ? 'ilimitado' : Math.max(0, aiLimit - aiUsed)
      });
    }

    if (url.includes('/api/finalize')) {
      if (method === 'POST') {
        // Sem token, qualquer um na internet gravava submissões em qualquer loja e
        // em nome de qualquer funcionário. O app já envia Authorization aqui,
        // inclusive na sincronização da fila offline.
        const autorFinalize = await autenticarComLojaAtual(req);
        if (!autorFinalize) return res.status(401).json({ error: 'Token inválido ou ausente. Faça login novamente.' });

        const { employeeName, tasks, feedbackInfo, selfie, checklistId, vehicleId, signature, startedAt } = req.body;
        // A loja sai do token. Antes vinha do corpo, então dava para lançar
        // submissão dentro da loja de outro cliente.
        const store = autorFinalize.role === 'master' ? await lojaCanonica(req.body.store || autorFinalize.store) : autorFinalize.store;

        // ── VERIFICAÇÃO DE COTA ──────────────────────────────────
        const { rows: storeAdmins } = await pool.query(
          "SELECT id, checklist_limit, checklists_used, quota_reset_date, status, plan, role FROM users WHERE store = $1 AND (role = 'admin' OR role = 'master') LIMIT 1",
          [store]
        );
        if (storeAdmins.length > 0) {
          const admin = storeAdmins[0];
          // Reset automático se necessário
          await checkAndResetQuota(pool, admin.id, admin.quota_reset_date);
          // Re-fetch após possível reset
          const { rows: freshAdmin } = await pool.query('SELECT checklists_used, checklist_limit, plan, status FROM users WHERE id = $1', [admin.id]);
          const fa = freshAdmin[0];
          const limit = fa.checklist_limit || getPlanLimit(fa.plan);
          const used = fa.checklists_used || 0;
          // Trial é ilimitado, master é ilimitado
          const isUnlimited = limit >= 999999 || fa.status === 'trial' || admin.role === 'master';
          if (!isUnlimited && used >= limit) {
            return res.status(403).json({
              status: 'error',
              quota_exceeded: true,
              error: `Sua empresa atingiu o limite de ${limit} checklists deste mês. Faça upgrade do plano para continuar.`,
              used,
              limit
            });
          }
        }
        // ─────────────────────────────────────────────────────────

        // --- INTEGRAÇÃO FIREBASE STORAGE ---
        // Faz o upload das fotos das tasks (suportando múltiplas fotos no array task.photos)
        const updatedTasks = await Promise.all(tasks.map(async (task) => {
          if (task.photos && Array.isArray(task.photos)) {
            const uploadedPhotos = await Promise.all(task.photos.map(async (p) => {
              if (p && p.startsWith('data:image')) {
                return await uploadImage(p, `tasks/${store}`);
              }
              return p;
            }));
            return { ...task, photos: uploadedPhotos };
          }
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

        // Faz o upload da assinatura digital
        let finalSignature = signature;
        if (signature && signature.startsWith('data:image')) {
          finalSignature = await uploadImage(signature, `signatures/${store}`);
        }
        // ------------------------------------

        const today = new Date().toISOString().split('T')[0];
        const checkDupe = await pool.query('SELECT employee_name FROM checklist_submissions WHERE checklist_id = $1 AND store = $2 AND created_at >= $3', [checklistId, store, today + ' 00:00:00']);
        if (checkDupe.rows.length > 0) return res.status(400).json({ message: `Este checklist já foi realizado hoje por ${checkDupe.rows[0].employee_name}.` });

        const { rows } = await pool.query(
          'INSERT INTO checklist_submissions (employee_name, store, tasks, feedback_info, selfie, checklist_id, vehicle_id, signature) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
          [
            employeeName,
            store,
            JSON.stringify(updatedTasks),
            JSON.stringify(feedbackInfo || {}),
            finalSelfie || null,
            checklistId ? parseInt(checklistId) : null,
            vehicleId ? parseInt(vehicleId) : null,
            finalSignature || null
          ]
        );

        // ── Envio feito com ciência da reprovação ───────────────────────────
        // O funcionário leu o motivo na tela, pôde refazer e confirmou mesmo
        // assim. Marca em coluna própria e avisa quem manda na loja.
        //
        // A marca é derivada do próprio feedback recebido, e não de um campo
        // solto que o aplicativo mande à parte: quem descreve o que aconteceu é
        // o veredito de cada tarefa, e ele já vem aqui.
        try {
          const fb = feedbackInfo && typeof feedbackInfo === 'object' ? feedbackInfo : {};
          const conscientes = Object.entries(fb)
            .filter(([chave, v]) => !String(chave).startsWith('_') && v && v.enviado_ciente === true)
            .map(([chave, v]) => {
              const tarefa = (Array.isArray(tasks) ? tasks : []).find(t => String(t.id) === String(chave));
              return {
                taskId: chave,
                texto: (tarefa?.text || 'Tarefa').slice(0, 80),
                motivo: String(v.message || v.mensagem || 'sem detalhe').slice(0, 120),
                justificativa: v.justificativa ? String(v.justificativa).slice(0, 200) : '',
              };
            });

          if (conscientes.length > 0) {
            await pool.query('UPDATE checklist_submissions SET enviado_ciente = TRUE WHERE id = $1', [rows[0].id]);
            // Sem await: o checklist já está gravado, e um WhatsApp lento não
            // pode segurar a tela de quem está terminando o turno.
            avisarEnvioConsciente(store, employeeName, conscientes)
              .catch(e => console.error('[Envio consciente] falhou:', e.message));
          }
        } catch (cienciaErr) {
          console.error('[Envio consciente] Falha ao registrar:', cienciaErr.message);
        }

        // --- ROTINA DE LIMPEZA AUTOMÁTICA (90 DIAS) ---
        try {
          const ninetyDaysAgo = new Date();
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
          await pool.query('DELETE FROM checklist_submissions WHERE created_at < $1', [ninetyDaysAgo]);
        } catch (cleanErr) { console.error('Erro na limpeza automática:', cleanErr); }

        // ── INCREMENTAR COTA ──────────────────────────────────
        if (storeAdmins && storeAdmins.length > 0) {
          const adminId = storeAdmins[0].id;
          await pool.query('UPDATE users SET checklists_used = COALESCE(checklists_used, 0) + 1 WHERE id = $1', [adminId]);

          const { rows: freshAdminDetails } = await pool.query('SELECT name, email, store, plan, status, checklist_limit, checklists_used, upgrade_alert_sent, phone, whatsapp_phone FROM users WHERE id = $1', [adminId]);
          if (freshAdminDetails.length > 0) {
            const admin = freshAdminDetails[0];
            const limit = admin.checklist_limit || getPlanLimit(admin.plan);
            const used = admin.checklists_used || 0;
            const threshold = limit * 0.9;

            if (used >= threshold && !admin.upgrade_alert_sent && admin.status === 'active') {
              let nextPlan = '';
              let upgradeLink = '';
              let cleanPlan = (admin.plan || '').toLowerCase();

              nextPlan = 'Combo Completo (Checklist Ilimitado + Ponto IA)';
              upgradeLink = 'https://pay.cakto.com.br/pavdwiz_869704';

              if (nextPlan && upgradeLink) {
                await pool.query('UPDATE users SET upgrade_alert_sent = TRUE WHERE id = $1', [adminId]);

                const clientPhone = admin.whatsapp_phone || admin.phone;
                if (clientPhone) {
                  const cleanPhone = clientPhone.replace(/\D/g, '');
                  const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;

                  const upgradeMsg = 
                    `⚠️ *ALERTA DE USO DE CRÉDITOS* ⚠️\n\n` +
                    `Olá, *${admin.name?.split(' ')[0]}*!\n\n` +
                    `Sua equipe utilizou *${used} de ${limit}* checklists disponíveis no seu plano atual (*${(used / limit * 100).toFixed(0)}%* de uso).\n\n` +
                    `Para garantir a continuidade das suas auditorias diárias, recomendamos fazer o upgrade para o plano *${nextPlan}* agora mesmo:\n` +
                    `👉 Link de Upgrade: ${upgradeLink}?email=${encodeURIComponent(admin.email || '')}\n\n` +
                    `*não deixe sua equipe sem creditos faça o upgrade antes que acabe* 🚀`;

                  const evoUrl = process.env.EVOLUTION_API_URL;
                  const evoKey = process.env.EVOLUTION_API_KEY;
                  const evoInstance = process.env.EVOLUTION_INSTANCE || 'firecheck';

                  if (evoUrl && evoKey) {
                    fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                      body: JSON.stringify({ number: fullPhone, text: upgradeMsg })
                    }).then(r => r.json()).then(d => {
                      console.log(`[WhatsApp Upgrade Alert] Enviado com sucesso para ${fullPhone}`);
                    }).catch(err => {
                      console.error(`[WhatsApp Upgrade Alert] Erro ao enviar para ${fullPhone}:`, err.message);
                    });
                  }
                }
              }
            }
          }
        }

        // ── PUSH NOTIFICATION ─────────────────────────────────
        try {
          const feedbackParsed = typeof feedbackInfo === 'string' ? JSON.parse(feedbackInfo) : (feedbackInfo || {});
          const hasWarnings = Object.values(feedbackParsed).some(f => f.status === 'warning' || f.status === 'error');
          if (hasWarnings && storeAdmins && storeAdmins.length > 0) {
            const adminToken = storeAdmins[0].fcm_token;
            if (adminToken) {
              await admin.messaging().send({
                token: adminToken,
                notification: {
                  title: '⚠️ Alerta na Operação',
                  body: `Irregularidade detectada na ${store} por ${employeeName}. Verifique o painel.`
                },
                data: { url: '/admin' },
                apns: { payload: { aps: { sound: 'default', badge: 1 } } }
              });
            }
          }
        } catch (pushErr) { console.error('Erro push notification:', pushErr); }
        // ─────────────────────────────────────────────────────────

        // ── NOTIFICAÇÃO VIA WHATSAPP (DONO E FUNCIONÁRIO) ───────
        try {
          const evoUrl = process.env.EVOLUTION_API_URL;
          const evoKey = process.env.EVOLUTION_API_KEY;
          const evoInstance = process.env.EVOLUTION_INSTANCE || 'firecheck';

          // Buscar título do checklist
          let checklistTitle = 'Checklist';
          if (checklistId) {
            const { rows: clRows } = await pool.query('SELECT title FROM checklists WHERE id = $1', [checklistId]);
            if (clRows.length > 0) checklistTitle = clRows[0].title;
          }

          // Formatar data e horários
          const now = new Date();
          const dataHoje = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
          const horaFim = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
          let horaInicio = '—';
          if (startedAt) {
            const startDate = new Date(startedAt);
            horaInicio = startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
          }

          if (evoUrl && evoKey) {
            // Verificar discrepâncias de estoque/quantidade em updatedTasks
            const stockDiscrepancies = [];
            const tasksList = Array.isArray(updatedTasks) ? updatedTasks : (typeof updatedTasks === 'string' ? JSON.parse(updatedTasks) : []);
            tasksList.forEach(t => {
              if (t && t.done !== null && t.done !== undefined && t.done !== '') {
                const val = parseFloat(t.done);
                if (!isNaN(val)) {
                  const hasMin = (t.minStock !== undefined && t.minStock !== '' && t.minStock !== null) || (t.minQuantity !== undefined && t.minQuantity !== '' && t.minQuantity !== null);
                  const minVal = parseFloat(t.minStock !== undefined && t.minStock !== '' && t.minStock !== null ? t.minStock : (t.minQuantity || 0));
                  const hasMax = t.maxQuantity !== undefined && t.maxQuantity !== '' && t.maxQuantity !== null;
                  const maxVal = parseFloat(t.maxQuantity || 0);

                  if (hasMin && val < minVal) {
                    const diff = (minVal - val).toFixed(1);
                    stockDiscrepancies.push(`🔻 *${t.text || 'Item'}*: Apurado *${val} ${t.unit || 'un'}* (Mínimo: ${minVal} ${t.unit || 'un'} — Faltam *${diff} ${t.unit || 'un'}*)`);
                  } else if (hasMax && val > maxVal) {
                    const excess = (val - maxVal).toFixed(1);
                    stockDiscrepancies.push(`🔺 *${t.text || 'Item'}*: Apurado *${val} ${t.unit || 'un'}* (Máximo: ${maxVal} ${t.unit || 'un'} — Excesso: *${excess} ${t.unit || 'un'}*)`);
                  }
                }
              }
            });

            const feedbackParsed = typeof feedbackInfo === 'string' ? JSON.parse(feedbackInfo) : (feedbackInfo || {});
            const hasAiWarnings = Object.values(feedbackParsed).some(f => f.status === 'warning' || f.status === 'error');
            const hasWarnings = hasAiWarnings || stockDiscrepancies.length > 0;

             // 1. Notificação para os Donos e Gestores (Admin/Master/Gestor)
             const { rows: adminDetails } = await pool.query(
               "SELECT phone, whatsapp_active, whatsapp_phone, wa_checklist_reprovado, wa_checklist_aprovado, name FROM users WHERE store = $1 AND (role = 'admin' OR role = 'master' OR role = 'gestor')",
               [store]
             );
             for (const adm of adminDetails) {
               const isWhatsappActive = adm.whatsapp_active !== false;
               const targetPhone = adm.whatsapp_phone || adm.phone;

               if (isWhatsappActive && targetPhone) {
                 const cleanPhone = targetPhone.replace(/\D/g, '');
                 const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;

                 // Notificação de checklist APROVADO (sem irregularidades e sem discrepância de estoque)
                 if (!hasWarnings && adm.wa_checklist_aprovado !== false) {
                   const successMsg = `✅ *FireCheck - Checklist Concluído com Sucesso*\n\n` +
                     `📋 *${checklistTitle}*\n` +
                     `👤 Colaborador: *${employeeName}*\n` +
                     `🏪 Loja: *${store}*\n` +
                     `📅 Data: *${dataHoje}*\n` +
                     `🕐 Início: *${horaInicio}* → Fim: *${horaFim}*\n\n` +
                     `Status: *✅ Tudo em Conformidade*\n` +
                     `Nenhuma irregularidade ou falta de estoque encontrada. Operação segura! 🚀`;

                   fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                     body: JSON.stringify({ number: fullPhone, text: successMsg })
                   }).catch(e => console.error('[WhatsApp Admin Aprovado] Erro ao enviar:', e.message));
                 }

                 // Notificação de checklist REPROVADO ou com Alerta de Estoque
                 if (hasWarnings && adm.wa_checklist_reprovado !== false) {
                   let stockDetailsMsg = '';
                   if (stockDiscrepancies.length > 0) {
                     stockDetailsMsg = `\n\n🚨 *ALERTAS DE ESTOQUE / QUANTIDADE:*\n` + stockDiscrepancies.join('\n');
                   }

                   const textMsg = `⚠️ *FireCheck - Alerta de Checklist & Estoque*\n\n` +
                     `📋 *${checklistTitle}*\n` +
                     `👤 Colaborador: *${employeeName}*\n` +
                     `🏪 Loja: *${store}*\n` +
                     `📅 Data: *${dataHoje}*\n` +
                     `🕐 Início: *${horaInicio}* → Fim: *${horaFim}*\n\n` +
                     `Status: *⚠️ Irregularidade / Estoque Fora do Limite*` +
                     stockDetailsMsg + `\n\n` +
                     `Acesse o painel em firecheckapp.com.br/login para ver o relatório completo. 🔥`;

                   fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                     body: JSON.stringify({ number: fullPhone, text: textMsg })
                   }).catch(e => console.error('[WhatsApp Admin] Erro ao enviar:', e.message));
                 }
               }
             }

            // 2. Notificação para o Colaborador que finalizou (Funcionário/Gestor/Dono)
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
                  `📋 *${checklistTitle}*\n` +
                  `Olá, *${employeeName}*! Seu checklist da loja *${store}* foi finalizado com sucesso.\n` +
                  `📅 Data: *${dataHoje}*\n` +
                  `🕐 Início: *${horaInicio}* → Fim: *${horaFim}*\n\n` +
                  `Obrigado por manter nossa operação segura! 🚀`;

                fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                  body: JSON.stringify({ number: fullPhone, text: textMsg })
                }).catch(e => console.error('[WhatsApp Funcionario] Erro ao enviar:', e.message));
              }
            }
          }
        } catch (waErr) {
          console.error('Erro geral ao processar notificações do WhatsApp:', waErr);
        }
        // ─────────────────────────────────────────────────────────

        return res.status(200).json({ success: true, id: rows[0].id });
      }
    }

    // ── Cron de Checklists Atrasados ─────────────────────────────────
    // ── Cron de Ponto - Notificação de Ausência/Falta ─────────────────────────────────
    if (url.includes('/api/cron/ponto-ausencia')) {
      try {
        const evoUrl = process.env.EVOLUTION_API_URL;
        const evoKey = process.env.EVOLUTION_API_KEY;
        const evoInstance = process.env.EVOLUTION_INSTANCE || 'firecheck';

        if (!evoUrl || !evoKey) {
          return res.status(500).json({ error: 'Evolution API não configurada.' });
        }

        // Buscar todas as lojas que têm ponto ativo
        const { rows: adminsWithPonto } = await pool.query(
          "SELECT DISTINCT store, ponto_hora_entrada, ponto_hora_saida, ponto_tolerancia, timezone, wa_ponto_ausencia FROM users WHERE (role = 'admin' OR role = 'master') AND (ponto_active = TRUE OR status = 'trial')"
        );

        let alertasEnviados = 0;

        for (const admin of adminsWithPonto) {
          const storeName = admin.store;
          if (!storeName) continue;

          const isAusenciaActive = admin.wa_ponto_ausencia !== false;
          if (!isAusenciaActive) continue;

          const tz = admin.timezone || 'America/Sao_Paulo';
          const agora = new Date();
          const horaAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz });
          const [hAtual, mAtual] = horaAtual.split(':').map(Number);
          const atualMinutos = hAtual * 60 + mAtual;

          const horaEntrada = admin.ponto_hora_entrada || '08:00';
          const tolerancia = admin.ponto_tolerancia || 15;
          const [hEntrada, mEntrada] = horaEntrada.split(':').map(Number);
          const limiteMinutos = hEntrada * 60 + mEntrada + tolerancia + 30; // 30 min extra de margem

          // Só verificar se já passou do horário limite
          if (atualMinutos < limiteMinutos) continue;

          // Buscar todos os funcionários da loja
          const today = agora.toLocaleDateString('en-CA', { timeZone: tz });
          const { rows: employees } = await pool.query(
            "SELECT id, name, ponto_hora_entrada, ponto_tolerancia FROM users WHERE store = $1 AND (role = 'funcionario' OR role = 'gestor')",
            [storeName]
          );

          // Buscar quem JÁ bateu entrada hoje
          const { rows: pontoHoje } = await pool.query(
            "SELECT DISTINCT user_id FROM ponto_records WHERE store = $1 AND type = 'entrada' AND timestamp::date = $2",
            [storeName, today]
          );
          const quemBateu = new Set(pontoHoje.map(r => r.user_id));

          // Filtrar quem faltou
          const ausentes = [];
          for (const emp of employees) {
            if (quemBateu.has(emp.id)) continue;
            
            const configData = await getEmployeeScheduleForDay(pool, emp.id, agora);
            if (!configData.isWorkday) continue;

            const empEntrada = configData.horaEntrada || '08:00';
            const empTolerancia = configData.tolerancia || 15;
            const [hEmp, mEmp] = empEntrada.split(':').map(Number);
            const limiteEmp = hEmp * 60 + mEmp + empTolerancia + 30;
            if (atualMinutos >= limiteEmp) {
               ausentes.push(emp);
            }
          }

          if (ausentes.length === 0) continue;

          // Buscar gestores/admins da loja para notificar
          const { rows: recipients } = await pool.query(
            "SELECT fcm_token, name, whatsapp_active, whatsapp_phone, phone FROM users WHERE store = $1 AND (role = 'admin' OR role = 'master' OR role = 'gestor')",
            [storeName]
          );

          const listaAusentes = ausentes.map(a => `  • ${a.name}`).join('\n');
          const textMsg = `🚨 *FireCheck - Alerta de Ausência/Falta*\n\n` +
            `Na loja *${storeName}*, os seguintes colaboradores *não registraram entrada* até agora (${horaAtual}):\n\n` +
            `${listaAusentes}\n\n` +
            `Horário esperado: *${horaEntrada}* (tolerância: ${tolerancia}min)\n` +
            `Verifique com a equipe! ⚠️`;

          for (const recipient of recipients) {
            // Push notification
            if (recipient.fcm_token) {
              try {
                await admin.messaging().send({
                  token: recipient.fcm_token,
                  notification: {
                    title: '🚨 Alerta de Ausência',
                    body: `${ausentes.length} colaborador(es) não bateram ponto em ${storeName}`
                  },
                  data: { url: '/admin' },
                  apns: { payload: { aps: { sound: 'default', badge: 1 } } }
                }).catch(e => console.error('[Push Ausencia] Erro:', e.message));
              } catch (pushErr) {
                console.error('[Push Ausencia] Erro:', pushErr.message);
              }
            }

            // WhatsApp
            const isWhatsappActive = recipient.whatsapp_active !== false;
            const targetPhone = recipient.whatsapp_phone || recipient.phone;
            if (isWhatsappActive && targetPhone) {
              const cleanPhone = targetPhone.replace(/\D/g, '');
              const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
              fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                body: JSON.stringify({ number: fullPhone, text: textMsg })
              }).catch(e => console.error('[WhatsApp Ausencia] Erro:', e.message));
            }
            alertasEnviados++;
          }
        }

        return res.status(200).json({ success: true, alertasEnviados });
      } catch (cronErr) {
        console.error('Erro no cron de ausência de ponto:', cronErr);
        return res.status(500).json({ error: cronErr.message });
      }
    }

    if (url.includes('/api/cron/checklists-delayed')) {
      try {
        const evoUrl = process.env.EVOLUTION_API_URL;
        const evoKey = process.env.EVOLUTION_API_KEY;
        const evoInstance = process.env.EVOLUTION_INSTANCE || 'firecheck';

        if (!evoUrl || !evoKey) {
          return res.status(500).json({ error: 'Evolution API não configurada.' });
        }

        // 1. Obter dia da semana atual em português (seg, ter...)
        const diasSemanaMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
        const agora = new Date();
        const diaSemanaAtual = diasSemanaMap[agora.getDay()];
        const dataHoje = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD
        const horaMinutosAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
        const [hAtual, mAtual] = horaMinutosAtual.split(':').map(Number);
        const minutosAtual = hAtual * 60 + mAtual;

        // 2. Buscar todos os checklists que possuem horário programado (scheduled_date)
        const { rows: checklists } = await pool.query(
          "SELECT id, title, store, recurrence, scheduled_date, weekdays FROM checklists WHERE scheduled_date IS NOT NULL AND scheduled_date != ''"
        );

        let alertasEnviados = 0;

        for (const cl of checklists) {
          // Validar recorrência/dias da semana
          let deveRodarHoje = false;
          if (!cl.weekdays || cl.weekdays.length === 0 || cl.recurrence === 'diaria') {
            deveRodarHoje = true;
          } else {
            try {
              const wd = typeof cl.weekdays === 'string' ? JSON.parse(cl.weekdays) : cl.weekdays;
              if (Array.isArray(wd) && wd.includes(diaSemanaAtual)) {
                deveRodarHoje = true;
              }
            } catch (e) { deveRodarHoje = true; }
          }

          if (!deveRodarHoje) continue;

          // Validar horário programado (ex: "18:00")
          const [hProg, mProg] = cl.scheduled_date.split(':').map(Number);
          if (isNaN(hProg) || isNaN(mProg)) continue;
          const minutosProg = hProg * 60 + mProg;

          // Se a hora atual já passou do horário programado, E está dentro da janela de 1 hora (60 minutos)
          if (minutosAtual >= minutosProg && minutosAtual <= minutosProg + 60) {
            // Verificar se já houve submissão para esse checklist hoje
            const { rows: submissoes } = await pool.query(
              "SELECT id FROM checklist_submissions WHERE checklist_id = $1 AND created_at::date = $2 LIMIT 1",
              [cl.id, dataHoje]
            );

            if (submissoes.length === 0) {
              // Checklist atrasado! Buscar dados dos Donos e Gestores
              const { rows: adminRows } = await pool.query(
                "SELECT phone, whatsapp_active, whatsapp_phone, wa_checklist_atrasado FROM users WHERE store = $1 AND (role = 'admin' OR role = 'master' OR role = 'gestor')",
                [cl.store]
              );

              for (const adminData of adminRows) {
                const isWaChecklistAtrasadoActive = adminData.wa_checklist_atrasado !== false;
                const isWhatsappActive = adminData.whatsapp_active !== false;
                const targetPhone = adminData.whatsapp_phone || adminData.phone;

                if (isWaChecklistAtrasadoActive && isWhatsappActive && targetPhone) {
                  const cleanPhone = targetPhone.replace(/\D/g, '');
                  const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;

                  const textMsg = `⏰ *FireCheck - Alerta de Checklist Atrasado*\n\n` +
                    `Atenção! O checklist programado *"${cl.title}"* da loja *${cl.store}* ainda não foi preenchido hoje.\n\n` +
                    `Horário programado: *${cl.scheduled_date}*\n` +
                    `Horário limite de tolerância ultrapassado. ⚠️`;

                  fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                    body: JSON.stringify({ number: fullPhone, text: textMsg })
                  }).catch(e => console.error(`[Cron WhatsApp Atraso] Erro:`, e.message));

                  alertasEnviados++;
                }
              }
            }
          }
        }

        return res.status(200).json({ success: true, alerts_sent: alertasEnviados });
      } catch (err) {
        console.error('Erro na rota de Cron de checklists:', err);
        return res.status(500).json({ error: err.message });
      }
    }

    // ── Health Check da IA ──────────────────────────────────────────
    if (url.includes('/api/health')) {
      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) return res.status(200).json({ ai: false, reason: 'API Key ausente' });
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent("Responda apenas: OK");
        const text = (await result.response).text();
        return res.status(200).json({ ai: true, response: text.substring(0, 20) });
      } catch (e) {
        return res.status(200).json({ ai: false, reason: e.message.substring(0, 100) });
      }
    }

    // ── Auto-Processador de Pendentes (Piggyback) ─────────────────
    // Roda silenciosamente em CADA request ao backend, sem depender do admin
    if (url.includes('/api/auto-process-pending')) {
      try {
        const { rows: pending } = await pool.query(
          `SELECT id FROM checklist_submissions 
           WHERE (feedback_info IS NULL OR feedback_info = '{}' OR feedback_info::text = 'null')
           AND retry_count < 15
           AND created_at > NOW() - INTERVAL '7 days'
           ORDER BY created_at DESC LIMIT 3`
        );
        const processed = [];
        for (const row of pending) {
          try {
            const innerRes = await processAuditForSubmission(pool, row.id);
            if (innerRes.processed > 0) processed.push(row.id);
          } catch (e) { console.error(`[Auto-Process] Falha no id=${row.id}:`, e.message); }
        }
        return res.status(200).json({ success: true, checked: pending.length, processed });
      } catch (e) {
        return res.status(200).json({ success: false, error: e.message });
      }
    }

    if (url.includes('/api/process-audit-background')) {
      if (method === 'POST') {
        const { submissionId } = req.body;
        const result = await processAuditForSubmission(pool, submissionId);
        return res.status(200).json(result);
      }
    }

    if (url.includes('/api/submissions')) {
      const authUser = await autenticarComLojaAtual(req);
      if (!authUser) return res.status(401).json({ error: 'Token inválido ou ausente.' });
      const store = authUser.role === 'master' ? searchParams.get('store') : authUser.store;
      
      let queryStr = 'SELECT cs.*, v.plate as vehicle_plate, v.model as vehicle_model, v.brand as vehicle_brand, v.color as vehicle_color FROM checklist_submissions cs LEFT JOIN vehicles v ON cs.vehicle_id = v.id';
      let queryParams = [];
      if (store) {
        queryStr += ' WHERE LOWER(cs.store) = LOWER($1)';
        queryParams.push(store);
      }
      // Detalhe de uma submissão: devolve o registro completo, com as imagens.
      const idPedido = searchParams.get('id');
      if (idPedido) {
        const { rows: um } = await pool.query(
          `SELECT cs.*, v.plate as vehicle_plate, v.model as vehicle_model, v.brand as vehicle_brand, v.color as vehicle_color
           FROM checklist_submissions cs LEFT JOIN vehicles v ON cs.vehicle_id = v.id
           WHERE cs.id = $1${store ? ' AND LOWER(cs.store) = LOWER($2)' : ''}`,
          store ? [idPedido, store] : [idPedido]
        );
        if (um.length === 0) return res.status(404).json({ error: 'Submissão não encontrada.' });
        const r = um[0];
        return res.status(200).json({
          ...r,
          tasks: typeof r.tasks === 'string' ? JSON.parse(r.tasks) : r.tasks,
          feedback_info: typeof r.feedback_info === 'string' ? JSON.parse(r.feedback_info) : r.feedback_info,
        });
      }

      queryStr += ' ORDER BY cs.created_at DESC LIMIT 50';

      const { rows } = await pool.query(queryStr, queryParams);

      // Quando o envio ao Firebase falha, a imagem inteira em base64 acaba gravada
      // no banco. Esta lista é recarregada a cada 10 segundos pelo painel, e sem
      // enxugar aqui o lojista baixava dezenas de MB a cada atualização.
      // O marcador continua sendo um valor "verdadeiro", então toda a lógica de
      // tela que só verifica a existência da foto segue funcionando; a imagem real
      // é buscada por ?id= quando o detalhe é aberto.
      const MARCADOR = '[imagem]';
      const enxugar = (v) => (typeof v === 'string' && v.startsWith('data:image') ? MARCADOR : v);

      return res.status(200).json(rows.map(r => {
        const tasks = typeof r.tasks === 'string' ? JSON.parse(r.tasks) : r.tasks;
        const tasksLeves = Array.isArray(tasks)
          ? tasks.map(t => (t && typeof t === 'object'
              ? { ...t, photo: enxugar(t.photo), photos: Array.isArray(t.photos) ? t.photos.map(enxugar) : t.photos }
              : t))
          : tasks;
        return {
          ...r,
          tasks: tasksLeves,
          selfie: enxugar(r.selfie),
          signature: enxugar(r.signature),
          feedback_info: typeof r.feedback_info === 'string' ? JSON.parse(r.feedback_info) : r.feedback_info,
        };
      }));
    }

    if (url.includes('/api/cameras')) {
      const authUser = await autenticarComLojaAtual(req);
      if (!authUser) return res.status(401).json({ error: 'Token inválido ou ausente.' });
      const store = authUser.role === 'master' ? searchParams.get('store') : authUser.store;
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
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

          const base64Data = photoBase64.split(',')[1] || photoBase64;
          const prompt = `Você é um sistema de monitoramento de segurança e auditoria operacional em tempo real.
          Sua tarefa é analisar o frame atual da câmera "${cameraName}" e verificar as seguintes regras operacionais:
          ${commands.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n')}
          
          Responda ESTRITAMENTE em formato JSON com uma lista de alertas. 
          Se uma regra for DESCUMPRIDA ou o evento solicitado ESTIVER ACONTECENDO (ex: "tem muito lixo", "porta aberta"), adicione um alerta.
          Se estiver tudo normal, retorne um array vazio [].
          Formato: [{"command": "A regra quebrada", "alert": "O que você viu na imagem que quebra a regra"}]`;

          const result = await model.generateContent([prompt, { inlineData: { data: base64Data, mimeType: "image/jpeg" } }]);
          const response = await result.response;
          const aiResponse = JSON.parse(response.text().match(/\[[\s\S]*\]/)?.[0] || '[]');

          return res.status(200).json({ alerts: aiResponse });
        } catch (error) {
          console.error('Erro na IA da Câmera:', error);
          return res.status(500).json({ error: 'Falha no processamento da IA' });
        }
      }
    }

    if (url.includes('/api/generate-checklist-ai') && !url.includes('/api/generate-checklist-ai-v2') && !url.includes('/api/generate-checklist-ai-audio')) {
      if (method === 'POST') {
        const { prompt } = req.body;
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'API Key ausente' });

        try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

          const aiPrompt = `Você é um especialista em auditoria operacional e criação de checklists empresariais.
          O dono de um negócio descreveu o seguinte processo que ele quer auditar: "${prompt}"

          Crie um checklist profissional e completo para auditar esse processo. Siga estas regras:
          1. Gere entre 4 e 8 tarefas relevantes e específicas para o processo descrito.
          2. Pelo menos 2 tarefas devem exigir foto como prova (requirePhoto: true).
          3. Inclua pelo menos 1 tarefa do tipo "rating" (avaliação 1-5) e 1 do tipo "multiple" (múltipla escolha com opções).
          4. Cada tarefa deve ter: text (descrição clara), type (boolean/check/rating/numeric/multiple/text), requirePhoto (boolean), options (array de strings, só para type multiple).
          5. Dê um título profissional e curto para o checklist.

          Responda ESTRITAMENTE em JSON no formato:
          {"title": "string", "tasks": [{"text": "string", "type": "string", "requirePhoto": boolean, "options": []}]}`;

          const result = await model.generateContent(aiPrompt);
          const response = await result.response;
          const text = response.text();
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);

          return res.status(200).json(parsed);
        } catch (error) {
          console.error('Erro ao gerar checklist com IA:', error);
          return res.status(500).json({ error: 'Falha na geração com IA' });
        }
      }
    }

    // ── Transcrição de Áudio via Gemini (STT) ──────────────────────
    if (url.includes('/api/transcribe-audio')) {
      if (method === 'POST') {
        const { audio, mimeType } = req.body;
        if (!audio) return res.status(400).json({ error: 'Nenhum áudio enviado' });

        const authUser = await autenticarComLojaAtual(req);
        if (!authUser) return res.status(401).json({ error: 'Não autenticado' });

        const { rows: admins } = await pool.query(
          "SELECT id, quota_reset_date, plan, ai_creations_used FROM users WHERE store = $1 AND (role = 'admin' OR role = 'master') LIMIT 1",
          [authUser.store]
        );
        const admin = admins[0];
        if (admin) {
          const wasReset = await checkAndResetQuota(pool, admin.id, admin.quota_reset_date);
          const used = wasReset ? 0 : (admin.ai_creations_used || 0);
          const limit = getAiCreationLimit(admin.plan);
          if (used >= limit) {
            return res.status(403).json({
              quota_exceeded: true,
              error: `Sua empresa atingiu o limite de ${limit} criações de checklist por IA este mês. Faça upgrade do plano para continuar.`
            });
          }
        }

        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'API Key ausente' });

        try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

          const result = await model.generateContent([
            {
              inlineData: {
                mimeType: mimeType || 'audio/webm',
                data: audio,
              },
            },
            { text: 'Transcreva exatamente o que foi dito neste áudio em português brasileiro. Retorne APENAS o texto transcrito, sem explicações, sem aspas, sem formatação. Se não houver fala, retorne uma string vazia.' },
          ]);

          const response = await result.response;
          const text = (response.text() || '').trim();
          console.log(`🎤 STT FireCheck: "${text.substring(0, 80)}..."`);
          return res.status(200).json({ text });
        } catch (error) {
          console.error('Erro na transcrição de áudio:', error);
          return res.status(500).json({ error: 'Falha na transcrição do áudio' });
        }
      }
    }

    // ── Geração de Checklist com IA v2 (Conversacional) ────────────
    if (url.includes('/api/generate-checklist-ai-v2')) {
      if (method === 'POST') {
        const { description, conversation = [] } = req.body;
        if (!description && conversation.length === 0) {
          return res.status(400).json({ error: 'Descrição ou conversa obrigatória' });
        }

        const authUser = await autenticarComLojaAtual(req);
        if (!authUser) return res.status(401).json({ error: 'Não autenticado' });

        const { rows: admins } = await pool.query(
          "SELECT id, quota_reset_date, plan, ai_creations_used FROM users WHERE store = $1 AND (role = 'admin' OR role = 'master') LIMIT 1",
          [authUser.store]
        );
        const admin = admins[0];
        if (!admin) return res.status(404).json({ error: 'Administrador da loja não encontrado' });

        const wasReset = await checkAndResetQuota(pool, admin.id, admin.quota_reset_date);
        const used = wasReset ? 0 : (admin.ai_creations_used || 0);
        const limit = getAiCreationLimit(admin.plan);
        if (used >= limit) {
          return res.status(403).json({
            quota_exceeded: true,
            error: `Sua empresa atingiu o limite de ${limit} criações de checklist por IA este mês. Faça upgrade do plano para continuar.`
          });
        }

        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'API Key ausente' });

        try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
          });

          // Monta o histórico de conversa para contexto
          const conversationContext = conversation.length > 0
            ? '\n\nHistórico da conversa até agora:\n' + conversation.map(m => `${m.role === 'user' ? 'Usuário' : 'Bill'}: ${m.content}`).join('\n')
            : '';

          const userStoreName = authUser.store || 'não informada';

          const aiPrompt = `Você é o Bill, um consultor operacional EXPERT em processos de negócios. Você ajuda donos de negócios a criar checklists operacionais perfeitos.

A loja/empresa do usuário se chama: "${userStoreName}"

Última mensagem do usuário:
"${description}"
${conversationContext}

═══════════════════════════════════════════
 REGRA #1 — ESCUTE COM ATENÇÃO TOTAL E PRESERVE OS TERMOS
═══════════════════════════════════════════
- CADA PALAVRA importa. Preste atenção em TODOS os detalhes específicos.
- Se ele mencionou "geladeira", use "geladeira" — NÃO transforme em "equipamento de refrigeração".
- Se ele disse "antes de abrir", entenda que é um processo de ABERTURA.
- Se ele mencionou produtos específicos (ex: "Coca-Cola, pão francês"), USE esses nomes exatos nas tarefas.
- Se ele falou de horários, USE esses horários no timeLimit.
- NUNCA invente detalhes ou tarefas que o usuário NÃO mencionou.
- A linguagem pode ser informal (vinda de áudio) — interprete o SIGNIFICADO, não julgue a forma.

═══════════════════════════════════════════
 REGRA #2 — DIAGNÓSTICO E PERGUNTAS SIMPLES E DIRETAS (OBRIGATÓRIO)
═══════════════════════════════════════════
Você deve seguir este fluxo conversacional estritamente:
1. Se a conversa acabou de começar ou se é a primeira vez na conversa que o usuário descreve/pede um checklist específico (mesmo que ele já tenha mandado saudações antes ou que esta não seja a primeira mensagem do histórico):
   - Você NÃO PODE, sob nenhuma circunstância, gerar o checklist ainda.
   - Você DEVE retornar "needsMoreInfo": true.
   - Primeiro, confirme que entendeu o pedido em uma única frase curta e simpática (ex: "Entendi! Você quer um checklist para retirada de itens da geladeira.").
   - Depois, faça no máximo 1 ou 2 perguntas extremamente curtas, diretas e simples (sem rodeios, textos longos ou explicações de por que a pergunta importa). Seja objetivo para facilitar o dia a dia do empresário.
   - Responda no formato:
     {"needsMoreInfo": true, "message": "sua mensagem curta confirmando que entendeu + perguntas", "questions": ["pergunta1", "pergunta2"]}

2. Se o usuário já respondeu a perguntas suas na conversa sobre o checklist solicitado:
   - Analise se você já tem detalhes suficientes.
   - Se ainda faltarem detalhes críticos, faça no máximo 1 pergunta focada e muito curta.
   - Se as informações já forem suficientes e claras, então GERE o checklist completo ("needsMoreInfo": false).

═══════════════════════════════════════════
 REGRA #3 — PERGUNTAS OBJETIVAS E CONTEXTUAIS
═══════════════════════════════════════════
- Pergunte coisas simples e diretamente relacionadas ao processo (ex: "Quais os principais itens?" ou "Tem algum horário específico?").
- NUNCA explique por que a pergunta é importante. Vá direto ao assunto.
- NUNCA faça perguntas longas ou acadêmicas. Use linguagem simples de quem está no chão de fábrica/operação.

═══════════════════════════════════════════
 REGRA #4 — CHECKLIST DE QUALIDADE (QUANDO FOR GERAR)
═══════════════════════════════════════════
Quando gerar o checklist (somente quando needsMoreInfo for false), siga estas regras:
- Gere entre 5 e 15 tarefas na ORDEM LÓGICA de execução.
- Use os TERMOS EXATOS que o usuário mencionou.
- Pelo menos 2-3 tarefas com requirePhoto: true (para auditoria visual).
- Use tipos variados: "boolean" (sim/não), "check" (feito), "rating" (1-5 estrelas), "numeric" (contagem), "multiple" (opções), "text" (texto livre), "itemlist" (lista de itens pra conferir).
- Para tipo "multiple" ou "itemlist", inclua as opções no array "options".
- Se o usuário mencionou horários, use-os no campo timeLimit (formato "HH:MM").

FORMATO DE RESPOSTA (JSON puro, sem markdown, sem blocos de código):

Se precisar de mais informações:
{"needsMoreInfo": true, "message": "sua mensagem amigável mostrando que entendeu", "questions": ["pergunta1", "pergunta2"]}

Se pronto para gerar:
{"needsMoreInfo": false, "title": "título curto e descritivo", "tasks": [{"text": "descrição clara usando termos do usuário", "type": "boolean|check|rating|numeric|multiple|text|itemlist", "requirePhoto": true/false, "timeLimit": "HH:MM ou vazio", "options": []}]}

Responda APENAS com JSON válido.`;

          const result = await model.generateContent(aiPrompt);
          const response = await result.response;
          const text = response.text().trim();

          // Tenta extrair JSON da resposta e higienizar caracteres de controle inválidos
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          const rawJson = jsonMatch ? jsonMatch[0] : text;
          const cleanJson = cleanJsonString(rawJson);
          const parsed = JSON.parse(cleanJson);

          if (parsed && !parsed.needsMoreInfo && parsed.title && parsed.tasks?.length > 0) {
            await pool.query('UPDATE users SET ai_creations_used = COALESCE(ai_creations_used, 0) + 1 WHERE id = $1', [admin.id]);
          }

          return res.status(200).json(parsed);
        } catch (error) {
          console.error('Erro ao gerar checklist v2 com IA:', error);
          return res.status(500).json({ error: 'Falha na geração com IA' });
        }
      }
    }

    // ── Geração de Lista de Compras com IA ──────────────────────
    if (url.includes('/api/generate-shopping-ai')) {
      if (method === 'POST') {
        const { description, conversation = [], audio, mimeType } = req.body;
        const authUser = await autenticarComLojaAtual(req);
        if (!authUser) return res.status(401).json({ error: 'Não autenticado' });

        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'API Key ausente' });

        try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
          });

          let userText = description || '';

          // Se veio áudio, transcrever primeiro
          if (audio && !userText) {
            const tModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const tResult = await tModel.generateContent([
              { inlineData: { mimeType: mimeType || 'audio/webm', data: audio } },
              'Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito.'
            ]);
            userText = tResult.response.text().trim();
          }

          if (!userText) return res.status(400).json({ error: 'Nenhum texto ou áudio enviado' });

          const conversationContext = conversation.length > 0
            ? '\n\nHistórico da conversa:\n' + conversation.map(m => `${m.role === 'user' ? 'Usuário' : 'Bill'}: ${m.content}`).join('\n')
            : '';

          const aiPrompt = `Você é o Bill, um assistente expert em gestão de compras e estoque para negócios. Você ajuda donos de negócios a criar LISTAS DE COMPRAS com controle de estoque.

A empresa do usuário: "${authUser.store || 'não informada'}"

Última mensagem do usuário:
"${userText}"
${conversationContext}

═══════════════════════════════════════════
 REGRA #1 — CONTEXTO: LISTA DE COMPRAS
═══════════════════════════════════════════
Você está ajudando a criar uma LISTA DE COMPRAS com:
- Nome dos produtos/itens
- Unidade de medida (un, kg, L, cx, pct, dz)
- Estoque mínimo (quantidade mínima que deve ter no estoque)

═══════════════════════════════════════════
 REGRA #2 — FLUXO CONVERSACIONAL
═══════════════════════════════════════════
1. Se é a primeira mensagem ou o usuário está descrevendo o que precisa:
   - Confirme que entendeu em 1 frase curta
   - Faça 1-2 perguntas rápidas (ex: "Quais itens principais?", "Tem algum item com estoque mínimo definido?")
   - Retorne: {"needsMoreInfo": true, "message": "...", "questions": ["..."]}

2. Se o usuário já respondeu e você tem info suficiente:
   - GERE a lista de compras completa
   - Retorne: {"needsMoreInfo": false, "title": "nome da lista", "items": [...]}

═══════════════════════════════════════════
 REGRA #3 — GERAÇÃO DA LISTA
═══════════════════════════════════════════
Quando gerar (needsMoreInfo = false):
- Use os termos EXATOS do usuário
- Cada item: {"name": "Nome do Produto", "unit": "un|kg|L|cx|pct|dz", "minStock": 5, "category": "categoria"}
- Categorias possíveis: "limpeza", "alimentos", "bebidas", "embalagens", "descartáveis", "escritório", "higiene", "manutenção", "geral"
- Defina estoque mínimo com bom senso (baseado no tipo de negócio)
- Agrupe logicamente os itens

FORMATO DE RESPOSTA (JSON puro):

Se precisar mais info:
{"needsMoreInfo": true, "message": "mensagem amigável", "questions": ["pergunta1"]}

Se pronto para gerar:
{"needsMoreInfo": false, "title": "título da lista", "recurrence": "daily|weekly|monthly", "items": [{"name": "Produto", "unit": "un", "minStock": 5, "category": "geral"}]}

Responda APENAS com JSON válido.`;

          const result = await model.generateContent(aiPrompt);
          const text = result.response.text().trim();

          const jsonMatch = text.match(/\{[\s\S]*\}/);
          const rawJson = jsonMatch ? jsonMatch[0] : text;
          const cleanJson = cleanJsonString(rawJson);
          const parsed = JSON.parse(cleanJson);

          // Se veio áudio, retorna a transcrição junto
          if (audio) parsed._transcription = userText;

          return res.status(200).json(parsed);
        } catch (error) {
          console.error('Erro ao gerar lista de compras com IA:', error);
          return res.status(500).json({ error: 'Falha na geração com IA' });
        }
      }
    }

    // ── Geração de Checklist com IA via Áudio Direto ────────────
    if (url.includes('/api/generate-checklist-ai-audio')) {
      if (method === 'POST') {
        const { audio, mimeType, conversation = [] } = req.body;
        if (!audio) {
          return res.status(400).json({ error: 'Nenhum áudio enviado' });
        }

        const authUser = await autenticarComLojaAtual(req);
        if (!authUser) return res.status(401).json({ error: 'Não autenticado' });

        const { rows: admins } = await pool.query(
          "SELECT id, quota_reset_date, plan, ai_creations_used FROM users WHERE store = $1 AND (role = 'admin' OR role = 'master') LIMIT 1",
          [authUser.store]
        );
        const admin = admins[0];
        if (!admin) return res.status(404).json({ error: 'Administrador da loja não encontrado' });

        const wasReset = await checkAndResetQuota(pool, admin.id, admin.quota_reset_date);
        const used = wasReset ? 0 : (admin.ai_creations_used || 0);
        const limit = getAiCreationLimit(admin.plan);
        if (used >= limit) {
          return res.status(403).json({
            quota_exceeded: true,
            error: `Sua empresa atingiu o limite de ${limit} criações de checklist por IA este mês. Faça upgrade do plano para continuar.`
          });
        }

        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'API Key ausente' });

        try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
          });

          const userStoreName = authUser.store || 'não informada';

          const conversationHistory = conversation.filter(m => m.content !== '🎤 [Áudio enviado]');
          const conversationContext = conversationHistory.length > 0
            ? '\n\nHistórico da conversa até agora:\n' + conversationHistory.map(m => `${m.role === 'user' ? 'Usuário' : 'Bill'}: ${m.content}`).join('\n')
            : '';

          const systemPrompt = `Você é o Bill, um consultor operacional EXPERT em processos de negócios. O usuário está explicando por ÁUDIO o que precisa — a linguagem é informal, coloquial, e pode ter repetições ou pausas.

A loja/empresa do usuário se chama: "${userStoreName}"
${conversationContext}

═══════════════════════════════════════════
 INSTRUÇÕES PARA ÁUDIO
═══════════════════════════════════════════
- Escute o áudio com ATENÇÃO TOTAL a cada detalhe.
- Capture TODOS os termos específicos, nomes de produtos, horários, locais mencionados.
- A linguagem é falada — interprete o SIGNIFICADO, ignore hesitações e repetições.
- Inclua na sua resposta uma transcrição resumida do que entendeu (campo "transcription").

═══════════════════════════════════════════
 REGRA #1 — ESCUTE COM ATENÇÃO TOTAL E PRESERVE OS TERMOS
═══════════════════════════════════════════
- CADA PALAVRA importa. Se ele mencionou "geladeira", use "geladeira" — NÃO transforme em "equipamento de refrigeração".
- Se ele disse "antes de abrir", entenda que é ABERTURA.
- Se mencionou produtos específicos, USE esses nomes exatos.
- NUNCA invente detalhes ou tarefas que o usuário NÃO mencionou.

═══════════════════════════════════════════
 REGRA #2 — DIAGNÓSTICO E PERGUNTAS SIMPLES E DIRETAS (OBRIGATÓRIO)
═══════════════════════════════════════════
Você deve seguir este fluxo conversacional estritamente:
1. Se a conversa acabou de começar ou se é a primeira vez na conversa que o usuário descreve/pede um checklist específico por áudio (mesmo que ele já tenha mandado saudações antes ou que esta não seja a primeira mensagem do histórico):
   - Você NÃO PODE, sob nenhuma circunstância, gerar o checklist ainda.
   - Você DEVE retornar "needsMoreInfo": true.
   - Primeiro, confirme que entendeu o pedido em uma única frase curta e simpática (no campo "transcription").
   - Depois, faça no máximo 1 ou 2 perguntas extremamente curtas, diretas e simples (sem rodeios, textos longos ou explicações de por que a pergunta importa). Seja objetivo para facilitar o dia a dia do empresário.
   - Responda no formato:
     {"needsMoreInfo": true, "transcription": "resumo do áudio", "message": "sua mensagem curta confirmando que entendeu + perguntas", "questions": ["pergunta1", "pergunta2"]}

2. Se o usuário já respondeu a perguntas suas na conversa sobre o checklist solicitado:
   - Analise se você já tem detalhes suficientes.
   - Se ainda faltarem detalhes críticos, faça no máximo 1 pergunta focada e muito curta.
   - Se as informações já forem suficientes e claras, então GERE o checklist completo ("needsMoreInfo": false).

═══════════════════════════════════════════
 REGRA #3 — PERGUNTAS OBJETIVAS E CONTEXTUAIS
═══════════════════════════════════════════
- Pergunte coisas simples e diretamente relacionadas ao processo (ex: "Quais os principais itens?" ou "Tem algum horário específico?").
- NUNCA explique por que a pergunta é importante. Vá direto ao assunto.
- NUNCA faça perguntas longas ou acadêmicas. Use linguagem simples de quem está no chão de fábrica/operação.

═══════════════════════════════════════════
 REGRA #4 — CHECKLIST DE QUALIDADE (QUANDO FOR GERAR)
═══════════════════════════════════════════
Quando gerar o checklist (somente quando needsMoreInfo for false), siga estas regras:
- 5 a 15 tarefas na ORDEM LÓGICA de execução.
- Termos EXATOS do usuário.
- 2-3 tarefas com requirePhoto: true.
- Tipos variados: boolean, check, rating, numeric, multiple, text, itemlist.
- Para multiple/itemlist, inclua opções no array "options".
- Se o usuário mencionou horários, use-os no campo timeLimit (formato "HH:MM").

FORMATO (JSON puro, sem markdown, sem blocos de código):
Se precisar mais info:
{"needsMoreInfo": true, "transcription": "resumo do áudio", "message": "mensagem", "questions": ["p1", "p2"]}

Se pronto:
{"needsMoreInfo": false, "transcription": "resumo do áudio", "title": "título", "tasks": [{"text": "desc", "type": "boolean", "requirePhoto": false, "timeLimit": "", "options": []}]}

Responda APENAS com JSON válido.`;

          const result = await model.generateContent([
            {
              inlineData: {
                mimeType: mimeType || 'audio/webm',
                data: audio,
              },
            },
            { text: systemPrompt },
          ]);

          const response = await result.response;
          const text = response.text().trim();
          console.log(`🎤🤖 Audio AI Checklist: "${text.substring(0, 120)}..."`);

          const jsonMatch = text.match(/\{[\s\S]*\}/);
          const rawJson = jsonMatch ? jsonMatch[0] : text;
          const cleanJson = cleanJsonString(rawJson);
          const parsed = JSON.parse(cleanJson);

          if (parsed && !parsed.needsMoreInfo && parsed.title && parsed.tasks?.length > 0) {
            await pool.query('UPDATE users SET ai_creations_used = COALESCE(ai_creations_used, 0) + 1 WHERE id = $1', [admin.id]);
          }

          return res.status(200).json(parsed);
        } catch (error) {
          console.error('Erro ao gerar checklist via áudio:', error);
          return res.status(500).json({ error: 'Falha na geração com IA via áudio' });
        }
      }
    }

    // ── Integração com Bill SaaS ───────────────────────────────────
    if (url.includes('/api/bill/link')) {
      if (method === 'POST') {
        const user = await autenticarComLojaAtual(req);
        if (!user) return res.status(401).json({ error: 'Não autenticado' });

        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });

        try {
          // Tenta autenticar no Bill SaaS
          const billRes = await fetch('https://backend-grupohakim.vercel.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          if (!billRes.ok) {
            const errData = await billRes.json().catch(() => ({}));
            return res.status(401).json({ error: errData.error || 'Credenciais do Bill inválidas' });
          }

          const billData = await billRes.json();
          const billUser = billData.user || {};
          const billToken = billData.token;

          // Salva a vinculação no banco
          await pool.query(
            `UPDATE users SET bill_user_id = $1, bill_token = $2, bill_name = $3, bill_plan = $4 WHERE id = $5`,
            [billUser.id || email, billToken, billUser.name || email, billUser.plan || 'starter', user.id]
          );

          return res.status(200).json({
            linked: true,
            billUser: { name: billUser.name || email, plan: billUser.plan || 'starter' }
          });
        } catch (error) {
          console.error('Erro ao vincular Bill:', error);
          return res.status(500).json({ error: 'Falha ao conectar com o Bill. Verifique sua conexão.' });
        }
      }
    }

    if (url.includes('/api/bill/unlink')) {
      if (method === 'POST') {
        const user = await autenticarComLojaAtual(req);
        if (!user) return res.status(401).json({ error: 'Não autenticado' });

        try {
          await pool.query(
            `UPDATE users SET bill_user_id = NULL, bill_token = NULL, bill_name = NULL, bill_plan = NULL WHERE id = $1`,
            [user.id]
          );
          return res.status(200).json({ unlinked: true });
        } catch (error) {
          console.error('Erro ao desvincular Bill:', error);
          return res.status(500).json({ error: 'Falha ao desvincular' });
        }
      }
    }

    if (url.includes('/api/bill/status')) {
      if (method === 'GET') {
        const user = await autenticarComLojaAtual(req);
        if (!user) return res.status(401).json({ error: 'Não autenticado' });

        try {
          const result = await pool.query(
            `SELECT bill_user_id, bill_name, bill_plan FROM users WHERE id = $1`,
            [user.id]
          );
          const row = result.rows[0];
          if (row && row.bill_user_id) {
            return res.status(200).json({
              linked: true,
              billUser: { name: row.bill_name, plan: row.bill_plan }
            });
          }
          return res.status(200).json({ linked: false });
        } catch (error) {
          console.error('Erro ao checar status Bill:', error);
          return res.status(200).json({ linked: false });
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
    // ── Ocorrências e descartes ────────────────────────────────────────────────
    if (url.includes('/api/ocorrencias')) {
      const autorOc = await autenticarComLojaAtual(req);
      if (!autorOc) return res.status(401).json({ error: 'Token inválido ou ausente.' });

      if (method === 'POST') {
        const { tipo, descricao, photo, item, quantidade, unidade, valorEstimado, motivo } = req.body;
        const ehDescarte = String(tipo || '').toLowerCase() === 'descarte';

        // Um registro sem conteúdo não avisa nada a ninguém e ainda dispara
        // WhatsApp: para descarte basta o item, para ocorrência basta o relato.
        const temConteudo = ehDescarte ? !!String(item || '').trim() : !!String(descricao || '').trim();
        if (!temConteudo) {
          return res.status(400).json({
            error: ehDescarte ? 'Diga qual item foi descartado.' : 'Escreva o que aconteceu.',
          });
        }

        // A loja sai do cadastro de quem está registrando, nunca do corpo.
        const lojaDoRegistro = autorOc.role === 'master' ? await lojaCanonica(req.body.store || autorOc.store) : autorOc.store;

        let fotoFinal = photo || null;
        if (fotoFinal && typeof fotoFinal === 'string' && fotoFinal.startsWith('data:image')) {
          try {
            fotoFinal = await uploadImage(fotoFinal, `ocorrencias/${lojaDoRegistro}`);
          } catch (upErr) {
            // Foto é opcional: se o upload falhar, o relato não pode ser perdido.
            console.error('[Ocorrência] Falha ao subir a foto:', upErr.message);
            fotoFinal = null;
          }
        }

        const { rows: quem } = await pool.query('SELECT name FROM users WHERE id = $1', [autorOc.id]);
        const nomeAutor = quem[0]?.name || autorOc.email || 'Colaborador';

        const { rows } = await pool.query(
          `INSERT INTO ocorrencias (store, tipo, employee_name, employee_id, descricao, photo, item, quantidade, unidade, valor_estimado, motivo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
          [
            lojaDoRegistro,
            ehDescarte ? 'descarte' : 'ocorrencia',
            nomeAutor,
            autorOc.id,
            descricao || null,
            fotoFinal,
            ehDescarte ? (item || null) : null,
            ehDescarte ? (quantidade != null ? String(quantidade) : null) : null,
            ehDescarte ? (unidade || null) : null,
            ehDescarte && valorEstimado !== '' && valorEstimado != null ? Number(valorEstimado) : null,
            ehDescarte ? (motivo || null) : null,
          ]
        );

        // Sem await: o registro já está gravado e um WhatsApp lento não pode
        // segurar a tela de quem está no meio do serviço.
        avisarOcorrencia(lojaDoRegistro, rows[0])
          .catch(e => console.error('[Ocorrência] aviso falhou:', e.message));

        return res.status(200).json({ success: true, ocorrencia: rows[0] });
      }

      if (method === 'GET') {
        const lojaConsulta = autorOc.role === 'master' ? (searchParams.get('store') || null) : autorOc.store;
        const tipoFiltro = searchParams.get('tipo');

        // O painel manda o mesmo ?start=&end= que usa nas outras abas.
        const inicio = searchParams.get('start');
        const fim = searchParams.get('end');

        const condicoes = [];
        const valores = [];
        if (lojaConsulta) { valores.push(lojaConsulta); condicoes.push(`LOWER(TRIM(store)) = LOWER(TRIM($${valores.length}))`); }
        if (tipoFiltro === 'descarte' || tipoFiltro === 'ocorrencia') { valores.push(tipoFiltro); condicoes.push(`tipo = $${valores.length}`); }
        if (inicio) { valores.push(inicio + ' 00:00:00'); condicoes.push(`created_at >= $${valores.length}`); }
        if (fim) { valores.push(fim + ' 23:59:59'); condicoes.push(`created_at <= $${valores.length}`); }

        const { rows } = await pool.query(
          `SELECT * FROM ocorrencias ${condicoes.length ? 'WHERE ' + condicoes.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 200`,
          valores
        );
        return res.status(200).json(rows);
      }

      if (method === 'DELETE') {
        const m = url.match(/\/api\/ocorrencias\/(\d+)/);
        if (!m) return res.status(400).json({ error: 'Informe qual registro remover.' });
        if (!['admin', 'master', 'gestor'].includes(autorOc.role)) {
          return res.status(403).json({ error: 'Somente quem administra pode remover registros.' });
        }
        // O WHERE leva a loja junto: só por id, um id sequencial alcançaria o
        // registro de outro cliente.
        const filtroLoja = autorOc.role === 'master' ? '' : 'AND LOWER(TRIM(store)) = LOWER(TRIM($2))';
        const params = autorOc.role === 'master' ? [m[1]] : [m[1], autorOc.store];
        await pool.query(`DELETE FROM ocorrencias WHERE id = $1 ${filtroLoja}`, params);
        return res.status(200).json({ success: true });
      }

      return res.status(405).json({ error: 'Método não permitido.' });
    }

    if (url.includes('/api/audit')) {
      if (method === 'POST') {
        // ── Conferência de UMA foto, na hora ────────────────────────────────
        // Esta rota existia pronta e nenhuma tela a chamava. Agora ela é o que o
        // funcionário vê enquanto preenche o checklist, então mudam três coisas:
        //
        // 1. Passa a exigir login. Analisar imagem custa dinheiro e a chave já
        //    vazou uma vez neste projeto; aberta, era um moedor de cota grátis.
        //
        // 2. Aceita o critério escrito pelo gestor. Sem ele a IA só tem a frase
        //    da tarefa — "Limpar a bancada" — e julga por conta própria o que
        //    conta como limpo. Reprovação assim é chute, e aqui o chute vai
        //    aparecer na cara de quem fez o trabalho.
        //
        // 3. Deixa de responder no vocabulário aprovado/reprovado. Errar
        //    aprovando deixa passar uma sujeira; errar reprovando acusa alguém
        //    que fez o serviço certo, e neste fluxo ainda registra para o chefe
        //    que a pessoa "enviou sabendo". Os custos não são simétricos, então
        //    a dúvida tem nome próprio: `nao_conferido` não acusa ninguém, não
        //    trava o envio e cai na auditoria de fundo que já existe.
        const autorAudit = await autenticarComLojaAtual(req);
        if (!autorAudit) return res.status(401).json({ error: 'Token inválido ou ausente.' });

        const { taskId, taskText, photoBase64, criteria } = req.body;

        if (!photoBase64 || typeof photoBase64 !== 'string') {
          return res.status(200).json({ resultado: 'nao_conferido', mensagem: 'Sem foto para conferir.', approved: true });
        }

        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

        if (!apiKey) {
          // Sem chave, a conferência não existe — e não existir nunca pode virar
          // acusação. Segue como não conferido.
          return res.status(200).json({
            resultado: 'nao_conferido',
            mensagem: 'A conferência automática está indisponível no momento.',
            approved: true,
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
            const criterioLimpo = typeof criteria === 'string' ? criteria.trim().slice(0, 600) : '';
            const prompt = `Você confere a foto que um funcionário acabou de tirar como prova de uma tarefa.

TAREFA: "${taskText}"
${criterioLimpo ? `O QUE O GESTOR EXIGE NESTA FOTO: "${criterioLimpo}"` : 'O gestor não escreveu um critério específico: julgue apenas pelo texto da tarefa, e seja generoso.'}

Como julgar:
- Verifique somente se a tarefa foi cumprida${criterioLimpo ? ' segundo o critério acima' : ''}. Ignore bagunça de fundo, itens irrelevantes, enquadramento e iluminação.
- Reprovar tem custo alto: acusa uma pessoa de não ter feito o trabalho. Só reprove quando a foto mostrar CLARAMENTE que a tarefa não foi cumprida.
- Foto escura, tremida, cortada, distante ou ambígua NÃO é reprovação: é "incerto".
- Se você não conseguiria defender a reprovação olhando a pessoa nos olhos, o resultado é "incerto".

Responda ESTRITAMENTE em JSON:
{"resultado": "aprovado" | "reprovado" | "incerto", "mensagem": "string", "confianca": "alta" | "media" | "baixa"}

A mensagem é lida pelo próprio funcionário, no celular:
- aprovado: um elogio de até 8 palavras.
- reprovado: diga em uma frase curta e concreta O QUE FALTA para ele refazer a foto certa. Sem rodeio, sem julgar a pessoa. Exemplo: "A lixeira ao lado da pia ainda está cheia."
- incerto: diga o que atrapalhou de ver. Exemplo: "A foto ficou escura demais para conferir."`;

            const result = await model.generateContent([
              prompt,
              { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
            ]);

            const response = await result.response;
            const text = response.text();

            // Extração robusta de JSON para evitar quebra com markdown (```json ... ```)
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            const cleanJson = jsonMatch ? jsonMatch[0] : text;

            const bruto = JSON.parse(cleanJson);

            // Normaliza para o vocabulário da tela. Só vira reprovação o que veio
            // reprovado E com confiança alta — o resto não acusa ninguém.
            const r = String(bruto.resultado || (bruto.approved === false ? 'reprovado' : 'aprovado')).toLowerCase();
            const confianca = String(bruto.confianca || '').toLowerCase();
            let resultado;
            if (r === 'reprovado') resultado = confianca === 'alta' ? 'reprovado' : 'nao_conferido';
            else if (r === 'aprovado') resultado = 'aprovado';
            else resultado = 'nao_conferido';

            const mensagem = String(bruto.mensagem || bruto.message || '').slice(0, 300)
              || (resultado === 'aprovado' ? 'Foto conferida.' : 'Não foi possível conferir esta foto.');

            return res.status(200).json({
              taskId,
              resultado,
              mensagem,
              confianca: confianca || 'media',
              // Mantido para quem ainda leia o formato antigo.
              approved: resultado !== 'reprovado',
              message: mensagem,
            });

          } catch (error) {
            lastError = error.message || 'Erro desconhecido';
            retries--;
            if (retries === 0) {
              console.error('Falha definitiva na auditoria SDK:', error);
              // Falha de infraestrutura não é falha do funcionário: antes isto
              // voltava como approved:false, ou seja, a tela diria que ele errou
              // porque o Gemini estava fora do ar.
              return res.status(200).json({
                taskId,
                resultado: 'nao_conferido',
                mensagem: 'Não deu para conferir agora. Sua foto foi mantida.',
                confianca: 'baixa',
                approved: true,
                message: 'Não deu para conferir agora.',
              });
            }
          }
        }
      }
    }
    // --- Tracking Endpoints ---
    if (url.includes('/api/ping')) {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || '';
      const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent);
      const deviceType = isMobile ? 'mobile' : 'desktop';

      await pool.query('INSERT INTO live_pings (ip, last_ping, device_type) VALUES ($1, NOW(), $2) ON CONFLICT (ip) DO UPDATE SET last_ping = NOW(), device_type = $2', [clientIp, deviceType]);
      await pool.query("INSERT INTO site_visits (ip, visit_date, device_type) VALUES ($1, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date, $2) ON CONFLICT (ip, visit_date) DO NOTHING", [clientIp, deviceType]);
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
      await pool.query(`DELETE FROM live_pings WHERE last_ping < NOW() - INTERVAL '30 seconds'`);
      const { rows: live } = await pool.query("SELECT COUNT(*) FROM live_pings");
      const { rows: today } = await pool.query("SELECT COUNT(*) FROM site_visits WHERE visit_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date");
      const { rows: todayMobile } = await pool.query("SELECT COUNT(*) FROM site_visits WHERE visit_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date AND device_type = 'mobile'");
      const { rows: todayDesktop } = await pool.query("SELECT COUNT(*) FROM site_visits WHERE visit_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date AND device_type = 'desktop'");
      const { rows: video } = await pool.query("SELECT COUNT(*) FROM video_plays WHERE play_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date");
      return res.status(200).json({
        visitors: parseInt(live[0].count),
        today: parseInt(today[0].count),
        todayMobile: parseInt(todayMobile[0].count),
        todayDesktop: parseInt(todayDesktop[0].count),
        videoPlays: parseInt(video[0].count)
      });
    }
    // --- Quiz Analytics ---
    if (url.includes('/api/track-quiz')) {
      if (method === 'POST') {
        const { sessionId, step, q1, q2, q3, q4, completed, clickedCta, clickedButton } = req.body;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

        await pool.query(`
          INSERT INTO quiz_responses (session_id, ip, last_step, q1_answer, q2_answer, q3_answer, q4_answer, completed, clicked_cta, clicked_button)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (session_id) DO UPDATE SET 
            last_updated_at = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'),
            last_step = $3,
            q1_answer = COALESCE($4, quiz_responses.q1_answer),
            q2_answer = COALESCE($5, quiz_responses.q2_answer),
            q3_answer = COALESCE($6, quiz_responses.q3_answer),
            q4_answer = COALESCE($7, quiz_responses.q4_answer),
            completed = $8,
            clicked_cta = COALESCE($9, quiz_responses.clicked_cta),
            clicked_button = COALESCE($10, quiz_responses.clicked_button)
        `, [sessionId, clientIp, step, q1, q2, q3, q4, completed, clickedCta, clickedButton]);

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

    // --- Rastreamento Comportamental (Espião) ---
    if (url.includes('/api/track-event')) {
      if (method === 'POST') {
        const { sessionId, eventType, eventData, page, deviceType } = req.body;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        await pool.query(`
          INSERT INTO behavior_events (session_id, ip, event_type, event_data, page, device_type)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [sessionId, clientIp, eventType, JSON.stringify(eventData), page, deviceType]);
        return res.status(200).json({ success: true });
      }
    }

    // ── CONTROLE DE PONTO ────────────────────────────────────────────
    // Todo este bloco estava sem verificação de token: qualquer um batia ponto
    // por qualquer funcionário, lia o espelho de qualquer loja e exportava o
    // relatório inteiro. O front já enviava Authorization em todas as chamadas,
    // então exigir o token aqui não muda nada para quem usa o app.
    if (url.includes('/api/ponto')) {
      const authPonto = await autenticarComLojaAtual(req);
      if (!authPonto) return res.status(401).json({ error: 'Token inválido ou ausente. Faça login novamente.' });
      // A loja vem do token, não do cliente. Só o master consulta outras lojas.
      if (authPonto.role !== 'master') {
        const lojaPedida = searchParams.get('store') || (req.body && req.body.store);
        if (lojaPedida && String(lojaPedida).trim().toLowerCase() !== String(authPonto.store || '').trim().toLowerCase()) {
          return res.status(403).json({ error: 'Você só pode acessar dados de ponto da sua própria loja.' });
        }
      }
    }

    if (url.includes('/api/ponto/today')) {
      const userId = searchParams.get('userId');
      const store = searchParams.get('store');
      if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
      // Buscar timezone da loja
      let tz = 'America/Sao_Paulo';
      if (store) {
        const { rows: admins } = await pool.query("SELECT timezone FROM users WHERE store = $1 AND (role = 'admin' OR role = 'master') LIMIT 1", [store]);
        if (admins.length > 0 && admins[0].timezone) tz = admins[0].timezone;
      }
      const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
      // hora_local vem formatada pelo próprio Postgres. A coluna timestamp é
      // "without time zone" e já guarda a hora de parede da loja
      // (padrão CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'). Ao ler esse
      // valor, o driver o interpreta no fuso do processo Node — que na Vercel é
      // UTC — e converter de novo tirava 3 horas: 08:00 virava 05:00. Formatando
      // no banco, o fuso do processo deixa de influenciar.
      const { rows } = await pool.query(
        `SELECT *, to_char(timestamp, 'HH24:MI') AS hora_local
         FROM ponto_records WHERE user_id = $1 AND timestamp::date = $2 ORDER BY timestamp ASC`,
        [userId, today]
      );
      const entrada = rows.find(r => r.type === 'entrada');
      const saida = rows.find(r => r.type === 'saida');
      return res.status(200).json({
        entrada: entrada ? entrada.hora_local : null,
        saida: saida ? saida.hora_local : null,
        entradaRecord: entrada || null,
        saidaRecord: saida || null,
        records: rows,
        timezone: tz
      });
    }

    if (url.includes('/api/ponto/export')) {
      const store = searchParams.get('store');
      const month = searchParams.get('month'); // yyyy-mm
      if (!store || !month) return res.status(400).json({ error: 'store e month obrigatórios' });
      // Buscar timezone da loja
      let tz = 'America/Sao_Paulo';
      const { rows: tzAdmins } = await pool.query("SELECT timezone FROM users WHERE store = $1 AND (role = 'admin' OR role = 'master') LIMIT 1", [store]);
      if (tzAdmins.length > 0 && tzAdmins[0].timezone) tz = tzAdmins[0].timezone;
      const startDate = `${month}-01`;
      const endDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0];
      // Data e hora formatadas no banco: o valor guardado já é a hora de parede da
      // loja, e reconvertê-lo no Node deslocava a folha inteira em 3 horas.
      // Esta planilha vai para a contabilidade — o horário precisa ser o real.
      const { rows } = await pool.query(
        `SELECT *, to_char(timestamp, 'DD/MM/YYYY') AS data_local, to_char(timestamp, 'HH24:MI') AS hora_local
         FROM ponto_records WHERE store = $1 AND timestamp::date BETWEEN $2 AND $3 ORDER BY timestamp ASC`,
        [store, startDate, endDate]
      );
      // Gerar CSV
      let csv = 'Funcionário,Tipo,Data,Horário,Origem,Justificativa/Observação,Latitude,Longitude,Endereço\n';
      rows.forEach(r => {
        const tipoStr = r.type === 'entrada' ? 'Entrada' : (r.type === 'saida' ? 'Saída' : r.type);
        const origemStr = r.is_manual ? 'Ajuste Manual (Gestor)' : 'Aplicativo (Selfie/GPS)';
        const notesStr = (r.notes || '').replace(/"/g, "'");
        csv += `"${r.user_name}","${tipoStr}","${r.data_local}","${r.hora_local}","${origemStr}","${notesStr}","${r.latitude || ''}","${r.longitude || ''}","${(r.address || '').replace(/"/g, "'")}"`;
        csv += '\n';
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=folha-ponto-${store}-${month}.csv`);
      return res.status(200).send(csv);
    }

    // ── Lançamento Manual de Ponto (Gestor) ──────────────────────────
    if (url.includes('/api/ponto/manual') && method === 'POST') {
      const { userId, userName, store, type, timestamp, notes, editedBy } = req.body;
      if (!userId || !userName || !store || !type || !timestamp) {
        return res.status(400).json({ error: 'userId, userName, store, type e timestamp são obrigatórios' });
      }
      const { rows } = await pool.query(
        `INSERT INTO ponto_records (user_id, user_name, store, type, timestamp, is_manual, notes, edited_by)
         VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7) RETURNING *`,
        [userId, userName, store, type, timestamp, notes || 'Ajuste manual pelo gestor', editedBy || 'Gestor']
      );
      return res.status(200).json({ success: true, record: rows[0] });
    }

    // ── Edição ou Exclusão de Registro de Ponto ───────────────────────
    if (url.includes('/api/ponto/record')) {
      if (method === 'PUT') {
        const { id, type, timestamp, notes, editedBy } = req.body;
        if (!id) return res.status(400).json({ error: 'id do registro é obrigatório' });
        const { rows } = await pool.query(
          `UPDATE ponto_records
           SET type = COALESCE($1, type),
               timestamp = COALESCE($2, timestamp),
               notes = COALESCE($3, notes),
               is_manual = TRUE,
               edited_by = COALESCE($4, edited_by),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $5 RETURNING *`,
          [type, timestamp, notes, editedBy || 'Gestor', id]
        );
        return res.status(200).json({ success: true, record: rows[0] });
      }
      if (method === 'DELETE') {
        const id = searchParams.get('id') || req.body?.id;
        if (!id) return res.status(400).json({ error: 'id é obrigatório' });
        await pool.query('DELETE FROM ponto_records WHERE id = $1', [id]);
        return res.status(200).json({ success: true });
      }
    }

    if (url.includes('/api/ponto')) {
      if (method === 'POST') {
        const { userId, userName, store, type, latitude, longitude, accuracy, selfie, address, deviceInfo } = req.body;
        if (!userId || !store || !type) return res.status(400).json({ error: 'userId, store e type obrigatórios' });
        if (!['entrada', 'saida'].includes(type)) return res.status(400).json({ error: 'type deve ser entrada ou saida' });
        // Validar GPS
        if (!latitude || !longitude) return res.status(400).json({ error: 'Geolocalização obrigatória. Ative o GPS.' });
        if (accuracy && accuracy > 200) return res.status(400).json({ error: `Precisão do GPS muito baixa (${Math.round(accuracy)}m). Vá para um local aberto.` });
        // Buscar timezone da loja para cálculos de data consistentes
        let tz = 'America/Sao_Paulo';
        if (store) {
          const { rows: admins } = await pool.query("SELECT timezone FROM users WHERE store = $1 AND (role = 'admin' OR role = 'master') LIMIT 1", [store]);
          if (admins.length > 0 && admins[0].timezone) tz = admins[0].timezone;
        }
        // Calcular data de hoje no timezone da loja
        const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
        // Verificar sequência: a primeira batida do dia precisa ser entrada
        if (type === 'saida') {
          const { rows: entradas } = await pool.query(
            "SELECT * FROM ponto_records WHERE user_id = $1 AND type = 'entrada' AND timestamp::date = $2",
            [userId, today]
          );
          if (entradas.length === 0) return res.status(400).json({ error: 'Registre a entrada antes da saída.' });
        }
        // Upload selfie se houver
        let selfieUrl = null;
        if (selfie && selfie.startsWith('data:image')) {
          try { selfieUrl = await uploadImage(selfie, `ponto/${store}`); } catch (e) { console.error('Erro upload selfie ponto:', e); }
        }
        const { rows } = await pool.query(
          `INSERT INTO ponto_records (user_id, user_name, store, type, latitude, longitude, accuracy, selfie_url, address, device_info)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
          [userId, userName, store, type, latitude, longitude, accuracy, selfieUrl, address, deviceInfo]
        );

        // ── Enviar Comprovante de Ponto via WhatsApp para o Funcionário ──
        try {
          const evoUrl = process.env.EVOLUTION_API_URL;
          const evoKey = process.env.EVOLUTION_API_KEY;
          const evoInstance = process.env.EVOLUTION_INSTANCE || 'firecheck';

          if (evoUrl && evoKey) {
            const { rows: empDetails } = await pool.query(
              "SELECT phone, whatsapp_active, whatsapp_phone FROM users WHERE id = $1",
              [userId]
            );
            if (empDetails.length > 0) {
              const emp = empDetails[0];
              const isWhatsappActive = emp.whatsapp_active !== false;
              const targetPhone = emp.whatsapp_phone || emp.phone;

              if (isWhatsappActive && targetPhone) {
                const cleanPhone = targetPhone.replace(/\D/g, '');
                const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;

                const agora = new Date();
                const horaAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz });
                const dataAtual = agora.toLocaleDateString('pt-BR', { timeZone: tz });

                const textMsg = `⏰ *FireCheck - Comprovante de Ponto*\n\n` +
                  `Colaborador: *${userName}*\n` +
                  `Loja: *${store}*\n` +
                  `Tipo: *${type === 'entrada' ? '📥 Entrada' : '📤 Saída'}*\n` +
                  `Data: *${dataAtual}*\n` +
                  `Hora: *${horaAtual}*\n\n` +
                  `Seu ponto foi registrado com sucesso! ✅`;

                fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                  body: JSON.stringify({ number: fullPhone, text: textMsg })
                }).catch(e => console.error('[WhatsApp Ponto Funcionario] Erro ao enviar:', e.message));
              }
            }
          }
        } catch (pontoWaErr) {
          console.error('Erro ao enviar comprovante de ponto via WhatsApp:', pontoWaErr);
        }

        // ── Push e WhatsApp para admin se funcionário registrou entrada/saída fora da tolerância ──
        if (store) {
          try {
            const configData = await getEmployeeScheduleForDay(pool, userId, new Date());
            
            if (configData && configData.isWorkday) {
              // Buscar todos os destinatários da loja (admin, master, gestor)
              const { rows: recipients } = await pool.query(
                "SELECT fcm_token, name, whatsapp_active, whatsapp_phone, phone, wa_ponto_atraso FROM users WHERE store = $1 AND (role = 'admin' OR role = 'master' OR role = 'gestor')",
                [store]
              );

              const tolerancia = configData.ponto_tolerancia || 15;

              // Calcular hora atual no timezone da loja
              const agora = new Date();
              const horaAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz });
              const [hAtual, mAtual] = horaAtual.split(':').map(Number);
              const atualMinutos = hAtual * 60 + mAtual;

              let isAtrasado = false;
              let detalheMsg = '';

              if (type === 'entrada') {
                const horaEntradaCfg = configData.horaEntrada || '08:00';
                const [hCfg, mCfg] = horaEntradaCfg.split(':').map(Number);
                const limiteMinutos = hCfg * 60 + mCfg + tolerancia;

                if (atualMinutos > limiteMinutos) {
                  isAtrasado = true;
                  detalheMsg = `registrou entrada às ${horaAtual} (tolerância: ${horaEntradaCfg} + ${tolerancia}min)`;
                }
              } else if (type === 'saida') {
                const horaSaidaCfg = configData.horaSaida || '18:00';
                const [hCfg, mCfg] = horaSaidaCfg.split(':').map(Number);
                const limiteMinutos = hCfg * 60 + mCfg + tolerancia;

                if (atualMinutos > limiteMinutos) {
                  isAtrasado = true;
                  detalheMsg = `registrou saída às ${horaAtual} (tolerância: ${horaSaidaCfg} + ${tolerancia}min)`;
                }
              }

              if (isAtrasado) {
                for (const adminData of recipients) {
                  const isWaPontoAtrasoActive = adminData.wa_ponto_atraso !== false;
                  if (isWaPontoAtrasoActive) {
                    const adminToken = adminData.fcm_token;

                    // 1. Enviar Push
                    if (adminToken) {
                      await admin.messaging().send({
                        token: adminToken,
                        notification: {
                          title: '⏰ Ponto Fora do Horário',
                          body: `${userName} ${detalheMsg}`
                        },
                        data: { url: '/admin' },
                        apns: { payload: { aps: { sound: 'default', badge: 1 } } }
                      }).catch(e => console.error('[Push Ponto Atraso] Erro:', e.message));
                    }

                    // 2. Enviar WhatsApp
                    try {
                      const evoUrl = process.env.EVOLUTION_API_URL;
                      const evoKey = process.env.EVOLUTION_API_KEY;
                      const evoInstance = process.env.EVOLUTION_INSTANCE || 'firecheck';
                      
                      const isWhatsappActive = adminData.whatsapp_active !== false;
                      const targetPhone = adminData.whatsapp_phone || adminData.phone;
                      
                      if (evoUrl && evoKey && isWhatsappActive && targetPhone) {
                        const cleanPhone = targetPhone.replace(/\D/g, '');
                        const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
                        
                        const textMsg = `⏰ *FireCheck - Alerta de Ponto Fora do Horário*\n\n` +
                          `O colaborador *${userName}* registrou o ponto com atraso na loja *${store}*.\n\n` +
                          `Tipo de Registro: *${type === 'entrada' ? '📥 Entrada' : '📤 Saída'}*\n` +
                          `Horário Registrado: *${horaAtual}*\n` +
                          `Detalhe: *${detalheMsg}* ⚠️`;
                          
                        fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                          body: JSON.stringify({ number: fullPhone, text: textMsg })
                        }).catch(e => console.error('[WhatsApp Atraso Admin] Erro ao enviar:', e.message));
                      }
                    } catch (waAtrasoErr) {
                      console.error('Erro ao enviar WhatsApp de atraso para o admin:', waAtrasoErr);
                    }
                  }
                }
              }
            }
          } catch (pushErr) {
            console.error('Erro ao processar push/wa de atraso de ponto:', pushErr);
          }
        }

        return res.status(200).json({ success: true, record: rows[0] });
      }
      // GET — listar registros
      const store = searchParams.get('store');
      const date = searchParams.get('date');
      const month = searchParams.get('month');
      if (!store) return res.status(400).json({ error: 'store obrigatória' });
      // hora_local e data_local vêm prontas do banco: o timestamp guardado já é a
      // hora de parede da loja, e reconvertê-lo no Node ou no navegador deslocava
      // tudo em 3 horas. O frontend deve exibir estes campos como estão.
      let query = `SELECT *, to_char(timestamp, 'HH24:MI') AS hora_local, to_char(timestamp, 'DD/MM/YYYY') AS data_local FROM ponto_records WHERE store = $1`;
      let qParams = [store];
      if (date) {
        query += ' AND timestamp::date = $2';
        qParams.push(date);
      } else if (month) {
        const startDate = `${month}-01`;
        const endDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0];
        query += ' AND timestamp::date BETWEEN $2 AND $3';
        qParams.push(startDate, endDate);
      }
      query += ' ORDER BY timestamp DESC';
      const { rows } = await pool.query(query, qParams);
      return res.status(200).json(rows);
    }

    // ── Registrar FCM Token para Push ─────────────────────────────
    if (url.includes('/api/register-token')) {
      if (method === 'POST') {
        // Sem autenticação, bastava registrar o próprio aparelho no cadastro de
        // outra pessoa para passar a receber as notificações dela.
        const donoToken = await autenticarComLojaAtual(req);
        if (!donoToken) return res.status(401).json({ error: 'Token inválido ou ausente. Faça login novamente.' });

        const { token, fcmToken } = req.body;
        const finalToken = token || fcmToken;
        // O dispositivo é sempre associado a quem está autenticado, nunca ao id
        // ou e-mail vindos do corpo da requisição.
        const finalUserId = donoToken.id;
        const finalEmail = donoToken.email;
        if (finalToken && (finalUserId || finalEmail)) {
          if (finalUserId) {
            await pool.query('UPDATE users SET fcm_token = $1 WHERE id = $2', [finalToken, finalUserId]);
          } else {
            await pool.query('UPDATE users SET fcm_token = $1 WHERE LOWER(email) = LOWER($2)', [finalToken, finalEmail]);
          }
          return res.status(200).json({ success: true });
        }
        return res.status(400).json({ error: 'userId/email e token obrigatórios' });
      }
    }

    // ── Endpoint de Teste de Push Notification ─────────────────────
    if (url.includes('/api/test-push') && method === 'POST') {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'email obrigatório' });
      const { rows } = await pool.query("SELECT id, name, fcm_token FROM users WHERE LOWER(email) = LOWER($1)", [email]);
      if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
      if (!rows[0].fcm_token) return res.status(400).json({ error: 'Usuário sem token FCM registrado. Abra o app nativo e aceite as notificações.' });
      try {
        await admin.messaging().send({
          token: rows[0].fcm_token,
          notification: {
            title: '🔥 FireCheck - Teste',
            body: `Olá ${rows[0].name}! Esta é uma notificação de teste.`
          },
          data: { url: '/admin' },
          apns: { payload: { aps: { sound: 'default', badge: 1 } } }
        });
        return res.status(200).json({ success: true, message: `Notificação enviada para ${rows[0].name}` });
      } catch (pushErr) {
        return res.status(500).json({ error: 'Erro ao enviar push', details: pushErr.message });
      }
    }

    // ── WHATSAPP CHATBOT — BILL VIA WHATSAPP ─────────────────────
    if (url.includes('/api/webhooks/whatsapp')) {
      if (method === 'POST') {
        try {
          const body = req.body || {};
          
          // Evolution API envia diferentes formatos de evento (messages.upsert, MESSAGES_UPSERT, etc.)
          const rawEvent = (body.event || body.type || '').toString().toLowerCase().replace(/[^a-z]/g, '');
          
          // Se houver nome de evento especificado, ignorar apenas se for explicitamente um evento não relacionado a mensagens
          if (rawEvent && !rawEvent.includes('messagesupsert') && !rawEvent.includes('messageset') && !rawEvent.includes('sendmessage')) {
            return res.status(200).json({ ignored: true, reason: 'event_type' });
          }

          // Extrair mensagem de body.data (pode ser objeto ou array) ou do próprio body
          let msgData = body.data || body;
          if (Array.isArray(msgData)) msgData = msgData[0];

          if (!msgData) return res.status(200).json({ ignored: true, reason: 'no_data' });

          const key = msgData.key || msgData.messageKey || {};
          const message = msgData.message || msgData.msg || {};

          if (!key.remoteJid || !message) {
            return res.status(200).json({ ignored: true, reason: 'missing_key_or_message' });
          }

          // Ignorar mensagens próprias e de grupos
          if (key.fromMe) return res.status(200).json({ ignored: 'own_message' });
          if (key.remoteJid.includes('@g.us')) return res.status(200).json({ ignored: 'group' });

          // Extrair telefone limpo (remover sufixos como :12@s.whatsapp.net ou @c.us)
          const remoteJid = key.remoteJid;
          const phoneClean = remoteJid.split('@')[0].split(':')[0].replace(/\D/g, '');
          const phoneRaw = phoneClean;

          let incomingText = message.conversation
            || message.extendedTextMessage?.text
            || message.imageMessage?.caption
            || '';

          // ── Suporte a ÁUDIO (voice notes / áudio) ──
          if (!incomingText.trim() && (message.audioMessage || message.pttMessage)) {
            try {
              const evoUrlAudio = process.env.EVOLUTION_API_URL;
              const evoKeyAudio = process.env.EVOLUTION_API_KEY;
              const evoInstAudio = process.env.EVOLUTION_INSTANCE || 'firecheck';

              const audioResp = await fetch(`${evoUrlAudio}/chat/getBase64FromMediaMessage/${evoInstAudio}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evoKeyAudio },
                body: JSON.stringify({ message: msgData, convertToMp4: false })
              });

              if (audioResp.ok) {
                const audioData = await audioResp.json();
                const audioBase64 = audioData.base64;
                const mimeType = audioData.mimetype || message.audioMessage?.mimetype || 'audio/ogg';

                if (audioBase64) {
                  const transcribeKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
                  if (transcribeKey) {
                    const tGenAI = new GoogleGenerativeAI(transcribeKey);
                    let tModel;
                    try {
                      tModel = tGenAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                    } catch(e) {
                      tModel = tGenAI.getGenerativeModel({ model: "gemini-2.0-flash" });
                    }
                    const tResult = await tModel.generateContent([
                      { inlineData: { mimeType, data: audioBase64 } },
                      'Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem formatação.'
                    ]);
                    incomingText = tResult.response.text().trim();
                  }
                }
              }
            } catch (audioErr) {
              console.error('[WA Bot] Erro ao processar áudio:', audioErr.message);
            }
          }

          if (!incomingText.trim()) return res.status(200).json({ ignored: 'no_text' });

          // Rate limiting simples — máx 20 msgs/minuto por telefone
          const rateLimitKey = `wa_rate_${phoneRaw}`;
          if (!global._waRateLimit) global._waRateLimit = {};
          const now = Date.now();
          const userRate = global._waRateLimit[rateLimitKey] || { count: 0, resetAt: now + 60000 };
          if (now > userRate.resetAt) { userRate.count = 0; userRate.resetAt = now + 60000; }
          userRate.count++;
          global._waRateLimit[rateLimitKey] = userRate;
          if (userRate.count > 20) return res.status(200).json({ ignored: 'rate_limited' });

          const evoUrl = process.env.EVOLUTION_API_URL;
          const evoKey = process.env.EVOLUTION_API_KEY;
          const evoInstance = process.env.EVOLUTION_INSTANCE || 'firecheck';

          // Função auxiliar para enviar resposta via WhatsApp
          const sendWAReply = async (text) => {
            if (!evoUrl || !evoKey) {
              console.error('[WA Bot] EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurado.');
              return;
            }
            try {
              const replyResp = await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                body: JSON.stringify({ number: phoneRaw, text })
              });
              if (!replyResp.ok) {
                const replyText = await replyResp.text();
                console.error('[WA Bot] Erro ao responder via Evolution API:', replyResp.status, replyText);
              }
            } catch (e) {
              console.error('[WA Bot] Exceção ao responder:', e.message);
            }
          };

          // ── 1. IDENTIFICAR USUÁRIO (SUPORTE COMPLETO A DDD/9º DÍGITO NO BRASIL) ──
          const getPhoneVariants = (raw) => {
            const digits = raw.replace(/\D/g, '');
            const variants = new Set([digits]);

            let local = digits;
            if (digits.startsWith('55') && digits.length >= 12) {
              local = digits.slice(2);
            }
            variants.add(local);
            variants.add('55' + local);
            variants.add('+' + digits);
            variants.add('+55' + local);

            if (local.length === 10) {
              const withNine = local.slice(0, 2) + '9' + local.slice(2);
              variants.add(withNine);
              variants.add('55' + withNine);
              variants.add('+' + withNine);
              variants.add('+55' + withNine);
            } else if (local.length === 11 && local[2] === '9') {
              const withoutNine = local.slice(0, 2) + local.slice(3);
              variants.add(withoutNine);
              variants.add('55' + withoutNine);
              variants.add('+' + withoutNine);
              variants.add('+55' + withoutNine);
            }
            return Array.from(variants);
          };

          const variantsList = getPhoneVariants(phoneRaw);
          let foundUser = null;

          const { rows: matchedUsers } = await pool.query(
            `SELECT * FROM users 
             WHERE REPLACE(REPLACE(REPLACE(whatsapp_phone, ' ', ''), '-', ''), '+', '') = ANY($1::text[])
                OR REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') = ANY($1::text[])
             LIMIT 1`,
            [variantsList]
          );

          if (matchedUsers.length > 0) {
            foundUser = matchedUsers[0];
          }

          // ── 1.1 VINCULAÇÃO AUTOMÁTICA DE CONTA VIA E-MAIL ──
          if (!foundUser) {
            const emailMatch = incomingText.trim().match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/);
            if (emailMatch) {
              const inputEmail = emailMatch[0].toLowerCase();
              const { rows: emailUsers } = await pool.query(
                "SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1", [inputEmail]
              );
              if (emailUsers.length > 0) {
                foundUser = emailUsers[0];
                await pool.query(
                  "UPDATE users SET whatsapp_phone = $1, whatsapp_active = true WHERE id = $2",
                  [phoneRaw, foundUser.id]
                );
                await sendWAReply(
                  `🎉 *WhatsApp Vinculado com Sucesso!*\n\n` +
                  `Olá, *${foundUser.name}*! Seu número foi vinculado à sua conta do *FireCheck* (${foundUser.store}).\n\n` +
                  `Eu sou o *Bill*, seu assistente inteligente. Agora você pode me enviar mensagens aqui para:\n` +
                  `📋 Criar checklists e tarefas\n` +
                  `🛒 Criar e consultar listas de compras\n` +
                  `📊 Ver resumos da sua loja e ponto\n` +
                  `👥 Cadastrar funcionários\n\n` +
                  `Como posso te ajudar hoje? 🔥`
                );
                return res.status(200).json({ handled: true, reason: 'user_linked' });
              } else {
                await sendWAReply(
                  `⚠️ Não encontrei nenhuma conta no FireCheck com o e-mail *${inputEmail}*.\n\n` +
                  `Verifique se digitou corretamente ou acesse *firecheckapp.com.br* para criar sua conta.`
                );
                return res.status(200).json({ handled: true, reason: 'email_not_found' });
              }
            }

            await sendWAReply(
              `Olá! 👋 Eu sou o *Bill*, assistente inteligente do *FireCheck*.\n\n` +
              `Ainda não encontrei seu WhatsApp vinculado a uma conta no sistema.\n\n` +
              `👉 *Para vincular agora:* Responda a esta mensagem enviando apenas o seu *e-mail de cadastro* no FireCheck (ex: *seuemail@empresa.com*).\n\n` +
              `Ou configure seu WhatsApp no painel em *Configurações > WhatsApp* 📱`
            );
            return res.status(200).json({ handled: true, reason: 'user_not_found' });
          }

          // ── 2. CARREGAR/CRIAR SESSÃO DE CONVERSA ──
          let { rows: convRows } = await pool.query(
            'SELECT * FROM wa_conversations WHERE phone = $1', [phoneRaw]
          );
          let conversation;
          let isFirstInteraction = false;
          if (convRows.length === 0) {
            const { rows: newConv } = await pool.query(
              'INSERT INTO wa_conversations (phone, user_id, store, role, messages) VALUES ($1, $2, $3, $4, $5) RETURNING *',
              [phoneRaw, foundUser.id, foundUser.store, foundUser.role, JSON.stringify([])]
            );
            conversation = newConv[0];
            isFirstInteraction = true;
          } else {
            conversation = convRows[0];
          }

          // ── 3. BUSCAR DADOS DA LOJA PARA CONTEXTO ──
          const userStore = foundUser.store;
          let storeContext = '';

          try {
            // Stats do dia
            const todayDate = new Date().toISOString().split('T')[0];
            const { rows: todaySubs } = await pool.query(
              "SELECT COUNT(*) as total, COUNT(CASE WHEN feedback_info::text LIKE '%warning%' OR feedback_info::text LIKE '%error%' THEN 1 END) as alerts FROM checklist_submissions WHERE store = $1 AND created_at >= $2",
              [userStore, todayDate + ' 00:00:00']
            );
            const { rows: allChecklists } = await pool.query(
              'SELECT id, title, recurrence, weekdays, scheduled_date, category FROM checklists WHERE LOWER(store) = LOWER($1)', [userStore]
            );
            const { rows: todayPonto } = await pool.query(
              "SELECT user_name, type, timestamp FROM ponto_records WHERE store = $1 AND timestamp::date = $2 ORDER BY timestamp ASC",
              [userStore, todayDate]
            );
            const { rows: employees } = await pool.query(
              "SELECT id, name, email, role, phone FROM users WHERE store = $1 AND (role = 'funcionario' OR role = 'gestor')", [userStore]
            );
            const { rows: adminData } = await pool.query(
              "SELECT ponto_hora_entrada, ponto_hora_saida, ponto_tolerancia, checklist_limit, checklists_used, plan, timezone FROM users WHERE id = $1",
              [foundUser.role === 'funcionario' ? (await pool.query("SELECT id FROM users WHERE store = $1 AND (role='admin' OR role='master') LIMIT 1", [userStore])).rows[0]?.id : foundUser.id]
            );

            storeContext = `
DADOS DA LOJA "${userStore}" — HOJE (${todayDate}):
- Checklists concluídos hoje: ${todaySubs[0]?.total || 0} (${todaySubs[0]?.alerts || 0} com alertas)
- Total de templates de checklist: ${allChecklists.length}
- Checklists cadastrados: ${allChecklists.map(c => `"${c.title}" (${c.recurrence || 'único'})`).join(', ') || 'nenhum'}
- Registros de ponto hoje: ${todayPonto.length > 0 ? todayPonto.map(p => `${p.user_name}: ${p.type} às ${new Date(p.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}`).join('; ') : 'nenhum registro'}
- Funcionários: ${employees.length > 0 ? employees.map(e => `${e.name} (${e.email})`).join(', ') : 'nenhum cadastrado'}
- Configuração de ponto: Entrada ${adminData[0]?.ponto_hora_entrada || '08:00'}, Saída ${adminData[0]?.ponto_hora_saida || '18:00'}, Tolerância ${adminData[0]?.ponto_tolerancia || 15}min
- Plano: ${adminData[0]?.plan || 'starter'}, Checklists usados: ${adminData[0]?.checklists_used || 0}/${adminData[0]?.checklist_limit || 300}
`;
          } catch (ctxErr) {
            console.error('[WA Bot] Erro ao buscar contexto:', ctxErr.message);
            storeContext = 'Dados da loja indisponíveis no momento.';
          }

          // ── 4. MONTAR HISTÓRICO DA CONVERSA ──
          let msgHistory = [];
          try { msgHistory = typeof conversation.messages === 'string' ? JSON.parse(conversation.messages) : (conversation.messages || []); } catch(e) { msgHistory = []; }

          // Manter últimas 10 mensagens
          if (msgHistory.length > 10) msgHistory = msgHistory.slice(-10);

          // Adicionar mensagem do usuário
          msgHistory.push({ role: 'user', content: incomingText, ts: new Date().toISOString() });

          const conversationText = msgHistory.map(m =>
            m.role === 'user' ? `USUÁRIO: ${m.content}` : `BILL: ${m.content}`
          ).join('\n');

          // ── 5. PROCESSAR COM GEMINI ──
          const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
          if (!apiKey) {
            await sendWAReply('⚠️ Sistema de IA temporariamente indisponível. Tente novamente em alguns minutos.');
            return res.status(200).json({ error: 'no_api_key' });
          }

          const isAdmin = foundUser.role === 'admin' || foundUser.role === 'master';
          const userRoleDesc = isAdmin ? 'ADMINISTRADOR/DONO da loja' : 'FUNCIONÁRIO da loja';

          const systemPrompt = `Você é o BILL, o assistente inteligente com Inteligência Artificial avançada do FireCheck via WhatsApp.
Sua personalidade: Extremamente simpático, amigável, inteligente, fluido e conversacional. Responda com respostas ricas, humanas e coerentes, como se fosse um colega especializado e prestativo!

USUÁRIO: ${foundUser.name} (${foundUser.email}) — ${userRoleDesc}
LOJA: ${userStore}
${isFirstInteraction ? 'NOTA: Esta é a primeira mensagem do usuário nesta conversa. Cumprimente-o com entusiasmo como Bill, assistente do FireCheck, e responda diretamente ao que ele disse!' : ''}
${storeContext}

HISTÓRICO DA CONVERSA:
${conversationText}

═══════════════════════════════════════════
 SUAS CAPACIDADES DE AÇÃO
═══════════════════════════════════════════

Você pode executar AÇÕES retornando JSON com o campo "action". As ações disponíveis são:

${isAdmin ? `
AÇÕES DE ADMIN:
1. CRIAR CHECKLIST: {"action": "create_checklist", "title": "Nome", "tasks": [{"text": "tarefa", "type": "boolean"}], "recurrence": "daily|weekdays|weekly|monthly|unique", "weekdays": ["seg","ter",...], "category": "geral"}
   - Tipos de task: boolean (sim/não), check (checkbox), rating (1-5 estrelas), numeric (número), multiple (múltipla escolha com options), text (texto livre), itemlist (lista de itens com options)
   - Para multiple/itemlist, inclua o campo "options": ["opção1", "opção2", ...]
   - Máximo 15 tarefas, mínimo 3
   - Se o usuário pedir para criar, CONVERSE com ele para entender o que precisa antes de gerar. Faça 1-2 perguntas curtas.
   
2. CRIAR LISTA DE COMPRAS: {"action": "create_shopping_list", "title": "Nome da Lista", "items": [{"name": "Produto", "unit": "un|kg|L|cx|pct|dz", "minStock": 5, "category": "geral"}], "recurrence": "daily|weekly|monthly"}
   - Categorias de itens: "limpeza", "alimentos", "bebidas", "embalagens", "descartáveis", "escritório", "higiene", "manutenção", "geral"
   - Se o usuário pedir uma lista de compras, CONVERSE para entender os itens antes de gerar.

3. CRIAR FUNCIONÁRIO: {"action": "create_employee", "name": "Nome", "email": "email@x.com", "password": "senha123"}

4. ALTERAR CONFIGURAÇÃO DE PONTO: {"action": "update_config", "field": "ponto_hora_entrada|ponto_hora_saida|ponto_tolerancia", "value": "09:00"}

5. CONSULTAR DADOS: {"action": "query", "type": "stats|checklists|ponto|employees|submissions|quota"}
` : `
AÇÕES DE FUNCIONÁRIO:
1. CONSULTAR DADOS: {"action": "query", "type": "my_checklists|my_ponto|pending"}
`}

═══════════════════════════════════════════
 FORMATO DE RESPOSTA (JSON OBRIGATÓRIO)
═══════════════════════════════════════════
SEMPRE responda em JSON puro com este formato:
{
  "reply": "Texto para enviar ao usuário no WhatsApp (use *negrito*, _itálico_, emojis)",
  "action": null ou objeto com a ação a executar,
  "intent": "saudacao|consulta|criar_checklist|criar_funcionario|configuracao|ajuda|conversa"
}

═══════════════════════════════════════════
 REGRAS DE OURO
═══════════════════════════════════════════
1. Responda de forma fluida, coerente, simpática e natural a QUALQUER conversa do usuário (saudações, perguntas gerais ou comandos do FireCheck).
2. NUNCA invente dados. Use APENAS os dados fornecidos no contexto acima para informações da loja.
3. Seja agradável e conversacional, usando marcações de WhatsApp (*negrito*, _itálico_) e emojis para deixar a leitura leve.
4. Para CRIAR CHECKLIST ou LISTAS: converse amigavelmente primeiro para entender o que o usuário precisa.
5. Se a mensagem for social (ex: "tudo bem com você?"), responda calorosamente e pergunte como pode ajudar na operação da loja!`;

          try {
            const genAI = new GoogleGenerativeAI(apiKey);
            let result;
            const modelNames = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
            let lastModelErr = null;

            for (const mName of modelNames) {

              try {
                const model = genAI.getGenerativeModel({
                  model: mName,
                  generationConfig: { responseMimeType: "application/json" }
                });
                result = await model.generateContent(systemPrompt);
                if (result && result.response) break;
              } catch(mErr) {
                lastModelErr = mErr;
              }
            }
            if (!result || !result.response) {
              throw lastModelErr || new Error('Não foi possível gerar resposta com o Gemini');
            }
            const responseText = result.response.text();
            let parsed;
            try {
              parsed = JSON.parse(responseText);
            } catch (parseErr) {
              // Tentar extrair JSON de resposta malformada
              const jsonMatch = responseText.match(/\{[\s\S]*\}/);
              if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
              else throw new Error('Resposta da IA não é JSON válido');
            }

            let finalReply = parsed.reply || 'Desculpe, não consegui processar sua mensagem. Tente novamente.';

            // ── 6. EXECUTAR AÇÃO (se houver) ──
            if (parsed.action && typeof parsed.action === 'object') {
              try {
                if (parsed.action.action === 'create_checklist' || parsed.action.type === 'create_checklist') {
                  const act = parsed.action;
                  const clTitle = act.title;
                  const clTasks = act.tasks || [];
                  const clRecurrence = act.recurrence || 'daily';
                  const clWeekdays = act.weekdays || null;
                  const clCategory = act.category || 'geral';

                  if (clTitle && clTasks.length > 0) {
                    const { rows: newCl } = await pool.query(
                      'INSERT INTO checklists (title, store, tasks, recurrence, weekdays, category) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                      [clTitle, userStore, JSON.stringify(clTasks), clRecurrence, clWeekdays ? JSON.stringify(clWeekdays) : null, clCategory]
                    );
                    finalReply += `\n\n✅ Checklist *"${clTitle}"* criado com ${clTasks.length} tarefas! Já está disponível para a equipe.`;
                  }
                }

                else if (parsed.action.action === 'create_employee' || parsed.action.type === 'create_employee') {
                  if (!isAdmin) {
                    finalReply = '⚠️ Apenas administradores podem cadastrar funcionários.';
                  } else {
                    const act = parsed.action;
                    const empName = act.name;
                    const empEmail = act.email;
                    const empPass = act.password || 'fire' + Math.random().toString(36).slice(-4);
                    const bcrypt = await import('bcryptjs');
                    const hashedPass = await bcrypt.hash(empPass, 10);
                    
                    // Verificar se email já existe
                    const { rows: existing } = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [empEmail]);
                    if (existing.length > 0) {
                      finalReply = `⚠️ Já existe um usuário com o email *${empEmail}*.`;
                    } else {
                      await pool.query(
                        "INSERT INTO users (name, email, password, role, store, status) VALUES ($1, $2, $3, 'funcionario', $4, 'active')",
                        [empName, empEmail, hashedPass, userStore]
                      );
                      finalReply = `✅ Funcionário *${empName}* cadastrado!\n📧 Email: ${empEmail}\n🔑 Senha: ${empPass}\n\nEle já pode acessar o app.`;
                    }
                  }
                }

                else if (parsed.action.action === 'update_config' || parsed.action.type === 'update_config') {
                  if (!isAdmin) {
                    finalReply = '⚠️ Apenas administradores podem alterar configurações.';
                  } else {
                    const act = parsed.action;
                    const field = act.field;
                    const value = act.value;
                    const allowedFields = ['ponto_hora_entrada', 'ponto_hora_saida', 'ponto_tolerancia'];
                    if (allowedFields.includes(field)) {
                      await pool.query(`UPDATE users SET ${field} = $1 WHERE id = $2`, [value, foundUser.id]);
                      const fieldNames = { ponto_hora_entrada: 'Horário de entrada', ponto_hora_saida: 'Horário de saída', ponto_tolerancia: 'Tolerância' };
                      finalReply = `✅ *${fieldNames[field]}* atualizado para *${value}${field === 'ponto_tolerancia' ? ' minutos' : ''}*.`;
                    }
                  }
                }

                else if (parsed.action.action === 'create_shopping_list' || parsed.action.type === 'create_shopping_list') {
                  if (!isAdmin) {
                    finalReply = '⚠️ Apenas administradores podem criar listas de compras.';
                  } else {
                    const act = parsed.action;
                    const slTitle = act.title;
                    const slItems = act.items || [];
                    const slRecurrence = act.recurrence || 'weekly';

                    if (slTitle && slItems.length > 0) {
                      const { rows: newSl } = await pool.query(
                        'INSERT INTO shopping_lists (store, title, recurrence, category) VALUES ($1, $2, $3, $4) RETURNING *',
                        [userStore, slTitle, slRecurrence, 'geral']
                      );
                      const listId = newSl[0].id;

                      for (let i = 0; i < slItems.length; i++) {
                        const item = slItems[i];
                        await pool.query(
                          'INSERT INTO shopping_items (shopping_list_id, name, unit, min_stock, current_stock, category, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                          [listId, item.name, item.unit || 'un', item.minStock || 0, null, item.category || 'geral', i]
                        );
                      }

                      finalReply += `\n\n✅ Lista de compras *"${slTitle}"* criada com ${slItems.length} itens! Já está disponível na seção Compras e Estoques do app. 🛒`;
                    } else {
                      finalReply += '\n\n⚠️ Não foi possível criar a lista. Informe o nome da lista e os itens desejados.';
                    }
                  }
                }

                // Ações de consulta não precisam de execução extra — dados já estão no contexto do Gemini
              } catch (actionErr) {
                console.error('[WA Bot] Erro ao executar ação:', actionErr.message);
                finalReply += '\n\n⚠️ Houve um problema ao executar a ação. Tente novamente.';
              }
            }

            // ── 7. SALVAR HISTÓRICO E RESPONDER ──
            msgHistory.push({ role: 'bill', content: finalReply, ts: new Date().toISOString() });
            if (msgHistory.length > 20) msgHistory = msgHistory.slice(-20);

            await pool.query(
              'UPDATE wa_conversations SET messages = $1, last_intent = $2, updated_at = NOW() WHERE phone = $3',
              [JSON.stringify(msgHistory), parsed.intent || 'conversa', phoneRaw]
            );

            await sendWAReply(finalReply);
            return res.status(200).json({ handled: true, intent: parsed.intent });

          } catch (aiErr) {
            console.error('[WA Bot] Erro Gemini:', aiErr.message);
            await sendWAReply('⚠️ Estou com um probleminha técnico agora. Tente novamente em alguns segundos! 🔧');
            return res.status(200).json({ error: aiErr.message });
          }

        } catch (webhookErr) {
          console.error('[WA Bot] Erro geral webhook:', webhookErr.message);
          return res.status(200).json({ error: webhookErr.message });
        }
      }
      return res.status(200).json({ status: 'webhook_ready' });
    }

    return res.status(200).json({ status: 'online' });
  } catch (err) {
    // Tratar erros de constraint do PostgreSQL com mensagens amigáveis
    if (err.code === '23505') {
      // Unique violation — ex: email duplicado
      if (err.constraint?.includes('email')) {
        return res.status(400).json({ error: 'Este e-mail já está cadastrado no sistema. Use outro e-mail.' });
      }
      return res.status(400).json({ error: 'Este registro já existe no sistema. Verifique os dados e tente novamente.' });
    }
    return res.status(500).json({ message: err.message });
  }
}
