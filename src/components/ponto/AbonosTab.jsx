import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, FileText } from 'lucide-react';
import API_URL from '../../api';
import AbonoForm from './AbonoForm';

// Aba "Atestados e Feriados" do ponto: lançar e ver o que foi lançado no mês.
const auth = () => ({ 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') });
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '');
const ultimoDiaDoMes = (mes) => {
  const [a, m] = mes.split('-').map(Number);
  return `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`;
};

export default function AbonosTab({ employees, onAlterado }) {
  const [mes, setMes] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7));
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`${API_URL}/api/ponto/abonos?inicio=${mes}-01&fim=${ultimoDiaDoMes(mes)}`, { headers: auth() });
      const dados = await res.json().catch(() => []);
      if (res.ok && Array.isArray(dados)) { setLista(dados); setErro(''); }
      else setErro(dados.error || 'Não foi possível carregar os lançamentos.');
    } catch {
      setErro('Erro de conexão.');
    }
    setCarregando(false);
  }, [mes]);

  useEffect(() => { carregar(); }, [carregar]);

  const excluir = async (item) => {
    const quem = item.user_name || 'toda a equipe';
    if (!window.confirm(`Excluir ${item.rotulo} de ${quem} em ${dataBR(item.data)}? O dia volta a contar normalmente no espelho.`)) return;
    const res = await fetch(`${API_URL}/api/ponto/abonos?id=${item.id}`, { method: 'DELETE', headers: auth() });
    if (res.ok) { carregar(); if (onAlterado) onAlterado(); }
    else {
      const d = await res.json().catch(() => ({}));
      setErro(d.error || 'Não foi possível excluir.');
    }
  };

  return (
    <div className="pt-grade">
      <div className="card pt-card">
        <div className="pt-card-cab">
          <div>
            <span className="fc-olho-rot">Novo lançamento</span>
            <h3>Lançar atestado, abono ou feriado</h3>
            <p>O dia lançado aparece marcado no espelho e não conta como falta.</p>
          </div>
        </div>
        <AbonoForm employees={employees} onSalvo={() => { carregar(); if (onAlterado) onAlterado(); }} />
      </div>

      <div className="card pt-card pt-lista" style={{ gap: '6px' }}>
        <div className="pt-card-cab" style={{ padding: '14px 14px 6px', alignItems: 'center' }}>
          <div>
            <span className="fc-olho-rot">Histórico</span>
            <h3>Lançados no mês</h3>
          </div>
          <label className="pt-periodo">
            Mês
            <input type="month" value={mes} onChange={e => setMes(e.target.value)} />
          </label>
        </div>
        {erro && <p className="pt-erro" style={{ margin: '0 14px' }}>{erro}</p>}
        {carregando ? (
          <div className="fc-vazio">Carregando...</div>
        ) : lista.length === 0 ? (
          <div className="fc-vazio">Nenhum atestado, abono ou feriado neste mês.</div>
        ) : (
          <div>
            {lista.map(item => (
              <div key={item.id} className="fc-lin pt-simples">
                <div style={{ minWidth: 0 }}>
                  <div className="fc-t">
                    {item.user_name || 'Toda a equipe'}
                    <span className="fc-dado" style={{ '--c': item.tipo === 'feriado' ? 'var(--primary)' : 'var(--info)' }}>{item.rotulo}</span>
                  </div>
                  <div className="fc-m">
                    <span className="mono">{dataBR(item.data)}{item.data_fim ? ` a ${dataBR(item.data_fim)}` : ''}</span>{item.observacao ? ` · ${item.observacao}` : ''}
                  </div>
                </div>
                <div className="pt-mini-acoes">
                  {item.arquivo_url && (
                    <a href={item.arquivo_url} target="_blank" rel="noreferrer" title="Ver anexo" className="fc-mini-btn info" style={{ textDecoration: 'none' }}><FileText size={13} /> Anexo</a>
                  )}
                  <button type="button" className="fc-mini-btn perigo" onClick={() => excluir(item)} title="Excluir" aria-label="Excluir"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
