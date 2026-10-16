/**
 * A resposta de uma tarefa do checklist em texto, para o painel e o PDF.
 *
 * Cada tipo grava `done` de um jeito: "lista de itens" guarda as POSIÇÕES das
 * opções marcadas ([0, 1, 4]), "estrelas" guarda o número, "múltipla escolha"
 * guarda a opção. Mostrar `done` cru imprimia "01234" no lugar dos nomes, e o
 * PDF reduzia tudo a Sim/Não.
 *
 * Devolve { texto, itens, tom }: `itens` só existe na lista de itens (cada
 * opção com marcado sim/não) e `tom` é 'ok', 'falha' ou 'neutro'.
 */
const vazio = (v) => v === null || v === undefined || v === '';

export function respostaDaTarefa(task) {
  const d = task?.done;
  const tipo = task?.type;
  const unidade = task?.unit ? ` ${task.unit}` : '';

  if (tipo === 'itemlist') {
    const opcoes = Array.isArray(task.options) ? task.options : [];
    const marcados = new Set((Array.isArray(d) ? d : []).map(Number));
    const itens = opcoes.map((nome, i) => ({ nome: String(nome || `Item ${i + 1}`), marcado: marcados.has(i) }));
    // Posição marcada que não existe mais nas opções (checklist editado depois).
    for (const i of marcados) if (i >= opcoes.length) itens.push({ nome: `Item ${i + 1}`, marcado: true });
    const feitos = itens.filter((i) => i.marcado);
    if (feitos.length === 0) return { texto: 'Nenhum item marcado', itens, tom: 'falha' };
    return {
      texto: `${feitos.length} de ${itens.length}: ${feitos.map((i) => i.nome).join(', ')}`,
      itens,
      tom: feitos.length === itens.length ? 'ok' : 'falha',
    };
  }
  if (tipo === 'rating') {
    if (vazio(d)) return { texto: 'Sem avaliação', tom: 'neutro' };
    const n = Math.max(0, Math.min(5, Number(d) || 0));
    return { texto: `${'★'.repeat(n)}${'☆'.repeat(5 - n)} (${n} de 5)`, tom: n >= 3 ? 'ok' : 'falha' };
  }
  if (tipo === 'numeric' || tipo === 'stock') {
    if (vazio(d)) return { texto: 'Não informado', tom: 'neutro' };
    return { texto: `${String(d).replace('.', ',')}${unidade}`, tom: 'neutro' };
  }
  if (tipo === 'multiple' || tipo === 'text') {
    if (vazio(d)) return { texto: 'Sem resposta', tom: 'neutro' };
    return { texto: String(d), tom: 'neutro' };
  }

  // Sim/Não, "feito" e tipos antigos sem `type`.
  if (d === true) return { texto: 'Sim', tom: 'ok' };
  if (d === false) return { texto: 'Não', tom: 'falha' };
  if (vazio(d)) return { texto: 'Sem resposta', tom: 'neutro' };
  if (Array.isArray(d)) return { texto: d.join(', '), tom: 'neutro' };
  return { texto: `${String(d)}${typeof d === 'number' ? unidade : ''}`, tom: 'neutro' };
}
