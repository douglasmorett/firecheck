// Pacote das telas para o app nativo se atualizar sozinho (src/atualizacaoDoApp.js).
// Roda depois do `vite build` (npm run build, também na Vercel) e grava:
//   dist/ota/<versao>.zip   o dist sem os vídeos da página de vendas
//   dist/ota/versao.json    { versao, arquivo, nativoMinimo, bytes, criadoEm }
// A versão é o hash do conteúdo: build igual não faz o app baixar de novo.
//
// NATIVO_MINIMO: suba quando as telas passarem a depender de um plugin nativo
// novo — app mais velho que isso não recebe o pacote e espera a versão da loja.
// No build do app nativo, scripts/app-sem-videos.mjs apaga dist/ota antes do
// `cap sync` (o pacote não pode ir dentro do próprio app).
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { zipSync } from 'fflate';

const NATIVO_MINIMO = '1.0.3';
const pasta = 'dist';

const arquivos = [];
const varrer = (dir) => {
  for (const nome of readdirSync(dir).sort()) {
    const caminho = join(dir, nome);
    const rel = relative(pasta, caminho).split(sep).join('/');
    if (rel === 'ota') continue;
    const info = statSync(caminho);
    if (info.isDirectory()) varrer(caminho);
    // Fora: vídeos e as imagens soltas grandes de public/ (fotos, logos e
    // mockups da página de vendas, que o app não abre — ele vai direto ao
    // login). O que as telas do app importam vai para assets/ e entra inteiro.
    else if (/\.(mp4|mov|webm)$/i.test(nome)) continue;
    else if (!rel.startsWith('assets/') && info.size > 150 * 1024) continue;
    else arquivos.push(rel);
  }
};
varrer(pasta);

const hash = createHash('sha256');
const conteudo = {};
for (const rel of arquivos) {
  const dados = readFileSync(join(pasta, rel));
  hash.update(rel).update(dados);
  conteudo[rel] = dados;
}
const versao = hash.digest('hex').slice(0, 12);
const zip = zipSync(conteudo, { level: 9 });

mkdirSync(join(pasta, 'ota'), { recursive: true });
writeFileSync(join(pasta, 'ota', `${versao}.zip`), zip);
writeFileSync(join(pasta, 'ota', 'versao.json'), JSON.stringify({
  versao, arquivo: `/ota/${versao}.zip`, nativoMinimo: NATIVO_MINIMO, bytes: zip.length, criadoEm: new Date().toISOString(),
}));
console.log(`pacote do app: ${versao} — ${arquivos.length} arquivos, ${(zip.length / 1048576).toFixed(1)} MB`);
