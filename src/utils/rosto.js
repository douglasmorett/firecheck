// Reconhecimento do rosto para o ponto, feito NO APARELHO.
//
// Usa o @vladmandic/face-api (TensorFlow.js) com três modelos servidos de
// public/modelos-rosto: o detector "tiny" (~190 KB), os 68 pontos do rosto
// (~350 KB) e a rede que tira o descritor (~6,4 MB). A biblioteca entra por
// import() dinâmico: só baixa quem abre o cadastro do rosto ou o ponto da
// loja, e o resto do app não fica mais pesado.
//
// O descritor é um vetor de 128 números; dois rostos da mesma pessoa ficam a
// uma distância euclidiana pequena (abaixo de ~0,6). Só o descritor vai para
// o servidor — a foto do cadastro não é guardada.

export const MODELO_DO_ROSTO = 'face-api 1.7.15 (tiny + 68 + recognition)';

// Limiar conservador: o usual do face-api é 0,6; aqui é 0,45 e ainda com folga
// sobre o segundo mais parecido (ver escolherPessoa). Errar para "não
// reconheci" é barato (a pessoa usa a própria conta); bater o ponto na pessoa
// errada não. Nos rostos de teste (gerados por IA), duas mulheres diferentes
// ficaram a 0,44–0,46 uma da outra: 0,5 deixaria uma bater pela outra.
export const LIMIAR = 0.45;
export const MARGEM = 0.08;
export const PARECIDO = 0.6;

let carregando = null;

/** Carrega a biblioteca e os modelos uma vez só. */
export function carregarReconhecimento() {
  if (!carregando) {
    carregando = (async () => {
      const faceapi = await import('@vladmandic/face-api');
      // WebGL é o rápido; aparelho sem WebGL cai para a CPU (lento, mas funciona).
      try {
        await faceapi.tf.setBackend('webgl');
        await faceapi.tf.ready();
      } catch {
        await faceapi.tf.setBackend('cpu');
        await faceapi.tf.ready();
      }
      const base = `${import.meta.env.BASE_URL || '/'}modelos-rosto`;
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(base),
        faceapi.nets.faceLandmark68Net.loadFromUri(base),
        faceapi.nets.faceRecognitionNet.loadFromUri(base),
      ]);
      return faceapi;
    })().catch((e) => { carregando = null; throw e; });
  }
  return carregando;
}

/**
 * Todos os rostos da imagem/vídeo, cada um com descritor, caixa e "virada"
 * (quanto a cabeça está girada para o lado: ~0 de frente).
 */
export async function lerRostos(entrada, { tamanho = 416 } = {}) {
  const faceapi = await carregarReconhecimento();
  const opcoes = new faceapi.TinyFaceDetectorOptions({ inputSize: tamanho, scoreThreshold: 0.5 });
  const achados = await faceapi.detectAllFaces(entrada, opcoes).withFaceLandmarks().withFaceDescriptors();
  const larguraDaImagem = entrada.videoWidth || entrada.naturalWidth || entrada.width || 1;
  return achados.map((a) => ({
    descritor: Array.from(a.descriptor),
    caixa: a.detection.box,
    confianca: a.detection.score,
    // Fração da largura da imagem que o rosto ocupa: longe demais, o
    // descritor perde qualidade.
    tamanho: a.detection.box.width / larguraDaImagem,
    virada: viradaDoRosto(a.landmarks),
  }));
}

/**
 * Virada da cabeça pelos 68 pontos: onde a ponta do nariz cai entre as duas
 * bordas do rosto (contorno do queixo). De frente, no meio (≈0); girando,
 * vai para um lado (±0,1 a ±0,3). É a prova de vida simples do ponto da loja:
 * foto parada não vira o rosto.
 */
export function viradaDoRosto(landmarks) {
  const contorno = landmarks.getJawOutline();
  const nariz = landmarks.getNose()[3];
  const esquerda = contorno[0].x;
  const direita = contorno[contorno.length - 1].x;
  const largura = direita - esquerda;
  if (!largura) return 0;
  return (nariz.x - esquerda) / largura - 0.5;
}

export function distancia(a, b) {
  let soma = 0;
  for (let i = 0; i < a.length; i++) soma += (a[i] - b[i]) ** 2;
  return Math.sqrt(soma);
}

/**
 * Quem, da equipe cadastrada, este rosto é. Devolve:
 *   { pessoa, distancia }               — reconhecido (abaixo do limiar e com folga sobre o 2º)
 *   { ambiguo: true, distancia }        — parecido com alguém, mas sem segurança
 *   { desconhecido: true, distancia }   — ninguém parecido
 */
export function escolherPessoa(descritor, equipe, { ignorar = [] } = {}) {
  let melhor = null;
  let segunda = Infinity;
  for (const p of equipe) {
    if (ignorar.includes(p.id)) continue;
    const d = distancia(descritor, p.descritor);
    if (!melhor || d < melhor.distancia) {
      if (melhor) segunda = Math.min(segunda, melhor.distancia);
      melhor = { pessoa: p, distancia: d };
    } else if (d < segunda) {
      segunda = d;
    }
  }
  if (!melhor) return { desconhecido: true, distancia: Infinity };
  if (melhor.distancia < LIMIAR && segunda - melhor.distancia >= MARGEM) return melhor;
  if (melhor.distancia < PARECIDO) return { ambiguo: true, distancia: melhor.distancia };
  return { desconhecido: true, distancia: melhor.distancia };
}

/** Abre um arquivo/URL/dataURL como <img> pronta para o detector. */
export function abrirImagem(origem) {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => ok(img);
    img.onerror = () => erro(new Error('Não deu para abrir a imagem.'));
    img.src = origem;
  });
}
