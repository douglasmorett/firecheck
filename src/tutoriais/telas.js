/**
 * Os tutoriais em vídeo do FireCheck — de qual tela é cada vídeo.
 *
 * ── Por que existe ──────────────────────────────────────────────────────────
 * Pedido do Douglas (10/2026): "a pessoa está com dúvida, assistiu". O dono,
 * o gestor e o funcionário abrem uma tela, não entendem um botão e chamam
 * alguém. O vídeo curto da própria tela responde na hora. É o mesmo desenho
 * dos tutoriais do FireHub (botão "Tutorial" na tela, central depois do login,
 * botão "Tutoriais em vídeo" no menu lateral).
 *
 * ── Uma lista só ────────────────────────────────────────────────────────────
 * A tela não declara o próprio vídeo: quem liga a tela ao vídeo é TELAS, logo
 * abaixo. Vídeo novo = o id dele na linha da tela (e em ORDEM, para a central).
 *
 * ── De onde vêm título, duração e capítulos ────────────────────────────────
 * De fichas.json, que NÃO se edita à mão: quem escreve é o
 * `tutoriais/publicar.mjs` a partir da gravação. Um vídeo só aparece se tiver
 * ficha. Com fichas.json = {} nenhum botão aparece e nada muda no app — o
 * código pode ir para produção antes dos vídeos.
 *
 * Formato de cada ficha (chave = id):
 *   { id, titulo, duracao (s), versao, publico: "gestor" | "funcionario",
 *     emPe (gravado em tela de celular), capitulos: [{ em (s), titulo }],
 *     texto (o que a voz fala, só para a busca) }
 */
import fichas from './fichas.json';

/**
 * Tela → vídeos, na ordem em que aparecem na janela.
 * - Abas do painel do dono/gestor (AdminDashboard): "admin:<chave da aba>".
 * - Telas com rota própria: a rota, sem os parâmetros (":id").
 */
export const TELAS = {
  // Painel do dono e do gestor (src/pages/AdminDashboard.jsx), pela aba aberta
  'admin:auditoria': ['firecheck-painel', 'firecheck-resultados'],
  'admin:ponto': ['firecheck-ponto-gestor'],
  'admin:notificacoes': ['firecheck-notificacoes'],
  'admin:ranking': ['firecheck-ranking'],
  'admin:alertas': ['firecheck-alertas', 'firecheck-resultados'],
  'admin:checklists': ['firecheck-checklists'],
  'admin:vehicles': ['firecheck-frota'],
  'admin:compras': ['firecheck-compras'],
  'admin:bill': ['firecheck-bill'],
  'admin:equipe': ['firecheck-equipe'],
  'admin:perfil': ['firecheck-perfil'],
  'admin:cameras': [],

  // Telas com rota própria
  '/admin/creator': ['firecheck-checklists'],
  '/funcionario': ['firecheck-fazer-checklist', 'firecheck-descarte'],
  '/ponto': ['firecheck-bater-ponto'],
  '/execucao': ['firecheck-fazer-checklist'],
  '/execucao/veiculo': ['firecheck-fazer-checklist'],
  '/execucao/compras': ['firecheck-compras-funcionario'],
};

/** O nome da tela no botão ("Tutorial Ranking") e no alto da janela. */
export const NOMES = {
  'admin:auditoria': 'Dashboard',
  'admin:ponto': 'Ponto',
  'admin:notificacoes': 'Notificações',
  'admin:ranking': 'Ranking',
  'admin:alertas': 'Alertas IA',
  'admin:checklists': 'Checklists',
  'admin:vehicles': 'Frota',
  'admin:compras': 'Compras',
  'admin:bill': 'Bill',
  'admin:equipe': 'Equipe',
  'admin:perfil': 'Perfil',
  'admin:cameras': 'Câmeras',
  '/admin/creator': 'Checklist',
  '/funcionario': 'Execução',
  '/ponto': 'Ponto',
  '/execucao': 'Checklist',
  '/execucao/veiculo': 'Vistoria',
  '/execucao/compras': 'Compras',
};

/**
 * A ordem da central de tutoriais: primeiro o que se usa todo dia. Vídeo com
 * ficha que não está aqui entra no fim do grupo dele, para nunca sumir.
 */
export const ORDEM = [
  // Para o dono e o gestor
  'firecheck-painel',
  'firecheck-checklists',
  'firecheck-resultados',
  'firecheck-equipe',
  'firecheck-ponto-gestor',
  'firecheck-alertas',
  'firecheck-ranking',
  'firecheck-notificacoes',
  'firecheck-compras',
  'firecheck-frota',
  'firecheck-bill',
  'firecheck-perfil',
  // Para a equipe
  'firecheck-fazer-checklist',
  'firecheck-bater-ponto',
  'firecheck-descarte',
  'firecheck-compras-funcionario',
];

export const GRUPOS = [
  { publico: 'gestor', titulo: 'Para o dono e o gestor' },
  { publico: 'funcionario', titulo: 'Para a equipe' },
];

/**
 * Onde os arquivos moram: no servidor do FireHub (outra origem, com CORS
 * liberado para o FireCheck). A versão é pasta, não ?v=: cada gravação tem
 * endereço próprio e o navegador nunca mostra o vídeo velho.
 */
export const BASE_DOS_TUTORIAIS = (import.meta.env.VITE_TUTORIAIS_URL || 'https://firehubfood.com.br/uploads/tutoriais').replace(/\/+$/, '');

export function arquivosDoTutorial(t) {
  const pasta = `${BASE_DOS_TUTORIAIS}/${t.id}/${t.versao}`;
  return { video: `${pasta}/video.mp4`, capa: `${pasta}/capa.jpg`, legendas: `${pasta}/legendas.vtt` };
}

// ── Chaves do navegador ────────────────────────────────────────────────────
/** Vídeo que a pessoa já começou a assistir (some a bolinha amarela). */
export const CHAVE_VISTO = 'firecheck_tutorial_visto:';
/** "Fechar" a central: vale até o próximo login (o Login apaga a marca). */
export const CHAVE_CENTRAL_FECHADA = 'firecheck_central_tutoriais_fechada:';
/** "Já vi, não mostrar mais": a central nunca mais abre sozinha neste aparelho. */
export const CHAVE_CENTRAL_NAO_MOSTRAR = 'firecheck_central_tutoriais_nao_mostrar:';
/** "Não mostrar mais nesta tela" da faixa do painel. */
export const CHAVE_FAIXA_OCULTA = 'firecheck_faixa_tutorial_oculta:';

/** Evento que abre a central (quem escuta: components/tutoriais/CentralDeTutoriais). */
export const ABRIR_CENTRAL = 'firecheck:abrir-central-de-tutoriais';

export function abrirCentralDeTutoriais() {
  window.dispatchEvent(new Event(ABRIR_CENTRAL));
}

export function lerChave(chave) {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

export function gravarChave(chave, valor) {
  try {
    if (valor == null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch { /* aparelho sem armazenamento: só não lembra */ }
}

export function foiVisto(id) {
  return lerChave(CHAVE_VISTO + id) === '1';
}

// ── Quem vê o quê ──────────────────────────────────────────────────────────
export function lerUsuario() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

/** A mesma régua do AdminDashboard: o master (Gestão de Clientes) não é lojista. */
export function ehMaster(usuario) {
  const email = String(usuario?.email || '').toLowerCase();
  return usuario?.role === 'master' || email === 'douglas@firecheck.com' || email === 'contatohakim@gmail.com';
}

export function ehFuncionario(usuario) {
  return usuario?.role === 'funcionario' || usuario?.role === 'employee';
}

/** Funcionário vê só os vídeos da equipe; dono e gestor veem os dois grupos; master, nenhum. */
export function publicosDoUsuario(usuario) {
  if (!usuario || ehMaster(usuario)) return [];
  if (ehFuncionario(usuario)) return ['funcionario'];
  return ['gestor', 'funcionario'];
}

/** Id da pessoa para as marcas do navegador (a central é por usuário). */
export function idDoUsuario(usuario) {
  return String(usuario?.id || usuario?.email || '');
}

const publicoDaFicha = (f) => (f.publico === 'funcionario' ? 'funcionario' : 'gestor');

function fichaValida(id) {
  const f = Object.prototype.hasOwnProperty.call(fichas, id) ? fichas[id] : null;
  if (!f || !f.versao) return null;
  return { ...f, id, capitulos: Array.isArray(f.capitulos) ? f.capitulos : [] };
}

/** Os vídeos da tela que esta pessoa pode ver, na ordem de TELAS. */
export function tutoriaisDaTela(tela, usuario) {
  const publicos = publicosDoUsuario(usuario);
  if (!publicos.length) return [];
  return (TELAS[tela] || [])
    .map(fichaValida)
    .filter((f) => f && publicos.includes(publicoDaFicha(f)));
}

export function nomeDaTela(tela) {
  return NOMES[tela] || '';
}

/** Todos os vídeos que esta pessoa pode ver, separados em grupos, na ordem da central. */
export function todosOsTutoriais(usuario) {
  const publicos = publicosDoUsuario(usuario);
  if (!publicos.length) return [];
  const ids = [...ORDEM, ...Object.keys(fichas).filter((id) => !ORDEM.includes(id))];
  const lista = ids.map(fichaValida).filter(Boolean);
  return GRUPOS
    .filter((g) => publicos.includes(g.publico))
    .map((g) => ({ ...g, tutoriais: lista.filter((f) => publicoDaFicha(f) === g.publico) }))
    .filter((g) => g.tutoriais.length > 0);
}

export function temTutoriais(usuario) {
  return todosOsTutoriais(usuario).length > 0;
}

/**
 * A central abre sozinha uma vez depois do login: só na primeira tela do
 * painel (/admin ou /funcionario), nunca no acesso remoto/Modo Simulação
 * (quem está ali é o dono testando, não a pessoa aprendendo), e não depois de
 * "Fechar" (até o próximo login) ou "Já vi, não mostrar mais" (nunca mais).
 */
export function centralAbreSozinha(usuario, pathname) {
  if (!['/admin', '/funcionario'].includes(String(pathname || '').replace(/\/+$/, ''))) return false;
  if (!temTutoriais(usuario)) return false;
  if (lerChave('firecheck_admin_backup')) return false;
  const id = idDoUsuario(usuario);
  if (!id) return false;
  return lerChave(CHAVE_CENTRAL_NAO_MOSTRAR + id) !== '1' && lerChave(CHAVE_CENTRAL_FECHADA + id) !== '1';
}

/** O Login chama ao entrar: "Fechar" vale só até o próximo login. */
export function esquecerCentralFechada(usuario) {
  const id = idDoUsuario(usuario);
  if (id) gravarChave(CHAVE_CENTRAL_FECHADA + id, null);
}

export const VELOCIDADES = [1, 1.25, 1.5];

/** Segundos de contagem antes de o próximo vídeo da tela começar sozinho. */
export const ESPERA_DO_PROXIMO = 6;

// ── Texto ──────────────────────────────────────────────────────────────────
/**
 * Os títulos sem o prefixo que todos os vídeos da tela repetem: no cartão,
 * "Checklists: criar com a IA" vira "Criar com a IA". Sem prefixo comum, fica
 * o título inteiro.
 */
export function titulosCurtos(tutoriais) {
  const prefixos = tutoriais.map((t) => /^([^:]{2,30}):\s+\S/.exec(t.titulo)?.[1] ?? null);
  const comum = tutoriais.length > 1 && prefixos[0] && prefixos.every((p) => p === prefixos[0]) ? prefixos[0] : null;
  return tutoriais.map((t) => {
    if (!comum) return t.titulo;
    const resto = t.titulo.slice(comum.length).replace(/^:\s+/, '');
    return resto.charAt(0).toUpperCase() + resto.slice(1);
  });
}

/** "3 min" — arredondado para cima: ninguém se sente enganado por sobrar tempo. */
export function duracaoEmMinutos(segundos) {
  return `${Math.max(1, Math.ceil((Number(segundos) || 0) / 60))} min`;
}

export function relogio(segundos) {
  const s = Math.max(0, Math.floor(Number(segundos) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Índice do capítulo que está passando no segundo dado. */
export function capituloNoSegundo(capitulos, segundo) {
  return capitulos.reduce((achado, c, i) => (segundo + 0.25 >= c.em ? i : achado), 0);
}
