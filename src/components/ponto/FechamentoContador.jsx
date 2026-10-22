import React, { useState, useEffect, useCallback } from 'react';
import { Send, History } from 'lucide-react';
import API_URL from '../../api';

// Envio do fechamento do ponto ao contador (fica no card "Automação Contábil").
// O servidor manda sozinho, toda manhã, o período que acabou de fechar
// (/api/cron/ponto-fechamento). Aqui o dono vê para quem e quando vai, manda na
// hora se precisar (ex.: corrigiu uma batida depois do envio) e vê o histórico.

const auth = () => ({ 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') });
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '');
const periodoBR = (p) => (p ? `${dataBR(p.inicio)} a ${dataBR(p.fim)}` : '');

const SITUACAO = {
  enviado: ['Enviado', '#10B981'],
  erro: ['Não enviado', '#EF4444'],
  ignorado: ['Não enviado', 'var(--text-muted)'],
  enviando: ['Enviando…', '#F59E0B'],
};

export default function FechamentoContador({ userProfile, versao }) {
  const [info, setInfo] = useState(null);
  const [periodo, setPeriodo] = useState('fechado');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const store = userProfile?.store || '';
  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/ponto/fechamento?store=${encodeURIComponent(store)}`, { headers: auth() });
      if (res.ok) setInfo(await res.json());
    } catch { /* sem conexão: o card fica sem o quadro de envio */ }
  }, [store]);

  useEffect(() => { if (store) carregar(); }, [store, versao, carregar]);

  const enviarAgora = async () => {
    setEnviando(true);
    setAviso(null);
    try {
      const res = await fetch(`${API_URL}/api/ponto/fechamento?store=${encodeURIComponent(store)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ periodo }),
      });
      const d = await res.json().catch(() => ({}));
      setAviso(res.ok
        ? { ok: true, texto: `Enviado para ${d.para.join(', ')} (${dataBR(d.inicio)} a ${dataBR(d.fim)}).` }
        : { ok: false, texto: d.error || 'Não foi possível enviar.' });
    } catch {
      setAviso({ ok: false, texto: 'Erro de conexão.' });
    }
    setEnviando(false);
    carregar();
  };

  if (!info) return null;
  const temEmail = info.para.length > 0;

  return (
    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {!info.envio_configurado && (
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#F59E0B' }}>
          O envio de e-mail ainda não foi ativado no FireCheck. Avise o suporte.
        </p>
      )}
      {temEmail ? (
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          📧 O fechamento de <strong>{periodoBR(info.periodo_atual)}</strong> vai sozinho para <strong>{info.para.join(', ')}</strong> em <strong>{dataBR(info.proximo_envio)}</strong>, de manhã: espelho de ponto em PDF e planilha para Excel.
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Para o fechamento ir sozinho ao contador, preencha o <strong>E-mail do Contador</strong> acima e clique em <strong>Salvar Automação</strong>. Pode pôr mais de um, separados por vírgula.
        </p>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <select className="input-field" value={periodo} onChange={e => setPeriodo(e.target.value)} style={{ flex: 1, minWidth: '200px' }}>
          <option value="fechado">Último fechamento ({periodoBR(info.ultimo_fechado)})</option>
          {info.parcial && <option value="parcial">Período atual até ontem ({periodoBR(info.parcial)})</option>}
        </select>
        <button className="btn-secondary" onClick={enviarAgora} disabled={!temEmail || enviando} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Send size={16} /> {enviando ? 'Enviando...' : 'Enviar agora para o contador'}
        </button>
      </div>
      {aviso && <p style={{ margin: 0, fontSize: '0.85rem', color: aviso.ok ? '#10B981' : 'var(--error)' }}>{aviso.texto}</p>}

      {info.historico.length > 0 && (
        <div>
          <p style={{ margin: '4px 0 6px 0', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
            <History size={14} /> Últimos envios
          </p>
          {info.historico.map(h => {
            const [rotulo, cor] = SITUACAO[h.status] || [h.status, 'var(--text-muted)'];
            return (
              <div key={`${h.inicio}-${h.fim}`} style={{ fontSize: '0.8rem', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: cor, fontWeight: 'bold' }}>{rotulo}</span>
                {' · '}{periodoBR(h)} · {new Date(h.enviado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                {' · '}{h.enviado_por === 'automático' ? 'automático' : `por ${h.enviado_por}`}
                <div style={{ color: 'var(--text-muted)' }}>{h.para}{h.motivo ? ` — ${h.motivo}` : ''}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
