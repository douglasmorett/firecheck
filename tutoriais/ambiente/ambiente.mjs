// Ambientes de gravação numerados: cada um tem o SEU banco descartável e o SEU
// FireCheck, para vários tutoriais serem gravados ao mesmo tempo sem um apagar
// a loja do outro (toda gravação recomeça a loja do zero).
//
//   npx vite build --outDir tutoriais/.dist --emptyOutDir   a build do app (uma serve a todos)
//   node tutoriais/ambiente/ambiente.mjs subir 1             sobe (ou confirma) o ambiente 1
//   node tutoriais/ambiente/ambiente.mjs variaveis 1         as variáveis para usar com produzir.mjs
//   node tutoriais/ambiente/ambiente.mjs parar 1
//
// Ambiente N: banco PGlite na porta 5470+N, FireCheck (API + app) na 3170+N.
// Nada aqui encosta em produção: sem chave do WhatsApp, do Firebase de verdade,
// do Gemini do app nem da Cakto, o que dependeria delas falha calado.
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import pg from "pg";
import { ESQUEMA_BASE } from "./esquema-base.mjs";

const BASE_FORA = process.env.TUTORIAL_PASTA || "C:/Users/Micro/tutoriais-firecheck";
const raiz = process.cwd();

/**
 * Conta de serviço FALSA do Firebase: o api/index.js inicializa o Firebase Admin
 * no boot e precisa de uma chave com formato válido. Gerada uma vez por pasta;
 * não vale em lugar nenhum.
 */
function contaFalsaDoFirebase() {
  const arquivo = path.join(BASE_FORA, "firebase-falso.json");
  if (!fs.existsSync(arquivo)) {
    fs.mkdirSync(BASE_FORA, { recursive: true });
    const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    fs.writeFileSync(arquivo, JSON.stringify({
      type: "service_account", project_id: "tutoriais-local", private_key_id: "x",
      private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
      client_email: "tutoriais@tutoriais-local.iam.gserviceaccount.com", client_id: "1",
    }));
  }
  return fs.readFileSync(arquivo, "utf8");
}

/** A chave do Gemini do FireCheck (a mesma que o app usa para auditar as fotos). */
function chaveDaIa() {
  if (process.env.TUTORIAL_IA_CHAVE) return process.env.TUTORIAL_IA_CHAVE;
  for (const arquivo of ["C:/Users/Micro/Documents/firecheck/.env", "C:/Users/Micro/Documents/firehub-site/.env"]) {
    if (!fs.existsSync(arquivo)) continue;
    const linha = fs.readFileSync(arquivo, "utf8").split(/\r?\n/).find((l) => l.startsWith("GEMINI_API_KEY="));
    if (linha) return linha.slice("GEMINI_API_KEY=".length).replace(/^["']|["']$/g, "").trim();
  }
  return "";
}

export function ambiente(n) {
  const portaDoBanco = 5470 + Number(n), portaDoApp = 3170 + Number(n);
  // O PGlite local aceita qualquer usuário e senha (vem de variável para não haver credencial no código).
  const usuario = process.env.TUTORIAL_PG_USUARIO || "postgres";
  const acesso = [usuario, process.env.TUTORIAL_PG_SENHA || usuario].join(":");
  const url = `postgres://${acesso}@127.0.0.1:${portaDoBanco}/postgres?sslmode=disable`;
  return {
    n: Number(n), portaDoBanco, portaDoApp,
    dados: path.join(BASE_FORA, `dados-${n}`),
    variaveis: { TUTORIAL_DATABASE_URL: url, TUTORIAL_BASE: `http://127.0.0.1:${portaDoApp}` },
    doServidor: {
      DATABASE_URL: url, PORT: String(portaDoApp), JWT_SECRET: "tutoriais-local",
      FIREBASE_SERVICE_ACCOUNT: contaFalsaDoFirebase(), NODE_ENV: "development",
      // Fuso do servidor = o da Vercel. O pg lê TIMESTAMP sem fuso no fuso do
      // processo: rodando no fuso do Windows, as horas sairiam diferentes das de produção.
      TZ: "UTC",
      // A IA do FireCheck de verdade (a auditoria das fotos aparece nos vídeos).
      // WhatsApp, Cakto e afins ficam sem chave: nada sai da máquina por eles.
      GEMINI_API_KEY: chaveDaIa(), EVOLUTION_API_URL: "", EVOLUTION_API_KEY: "", VERCEL: "",
    },
  };
}

const escutando = (porta) => new Promise((ok) => {
  const s = net.connect({ port: porta, host: "127.0.0.1" });
  s.once("connect", () => { s.destroy(); ok(true); });
  s.once("error", () => ok(false));
});
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));

function soltar(script, args, env, log) {
  const saida = fs.openSync(log, "a");
  spawn(process.execPath, [script, ...args], { cwd: raiz, env: { ...process.env, ...env }, detached: true, stdio: ["ignore", saida, saida], windowsHide: true }).unref();
}

async function subir(n) {
  const a = ambiente(n);
  fs.mkdirSync(BASE_FORA, { recursive: true });
  if (!(await escutando(a.portaDoBanco))) {
    soltar(path.join(raiz, "tutoriais/node_modules/@electric-sql/pglite-socket/dist/scripts/server.js"),
      [`--db=${a.dados}`, `--port=${a.portaDoBanco}`, "--max-connections=10"], {}, path.join(BASE_FORA, `pglite-${n}.log`));
    for (let i = 0; i < 60 && !(await escutando(a.portaDoBanco)); i++) await dormir(500);
    if (!(await escutando(a.portaDoBanco))) throw new Error(`O banco do ambiente ${n} não subiu (veja pglite-${n}.log).`);
  }
  // As tabelas que a API do FireCheck pressupõe (as outras ela cria no boot).
  const cliente = new pg.Client({ connectionString: a.variaveis.TUTORIAL_DATABASE_URL });
  await cliente.connect();
  await cliente.query(ESQUEMA_BASE);
  await cliente.end();

  if (!(await escutando(a.portaDoApp))) {
    if (!fs.existsSync(path.join(raiz, "tutoriais/.dist/index.html"))) {
      throw new Error("Falta a build: rode `npx vite build --outDir tutoriais/.dist --emptyOutDir` na raiz antes.");
    }
    soltar(path.join(raiz, "tutoriais/ambiente/servidor.mjs"), [], a.doServidor, path.join(BASE_FORA, `app-${n}.log`));
    for (let i = 0; i < 60 && !(await escutando(a.portaDoApp)); i++) await dormir(500);
    if (!(await escutando(a.portaDoApp))) throw new Error(`O FireCheck do ambiente ${n} não subiu (veja app-${n}.log).`);
  }
  // A primeira chamada à API roda as migrações do boot (tabelas de ponto, compras, frota...).
  for (let i = 0; i < 60; i++) {
    const r = await fetch(`http://127.0.0.1:${a.portaDoApp}/api/ping`).catch(() => null);
    if (r && r.status < 500) return a;
    await dormir(1000);
  }
  throw new Error(`O FireCheck do ambiente ${n} não respondeu em /api/ping.`);
}

function parar(n) {
  const a = ambiente(n);
  for (const porta of [a.portaDoApp, a.portaDoBanco]) {
    const linhas = execFileSync("netstat", ["-ano"], { encoding: "utf8" }).split(/\r?\n/).filter((l) => /LISTENING/.test(l) && new RegExp(`:${porta}\\s`).test(l));
    for (const pid of new Set(linhas.map((l) => l.trim().split(/\s+/).pop()))) {
      try { execFileSync("taskkill", ["/F", "/T", "/PID", pid], { stdio: "ignore" }); } catch {}
    }
  }
}

const [acao, n] = process.argv.slice(2);
if (acao === "subir") {
  const a = await subir(n);
  console.log(`ambiente ${a.n} no ar: FireCheck http://127.0.0.1:${a.portaDoApp} · banco ${a.portaDoBanco}`);
} else if (acao === "variaveis") {
  console.log(Object.entries(ambiente(n).variaveis).map(([k, v]) => `export ${k}='${v}'`).join("\n"));
} else if (acao === "parar") {
  parar(n);
  console.log(`ambiente ${n} parado`);
} else if (acao) {
  console.error("Uso: node tutoriais/ambiente/ambiente.mjs subir|variaveis|parar <n>");
  process.exit(2);
}
