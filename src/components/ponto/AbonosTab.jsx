import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, FileText, CalendarCheck } from 'lucide-react';
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', alignItems: 'start' }}>
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CalendarCheck size={20} color="var(--primary)" /> Lançar atestado, abono ou feriado
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 16px 0' }}>
          O dia lançado aparece marcado no espelho e não conta como falta.
        </p>
        <AbonoForm employees={employees} onSalvo={() => { carregar(); if (onAlterado) onAlterado(); }} />
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Lançados no mês</h3>
          <input type="month" className="input-field" style={{ width: 'auto' }} value={mes} onChange={e => setMes(e.target.value)} />
        </div>
        {erro && <p style={{ color: 'var(--error)', fontSize: '0.9rem' }}>{erro}</p>}
        {carregando ? (
          <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
        ) : lista.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nenhum atestado, abono ou feriado neste mês.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {lista.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '12px', backgroundColor: 'var(--bg-main)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 10px', borderRadius: '20px', backgroundColor: item.tipo === 'feriado' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(59, 130, 246, 0.12)', color: item.tipo === 'feriado' ? '#8B5CF6' : '#3B82F6' }}>{item.rotulo}</span>
                    <strong>{item.user_name || 'Toda a equipe'}</strong>
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {dataBR(item.data)}{item.data_fim ? ` a ${dataBR(item.data_fim)}` : ''}{item.observacao ? ` · ${item.observacao}` : ''}
                  </p>
                </div>
                {item.arquivo_url && (
                  <a href={item.arquivo_url} target="_blank" rel="noreferrer" title="Ver anexo" style={{ color: 'var(--primary)', display: 'flex' }}><FileText size={18} /></a>
                )}
                <button onClick={() => excluir(item)} title="Excluir" style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#EF4444', display: 'flex' }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
