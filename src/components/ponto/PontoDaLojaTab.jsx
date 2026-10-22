import React, { useState, useEffect, useCallback } from 'react';
import { ScanFace, Tablet, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import API_URL from '../../api';
import { GUARDA_DO_QUIOSQUE } from '../../utils/quiosque';

// Aba "Ponto da Loja" do módulo de ponto (gestor).
//
// Um aparelho da loja (tablet na recepção) vira o relógio de ponto: a equipe
// bate pelo rosto, sem entrar cada um na própria conta. Aqui o gestor ativa
// ESTE aparelho, vê os aparelhos ativos e desliga o que não deve mais bater
// ponto (perdeu, trocou, saiu da loja). O rosto de cada um se cadastra na
// ficha do funcionário.

const cabecalhos = (json) => ({
  ...(json ? { 'Content-Type': 'application/json' } : {}),
  'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '')
});
const dataHoraBR = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const NOME_DO_MODO = { ambos: 'conta e ponto da loja', conta: 'só pela conta', loja: 'só no ponto da loja' };

export default function PontoDaLojaTab() {
  const [aparelhos, setAparelhos] = useState([]);
  const [equipe, setEquipe] = useState([]);
  const [nome, setNome] = useState('Tablet da recepção');
  const [erro, setErro] = useState('');
  const [ativando, setAtivando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([
        fetch(`${API_URL}/api/quiosque/aparelhos`, { headers: cabecalhos() }),
        fetch(`${API_URL}/api/rostos`, { headers: cabecalhos() }),
      ]);
      if (a.ok) setAparelhos(await a.json());
      if (r.ok) setEquipe((await r.json()).funcionarios || []);
      if (!a.ok || !r.ok) setErro('Não deu para carregar o ponto da loja.');
    } catch {
      setErro('Erro de conexão.');
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const desativar = async (ap) => {
    if (!window.confirm(`Desativar "${ap.nome}"? Ele para de bater ponto na hora.`)) return;
    const res = await fetch(`${API_URL}/api/quiosque/aparelhos?id=${ap.id}`, { method: 'DELETE', headers: cabecalhos() });
    if (!res.ok) setErro((await res.json().catch(() => ({}))).error || 'Não deu para desativar.');
    carregar();
  };

  const ativarEsteAparelho = async () => {
    if (!window.confirm(
      'Este aparelho vai sair da sua conta e virar o ponto da loja: a tela fica só com a câmera para a equipe bater o ponto pelo rosto.\n\n' +
      'Para voltar ao normal, será preciso o e-mail e a senha do dono ou de um gestor.\n\nContinuar?'
    )) return;
    setAtivando(true);
    setErro('');
    try {
      const res = await fetch(`${API_URL}/api/quiosque/aparelhos`, { method: 'POST', headers: cabecalhos(true), body: JSON.stringify({ nome }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.token) { setErro(d.error || 'Não deu para ativar.'); setAtivando(false); return; }
      // A sessão do gestor NÃO fica no tablet da recepção: quem passar por ele
      // não pode abrir o painel. Fica só o token do quiosque, que só bate ponto.
      localStorage.setItem(GUARDA_DO_QUIOSQUE, JSON.stringify({ token: d.token, id: d.id, nome: d.nome }));
      ['user', 'firecheck_token', 'firecheck_admin_backup', 'firecheck_impersonated', 'admin_active_tab'].forEach(k => localStorage.removeItem(k));
      window.location.href = '/ponto-loja';
    } catch {
      setErro('Erro de conexão.');
      setAtivando(false);
    }
  };

  const comRosto = equipe.filter(f => f.rosto).length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start' }}>
      <div className="card" style={{ padding: '24px', borderRadius: '20px', borderTop: '4px solid #8B5CF6' }}>
        <h3 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '10px' }}><ScanFace size={22} color="#8B5CF6" /> Ponto pelo rosto</h3>
        <p style={{ margin: '0 0 16px 0', color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.5 }}>
          Deixe um tablet ou celular da loja como relógio de ponto: a equipe olha para a câmera, o aparelho reconhece quem é e registra a batida com a selfie — ninguém precisa entrar na própria conta.
          Cadastre o rosto de cada um na ficha do funcionário (aba Funcionários).
        </p>
        {erro && <p style={{ color: 'var(--error)', fontSize: '0.88rem', display: 'flex', gap: '6px' }}><AlertTriangle size={16} /> {erro}</p>}
        <label className="input-label">Nome deste aparelho</label>
        <input className="input-field" value={nome} onChange={e => setNome(e.target.value)} maxLength={80} style={{ marginBottom: '12px' }} />
        <button className="btn-primary" onClick={ativarEsteAparelho} disabled={ativando} style={{ width: '100%', padding: '14px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}>
          <Tablet size={18} /> {ativando ? 'Ativando…' : 'Usar este aparelho como ponto da loja'}
        </button>
        <p style={{ margin: '10px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Abra esta tela no próprio tablet que vai ficar na loja, logado como dono ou gestor.
        </p>
      </div>

      <div className="card" style={{ padding: '24px', borderRadius: '20px' }}>
        <h3 style={{ margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '10px' }}><Tablet size={20} color="var(--primary)" /> Aparelhos ativos</h3>
        {aparelhos.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nenhum aparelho é ponto da loja agora.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} data-testid="aparelhos">
            {aparelhos.map(ap => (
              <div key={ap.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <div>
                  <strong>{ap.nome}</strong>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Ativado em {dataHoraBR(ap.criado_em)}{ap.criado_por ? ` por ${ap.criado_por}` : ''} · último uso {dataHoraBR(ap.ultimo_uso_em)}
                  </p>
                </div>
                <button onClick={() => desativar(ap)} style={{ padding: '8px 12px', borderRadius: '10px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Trash2 size={14} /> Desativar
                </button>
              </div>
            ))}
          </div>
        )}

        <h4 style={{ margin: '22px 0 10px 0' }}>Equipe: {comRosto} de {equipe.length} com rosto cadastrado</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {equipe.map(f => (
            <div key={f.user_id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '0.88rem' }}>
              <span>{f.nome}</span>
              <span style={{ color: f.rosto ? '#10B981' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {f.rosto ? <><CheckCircle size={14} /> rosto · {NOME_DO_MODO[f.ponto_modo]}</> : `sem rosto · ${NOME_DO_MODO[f.ponto_modo]}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
