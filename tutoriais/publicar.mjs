// Leva um tutorial APROVADO para o app: grava a ficha em src/tutoriais/fichas.json
// (título, duração, capítulos, versão, público, em pé, o que a voz fala — para a
// busca da central) e separa vídeo, capa e legenda em tutoriais/saida/_envio/,
// com o nome <id>__<versao>__<arquivo>, para o envio ao servidor.
//
//   node tutoriais/publicar.mjs firecheck-painel [outros ids...]
//
// Os vídeos moram no volume de uploads do FIREHUB (tutoriais/<id>/<versao>/,
// servidos com CORS para o FireCheck): o FireCheck fica na Vercel, que não é
// lugar de vídeo. O envio é feito do navegador logado como ADMIN no FireHub, com
// o enviar-no-navegador.js do repositório do FireHub (tutoriais/), escolhendo
// os arquivos de tutoriais/saida/_envio. A ficha só deve ir para produção
// depois que os arquivos chegaram: senão o botão aparece e o vídeo não abre.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const ids = process.argv.slice(2);
if (!ids.length) {
  console.error("Uso: node tutoriais/publicar.mjs <roteiro> [outros...]");
  process.exit(2);
}
const raiz = process.cwd();
const arquivoDasFichas = path.join(raiz, "src", "tutoriais", "fichas.json");
const fichas = JSON.parse(fs.readFileSync(arquivoDasFichas, "utf8"));
const envio = path.join(raiz, "tutoriais", "saida", "_envio");
fs.mkdirSync(envio, { recursive: true });

for (const id of ids) {
  const origem = path.join(raiz, "tutoriais", "saida", id);
  const roteiro = (await import(pathToFileURL(path.join(raiz, "tutoriais", "roteiros", `${id}.mjs`)).href)).default;
  const ficha = JSON.parse(fs.readFileSync(path.join(origem, "tutorial.json"), "utf8"));
  const gravacao = JSON.parse(fs.readFileSync(path.join(origem, "gravacao.json"), "utf8"));
  const versao = crypto.createHash("sha1").update(fs.readFileSync(path.join(origem, "video.mp4"))).digest("hex").slice(0, 8);

  // A versão anterior deste vídeo sai da pasta de envio; a nova entra.
  for (const f of fs.readdirSync(envio)) if (f.startsWith(`${id}__`)) fs.rmSync(path.join(envio, f));
  for (const arquivo of ["video.mp4", "capa.jpg", "legendas.vtt"]) {
    fs.copyFileSync(path.join(origem, arquivo), path.join(envio, `${id}__${versao}__${arquivo}`));
  }

  fichas[id] = {
    id,
    titulo: ficha.titulo,
    duracao: ficha.duracao,
    versao,
    publico: roteiro.publico === "funcionario" ? "funcionario" : "gestor",
    ...(ficha.emPe ? { emPe: true } : {}),
    capitulos: ficha.capitulos,
    texto: gravacao.cenas.map((c) => c.fala).filter(Boolean).join(" "),
  };
  console.log(`publicado ${id} @ ${versao}`);
}
fs.writeFileSync(arquivoDasFichas, JSON.stringify(fichas, null, 2) + "\n", "utf8");
console.log(`fichas: ${Object.keys(fichas).length} · arquivos para enviar em ${envio}`);
