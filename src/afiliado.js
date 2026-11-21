// Afiliado da Cakto que trouxe o cliente (Douglas, 12/11/2026): o teste grátis
// feito pelo site tem que contar para o aluno quando o cliente veio pelo link dele.
//
// O aluno divulga https://www.firecheckapp.com.br/?afiliado=<código> — o código é
// o que vem depois de "affiliate=" no link dele na Cakto. O site guarda o código,
// o cadastro grava na conta (users.cakto_afiliado) e todo link de pagamento da
// Cakto sai com ?affiliate=<código>, que é como a Cakto credita a comissão.

const CHAVE = 'fc_afiliado';
const valido = (c) => typeof c === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(c);

export function guardarAfiliado(codigo) {
  if (!valido(codigo)) return;
  try { localStorage.setItem(CHAVE, codigo); } catch { /* sem armazenamento: segue sem afiliado */ }
}

// Origem do anúncio (fbclid e utm_*): o cliente entra pela página inicial e só
// depois vai para a Cakto. Sem repassar, a venda chega sem saber de qual anúncio veio.
const CHAVE_ORIGEM = 'fc_origem';
const PARAMS_DE_ORIGEM = ['fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

export function guardarAfiliadoDaUrl() {
  try {
    const p = new URLSearchParams(window.location.search);
    guardarAfiliado(p.get('afiliado') || p.get('affiliate'));
    const origem = PARAMS_DE_ORIGEM.filter((k) => p.get(k)).map((k) => [k, p.get(k)]);
    if (origem.length) sessionStorage.setItem(CHAVE_ORIGEM, JSON.stringify(origem));
  } catch { /* URL estranha: ignora */ }
}

export function comOrigem(link) {
  try {
    const origem = JSON.parse(sessionStorage.getItem(CHAVE_ORIGEM) || '[]');
    const u = new URL(link);
    for (const [k, v] of origem) if (!u.searchParams.has(k)) u.searchParams.set(k, v);
    return u.toString();
  } catch {
    return link;
  }
}

// O da conta vale mais que o do aparelho: é o de quem trouxe o cliente no cadastro.
export function afiliadoAtual() {
  try {
    const daConta = JSON.parse(localStorage.getItem('user') || '{}').cakto_afiliado;
    if (valido(daConta)) return daConta;
    const doAparelho = localStorage.getItem(CHAVE);
    return valido(doAparelho) ? doAparelho : null;
  } catch {
    return null;
  }
}

export function comAfiliado(link) {
  const codigo = afiliadoAtual();
  if (!codigo || typeof link !== 'string' || !link.startsWith('https://pay.cakto.com.br/')) return link;
  try {
    const u = new URL(link);
    if (!u.searchParams.has('affiliate')) u.searchParams.set('affiliate', codigo);
    return u.toString();
  } catch {
    return link;
  }
}

// Os botões de pagamento do painel abrem a Cakto por window.open em vários
// lugares; em vez de mexer em cada um, o próprio window.open passa o link aqui.
export function ligarAfiliadoNosLinksDaCakto() {
  const abrir = window.open.bind(window);
  window.open = (url, ...resto) => abrir(comAfiliado(typeof url === 'string' ? url : url?.toString?.() ?? url), ...resto);
}
