import { useEffect, useState } from 'react';
import { KeyRound, Download } from 'lucide-react';
import API_URL from '../api';

// Tela do master: gera lotes de códigos de ativação (venda no Mercado Livre) e
// baixa o .txt com um código por linha, o formato do Mercado Turbo.
const cabecalhos = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('firecheck_token') || '') });
const NOMES = { checklists: 'Checklist inteligente', ponto: 'Controle de ponto' };

function baixar(nome, linhas) {
  const url = URL.createObjectURL(new Blob([linhas.join('\n') + '\n'], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `codigos-${nome}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CodigosDeAtivacao({ addToast }) {
  const [lotes, setLotes] = useState([]);
  const [novo, setNovo] = useState({ produto: 'checklists', quantidade: 50, dias: 30, lote: '' });
  const [gerando, setGerando] = useState(false);

  const carregar = () => fetch(`${API_URL}/api/codigos-ativacao`, { headers: cabecalhos() })
    .then((r) => r.json()).then((d) => setLotes(d.lotes || [])).catch(() => {});
  useEffect(() => { carregar(); }, []);

  const gerar = async () => {
    setGerando(true);
    try {
      const r = await fetch(`${API_URL}/api/codigos-ativacao`, { method: 'POST', headers: cabecalhos(), body: JSON.stringify(novo) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falhou.');
      baixar(d.lote, d.codigos);
      addToast?.(`${d.codigos.length} códigos gerados (lote ${d.lote}).`, 'success');
      carregar();
    } catch (e) {
      addToast?.(e.message, 'error');
    } finally {
      setGerando(false);
    }
  };

  // Só os que ainda não foram usados: é isso que vai para o Mercado Turbo.
  const baixarLivres = async (lote) => {
    const d = await fetch(`${API_URL}/api/codigos-ativacao?lote=${encodeURIComponent(lote)}`, { headers: cabecalhos() }).then((r) => r.json());
    baixar(`${lote}-livres`, (d.codigos || []).filter((c) => !c.usado_em).map((c) => c.codigo));
  };

  return (
    <div className="card">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <KeyRound size={20} color="var(--primary)" /> Códigos de ativação (Mercado Livre)
      </h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
        Cada código ativa uma conta uma vez, em firecheckapp.com.br/ativar. O arquivo baixado tem um código por linha.
      </p>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '24px' }}>
        <label>
          <span className="input-label">Produto</span>
          <select className="input-field" value={novo.produto} onChange={(e) => setNovo({ ...novo, produto: e.target.value })}>
            <option value="checklists">Checklist inteligente</option>
            <option value="ponto">Controle de ponto</option>
          </select>
        </label>
        <label>
          <span className="input-label">Quantidade</span>
          <input className="input-field" type="number" min="1" max="1000" style={{ width: '110px' }} value={novo.quantidade} onChange={(e) => setNovo({ ...novo, quantidade: e.target.value })} />
        </label>
        <label>
          <span className="input-label">Dias</span>
          <input className="input-field" type="number" min="1" max="366" style={{ width: '90px' }} value={novo.dias} onChange={(e) => setNovo({ ...novo, dias: e.target.value })} />
        </label>
        <label style={{ flex: 1, minWidth: '160px' }}>
          <span className="input-label">Nome do lote (opcional)</span>
          <input className="input-field" placeholder="ml-out-2026" value={novo.lote} onChange={(e) => setNovo({ ...novo, lote: e.target.value })} />
        </label>
        <button className="btn" disabled={gerando} onClick={gerar}>{gerando ? 'Gerando...' : 'Gerar e baixar'}</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
              <th style={{ padding: '8px' }}>Lote</th><th>Produto</th><th>Dias</th><th>Usados</th><th>Criado em</th><th></th>
            </tr>
          </thead>
          <tbody>
            {lotes.map((l) => (
              <tr key={`${l.lote}-${l.produto}-${l.dias}`} style={{ borderTop: '1px solid var(--border-color)' }}>
                <td style={{ padding: '8px', fontFamily: 'monospace' }}>{l.lote}</td>
                <td>{NOMES[l.produto] || l.produto}</td>
                <td>{l.dias}</td>
                <td>{l.usados} de {l.total}</td>
                <td>{new Date(l.criado_em).toLocaleDateString('pt-BR')}</td>
                <td>
                  <button className="btn-secondary" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => baixarLivres(l.lote)}>
                    <Download size={14} /> Livres
                  </button>
                </td>
              </tr>
            ))}
            {lotes.length === 0 && <tr><td colSpan="6" style={{ padding: '12px', color: 'var(--text-muted)' }}>Nenhum lote ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
