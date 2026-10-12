/**
 * Busca da central de tutoriais: "como bater o ponto" → o vídeo do ponto,
 * com os capítulos que falam disso.
 *
 * Procura no título do vídeo, no título de cada capítulo e no que a voz fala
 * (o campo `texto` da ficha; se um dia o capítulo trouxer `texto` próprio,
 * ele também conta). Quem procura escreve do próprio jeito, então:
 * - sem acento e sem maiúscula ("funcionario" acha "Funcionário");
 * - palavra começando igual vale ("checklist" acha "checklists");
 * - palavras de ligação não contam ("como", "do", "de"...);
 * - sinônimos do dia a dia (app = aplicativo, funcionário = colaborador = equipe...).
 *
 * Toda palavra que conta tem que aparecer em algum lugar do vídeo.
 */

const LIGACAO = new Set(
  'a o as os de da do das dos e em no na nos nas um uma uns umas para pra pro com como que qual onde quando por pelo pela se eu meu minha sua seu ao aos tem ter fazer faz usar uso ver'.split(' '),
);

const SINONIMOS = [
  ['app', 'apps', 'aplicativo', 'aplicativos', 'celular'],
  ['funcionario', 'funcionarios', 'colaborador', 'colaboradores', 'equipe', 'empregado', 'empregados'],
  ['checklist', 'checklists', 'lista', 'listas', 'tarefa', 'tarefas'],
  ['ponto', 'jornada', 'bater', 'entrada', 'saida'],
  ['foto', 'fotos', 'imagem', 'imagens', 'camera'],
  ['descarte', 'descartes', 'perda', 'perdas', 'ocorrencia', 'ocorrencias'],
  ['compra', 'compras', 'estoque'],
  ['veiculo', 'veiculos', 'frota', 'carro', 'carros', 'moto', 'vistoria'],
  ['alerta', 'alertas', 'aviso', 'avisos', 'notificacao', 'notificacoes', 'whatsapp'],
  ['ia', 'inteligencia', 'robo'],
  ['senha', 'login', 'acesso', 'entrar'],
];
const GRUPO = new Map();
for (const g of SINONIMOS) for (const p of g) GRUPO.set(p, g);

export function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function termosDaBusca(busca) {
  return normalizar(busca)
    .split(' ')
    .filter((p) => p.length >= 2 && !LIGACAO.has(p))
    .map((p) => GRUPO.get(p) || [p]);
}

/** Alguma palavra do texto começa com alguma das formas? */
function aparece(palavras, formas) {
  return palavras.some((w) => formas.some((f) => w.startsWith(f)));
}

const palavras = (texto) => normalizar(texto).split(' ').filter(Boolean);

/** [{ tutorial, capitulos: [{ em, titulo }] }], do mais ao menos relevante. */
export function buscarNosTutoriais(busca, tutoriais) {
  const termos = termosDaBusca(busca);
  if (!termos.length) return [];
  const resultados = [];
  for (const t of tutoriais) {
    const titulo = palavras(t.titulo);
    const fala = palavras(t.texto);
    const caps = t.capitulos.map((c) => ({
      em: c.em,
      titulo: c.titulo,
      doTitulo: palavras(c.titulo),
      daFala: palavras(c.texto),
    }));
    let pontos = 0;
    let todos = true;
    for (const formas of termos) {
      const peso = aparece(titulo, formas) ? 3
        : caps.some((c) => aparece(c.doTitulo, formas)) ? 2
        : (aparece(fala, formas) || caps.some((c) => aparece(c.daFala, formas))) ? 1 : 0;
      if (!peso) { todos = false; break; }
      pontos += peso;
    }
    if (!todos) continue;
    const capitulos = caps
      .map((c) => ({
        c,
        acertos: termos.filter((f) => aparece(c.doTitulo, f)).length * 2 + termos.filter((f) => aparece(c.daFala, f)).length,
      }))
      .filter((x) => x.acertos > 0)
      .sort((a, b) => b.acertos - a.acertos || a.c.em - b.c.em)
      .slice(0, 3)
      .map((x) => ({ em: x.c.em, titulo: x.c.titulo }));
    resultados.push({ tutorial: t, capitulos, pontos: pontos + (capitulos.length ? 0.5 : 0) });
  }
  return resultados.sort((a, b) => b.pontos - a.pontos).map(({ tutorial, capitulos }) => ({ tutorial, capitulos }));
}
