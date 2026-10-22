// Nomes das batidas do dia e soma das horas, usados pela tela do funcionário,
// pela tela de bater ponto e pelo espelho do gestor.
//
// O ponto só grava 'entrada' e 'saida'. Quem almoça bate quatro vezes
// (entrada, saída almoço, volta do almoço, saída) e via na tela "Entrada" e
// "Saída" repetidos, sem saber qual era qual. O nome sai da posição no dia:
// 1ª Entrada, 2ª Saída almoço, 3ª Volta do almoço, 4ª Saída; da 5ª em diante,
// só Entrada/Saída. O mesmo critério está em rotuloDaBatida (api/index.js),
// que nomeia a batida no comprovante do WhatsApp.

/**
 * Nome de cada batida do dia, na ordem do horário.
 * comAlmoco: a escala do dia tem intervalo. Dia encerrado com só duas batidas
 * é jornada sem almoço — a 2ª fica "Saída". Enquanto o dia corre (emAndamento)
 * e a escala tem almoço, a 2ª batida é a saída para o almoço.
 */
export function rotulosDoDia(registros, { comAlmoco = false, emAndamento = false } = {}) {
  const tipos = (registros || []).map(r => r.type);
  return tipos.map((tipo, i) => {
    if (tipo === 'entrada') {
      return i === 2 && tipos[0] === 'entrada' && tipos[1] === 'saida' ? 'Volta do almoço' : 'Entrada';
    }
    if (i === 1 && tipos[0] === 'entrada') {
      const temVolta = tipos.length > 2;
      if (temVolta || (emAndamento && comAlmoco)) return 'Saída almoço';
    }
    return 'Saída';
  });
}

/** A próxima batida esperada hoje: { tipo: 'entrada'|'saida', rotulo }. */
export function proximaBatida(registros, { comAlmoco = false } = {}) {
  const lista = registros || [];
  const ultima = lista[lista.length - 1];
  const tipo = ultima && ultima.type === 'entrada' ? 'saida' : 'entrada';
  const rotulos = rotulosDoDia([...lista, { type: tipo }], { comAlmoco, emAndamento: true });
  return { tipo, rotulo: rotulos[rotulos.length - 1] };
}

/** Hora 'HH:MM' de uma batida, sem passar por new Date() (o banco já guarda a hora da loja). */
export function horaDaBatida(r) {
  if (!r) return null;
  if (r.hora_local) return r.hora_local;
  if (r.hora) return r.hora;
  const m = String(r.timestamp || '').match(/^\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2})/);
  return m ? m[1] : null;
}

/** Minutos trabalhados no dia: soma dos pares entrada→saída (o almoço fica fora). */
export function minutosTrabalhados(registros) {
  let total = 0;
  let aberta = null;
  for (const r of registros || []) {
    const h = horaDaBatida(r);
    if (!h) continue;
    const [hh, mm] = h.split(':').map(Number);
    const min = hh * 60 + mm;
    if (r.type === 'entrada') aberta = min;
    else if (r.type === 'saida' && aberta !== null) {
      total += min >= aberta ? min - aberta : min + 24 * 60 - aberta;
      aberta = null;
    }
  }
  return total;
}

/** 485 → "8h05"; -30 → "-0h30". */
export function formatarMinutos(min) {
  if (min === null || min === undefined) return '—';
  const sinal = min < 0 ? '-' : '';
  const abs = Math.abs(Math.round(min));
  return `${sinal}${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}`;
}
