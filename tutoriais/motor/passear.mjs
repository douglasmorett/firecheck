// Fotografa as telas do FireCheck da loja fictícia, para planejar e revisar
// roteiros: entra com a conta pedida, abre cada aba do menu lateral e salva
// uma foto por aba.
//
//   node tutoriais/motor/passear.mjs dono [pasta]          todas as abas do painel
//   node tutoriais/motor/passear.mjs funcionario [pasta]   Tela de Execução e ponto (celular)
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { BASE, FUSO } from "./palco.mjs";
import { CONTAS } from "../ambiente/semente.mjs";

const conta = process.argv[2] || "dono";
const pasta = process.argv[3] || path.join(process.cwd(), "tutoriais", "saida", `passeio-${conta}`);
fs.mkdirSync(pasta, { recursive: true });
const CHROME = process.env.TUTORIAL_CHROME || "C:/Users/Micro/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const celular = conta === "funcionario";

const navegador = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, headless: true });
const contexto = await navegador.newContext({
  viewport: celular ? { width: 390, height: 844 } : { width: 1366, height: 768 },
  deviceScaleFactor: celular ? 2 : 1, isMobile: celular, hasTouch: celular,
  locale: "pt-BR", timezoneId: FUSO, permissions: ["geolocation", "camera"], geolocation: { latitude: -22.5269, longitude: -41.9447 },
});
await contexto.addInitScript(() => {
  for (const k of ["firecheck_tour_dismissed", "firecheck_webapp_banner_dismissed", "firecheck_pwa_banner_dismissed"]) localStorage.setItem(k, "true");
});
const p = await contexto.newPage();
const erros = [];
p.on("pageerror", (e) => erros.push(String(e).slice(0, 200)));
p.on("dialog", (d) => { erros.push(`dialog: ${d.message().slice(0, 100)}`); d.dismiss().catch(() => {}); });
await p.goto(`${BASE}/login`);
await p.fill("input[type=email]", CONTAS[conta].email);
await p.fill("input[type=password]", CONTAS[conta].senha);
await p.press("input[type=password]", "Enter");
await p.waitForURL(/\/(admin|funcionario)/, { timeout: 60000 });
await p.waitForTimeout(3000);
const foto = async (nome) => { await p.screenshot({ path: path.join(pasta, `${nome}.png`), fullPage: celular }); console.log(nome); };

if (!celular) {
  await foto("00-entrada");
  const itens = await p.locator("aside.sidebar button").allInnerTexts();
  console.log("menu:", itens.map((t) => t.trim()).filter(Boolean).join(" | "));
  let i = 1;
  for (const nome of itens.map((t) => t.trim()).filter(Boolean)) {
    if (/Sair|Ocultar|Tela de Execução|Tour|Tutoriais/.test(nome)) continue;
    await p.locator("aside.sidebar button", { hasText: nome }).first().click().catch(() => {});
    await p.waitForTimeout(2500);
    await foto(`${String(i++).padStart(2, "0")}-${nome.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}`);
  }
} else {
  await foto("00-execucao");
  await p.goto(`${BASE}/ponto`);
  await p.waitForTimeout(3000);
  await foto("01-ponto");
}
console.log("erros:", JSON.stringify(erros));
await navegador.close();
