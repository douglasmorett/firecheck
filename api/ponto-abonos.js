// O tipo antigo permanece com o efeito já lançado no histórico. Novos
// pedidos, inclusive de versões antigas do app, usam a justificativa sem abono.
export const FALTA_JUSTIFICADA_SEM_ABONO = 'falta_justificada_sem_abono';

export const TIPOS_DE_ABONO = Object.freeze({
  atestado: 'Atestado',
  falta_justificada: 'Falta justificada (horas abonadas)',
  [FALTA_JUSTIFICADA_SEM_ABONO]: 'Falta justificada (sem abono de horas)',
  folga_compensada: 'Folga compensada',
  feriado: 'Feriado',
});

/** Canoniza só a escrita nova: nunca converte registros já salvos. */
export function tipoParaNovoAbono(tipo) {
  if (typeof tipo !== 'string' || !Object.hasOwn(TIPOS_DE_ABONO, tipo)) return null;
  return tipo === 'falta_justificada' ? FALTA_JUSTIFICADA_SEM_ABONO : tipo;
}

/** Justificar a ausência não cria crédito de horas. O tipo legado conserva
 * o abono anterior para não recalcular silenciosamente o banco já fechado. */
export function minutosAbonadosDoLancamento(abono, esperado) {
  return abono && ['atestado', 'falta_justificada', 'feriado'].includes(abono.tipo) ? esperado : 0;
}
