// Gera as fotos da loja fictícia (Sabor da Praça) pelo Gemini: as fotos que a
// equipe "tirou" nos checklists, os rostos da equipe (selfie do ponto) e os
// veículos da frota. Ninguém real aparece em vídeo.
//
//   node tutoriais/ambiente/gerar-fotos.mjs            gera só as que faltam
//   node tutoriais/ambiente/gerar-fotos.mjs bancada    refaz uma
//
// As fotos ficam em tutoriais/ambiente/fotos/ (entram no repositório: a
// semente as usa e regravar um vídeo não pode depender de gerar de novo).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const PASTA = path.join(aqui, "fotos");
const MODELO = process.env.TUTORIAL_FOTO_MODELO || "gemini-2.5-flash-image";

function chave() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  for (const arquivo of [process.env.TUTORIAL_ENV, "C:/Users/Micro/Documents/firehub-site/.env.local", "C:/Users/Micro/Documents/firehub-site/.env"]) {
    if (!arquivo || !fs.existsSync(arquivo)) continue;
    const linha = fs.readFileSync(arquivo, "utf8").split(/\r?\n/).find((l) => l.startsWith("GEMINI_API_KEY="));
    if (linha) return linha.slice("GEMINI_API_KEY=".length).replace(/^["']|["']$/g, "").trim();
  }
  throw new Error("GEMINI_API_KEY não encontrada.");
}

const CELULAR = "Foto realista tirada com celular, luz natural de cozinha, sem texto, sem marca, sem logotipo, sem pessoas a menos que pedido.";
const ROSTO = "Selfie realista de celular, rosto inteiro centralizado olhando para a câmera, enquadramento do peito para cima, fundo de cozinha de lanchonete desfocado, sem texto, sem logotipo. Pessoa fictícia.";

export const FOTOS = {
  // Tarefas dos checklists
  bancada: { tam: [960, 720], prompt: `${CELULAR} Bancada de inox de cozinha de lanchonete, limpa e seca, sem nada em cima.` },
  "bancada-suja": { tam: [960, 720], prompt: `${CELULAR} Bancada de inox de cozinha de lanchonete suja, com farelos de pão, uma faca e restos de molho espalhados.` },
  geladeira: { tam: [720, 960], prompt: `${CELULAR} Interior de geladeira industrial de lanchonete organizada, potes com tampa, e um termômetro digital pendurado mostrando 3 °C.` },
  chapa: { tam: [960, 720], prompt: `${CELULAR} Chapa de lanchonete desligada e raspada, limpa, com o botão do gás na posição desligado.` },
  piso: { tam: [720, 960], prompt: `${CELULAR} Piso de cerâmica de cozinha comercial limpo e seco, rodo encostado na parede.` },
  lixo: { tam: [720, 960], prompt: `${CELULAR} Duas lixeiras de pedal de cozinha comercial com as tampas fechadas e um saco de lixo amarrado ao lado.` },
  salao: { tam: [960, 720], prompt: `${CELULAR} Salão pequeno de lanchonete brasileira, mesas de madeira arrumadas, cadeiras alinhadas, chão limpo, de manhã antes de abrir.` },
  banheiro: { tam: [720, 960], prompt: `${CELULAR} Pia de banheiro de restaurante limpa, com sabonete líquido e papel toalha abastecidos.` },
  estoque: { tam: [720, 960], prompt: `${CELULAR} Prateleiras de estoque seco de lanchonete organizadas: pacotes de farinha, latas de molho, embalagens de papelão, tudo etiquetado.` },
  fritadeira: { tam: [960, 720], prompt: `${CELULAR} Fritadeira elétrica de inox de lanchonete com óleo limpo e cesto pendurado, tampa aberta.` },
  descarte: { tam: [960, 720], prompt: `${CELULAR} Bandeja de inox com quatro esfirras queimadas e escuras nas bordas, sobre a bancada, prontas para o descarte.` },
  // Rostos da equipe (selfie do ponto e foto do cadastro)
  "rosto-ana": { tam: [600, 800], prompt: `${ROSTO} Mulher brasileira de uns 28 anos, cabelo cacheado preso, touca de cozinha e dólmã branco, sorriso leve.` },
  "rosto-bruno": { tam: [600, 800], prompt: `${ROSTO} Homem brasileiro de uns 24 anos, cabelo curto, camiseta preta de uniforme de atendimento, sorrindo.` },
  "rosto-juliana": { tam: [600, 800], prompt: `${ROSTO} Mulher brasileira de uns 35 anos, cabelo liso escuro na altura do ombro, camisa polo vermelha de uniforme, sorriso simpático.` },
  "rosto-rafael": { tam: [600, 800], prompt: `${ROSTO} Homem brasileiro de uns 30 anos, barba curta, jaqueta de motoboy entregador, capacete na mão, fundo de calçada em frente à lanchonete.` },
  "rosto-lucas": { tam: [600, 800], prompt: `${ROSTO} Rapaz brasileiro de uns 19 anos, boné virado para trás e avental de cozinha, sorriso tímido.` },
  "rosto-fernanda": { tam: [600, 800], prompt: `${ROSTO} Mulher brasileira de uns 40 anos, gerente de lanchonete, cabelo castanho preso, camisa social escura, expressão confiante.` },
  "rosto-carlos": { tam: [600, 800], prompt: `${ROSTO} Homem brasileiro de uns 45 anos, dono de lanchonete, camisa polo cinza, cabelo grisalho curto, sorrindo.` },
  // Frota
  moto: { tam: [960, 720], prompt: `${CELULAR} Motocicleta de entrega vermelha estilo Honda CG 160 estacionada na calçada, com baú de entrega preto sem logotipo. Placa não legível.` },
  fiorino: { tam: [960, 720], prompt: `${CELULAR} Furgão utilitário pequeno branco estilo Fiat Fiorino estacionado em frente a uma lanchonete. Placa não legível.` },
};

async function gerar(nome, { prompt, tam }) {
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": chave() },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: tam[0] > tam[1] ? "4:3" : "3:4" } },
    }),
  });
  const j = await resp.json();
  const parte = j?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!parte) throw new Error(`${nome}: ${resp.status} ${JSON.stringify(j).slice(0, 300)}`);
  const destino = path.join(PASTA, `${nome}.jpg`);
  await sharp(Buffer.from(parte.inlineData.data, "base64")).resize(tam[0], tam[1], { fit: "cover" }).jpeg({ quality: 78 }).toFile(destino);
  return destino;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fs.mkdirSync(PASTA, { recursive: true });
  const pedidas = process.argv.slice(2);
  for (const [nome, f] of Object.entries(FOTOS)) {
    if (pedidas.length ? !pedidas.includes(nome) : fs.existsSync(path.join(PASTA, `${nome}.jpg`))) continue;
    try { console.log("ok", await gerar(nome, f)); } catch (e) { console.error("falhou", e.message); }
  }
}
