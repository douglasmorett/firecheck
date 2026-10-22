// O aparelho em modo "ponto da loja" guarda aqui o token do quiosque (que só
// serve para bater ponto daquela loja). Com ele presente, o app abre direto
// na tela do ponto da loja — ver App.jsx.
export const GUARDA_DO_QUIOSQUE = 'firecheck_quiosque';

export function lerQuiosque() {
  try {
    const q = JSON.parse(localStorage.getItem(GUARDA_DO_QUIOSQUE) || 'null');
    return q && typeof q.token === 'string' && q.token.startsWith('fcq_') ? q : null;
  } catch {
    return null;
  }
}

export function esquecerQuiosque() {
  try { localStorage.removeItem(GUARDA_DO_QUIOSQUE); } catch { /* sem armazenamento: nada a apagar */ }
}
