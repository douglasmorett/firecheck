/**
 * Entrada e saída de estoque na tela simples do funcionário.
 *
 * Pedido da Pet Nature (Dany, 22/10/2026): a gerente usa a tela de funcionário
 * e queria lançar entrada e saída "no formato mais simples", igual à
 * conferência de estoque — uma lista de produtos com um campo de quantidade —,
 * sem a janela do gestor (EstoqueDaLista) com abas, custo e botões por item.
 *
 * Escolhe Entrada ou Saída, digita a quantidade só nos produtos que mudaram e
 * confirma tudo de uma vez. Cada produto vira um lançamento em
 * /api/shopping/movimento, o mesmo do gestor (o servidor confere perm_estoque).
 */
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Plus, Minus, CheckCircle } from 'lucide-react';
import API_URL from '../api';

const cabecalhos = () => ({
  'Content-Type': 'application/json',
  Authorization: 'Bearer ' + (localStorage.getItem('firecheck_token') || ''),
});

const numero = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const quantidade = (v) => parseFloat(String(v ?? '').replace(',', '.'));

const TIPOS = {
  entrada: { rotulo: 'Entrada', titulo: 'Chegou mercadoria', pergunta: 'Quanto chegou?', cor: '#10b981', fundo: 'rgba(16, 185, 129, 0.08)', Icone: Plus, obs: 'Fornecedor / nota (opcional)', exemplo: 'Ex.: NF 1234 — Distribuidora X' },
  saida: { rotulo: 'Saída', titulo: 'Saiu do estoque', pergunta: 'Quanto saiu?', cor: '#ef4444', fundo: 'rgba(239, 68, 68, 0.06)', Icone: Minus, obs: 'Motivo (opcional)', exemplo: 'Ex.: uso, perda, vencido' },
};

export default function EstoqueSimples({ lista, onFechar, onMudou }) {
  const [tipo, setTipo] = useState('entrada');
  const [itens, setItens] = useState([]);
  const [valores, setValores] = useState({});
  const [erros, setErros] = useState({});
  const [obs, setObs] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [feito, setFeito] = useState(null);
  const [historico, setHistorico] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/shopping/items?listId=${lista.id}`, { headers: cabecalhos() });
      const d = await r.json().catch(() => []);
      setItens(Array.isArray(d) ? d : []);
    } catch (e) {
      console.error('Erro ao carregar o estoque:', e);
    } finally {
      setCarregando(false);
    }
  }, [lista.id]);

  useEffect(() => { carregar(); }, [carregar]);

  const verHistorico = async () => {
    if (historico) { setHistorico(null); return; }
    try {
      const r = await fetch(`${API_URL}/api/shopping/movimentos?listId=${lista.id}`, { headers: cabecalhos() });
      const d = await r.json().catch(() => []);
      setHistorico(Array.isArray(d) ? d.slice(0, 30) : []);
    } catch {
      setHistorico([]);
    }
  };

  const trocarTipo = (novo) => {
    setTipo(novo);
    setErros({});
    setFeito(null);
  };

  const preenchidos = itens.filter((it) => quantidade(valores[it.id]) > 0);
  const t = TIPOS[tipo];

  const confirmar = async () => {
    if (!preenchidos.length || salvando) return;
    setSalvando(true);
    setErros({});
    setFeito(null);
    const novosErros = {};
    let lancados = 0;
    // Um por vez: a saída confere o saldo no servidor e o aviso de mínimo sai uma vez só.
    for (const it of preenchidos) {
      try {
        const r = await fetch(`${API_URL}/api/shopping/movimento`, {
          method: 'POST',
          headers: cabecalhos(),
          body: JSON.stringify({ itemId: it.id, tipo, quantidade: valores[it.id], custoUnitario: null, observacao: obs }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok) lancados++;
        else novosErros[it.id] = d.error || `Não foi possível lançar (erro ${r.status}).`;
      } catch {
        novosErros[it.id] = 'Erro de conexão. Tente de novo.';
      }
    }
    // Some o que entrou; fica na tela só o que deu erro, para corrigir.
    setValores((v) => Object.fromEntries(Object.entries(v).filter(([id]) => novosErros[id])));
    setErros(novosErros);
    if (lancados) {
      setFeito(`${t.rotulo} lançada: ${lancados} ${lancados === 1 ? 'produto' : 'produtos'}.`);
      setObs('');
      setHistorico(null);
      await carregar();
      onMudou?.();
    }
    setSalvando(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, backgroundColor: 'var(--bg-color, #f4f4f5)', overflowY: 'auto' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '16px 16px 120px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
          <button onClick={onFechar} aria-label="Voltar" style={{ flexShrink: 0, width: '44px', height: '44px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={20} color="#0f172a" />
          </button>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>{lista.title}</h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Entrada e saída de estoque</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
          {Object.entries(TIPOS).map(([chave, x]) => {
            const ativo = tipo === chave;
            return (
              <button key={chave} type="button" onClick={() => trocarTipo(chave)}
                style={{ padding: '14px 10px', borderRadius: '14px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                  border: `2px solid ${x.cor}`, backgroundColor: ativo ? x.cor : 'white', color: ativo ? 'white' : x.cor }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><x.Icone size={18} /> {x.rotulo}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.9 }}>{x.titulo}</span>
              </button>
            );
          })}
        </div>

        <p style={{ margin: '0 0 14px', padding: '12px 14px', borderRadius: '12px', backgroundColor: t.fundo, color: '#0f172a', fontSize: '0.88rem' }}>
          Digite a quantidade <strong>só nos produtos que {tipo === 'entrada' ? 'chegaram' : 'saíram'}</strong>. Os outros, deixe em branco.
        </p>

        {feito && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', padding: '12px 14px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#047857', fontWeight: 'bold', fontSize: '0.9rem' }}>
            <CheckCircle size={18} /> {feito}
          </div>
        )}

        {carregando ? (
          <p style={{ color: 'var(--text-muted)' }}>Carregando…</p>
        ) : itens.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Esta lista não tem produtos.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {itens.map((it) => {
              const un = it.unit || 'un';
              const contado = it.current_stock !== null && it.current_stock !== undefined;
              const saldo = contado ? parseFloat(it.current_stock) : null;
              const baixo = contado && saldo < parseFloat(it.min_stock || 0);
              const v = valores[it.id] ?? '';
              const q = quantidade(v);
              const depois = q > 0 ? (saldo || 0) + (tipo === 'entrada' ? q : -q) : null;
              return (
                <div key={it.id} style={{ padding: '16px', borderRadius: '16px', backgroundColor: 'white', border: `1px solid ${erros[it.id] ? '#ef4444' : q > 0 ? t.cor : '#e2e8f0'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                    <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{it.name}</strong>
                    <span style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      Tem agora
                      <strong style={{ display: 'block', fontSize: '1rem', color: baixo ? '#ef4444' : '#0f172a' }}>
                        {contado ? `${numero(saldo)} ${un}` : 'não contado'}
                      </strong>
                    </span>
                  </div>
                  <label style={{ display: 'block', margin: '10px 0 6px', fontSize: '0.85rem', fontWeight: 'bold', color: '#0f172a' }}>
                    {t.pergunta} ({un})
                  </label>
                  <input
                    inputMode="decimal"
                    className="input-field"
                    value={v}
                    onChange={(e) => { setValores({ ...valores, [it.id]: e.target.value }); setErros(({ [it.id]: _, ...resto }) => resto); }}
                    placeholder={`Quantidade em ${un}`}
                    style={{ width: '100%', padding: '12px 14px', fontSize: '1.05rem', fontWeight: 'bold', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)' }}
                  />
                  {depois !== null && !erros[it.id] && (
                    <span style={{ display: 'block', marginTop: '6px', fontSize: '0.8rem', color: depois < 0 ? '#ef4444' : 'var(--text-muted)' }}>
                      {depois < 0 ? `Saída maior que o que tem (${contado ? numero(saldo) : 0} ${un}). Confira a contagem.` : `Vai ficar com ${numero(depois)} ${un}.`}
                    </span>
                  )}
                  {erros[it.id] && <span style={{ display: 'block', marginTop: '6px', fontSize: '0.8rem', color: '#ef4444', fontWeight: 'bold' }}>{erros[it.id]}</span>}
                </div>
              );
            })}
          </div>
        )}

        <button type="button" onClick={verHistorico} style={{ marginTop: '18px', background: 'none', border: 'none', color: '#0891b2', fontWeight: 'bold', cursor: 'pointer', padding: 0, fontSize: '0.9rem' }}>
          {historico ? 'Esconder o histórico' : 'Ver o que já foi lançado'}
        </button>
        {historico && (
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {historico.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nada lançado ainda.</p>}
            {historico.map((m) => {
              const x = TIPOS[m.tipo];
              return (
                <div key={m.id} style={{ padding: '10px 12px', borderRadius: '10px', backgroundColor: 'white', borderLeft: `4px solid ${x ? x.cor : '#3b82f6'}`, fontSize: '0.85rem' }}>
                  <strong>{m.item_nome}</strong> · {x ? `${x.rotulo} ${m.tipo === 'entrada' ? '+' : '−'}` : 'Contagem ='}{numero(m.quantidade)} {m.unidade || 'un'}
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {m.usuario || '—'}{m.observacao ? ` · ${m.observacao}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rodapé fixo: o botão fica à mão no celular, com a lista comprida. */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, backgroundColor: 'white', borderTop: '1px solid #e2e8f0', padding: '12px 16px calc(12px + env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {preenchidos.length > 0 && (
            <input className="input-field" value={obs} onChange={(e) => setObs(e.target.value)} placeholder={`${t.obs} — ${t.exemplo}`}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.9rem' }} />
          )}
          <button type="button" className="btn" onClick={confirmar} disabled={!preenchidos.length || salvando}
            style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 'bold', border: 'none', borderRadius: '12px', color: 'white', backgroundColor: t.cor, opacity: !preenchidos.length || salvando ? 0.5 : 1 }}>
            {salvando ? 'Lançando…' : preenchidos.length
              ? `Confirmar ${t.rotulo.toLowerCase()} (${preenchidos.length} ${preenchidos.length === 1 ? 'produto' : 'produtos'})`
              : `Digite a quantidade de algum produto`}
          </button>
        </div>
      </div>
    </div>
  );
}
