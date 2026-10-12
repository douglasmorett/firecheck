// A loja fictícia dos tutoriais: "Sabor da Praça", a mesma lanchonete dos
// vídeos do FireHub. Toda gravação recomeça daqui (as tabelas são esvaziadas),
// e nenhum nome, telefone ou foto de gente real aparece em vídeo: os rostos e
// as fotos das tarefas foram gerados (tutoriais/ambiente/gerar-fotos.mjs).
//
// Recusa qualquer banco que não seja local.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import bcrypt from "bcryptjs";
import sharp from "sharp";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const FOTOS = path.join(aqui, "fotos");

export const LOJA_NOME = "Sabor da Praça";
const SENHA = "sabor123";
/** Quem entra para gravar: o dono (painel) ou um funcionário (Tela de Execução e ponto). */
export const CONTAS = {
  dono: { email: "carlos@sabordapraca.com.br", senha: SENHA },
  gestora: { email: "fernanda@sabordapraca.com.br", senha: SENHA },
  funcionario: { email: "ana@sabordapraca.com.br", senha: SENHA },
};
export const LOJA = CONTAS.dono;

export function banco() {
  const url = process.env.TUTORIAL_DATABASE_URL;
  if (!url) throw new Error("Falta TUTORIAL_DATABASE_URL: rode com as variáveis do ambiente (ambiente.mjs variaveis N).");
  const host = new URL(url).hostname;
  if (!["127.0.0.1", "localhost"].includes(host)) throw new Error(`A semente só roda em banco local (veio ${host}).`);
  return new pg.Client({ connectionString: url });
}

const cacheDeFotos = new Map();
/** A foto como data URL, no tamanho pedido (o banco guarda base64 quando não há Firebase). */
export async function foto(nome, largura = 640) {
  const chave = `${nome}@${largura}`;
  if (!cacheDeFotos.has(chave)) {
    const arquivo = path.join(FOTOS, `${nome}.jpg`);
    if (!fs.existsSync(arquivo)) throw new Error(`Falta a foto ${nome}.jpg (rode tutoriais/ambiente/gerar-fotos.mjs).`);
    const buf = await sharp(arquivo).resize({ width: largura }).jpeg({ quality: 72 }).toBuffer();
    cacheDeFotos.set(chave, `data:image/jpeg;base64,${buf.toString("base64")}`);
  }
  return cacheDeFotos.get(chave);
}

const EQUIPE = [
  { nome: "Fernanda Lima", email: CONTAS.gestora.email, papel: "gestor", rosto: "rosto-fernanda", telefone: "(22) 99812-4410", escala: "dia" },
  { nome: "Ana Souza", email: CONTAS.funcionario.email, papel: "funcionario", rosto: "rosto-ana", telefone: "(22) 99734-1182", escala: "dia" },
  { nome: "Bruno Alves", email: "bruno@sabordapraca.com.br", papel: "funcionario", rosto: "rosto-bruno", telefone: "(22) 99651-2290", escala: "noite" },
  { nome: "Juliana Costa", email: "juliana@sabordapraca.com.br", papel: "funcionario", rosto: "rosto-juliana", telefone: "(22) 99577-3021", escala: "dia" },
  { nome: "Rafael Pereira", email: "rafael@sabordapraca.com.br", papel: "funcionario", rosto: "rosto-rafael", telefone: "(22) 99488-6573", escala: "noite" },
  { nome: "Lucas Oliveira", email: "lucas@sabordapraca.com.br", papel: "funcionario", rosto: "rosto-lucas", telefone: "(22) 99390-7714", escala: "noite" },
];

const PERMISSOES_DA_GESTORA = {
  perm_checklists: true, perm_equipe: true, perm_ponto: true, perm_alertas: true,
  perm_ranking: true, perm_compras: true, perm_frota: true, perm_notificacoes: true,
};

let proximoId = 1;
const tarefa = (text, extra = {}) => ({
  id: proximoId++, text, type: "boolean", requirePhoto: false, timeLimit: "", notifyDelay: true,
  options: [], assignee: "", section: "", maxPhotos: 1, minQuantity: "", unit: "un", ...extra,
});

/** Os checklists da loja. `fotos` diz a foto que a equipe "tirou" em cada tarefa com foto. */
function checklists() {
  proximoId = 1;
  return [
    {
      titulo: "Abertura da cozinha", quem: "Ana Souza", hora: 10,
      tarefas: [
        tarefa("Bancada de inox limpa e seca", { requirePhoto: true, timeLimit: "10:30", foto: "bancada" }),
        tarefa("Temperatura da geladeira (°C)", { type: "numeric", requirePhoto: true, foto: "geladeira", valor: "3" }),
        tarefa("Chapa raspada e limpa", { requirePhoto: true, foto: "chapa" }),
        tarefa("Óleo da fritadeira", { type: "multiple", options: ["Bom para usar", "Trocar hoje"], requirePhoto: true, foto: "fritadeira", valor: "Bom para usar" }),
        tarefa("Estoque seco organizado", { requirePhoto: true, foto: "estoque" }),
      ],
    },
    {
      titulo: "Salão pronto para abrir", quem: "Juliana Costa", hora: 10.5,
      tarefas: [
        tarefa("Mesas e cadeiras arrumadas", { requirePhoto: true, foto: "salao" }),
        tarefa("Cardápios e guardanapos nas mesas"),
        tarefa("Nota para a limpeza do salão", { type: "rating", valor: 5 }),
      ],
    },
    {
      titulo: "Limpeza do banheiro", quem: "Juliana Costa", hora: 15,
      tarefas: [
        tarefa("Pia e espelho limpos", { requirePhoto: true, foto: "banheiro" }),
        tarefa("Papel e sabonete abastecidos"),
      ],
    },
    {
      titulo: "Fechamento da loja", quem: "Lucas Oliveira", hora: 23,
      tarefas: [
        tarefa("Lixo retirado e lixeiras fechadas", { requirePhoto: true, foto: "lixo" }),
        tarefa("Piso da cozinha lavado", { requirePhoto: true, foto: "piso" }),
        tarefa("Chapa desligada", { requirePhoto: true, foto: "chapa" }),
        tarefa("Registro do gás fechado"),
        tarefa("Dinheiro do caixa conferido (R$)", { type: "numeric", valor: "412,50" }),
      ],
    },
  ];
}

const MENSAGENS_APROVADAS = [
  "Tudo certo: a foto mostra exatamente o que foi pedido.",
  "Aprovado. Bem limpo e organizado.",
  "Ótimo trabalho, item conferido na foto.",
];

export async function semear(cliente) {
  // Do zero: tudo que a gravação anterior deixou sai, inclusive as sequências.
  const { rows: tabelas } = await cliente.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  await cliente.query(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);

  const hash = await bcrypt.hash(SENHA, 8);
  const agoraSP = (await cliente.query("SELECT (NOW() AT TIME ZONE 'America/Sao_Paulo') AS t")).rows[0].t;

  // ── Escalas ──
  const escalas = {};
  for (const [chave, nome, entrada, saida, cor] of [["dia", "Turno do dia", "10:00", "18:00", "#F97316"], ["noite", "Turno da noite", "17:00", "23:30", "#3B82F6"]]) {
    const { rows } = await cliente.query(
      `INSERT INTO work_schedules (store, name, type, hora_entrada, hora_saida, intervalo_inicio, intervalo_fim, tolerancia, saturday_active, sunday_active, color)
       VALUES ($1, $2, 'fixed', $3, $4, NULL, NULL, 10, TRUE, TRUE, $5) RETURNING id`,
      [LOJA_NOME, nome, entrada, saida, cor]);
    escalas[chave] = { id: rows[0].id, entrada, saida };
  }

  // ── Dono e equipe ──
  const { rows: [dono] } = await cliente.query(
    `INSERT INTO users (name, email, password, role, store, store_name, status, plan, phone, expiration_date, photo,
       ponto_active, whatsapp_phone, checklist_limit, timezone, ponto_hora_entrada, ponto_hora_saida, ponto_tolerancia, created_at)
     VALUES ('Carlos Mendes', $1, $2, 'admin', $3, $3, 'active', 'combo_anual', '(22) 99901-5520', NOW() + INTERVAL '300 days', $4,
       TRUE, '(22) 99901-5520', 999999, 'America/Sao_Paulo', '10:00', '23:30', 10, NOW() - INTERVAL '120 days') RETURNING id`,
    [CONTAS.dono.email, hash, LOJA_NOME, await foto("rosto-carlos", 300)]);
  const pessoas = [];
  for (const p of EQUIPE) {
    const { rows: [u] } = await cliente.query(
      `INSERT INTO users (name, email, password, role, store, store_name, status, phone, photo, ponto_active, schedule_id, permissions, created_at)
       VALUES ($1, $2, $3, $4, $5, $5, 'active', $6, $7, TRUE, $8, $9, NOW() - INTERVAL '90 days') RETURNING id`,
      [p.nome, p.email, hash, p.papel, LOJA_NOME, p.telefone, await foto(p.rosto, 300), escalas[p.escala].id,
        p.papel === "gestor" ? JSON.stringify(PERMISSOES_DA_GESTORA) : null]);
    pessoas.push({ ...p, id: u.id });
  }

  // ── Checklists e uma semana de histórico ──
  const lista = checklists();
  const criados = [];
  for (const c of lista) {
    const tarefasDoCadastro = c.tarefas.map(({ foto: _f, valor: _v, ...t }) => t);
    const { rows: [ck] } = await cliente.query(
      `INSERT INTO checklists (store, title, tasks, recurrence, category, require_selfie, created_at)
       VALUES ($1, $2, $3, 'daily', 'geral', FALSE, NOW() - INTERVAL '60 days') RETURNING id`,
      [LOJA_NOME, c.titulo, JSON.stringify(tarefasDoCadastro)]);
    criados.push({ ...c, id: ck.id });
  }

  // Dias para trás (0 = hoje). Hoje só entra o que já passou da hora.
  const horaAgora = agoraSP.getHours() + agoraSP.getMinutes() / 60;
  for (let dia = 6; dia >= 0; dia--) {
    for (const c of criados) {
      if (dia === 0 && c.hora > horaAgora - 0.2) continue;
      // Ontem, a abertura foi reprovada pela IA na bancada: é o alerta que o vídeo mostra.
      const reprovada = dia === 1 && c.titulo === "Abertura da cozinha";
      const feitas = [];
      const parecer = {};
      for (const t of c.tarefas) {
        const nomeDaFoto = reprovada && t.foto === "bancada" ? "bancada-suja" : t.foto;
        const feita = { ...t, done: t.valor ?? true };
        delete feita.foto; delete feita.valor;
        if (nomeDaFoto) {
          const f = await foto(nomeDaFoto, 480);
          Object.assign(feita, { photo: f, photos: [f] });
          parecer[t.id] = nomeDaFoto === "bancada-suja"
            ? { status: "warning", message: "A bancada ainda tem farelos, molho e uma faca em cima: não está limpa." }
            : { status: "success", message: MENSAGENS_APROVADAS[(t.id + dia) % MENSAGENS_APROVADAS.length] };
        }
        feitas.push(feita);
      }
      // created_at de checklist_submissions é o NOW() do banco (UTC, sem fuso), como em produção.
      const minutos = Math.round(c.hora * 60) + ((dia * 7 + c.id * 3) % 17);
      await cliente.query(
        `INSERT INTO checklist_submissions (employee_name, store, tasks, feedback_info, checklist_id, resolved, created_at)
         VALUES ($1, $2, $3, $4, $5, FALSE,
           ((date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo') - make_interval(days => $6) + make_interval(mins => $7)) AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'UTC')`,
        [c.quem, LOJA_NOME, JSON.stringify(feitas), JSON.stringify(parecer), c.id, dia, minutos]);
    }
  }

  // ── Ponto da semana (hora de São Paulo, sem fuso, como o banco grava) ──
  for (let dia = 6; dia >= 0; dia--) {
    for (const p of pessoas) {
      const e = escalas[p.escala];
      const [he, me] = e.entrada.split(":").map(Number);
      const [hs, ms] = e.saida.split(":").map(Number);
      // Rafael chega 18 min atrasado anteontem: é o atraso que aparece no relatório.
      const atraso = p.nome.startsWith("Rafael") && dia === 2 ? 18 : ((p.id * 7 + dia * 3) % 9) - 4;
      const entrada = he * 60 + me + atraso;
      const saida = hs * 60 + ms + ((p.id + dia) % 6);
      for (const [tipo, mins] of [["entrada", entrada], ["saida", saida]]) {
        if (dia === 0 && mins / 60 > horaAgora - 0.1) continue;
        await cliente.query(
          `INSERT INTO ponto_records (user_id, user_name, store, type, timestamp, latitude, longitude, accuracy, selfie_url, address, device_info)
           VALUES ($1, $2, $3, $4, date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo') - make_interval(days => $5) + make_interval(mins => $6),
             -22.5269, -41.9447, 12, $7, 'Praça da Independência, 120 - Centro', 'Android')`,
          [p.id, p.nome, LOJA_NOME, tipo, dia, mins, await foto(p.rosto, 240)]);
      }
    }
  }

  // ── Frota ──
  const rafael = pessoas.find((p) => p.nome.startsWith("Rafael"));
  await cliente.query(
    `INSERT INTO vehicles (store, plate, model, brand, color, year, current_km, photo_url, status, employee_id, tasks, schedule_type)
     VALUES ($1, 'RJO-4B21', 'CG 160 Cargo', 'Honda', 'Vermelha', 2022, 18450, $2, 'ativo', $3, $4, 'manual'),
            ($1, 'KXP-7D90', 'Fiorino Endurance', 'Fiat', 'Branca', 2021, 62310, $5, 'ativo', NULL, $4, 'manual')`,
    [LOJA_NOME, await foto("moto", 640), rafael.id,
      JSON.stringify([tarefa("Pneus calibrados", { requirePhoto: true }), tarefa("Óleo do motor no nível"), tarefa("Quilometragem atual", { type: "numeric" })]),
      await foto("fiorino", 640)]);

  // ── Compras ──
  const { rows: [compra] } = await cliente.query(
    `INSERT INTO shopping_lists (store, title, recurrence, weekdays, category, active) VALUES ($1, 'Compras da semana', 'weekly', '["seg"]', 'compras', TRUE) RETURNING id`,
    [LOJA_NOME]);
  const itens = [["Farinha de trigo", "kg", 25, 12], ["Queijo muçarela", "kg", 10, 4], ["Óleo de soja", "L", 18, 20], ["Caixa de esfirra G", "un", 200, 140], ["Refrigerante lata", "un", 48, 60]];
  for (const [i, [nome, unidade, minimo]] of itens.entries()) {
    await cliente.query("INSERT INTO shopping_items (shopping_list_id, name, unit, min_stock, category, sort_order) VALUES ($1, $2, $3, $4, 'geral', $5)",
      [compra.id, nome, unidade, minimo, i]);
  }
  await cliente.query(
    `INSERT INTO shopping_submissions (shopping_list_id, store, employee_name, items, below_minimum, notes, created_at)
     VALUES ($1, $2, 'Fernanda Lima', $3, $4, 'Muçarela acaba antes de sexta.', NOW() - INTERVAL '1 day')`,
    [compra.id, LOJA_NOME,
      JSON.stringify(itens.map(([nome, unidade, minimo, atual]) => ({ name: nome, unit: unidade, min_stock: minimo, current_stock: atual }))),
      JSON.stringify(itens.filter(([, , minimo, atual]) => atual < minimo).map(([nome, unidade, minimo, atual]) => ({ name: nome, unit: unidade, min_stock: minimo, current_stock: atual, falta: minimo - atual })))]);

  // ── Descarte e ocorrência (hora de São Paulo) ──
  const ana = pessoas.find((p) => p.nome.startsWith("Ana"));
  const bruno = pessoas.find((p) => p.nome.startsWith("Bruno"));
  await cliente.query(
    `INSERT INTO ocorrencias (store, tipo, employee_name, employee_id, item, quantidade, unidade, valor_estimado, motivo, photo, created_at)
     VALUES ($1, 'descarte', $2, $3, 'Esfirra de carne', '4', 'un', 14.00, 'Queimou no forno', $4, (NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '26 hours')`,
    [LOJA_NOME, ana.nome, ana.id, await foto("descarte", 480)]);
  await cliente.query(
    `INSERT INTO ocorrencias (store, tipo, employee_name, employee_id, descricao, created_at)
     VALUES ($1, 'ocorrencia', $2, $3, 'O freezer 2 está fazendo barulho e a porta não fecha direito.', (NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '5 hours')`,
    [LOJA_NOME, bruno.nome, bruno.id]);

  return { loja: LOJA_NOME, dono: { id: dono.id }, pessoas, checklists: criados, escalas };
}

// node tutoriais/ambiente/semente.mjs → semeia o ambiente das variáveis (para olhar as telas à mão).
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const c = banco();
  await c.connect();
  const r = await semear(c);
  await c.end();
  console.log(`loja ${r.loja}: ${r.pessoas.length + 1} pessoas, ${r.checklists.length} checklists. Entrar: ${CONTAS.dono.email} / ${CONTAS.dono.senha}`);
}
