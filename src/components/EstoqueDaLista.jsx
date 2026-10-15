/**
 * Estoque de uma lista de Compras e Estoque (api › /api/shopping/movimento[s]).
 *
 * A contagem diária da equipe continua gravando o saldo contado. Aqui o gestor
 * lança o que muda entre uma contagem e outra: a ENTRADA de mercadoria (com
 * custo e fornecedor/nota) e a SAÍDA (uso, perda, vencido). Tudo fica no
 * histórico de movimentações, junto com as contagens.
 */
import { useCallback, useEffect, useState } from 'react';
import { X, Package, Plus, Minus } from 'lucide-react';
import API_URL from '../api';

const cabecalhos = () => ({
  'Content-Type': 'application/json',
  Authorization: 'Bearer ' + (localStorage.getItem('firecheck_token') || ''),
});

const numero = (n) => (n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 }));
const reais = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TIPOS = {
  entrada: { rotulo: 'Entrada', sinal: '+', cor: '#10b981' },
  saida: { rotulo: 'Saída', sinal: '−', cor: '#ef4444' },
  contagem: { rotulo: 'Contagem', sinal: '=', cor: '#3b82f6' },
};

const campo = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.95rem' };

export default function EstoqueDaLista({ lista, onFechar, onMudou }) {
  const [aba, setAba] = useState('saldo');
  const [itens, setItens] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [lancando, setLancando] = useState(null); // { itemId, tipo }
  const [form, setForm] = useState({ quantidade: '', custo: '', obs: '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      const [ri, rm] = await Promise.all([
        fetch(`${API_URL}/api/shopping/items?listId=${lista.id}`, { headers: cabecalhos() }),
        fetch(`${API_URL}/api/shopping/movimentos?listId=${lista.id}`, { headers: cabecalhos() }),
      ]);
      const di = await ri.json().catch(() => []);
      const dm = await rm.json().catch(() => []);
      setItens(Array.isArray(di) ? di : []);
      setMovimentos(Array.isArray(dm) ? dm : []);
    } catch (e) {
      console.error('Erro ao carregar o estoque:', e);
    } finally {
      setCarregando(false);
    }
  }, [lista.id]);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirLancamento = (itemId, tipo) => {
    setErro('');
    setForm({ quantidade: '', custo: '', obs: '' });
    setLancando({ itemId, tipo });
  };

  const confirmar = async () => {
    if (!lancando || salvando) return;
    setSalvando(true);
    setErro('');
    try {
      const res = await fetch(`${API_URL}/api/shopping/movimento`, {
        method: 'POST',
        headers: cabecalhos(),
        body: JSON.stringify({
          itemId: lancando.itemId,
          tipo: lancando.tipo,
          quantidade: form.quantidade,
          custoUnitario: lancando.tipo === 'entrada' ? form.custo : null,
          observacao: form.obs,
        }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(dados.error || `Não foi possível lançar (erro ${res.status}).`);
        return;
      }
      setLancando(null);
      await carregar();
      onMudou?.();
    } catch {
      setErro('Erro de conexão. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const abaixo = (it) => it.current_stock !== null && it.current_stock !== undefined && parseFloat(it.current_stock) < parseFloat(it.min_stock || 0);

  return (
    // Sobreposição com estilo próprio: a classe modal-overlay não tem CSS e
    // desenhava a janela no fim da página, longe de onde a pessoa clicou.
    <div onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 10000, padding: '5vh 12px 12px', backdropFilter: 'blur(4px)' }}>
      <div className="card animate-scale modal-janela" style={{ maxWidth: '760px', width: '100%', maxHeight: '90vh', overflow: 'auto', padding: '24px', backgroundColor: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={20} /> Estoque — {lista.title}
          </h3>
          <button onClick={onFechar} aria-label="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {[['saldo', 'Saldo e lançamentos'], ['historico', 'Movimentações']].map(([chave, rotulo]) => (
            <button key={chave} onClick={() => setAba(chave)}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                backgroundColor: aba === chave ? 'var(--primary)' : 'transparent', color: aba === chave ? 'white' : 'var(--text-main)' }}>
              {rotulo}
            </button>
          ))}
        </div>

        {carregando ? (
          <p style={{ color: 'var(--text-muted)' }}>Carregando…</p>
        ) : aba === 'saldo' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              A contagem diária da equipe acerta o saldo. Entre uma contagem e outra, lance aqui a mercadoria que chegou e o que saiu.
            </p>
            {itens.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Esta lista não tem itens.</p>}
            {itens.map((it) => {
              const baixo = abaixo(it);
              const aberto = lancando && lancando.itemId === it.id;
              return (
                <div key={it.id} style={{ padding: '14px 16px', borderRadius: '10px', backgroundColor: baixo ? 'rgba(239, 68, 68, 0.06)' : 'var(--bg-color)', border: `1px solid ${baixo ? '#ef4444' : 'var(--border-color)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: '160px', flex: 1 }}>
                      <strong>{it.name}</strong>
                      <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Mínimo: {numero(it.min_stock)} {it.unit || 'un'}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 'bold', color: baixo ? '#ef4444' : 'var(--text-main)' }}>
                        {it.current_stock === null || it.current_stock === undefined ? 'Não contado' : `${numero(it.current_stock)} ${it.unit || 'un'}`}
                      </span>
                      {baixo && <span style={{ display: 'block', fontSize: '0.75rem', color: '#ef4444', fontWeight: 'bold' }}>Abaixo do mínimo</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => abrirLancamento(it.id, 'entrada')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '8px', border: '1px solid #10b981', color: '#10b981', background: 'transparent', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                        <Plus size={14} /> Entrada
                      </button>
                      <button onClick={() => abrirLancamento(it.id, 'saida')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '8px', border: '1px solid #ef4444', color: '#ef4444', background: 'transparent', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                        <Minus size={14} /> Saída
                      </button>
                    </div>
                  </div>

                  {aberto && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flex: '1 1 180px' }}>
                        {lancando.tipo === 'entrada' ? 'Quantidade que chegou' : 'Quantidade que saiu'} ({it.unit || 'un'})
                        <input autoFocus inputMode="decimal" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} style={campo} placeholder="Ex.: 10" />
                      </label>
                      {lancando.tipo === 'entrada' && (
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flex: '1 1 180px' }}>
                          Custo por {it.unit || 'un'} (R$, opcional)
                          <input inputMode="decimal" value={form.custo} onChange={(e) => setForm({ ...form, custo: e.target.value })} style={campo} placeholder="Ex.: 12,50" />
                        </label>
                      )}
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flex: '1 1 180px' }}>
                        {lancando.tipo === 'entrada' ? 'Fornecedor / nota (opcional)' : 'Motivo (opcional)'}
                        <input value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} style={campo} placeholder={lancando.tipo === 'entrada' ? 'Ex.: NF 1234 — Distribuidora X' : 'Ex.: uso, perda, vencido'} />
                      </label>
                      <div style={{ flexBasis: '100%', display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                        {erro && <span style={{ color: '#ef4444', fontSize: '0.85rem', marginRight: 'auto' }}>{erro}</span>}
                        <button className="btn-secondary" onClick={() => setLancando(null)} style={{ padding: '8px 14px' }}>Cancelar</button>
                        <button className="btn" onClick={confirmar} disabled={salvando} style={{ padding: '8px 16px' }}>
                          {salvando ? 'Lançando…' : lancando.tipo === 'entrada' ? 'Confirmar entrada' : 'Confirmar saída'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {movimentos.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Nenhuma movimentação ainda. Entradas, saídas e contagens aparecem aqui.</p>}
            {movimentos.map((m) => {
              const t = TIPOS[m.tipo] || TIPOS.contagem;
              return (
                <div key={m.id} style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-color)', borderLeft: `4px solid ${t.cor}`, display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <strong>{m.item_nome}</strong>
                    <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · {m.usuario || '—'}
                    </span>
                    {m.observacao && <span style={{ display: 'block', fontSize: '0.8rem', marginTop: '2px' }}>📝 {m.observacao}</span>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 'bold', color: t.cor }}>
                      {t.rotulo} {t.sinal}{numero(m.quantidade)} {m.unidade || 'un'}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Saldo: {numero(m.saldo_antes)} → {numero(m.saldo_depois)}
                    </span>
                    {m.custo_unitario !== null && m.custo_unitario !== undefined && (
                      <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {reais(m.custo_unitario)}/{m.unidade || 'un'} · total {reais(Number(m.custo_unitario) * Number(m.quantidade))}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
