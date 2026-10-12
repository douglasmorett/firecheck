// Exploração rápida para escrever roteiro: entra, roda os passos de um arquivo
// e fotografa. Os passos são uma função (pagina, foto) => {...} exportada como default.
//
//   node tutoriais/motor/explorar.mjs <arquivo-dos-passos.mjs> [dono|funcionario|gestora] [celular]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { abrirNavegador, entrar, BASE, FUSO, definirTela, TELA, LOCAL_DA_LOJA } from "./palco.mjs";
import { CONTAS } from "../ambiente/semente.mjs";

const [arquivo, conta = "dono", celular] = process.argv.slice(2);
if (celular) definirTela({ width: 390, height: 844, celular: true });
const passos = (await import(pathToFileURL(path.resolve(arquivo)).href)).default;
const pasta = path.join(process.cwd(), "tutoriais", "saida", "explorar");
fs.mkdirSync(pasta, { recursive: true });
const navegador = await abrirNavegador({ camera: process.env.TUTORIAL_CAMERA });
const estado = await entrar(navegador, CONTAS[conta]);
const contexto = await navegador.newContext({
  viewport: { width: TELA.width, height: TELA.height }, storageState: estado, locale: "pt-BR", timezoneId: FUSO,
  permissions: ["geolocation", "camera"], geolocation: { latitude: LOCAL_DA_LOJA.latitude, longitude: LOCAL_DA_LOJA.longitude },
  ...(TELA.celular ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
});
const pagina = await contexto.newPage();
const erros = [];
pagina.on("pageerror", (e) => erros.push(String(e).slice(0, 200)));
pagina.on("dialog", (d) => { erros.push(`dialog: ${d.message().slice(0, 120)}`); d.dismiss().catch(() => {}); });
let n = 0;
const foto = async (nome, opcoes = {}) => {
  const destino = path.join(pasta, `${String(++n).padStart(2, "0")}-${nome}.png`);
  await pagina.screenshot({ path: destino, ...opcoes });
  console.log(destino);
};
try {
  await passos(pagina, foto, BASE);
} finally {
  console.log("erros:", JSON.stringify(erros));
  await navegador.close();
}
