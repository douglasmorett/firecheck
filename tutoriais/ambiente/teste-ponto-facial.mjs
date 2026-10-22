// Teste do ponto da loja (reconhecimento facial) e das travas do ponto, contra
// um ambiente local descartável (ver ambiente.mjs). Nada aqui encosta em produção.
//
//   npx vite build --outDir tutoriais/.dist --emptyOutDir
//   node tutoriais/ambiente/ambiente.mjs subir 6
//   TUTORIAL_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5476/postgres?sslmode=disable node tutoriais/ambiente/semente.mjs
//   node tutoriais/ambiente/teste-ponto-facial.mjs 6
//
// A câmera do quiosque é um <canvas> no lugar do getUserMedia, onde o teste
// desenha as fotos geradas de tutoriais/ambiente/fotos (não são pessoas reais).
// A foto entra espelhada e mais clara que a do cadastro, e a "virada de rosto"
// da prova de vida é a imagem comprimida de um lado.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import pg from "pg";

const n = Number(process.argv[2] || 6);
const BASE = `http://127.0.0.1:${3170 + n}`;
const BANCO = `postgres://${["postgres", "postgres"].join(":")}@127.0.0.1:${5470 + n}/postgres?sslmode=disable`;
const aqui = path.dirname(fileURLToPath(import.meta.url));
const FOTOS = path.join(aqui, "fotos");
const DIST = path.join(aqui, "..", ".dist");
const CHROME = "C:/Users/Micro/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const SENHA = "sabor123";
const EMAIL = (nome) => `${nome}@sabordapraca.com.br`;

let falhas = 0;
const resultados = [];
function confere(nome, ok, detalhe = "") {
  resultados.push(`${ok ? "OK  " : "FALHOU"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  console.log(`${ok ? "  ok" : "  FALHOU"}  ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas += 1;
}

async function api(caminho, { token, metodo = "GET", corpo } = {}) {
  const r = await fetch(BASE + caminho, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  let dados = null;
  try { dados = await r.json(); } catch { /* CSV ou vazio */ }
  return { status: r.status, dados };
}
async function login(nome) {
  const r = await api("/api/auth", { metodo: "POST", corpo: { email: EMAIL(nome), password: SENHA } });
  if (!r.dados?.token) throw new Error(`login de ${nome} falhou: ${JSON.stringify(r.dados)}`);
  return { token: r.dados.token, user: r.dados.user };
}
const dataUrl = (arquivo) => `data:image/jpeg;base64,${fs.readFileSync(path.join(FOTOS, arquivo)).toString("base64")}`;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

// Roda dentro da página, antes do app: a câmera vira um canvas que o teste controla.
function cameraFalsa() {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");
  const estado = { img: null, virada: 0 };
  window.__camera = {
    async mostrar(src) { const img = new Image(); img.src = src; await img.decode(); estado.img = img; estado.virada = 0; },
    virar(v) { estado.virada = v; },
    vazio() { estado.img = null; },
  };
  setInterval(() => {
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(0, 0, 640, 480);
    const img = estado.img;
    if (!img) return;
    ctx.save();
    ctx.filter = "brightness(1.12) contrast(0.95)";
    ctx.translate(640, 0);
    ctx.scale(-1, 1);
    const W = 640;
    const H = img.height * (W / img.width);
    const y0 = -H * 0.18;
    if (!estado.virada) {
      ctx.drawImage(img, 0, y0, W, H);
    } else {
      const meio = img.width / 2;
      const wE = (W / 2) * (1 - estado.virada);
      ctx.drawImage(img, 0, 0, meio, img.height, 0, y0, wE, H);
      ctx.drawImage(img, meio, 0, meio, img.height, wE, y0, W - wE, H);
    }
    ctx.restore();
  }, 66);
  const stream = canvas.captureStream(15);
  if (!navigator.mediaDevices) Object.defineProperty(navigator, "mediaDevices", { value: {} });
  navigator.mediaDevices.getUserMedia = async () => stream;
}

async function entrarNoPainel(navegador, nome) {
  const { token, user } = await login(nome);
  const contexto = await navegador.newContext({ viewport: { width: 1366, height: 900 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  await contexto.addInitScript(({ token, user }) => {
    if (sessionStorage.getItem("__teste_logado")) return;
    sessionStorage.setItem("__teste_logado", "1");
    localStorage.setItem("firecheck_token", token);
    localStorage.setItem("user", JSON.stringify(user));
    for (const k of ["firecheck_tour_dismissed", "firecheck_webapp_banner_dismissed", "firecheck_pwa_banner_dismissed"]) localStorage.setItem(k, "true");
  }, { token, user });
  await contexto.addInitScript(cameraFalsa);
  const pagina = await contexto.newPage();
  pagina.on("dialog", (d) => d.accept());
  pagina.on("pageerror", (e) => console.log("    [erro na página]", e.message));
  await pagina.goto(`${BASE}/admin`, { waitUntil: "load" });
  const naoMostrar = pagina.getByRole("button", { name: "Já vi, não mostrar mais" });
  if (await naoMostrar.waitFor({ state: "visible", timeout: 8000 }).then(() => true, () => false)) await naoMostrar.click();
  return { contexto, pagina, token, user };
}

async function abrirModuloDePonto(pagina) {
  await pagina.getByText("Controle de Ponto IA").first().click();
  await pagina.getByText("Escalas de Trabalho").first().waitFor({ timeout: 30000 });
}

async function cadastrarRosto(pagina, nomeCompleto, foto) {
  await abrirModuloDePonto(pagina);
  await pagina.getByText(nomeCompleto, { exact: true }).first().click();
  const cartao = pagina.getByTestId("cartao-rosto");
  await cartao.waitFor({ timeout: 30000 });
  await cartao.getByRole("button", { name: /Cadastrar rosto|Trocar rosto/ }).click();
  await pagina.getByTestId("arquivo-rosto").waitFor({ state: "attached", timeout: 120000 });
  await pagina.getByTestId("arquivo-rosto").setInputFiles(path.join(FOTOS, foto));
  const achou = await pagina.getByText("✓ Rosto encontrado.").waitFor({ timeout: 60000 }).then(() => true, () => false);
  if (!achou) return { ok: false, motivo: await pagina.locator(".modal-janela").innerText().catch(() => "?") };
  await pagina.getByTestId("consentimento").check();
  await pagina.getByRole("button", { name: "Salvar rosto" }).click();
  const salvo = await pagina.getByTestId("rosto-status").filter({ hasText: "Rosto cadastrado em" }).waitFor({ timeout: 15000 }).then(() => true, () => false);
  const texto = salvo ? await pagina.getByTestId("rosto-status").innerText() : await pagina.locator(".modal-janela").innerText().catch(() => "?");
  return { ok: salvo, motivo: texto };
}

async function voltarDaFicha(pagina) {
  await pagina.locator("button:has(svg.lucide-arrow-left)").first().click();
  await pagina.getByText("Escalas de Trabalho").first().waitFor({ timeout: 30000 });
}

// Uma pessoa na frente do tablet: reconhece, vira o rosto, confirma.
async function baterNoQuiosque(pagina, foto, { confirmar = true } = {}) {
  await pagina.evaluate((src) => window.__camera.mostrar(src), dataUrl(foto));
  const msg = pagina.getByTestId("quiosque-mensagem");
  const pediuVirada = await msg.filter({ hasText: "vire o rosto" }).waitFor({ timeout: 30000 }).then(() => true, () => false);
  if (!pediuVirada) return { ok: false, motivo: await msg.innerText() };
  // "Mexe a cabeça": de lado e de volta, até a tela perguntar.
  for (let i = 0; i < 12; i++) {
    await pagina.evaluate((v) => window.__camera.virar(v), i % 2 === 0 ? 0.32 : 0);
    if (await pagina.getByTestId("quiosque-pessoa").isVisible()) break;
    await esperar(500);
  }
  const ola = await pagina.getByTestId("quiosque-pessoa").waitFor({ timeout: 10000 }).then(() => true, () => false);
  if (!ola) return { ok: false, motivo: await msg.innerText() };
  await pagina.evaluate(() => window.__camera.virar(0));
  await pagina.locator('[data-testid="quiosque-rotulo"]:not(:has-text("…"))').waitFor({ timeout: 10000 });
  const quem = await pagina.getByTestId("quiosque-pessoa").innerText();
  const rotulo = await pagina.getByTestId("quiosque-rotulo").innerText();
  if (!confirmar) return { ok: true, quem, rotulo };
  await pagina.getByTestId("quiosque-confirmar").click();
  await msg.filter({ hasText: /registrad|Não deu|acabou/ }).waitFor({ timeout: 20000 });
  const fim = await msg.innerText();
  await pagina.evaluate(() => window.__camera.vazio());
  await esperar(4500); // a tela volta a procurar
  return { ok: /registrad/.test(fim), quem, rotulo, fim };
}

async function main() {
  const banco = new pg.Client({ connectionString: BANCO });
  await banco.connect();
  const carlos = await login("carlos");
  const fernanda = await login("fernanda");
  const ana = await login("ana");
  const bruno = await login("bruno");
  const { rows: equipe } = await banco.query("SELECT id, name, email FROM users WHERE store = (SELECT store FROM users WHERE email = $1)", [EMAIL("carlos")]);
  const id = (nome) => equipe.find((u) => u.email === EMAIL(nome)).id;
  const store = carlos.user.store;
  const mes = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);

  console.log("\nD. Revisão do ponto: travas no servidor");
  const escala = { name: "Escala de teste", hora_entrada: "09:00", hora_saida: "17:00" };
  confere("funcionário não cria escala (403)", (await api("/api/schedules", { token: ana.token, metodo: "POST", corpo: escala })).status === 403);
  const { rows: [umaEscala] } = await banco.query("SELECT id FROM work_schedules WHERE store = $1 LIMIT 1", [store]);
  confere("funcionário não altera escala (403)", (await api(`/api/schedules/${umaEscala.id}`, { token: ana.token, metodo: "PUT", corpo: escala })).status === 403);
  confere("funcionário não apaga escala (403)", (await api(`/api/schedules/${umaEscala.id}`, { token: ana.token, metodo: "DELETE" })).status === 403);
  confere("funcionário ainda lê as escalas (tela de bater ponto)", (await api("/api/schedules", { token: ana.token })).status === 200);
  const criada = await api("/api/schedules", { token: fernanda.token, metodo: "POST", corpo: escala });
  confere("gestora com perm_ponto cria escala", criada.status === 200);
  const { rows: [permsDaFernanda] } = await banco.query("SELECT permissions FROM users WHERE email = $1", [EMAIL("fernanda")]);
  await banco.query(`UPDATE users SET permissions = '{"perm_ponto": false}' WHERE email = $1`, [EMAIL("fernanda")]);
  confere("gestora SEM perm_ponto não cria escala (403)", (await api("/api/schedules", { token: fernanda.token, metodo: "POST", corpo: escala })).status === 403);
  confere("gestora SEM perm_ponto não vê o espelho (403)", (await api(`/api/ponto?store=${encodeURIComponent(store)}&month=${mes}`, { token: fernanda.token })).status === 403);
  await banco.query("UPDATE users SET permissions = $1 WHERE email = $2", [permsDaFernanda.permissions, EMAIL("fernanda")]);
  confere("dono apaga a escala de teste", (await api(`/api/schedules/${criada.dados.id}`, { token: carlos.token, metodo: "DELETE" })).status === 200);
  confere("funcionário não lista o espelho da loja (403)", (await api(`/api/ponto?store=${encodeURIComponent(store)}&month=${mes}`, { token: ana.token })).status === 403);
  confere("funcionário não exporta a folha (403)", (await api(`/api/ponto/export?store=${encodeURIComponent(store)}&month=${mes}`, { token: ana.token })).status === 403);
  confere("dono lista o espelho", (await api(`/api/ponto?store=${encodeURIComponent(store)}&month=${mes}`, { token: carlos.token })).status === 200);
  confere("funcionário não mexe no rosto de ninguém (403)", (await api("/api/rostos/modo", { token: ana.token, metodo: "PUT", corpo: { userId: id("bruno"), modo: "loja" } })).status === 403);
  confere("'só no ponto da loja' sem rosto é recusado (400)", (await api("/api/rostos/modo", { token: carlos.token, metodo: "PUT", corpo: { userId: id("rafael"), modo: "loja" } })).status === 400);

  const navegador = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, headless: true, args: ["--use-fake-ui-for-media-stream", "--enable-unsafe-swiftshader"] });
  try {
    console.log("\nA. Cadastro do rosto na ficha (gestor, pela tela)");
    const painel = await entrarNoPainel(navegador, "carlos");
    const p = painel.pagina;
    const rAna = await cadastrarRosto(p, "Ana Souza", "rosto-ana.jpg");
    confere("Ana: rosto cadastrado e a ficha mostra a data", rAna.ok && /Rosto cadastrado em \d{2}\/\d{2}\/\d{4}/.test(rAna.motivo), rAna.motivo);
    await voltarDaFicha(p);
    const rBruno = await cadastrarRosto(p, "Bruno Alves", "rosto-bruno.jpg");
    confere("Bruno: rosto cadastrado", rBruno.ok, rBruno.motivo);
    await voltarDaFicha(p);
    const rDup = await cadastrarRosto(p, "Juliana Costa", "rosto-ana.jpg");
    confere("foto da Ana na ficha da Juliana é barrada (rosto repetido)", !rDup.ok && /parecido com o de Ana Souza/.test(rDup.motivo), rDup.motivo.split("\n").find((l) => l.includes("parecido")) || rDup.motivo.slice(0, 120));
    await p.getByRole("button").filter({ has: p.locator("svg.lucide-x") }).last().click();
    await voltarDaFicha(p);
    const { rows: guardado } = await banco.query("SELECT user_id, jsonb_array_length(descritor) AS tam, consentimento_texto, cadastrado_por FROM ponto_rostos ORDER BY user_id");
    confere("servidor guarda só o descritor (128 números), com consentimento e quem cadastrou",
      guardado.length === 2 && guardado.every((g) => g.tam === 128 && g.consentimento_texto.includes("LGPD") && g.cadastrado_por === EMAIL("carlos")),
      JSON.stringify(guardado.map((g) => ({ user_id: g.user_id, tam: g.tam, por: g.cadastrado_por }))));
    confere("nenhuma coluna de foto na tabela do rosto", !(await banco.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'ponto_rostos'")).rows.some((c) => /foto|photo|selfie|imagem/.test(c.column_name)));

    console.log("\nC. Como cada um bate ponto");
    await p.getByText("Bruno Alves", { exact: true }).first().click();
    await p.getByTestId("modo-ponto").selectOption("loja");
    await esperar(1500);
    confere("Bruno ficou 'só no ponto da loja'", (await banco.query("SELECT ponto_modo FROM users WHERE id = $1", [id("bruno")])).rows[0].ponto_modo === "loja");
    const hojeBruno = await api(`/api/ponto/today?userId=${id("bruno")}`, { token: bruno.token });
    confere("a tela do Bruno sabe que ele bate na loja (today.modo)", hojeBruno.dados?.modo === "loja");
    const proprioBruno = await api("/api/ponto", { token: bruno.token, metodo: "POST", corpo: { store, type: "entrada", latitude: -22.52, longitude: -41.94, accuracy: 10 } });
    confere("Bruno não bate pela própria conta (403)", proprioBruno.status === 403, proprioBruno.dados?.error);
    const juliana = await login("juliana");
    const proprioJuliana = await api("/api/ponto", { token: juliana.token, metodo: "POST", corpo: { store, type: "entrada", latitude: -22.52, longitude: -41.94, accuracy: 10, selfie: dataUrl("rosto-juliana.jpg") } });
    confere("Juliana segue batendo pela própria conta (origem 'app')", proprioJuliana.status === 200 && proprioJuliana.dados?.record?.origem === "app", `${proprioJuliana.status} ${proprioJuliana.dados?.error || ""}`);
    await voltarDaFicha(p);

    console.log("\nD. Ficha: \"Criar Escala e Vincular\"");
    await p.getByText("Lucas Oliveira", { exact: true }).first().click();
    await p.getByRole("button", { name: "Nova Escala" }).click();
    await p.getByPlaceholder("Ex: Comercial Seg a Sex").fill("Escala do Lucas (teste)");
    await p.getByRole("button", { name: "Criar Escala e Vincular" }).click();
    await esperar(2500);
    const { rows: [lucas] } = await banco.query(
      "SELECT w.name FROM users u LEFT JOIN work_schedules w ON w.id = u.schedule_id WHERE u.id = $1", [id("lucas")]);
    confere("a escala criada na ficha fica vinculada ao funcionário", lucas.name === "Escala do Lucas (teste)", `escala do Lucas: ${lucas.name}`);
    await voltarDaFicha(p);

    console.log("\nB. Ponto da loja (tablet), sem login");
    await p.getByText("Ponto da Loja", { exact: true }).click();
    await p.locator('input[maxlength="80"]').fill("Tablet de teste");
    await Promise.all([
      p.waitForURL(/\/ponto-loja/, { timeout: 30000 }),
      p.getByRole("button", { name: "Usar este aparelho como ponto da loja" }).click(),
    ]);
    const guardaDoTablet = await p.evaluate(() => ({ q: localStorage.getItem("firecheck_quiosque"), t: localStorage.getItem("firecheck_token"), u: localStorage.getItem("user") }));
    confere("o tablet guarda só o token do quiosque (sessão do dono sai do aparelho)", !!guardaDoTablet.q && !guardaDoTablet.t && !guardaDoTablet.u);
    const tokenDoQuiosque = JSON.parse(guardaDoTablet.q).token;
    await p.getByTestId("quiosque-mensagem").filter({ hasText: "Olhe para a câmera" }).waitFor({ timeout: 180000 });
    await p.goto(`${BASE}/admin`);
    const voltou = await p.waitForURL(/\/ponto-loja/, { timeout: 15000 }).then(() => true, () => false);
    confere("no modo quiosque, o painel volta para o ponto da loja", voltou, p.url());
    await p.getByTestId("quiosque-mensagem").filter({ hasText: "Olhe para a câmera" }).waitFor({ timeout: 180000 });

    // Prova de vida: a foto parada da Ana não passa.
    await p.evaluate((src) => window.__camera.mostrar(src), dataUrl("rosto-ana.jpg"));
    await p.getByTestId("quiosque-mensagem").filter({ hasText: "vire o rosto" }).waitFor({ timeout: 30000 });
    const parada = await p.getByTestId("quiosque-mensagem").filter({ hasText: "Não deu para confirmar" }).waitFor({ timeout: 15000 }).then(() => true, () => false);
    confere("foto parada (sem virar o rosto) não bate ponto", parada && !(await p.getByTestId("quiosque-pessoa").isVisible()));

    // "Não sou eu" com a Ana.
    const anaNao = await baterNoQuiosque(p, "rosto-ana.jpg", { confirmar: false });
    confere("Ana reconhecida como Ana", anaNao.ok && anaNao.quem === "Olá, Ana!", `${anaNao.quem || anaNao.motivo} · ${anaNao.rotulo || ""}`);
    await p.getByTestId("quiosque-nao-sou-eu").click();
    const naoSouEu = await p.getByTestId("quiosque-mensagem").innerText();
    confere("'Não sou eu' cancela sem gravar", /Tudo bem/.test(naoSouEu) && (await banco.query("SELECT COUNT(*)::int AS c FROM ponto_records WHERE user_id = $1 AND origem = 'quiosque'", [id("ana")])).rows[0].c === 0);
    await p.evaluate(() => window.__camera.vazio());
    const inicioNaoSouEu = Date.now();

    const bat1 = await baterNoQuiosque(p, "rosto-bruno.jpg");
    confere("Bruno reconhecido como Bruno e ponto registrado", bat1.ok && bat1.quem === "Olá, Bruno!", `${bat1.quem} · ${bat1.rotulo} · ${bat1.fim || bat1.motivo}`);
    // A Ana fica 20 s fora depois do "Não sou eu".
    const falta = 21000 - (Date.now() - inicioNaoSouEu);
    if (falta > 0) await esperar(falta);
    const bat2 = await baterNoQuiosque(p, "rosto-ana.jpg");
    confere("Ana, em seguida, também bate (sem login)", bat2.ok && bat2.quem === "Olá, Ana!", `${bat2.quem} · ${bat2.rotulo} · ${bat2.fim || bat2.motivo}`);

    await p.evaluate((src) => window.__camera.mostrar(src), dataUrl("rosto-juliana.jpg"));
    const recusou = await p.getByTestId("quiosque-mensagem").filter({ hasText: "Rosto não reconhecido" }).waitFor({ timeout: 30000 }).then(() => true, () => false);
    confere("Juliana (sem rosto cadastrado) é recusada", recusou && !(await p.getByTestId("quiosque-pessoa").isVisible()), await p.getByTestId("quiosque-mensagem").innerText());
    await p.evaluate(() => window.__camera.vazio());

    const { rows: batidas } = await banco.query(
      "SELECT user_id, user_name, type, origem, quiosque_id, rosto_distancia, (selfie_url IS NOT NULL AND selfie_url <> '') AS tem_selfie, device_info FROM ponto_records WHERE origem = 'quiosque' ORDER BY id");
    confere("batidas do quiosque na pessoa certa, com selfie, origem e aparelho",
      batidas.length === 2 && batidas[0].user_id === id("bruno") && batidas[1].user_id === id("ana") && batidas.every((b) => b.tem_selfie && b.quiosque_id && b.rosto_distancia !== null),
      batidas.map((b) => `${b.user_name}: ${b.type}, distância ${b.rosto_distancia}`).join(" | "));

    console.log("\nB. Token do quiosque: só serve para bater ponto daquela loja");
    for (const rota of ["/api/users", `/api/ponto/today?userId=${id("ana")}`, "/api/schedules", "/api/rostos", `/api/ponto?store=${encodeURIComponent(store)}&month=${mes}`, "/api/quiosque/aparelhos"]) {
      confere(`token do quiosque recusado em ${rota.split("?")[0]} (401)`, (await api(rota, { token: tokenDoQuiosque })).status === 401);
    }
    const rostos = await api("/api/quiosque/rostos", { token: tokenDoQuiosque });
    const descritor = (nome) => {
      const d = rostos.dados.funcionarios.find((f) => f.id === id(nome)).descritor;
      return typeof d === "string" ? JSON.parse(d) : d;
    };
    confere("o quiosque baixa só os rostos desta loja", rostos.status === 200 && rostos.dados.funcionarios.length === 2);
    const repetida = await api("/api/quiosque/bater", { token: tokenDoQuiosque, metodo: "POST", corpo: { userId: id("ana"), descritor: descritor("ana") } });
    confere("mesma pessoa de novo em menos de 1 min não duplica (409)", repetida.status === 409, repetida.dados?.error);
    const trocado = await api("/api/quiosque/bater", { token: tokenDoQuiosque, metodo: "POST", corpo: { userId: id("ana"), descritor: descritor("bruno") } });
    confere("rosto do Bruno em nome da Ana é recusado pelo servidor (403)", trocado.status === 403, trocado.dados?.error);
    const semRosto = await api("/api/quiosque/bater", { token: tokenDoQuiosque, metodo: "POST", corpo: { userId: id("juliana"), descritor: descritor("ana") } });
    confere("funcionária sem rosto cadastrado não bate no quiosque (404)", semRosto.status === 404);

    // Outra loja, direto no banco descartável: o mesmo rosto da Ana num funcionário de lá.
    const { rows: [outroDono] } = await banco.query(
      `INSERT INTO users (name, email, password, role, store, store_name, status, ponto_active) VALUES ('Dono Outra', 'dono@outra.test', 'x', 'admin', 'Outra Loja', 'Outra Loja', 'active', TRUE) RETURNING id`);
    const { rows: [outroFunc] } = await banco.query(
      `INSERT INTO users (name, email, password, role, store, status) VALUES ('Zé da Outra', 'ze@outra.test', 'x', 'funcionario', 'Outra Loja', 'active') RETURNING id`);
    await banco.query("INSERT INTO ponto_rostos (user_id, store, descritor, modelo, consentimento_texto) VALUES ($1, 'Outra Loja', $2, 'teste', 'teste')", [outroFunc.id, JSON.stringify(descritor("ana"))]);
    const { rows: [outroTablet] } = await banco.query("INSERT INTO ponto_quiosques (store, nome, token_hash) VALUES ('Outra Loja', 'Tablet da outra', repeat('a', 64)) RETURNING id");
    const deOutraLoja = await api("/api/quiosque/bater", { token: tokenDoQuiosque, metodo: "POST", corpo: { userId: outroFunc.id, descritor: descritor("ana") } });
    confere("tablet desta loja não bate ponto de funcionário de outra loja (404)", deOutraLoja.status === 404);
    confere("dono desta loja não desativa tablet de outra loja (404)", (await api(`/api/quiosque/aparelhos?id=${outroTablet.id}`, { token: carlos.token, metodo: "DELETE" })).status === 404);
    confere("dono desta loja não mexe no rosto de outra loja (404)", (await api(`/api/rostos?userId=${outroFunc.id}`, { token: carlos.token, metodo: "DELETE" })).status === 404);
    await banco.query("DELETE FROM ponto_quiosques WHERE id = $1", [outroTablet.id]);
    await banco.query("DELETE FROM ponto_rostos WHERE user_id = $1", [outroFunc.id]);
    await banco.query("DELETE FROM users WHERE id IN ($1, $2)", [outroDono.id, outroFunc.id]);

    // "Só pela conta": some do quiosque.
    await api("/api/rostos/modo", { token: carlos.token, metodo: "PUT", corpo: { userId: id("ana"), modo: "conta" } });
    const soConta = await api("/api/quiosque/rostos", { token: tokenDoQuiosque });
    confere("Ana 'só pela conta' sai da lista do quiosque", !soConta.dados.funcionarios.some((f) => f.id === id("ana")));
    await api("/api/rostos/modo", { token: carlos.token, metodo: "PUT", corpo: { userId: id("ana"), modo: "ambos" } });

    console.log("\nB. Espelho do gestor");
    const gestor = await entrarNoPainel(navegador, "carlos");
    await abrirModuloDePonto(gestor.pagina);
    await gestor.pagina.getByText("Ana Souza", { exact: true }).first().click();
    const selo = await gestor.pagina.getByText("Ponto da loja (rosto)").first().waitFor({ timeout: 20000 }).then(() => true, () => false);
    const selfies = await gestor.pagina.locator('img[alt="Selfie"]').count();
    confere("espelho da Ana mostra a batida com selfie e 'Ponto da loja (rosto)'", selo && selfies >= 1, `selfies na ficha: ${selfies}`);
    await gestor.pagina.screenshot({ path: path.join(aqui, "..", ".dist", "_espelho-ana.png") }).catch(() => {});

    console.log("\nB. Desativar e sair do modo");
    const { rows: [tablet] } = await banco.query("SELECT id FROM ponto_quiosques WHERE revogado_em IS NULL AND nome = 'Tablet de teste'");
    confere("dono desativa o tablet", (await api(`/api/quiosque/aparelhos?id=${tablet.id}`, { token: carlos.token, metodo: "DELETE" })).status === 200);
    confere("tablet desativado não baixa mais rostos (401)", (await api("/api/quiosque/rostos", { token: tokenDoQuiosque })).status === 401);
    confere("tablet desativado não bate mais ponto (401)", (await api("/api/quiosque/bater", { token: tokenDoQuiosque, metodo: "POST", corpo: { userId: id("bruno"), descritor: descritor("bruno") } })).status === 401);
    await p.reload();
    const avisoRevogado = await p.getByText("não é mais o ponto da loja").first().waitFor({ timeout: 30000 }).then(() => true, () => false);
    confere("a tela do tablet desativado avisa e oferece o login", avisoRevogado);

    const novo = await api("/api/quiosque/aparelhos", { token: carlos.token, metodo: "POST", corpo: { nome: "Tablet 2" } });
    const sairAna = await api("/api/quiosque/sair", { token: novo.dados.token, metodo: "POST", corpo: { email: EMAIL("ana"), senha: SENHA } });
    confere("funcionária não tira o tablet do modo ponto (403)", sairAna.status === 403);
    confere("senha errada do dono não tira (403)", (await api("/api/quiosque/sair", { token: novo.dados.token, metodo: "POST", corpo: { email: EMAIL("carlos"), senha: "errada" } })).status === 403);
    confere("e-mail e senha do dono tiram o tablet do modo", (await api("/api/quiosque/sair", { token: novo.dados.token, metodo: "POST", corpo: { email: EMAIL("carlos"), senha: SENHA } })).status === 200);
    confere("depois de sair, o token não vale mais (401)", (await api("/api/quiosque/rostos", { token: novo.dados.token })).status === 401);

    console.log("\nA. Apagar o rosto");
    const apagar = await api(`/api/rostos?userId=${id("bruno")}`, { token: carlos.token, metodo: "DELETE" });
    const brunoDepois = (await banco.query("SELECT ponto_modo FROM users WHERE id = $1", [id("bruno")])).rows[0];
    confere("apagar o rosto do Bruno tira o descritor e devolve a própria conta", apagar.status === 200 &&
      (await banco.query("SELECT 1 FROM ponto_rostos WHERE user_id = $1", [id("bruno")])).rowCount === 0 && brunoDepois.ponto_modo === null);
    confere("excluir a Ana (funcionária) apaga o rosto dela junto",
      (await api(`/api/users/${id("ana")}`, { token: carlos.token, metodo: "DELETE" })).status === 200 &&
      (await banco.query("SELECT 1 FROM ponto_rostos WHERE user_id = $1", [id("ana")])).rowCount === 0);

    console.log("\nSósia: só a Fernanda cadastrada, a Juliana na frente do tablet");
    // Nas fotos geradas, Fernanda × Juliana dão 0,44–0,46 (a tabela abaixo):
    // é o caso mais difícil para o limiar do aparelho.
    await gestor.pagina.locator("button:has(svg.lucide-arrow-left)").first().click();
    await gestor.pagina.getByText("Escalas de Trabalho").first().waitFor({ timeout: 30000 });
    const rFer = await cadastrarRosto(gestor.pagina, "Fernanda Lima", "rosto-fernanda.jpg");
    confere("Fernanda: rosto cadastrado", rFer.ok, rFer.motivo);
    const tablet3 = await api("/api/quiosque/aparelhos", { token: carlos.token, metodo: "POST", corpo: { nome: "Tablet 3" } });
    const ctx3 = await navegador.newContext({ viewport: { width: 1024, height: 768 }, locale: "pt-BR" });
    await ctx3.addInitScript((q) => localStorage.setItem("firecheck_quiosque", q), JSON.stringify({ token: tablet3.dados.token, id: tablet3.dados.id, nome: "Tablet 3" }));
    await ctx3.addInitScript(cameraFalsa);
    const p3 = await ctx3.newPage();
    await p3.goto(`${BASE}/ponto-loja`);
    await p3.getByTestId("quiosque-mensagem").filter({ hasText: "Olhe para a câmera" }).waitFor({ timeout: 180000 });
    await p3.evaluate((src) => window.__camera.mostrar(src), dataUrl("rosto-juliana.jpg"));
    let virouFernanda = false;
    const vistas = new Set();
    for (let i = 0; i < 30 && !virouFernanda; i++) {
      await p3.evaluate((v) => window.__camera.virar(v), i % 2 ? 0.32 : 0);
      vistas.add(await p3.getByTestId("quiosque-mensagem").innerText());
      virouFernanda = await p3.getByTestId("quiosque-pessoa").isVisible();
      await esperar(500);
    }
    confere("Juliana NÃO vira Fernanda no tablet", !virouFernanda, [...vistas].filter(Boolean).join(" / "));
    await p3.evaluate((src) => window.__camera.mostrar(src), dataUrl("rosto-fernanda.jpg"));
    const fer = await baterNoQuiosque(p3, "rosto-fernanda.jpg", { confirmar: false });
    confere("Fernanda reconhecida como Fernanda", fer.ok && fer.quem === "Olá, Fernanda!", fer.quem || fer.motivo);
    await ctx3.close();

    // Para o relatório: o quanto as fotos se parecem (distância entre descritores).
    console.log("\nDistâncias entre os rostos gerados (cadastro × câmera espelhada/clareada):");
    const medir = await navegador.newPage();
    await medir.goto(`${BASE}/privacy`);
    const pedaco = fs.readdirSync(path.join(DIST, "assets")).find((f) => /^face-api\.esm-.*\.js$/.test(f));
    const fotos = fs.readdirSync(FOTOS).filter((f) => f.startsWith("rosto-")).sort();
    const srcs = Object.fromEntries(fotos.map((f) => [f, dataUrl(f)]));
    const tabela = await medir.evaluate(async ({ pedaco, fotos, srcs }) => {
      const faceapi = await import(`/assets/${pedaco}`);
      for (const rede of ["tinyFaceDetector", "faceLandmark68Net", "faceRecognitionNet"]) await faceapi.nets[rede].loadFromUri("/modelos-rosto");
      const ler = async (src, variar) => {
        const img = new Image(); img.src = src; await img.decode();
        const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
        const ctx = c.getContext("2d");
        if (variar) { ctx.filter = "brightness(1.12) contrast(0.95)"; ctx.translate(c.width, 0); ctx.scale(-1, 1); }
        ctx.drawImage(img, 0, 0);
        const r = await faceapi.detectSingleFace(c, new faceapi.TinyFaceDetectorOptions({ inputSize: 416 })).withFaceLandmarks().withFaceDescriptor();
        return Array.from(r.descriptor);
      };
      const d = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
      const cad = {}; const cam = {};
      for (const f of fotos) { cad[f] = await ler(srcs[f], false); cam[f] = await ler(srcs[f], true); }
      return fotos.map((a) => [a, ...fotos.map((b) => d(cad[a], cam[b]).toFixed(2))]);
    }, { pedaco, fotos, srcs }).catch((e) => `não medi: ${e.message}`);
    if (Array.isArray(tabela)) {
      console.log("  cadastro\\câmera " + fotos.map((f) => f.replace("rosto-", "").replace(".jpg", "").padStart(8)).join(""));
      for (const [nome, ...vals] of tabela) console.log("  " + nome.replace("rosto-", "").replace(".jpg", "").padEnd(16) + vals.map((v) => v.padStart(8)).join(""));
    } else console.log("  " + tabela);
    await medir.close();
  } finally {
    await navegador.close();
    await banco.end();
  }
  console.log(`\n${resultados.length - falhas} de ${resultados.length} ok${falhas ? `, ${falhas} FALHARAM` : ""}`);
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
