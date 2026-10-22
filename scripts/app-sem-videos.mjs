// Tira os vídeos da página de vendas do dist antes do `cap sync`.
// No celular o app abre direto no login (App.jsx), então eles só deixavam o pacote com ~180 MB.
import { readdirSync, rmSync, statSync, unlinkSync } from "fs";
import { join } from "path";

const pasta = "dist";
let total = 0;
const varrer = (dir) => {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    const info = statSync(caminho);
    if (info.isDirectory()) varrer(caminho);
    else if (/\.(mp4|mov|webm)$/i.test(nome)) {
      total += info.size;
      unlinkSync(caminho);
      console.log("fora do app:", caminho);
    }
  }
};
varrer(pasta);
// O pacote de atualização (scripts/pacote-do-app.mjs) é para baixar, não para ir dentro do app.
rmSync(join(pasta, "ota"), { recursive: true, force: true });
console.log(`vídeos removidos: ${(total / 1048576).toFixed(1)} MB`);
