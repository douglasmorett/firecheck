import React, { useState, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import API_URL from '../../api';

// Envio do fechamento do ponto ao contador (fica no card "Automação Contábil").
// O servidor manda sozinho, toda manhã, o período que acabou de fechar
// (/api/cron/ponto-fechamento). Aqui o dono vê para quem e quando vai, manda na
// hora se precisar (ex.: corrigiu uma batida depois do envio) e vê o histórico.

const auth = () => ({ 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') });
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '');
const periodoBR = (p) => (p ? `${dataBR(p.inicio)} a ${dataBR(p.fim)}` : '');

const SITUACAO = {
  enviado: ['Enviado', 'var(--ok)'],
  erro: ['Não enviado', 'var(--bad)'],
  ignorado: ['Não enviado', 'var(--text-muted)'],
  enviando: ['Enviando…', 'var(--warning)'],
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
    <div style={{ boxShadow: '0 -1px 0 var(--border-color)', paddingTop: '18px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <span className="fc-olho-rot">Envio ao contador</span>
      {!info.envio_configurado && (
        <p className="pt-aviso">O envio de e-mail ainda não foi ativado no FireCheck. Avise o suporte.</p>
      )}
      {temEmail ? (
        <p className="pt-nota">
          O fechamento de <strong className="mono" style={{ color: 'var(--text-main)' }}>{periodoBR(info.periodo_atual)}</strong> vai sozinho para <strong style={{ color: 'var(--text-main)' }}>{info.para.join(', ')}</strong> em <strong className="mono" style={{ color: 'var(--text-main)' }}>{dataBR(info.proximo_envio)}</strong>, de manhã: espelho de ponto em PDF e planilha para Excel.
        </p>
      ) : (
        <p className="pt-nota">
          Para o fechamento ir sozinho ao contador, preencha o <strong style={{ color: 'var(--text-main)' }}>E-mail do Contador</strong> acima e clique em <strong style={{ color: 'var(--text-main)' }}>Salvar Automação</strong>. Pode pôr mais de um, separados por vírgula.
        </p>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="input-field" value={periodo} onChange={e => setPeriodo(e.target.value)} style={{ flex: 1, minWidth: '200px' }}>
          <option value="fechado">Último fechamento ({periodoBR(info.ultimo_fechado)})</option>
          {info.parcial && <option value="parcial">Período atual até ontem ({periodoBR(info.parcial)})</option>}
        </select>
        <button type="button" className="fc-mini-btn info" onClick={enviarAgora} disabled={!temEmail || enviando} style={{ padding: '9px 14px', fontSize: '12.5px' }}>
          <Send size={14} /> {enviando ? 'Enviando...' : 'Enviar agora para o contador'}
        </button>
      </div>
      {aviso && <p className={aviso.ok ? 'pt-ok' : 'pt-erro'}>{aviso.texto}</p>}

      {info.historico.length > 0 && (
        <div>
          <span className="fc-olho-rot" style={{ marginBottom: '4px' }}>Últimos envios</span>
          {info.historico.map(h => {
            const [rotulo, cor] = SITUACAO[h.status] || [h.status, 'var(--text-muted)'];
            return (
              <div key={`${h.inicio}-${h.fim}`} style={{ fontSize: '12.5px', padding: '9px 0', boxShadow: '0 -1px 0 var(--bg-inset)' }}>
                <span className="fc-selo" style={{ '--c': cor }}><i /><span>{rotulo}</span></span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {' · '}<span className="mono">{periodoBR(h)}</span> · <span className="mono">{new Date(h.enviado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  {' · '}{h.enviado_por === 'automático' ? 'automático' : `por ${h.enviado_por}`}
                </span>
                <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>{h.para}{h.motivo ? ` — ${h.motivo}` : ''}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
