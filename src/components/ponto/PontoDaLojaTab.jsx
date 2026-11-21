import React, { useState, useEffect, useCallback } from 'react';
import { Tablet, Trash2 } from 'lucide-react';
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
    <div className="pt-grade">
      <div className="card pt-card">
        <div className="pt-card-cab">
          <div>
            <span className="fc-olho-rot">Este aparelho</span>
            <h3>Ponto pelo rosto</h3>
            <p>
              Deixe um tablet ou celular da loja como relógio de ponto: a equipe olha para a câmera, o aparelho reconhece quem é e registra a batida com a selfie — ninguém precisa entrar na própria conta.
              Cadastre o rosto de cada um na ficha do funcionário (aba Funcionários).
            </p>
          </div>
        </div>
        {erro && <p className="pt-erro">{erro}</p>}
        <div>
          <label className="input-label">Nome deste aparelho</label>
          <input className="input-field" value={nome} onChange={e => setNome(e.target.value)} maxLength={80} />
        </div>
        <button type="button" className="fc-pilula" onClick={ativarEsteAparelho} disabled={ativando}>
          {ativando ? 'Ativando…' : 'Usar este aparelho como ponto da loja'} <i><Tablet size={15} /></i>
        </button>
        <p className="pt-dica" style={{ margin: 0 }}>Abra esta tela no próprio tablet que vai ficar na loja, logado como dono ou gestor.</p>
      </div>

      <div className="card pt-card pt-lista" style={{ gap: '4px' }}>
        <div className="pt-card-cab" style={{ padding: '14px 14px 6px' }}>
          <div>
            <span className="fc-olho-rot">Aparelhos ativos · <span className="mono" style={{ letterSpacing: 0 }}>{aparelhos.length}</span></span>
          </div>
        </div>
        {aparelhos.length === 0 ? (
          <p className="pt-nota" style={{ padding: '4px 14px 10px' }}>Nenhum aparelho é ponto da loja agora.</p>
        ) : (
          <div data-testid="aparelhos">
            {aparelhos.map(ap => (
              <div key={ap.id} className="fc-lin pt-simples">
                <div style={{ minWidth: 0 }}>
                  <div className="fc-t"><span className="fc-selo" style={{ '--c': 'var(--ok)' }}><i /></span>{ap.nome}</div>
                  <div className="fc-m">
                    Ativado em <span className="mono">{dataHoraBR(ap.criado_em)}</span>{ap.criado_por ? ` por ${ap.criado_por}` : ''} · último uso <span className="mono">{dataHoraBR(ap.ultimo_uso_em)}</span>
                  </div>
                </div>
                <button type="button" className="fc-mini-btn perigo" onClick={() => desativar(ap)}>
                  <Trash2 size={13} /> Desativar
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="pt-card-cab" style={{ padding: '18px 14px 6px', boxShadow: '0 -1px 0 var(--bg-inset)', marginTop: '6px' }}>
          <span className="fc-olho-rot">Equipe: <span className="mono" style={{ letterSpacing: 0 }}>{comRosto}</span> de <span className="mono" style={{ letterSpacing: 0 }}>{equipe.length}</span> com rosto cadastrado</span>
        </div>
        <div style={{ padding: '0 14px 8px' }}>
          {equipe.map(f => (
            <div key={f.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '8px 0', fontSize: '13.5px', boxShadow: '0 -1px 0 var(--bg-inset)' }}>
              <span style={{ fontWeight: 500 }}>{f.nome}</span>
              <span className="fc-selo" style={{ '--c': f.rosto ? 'var(--ok)' : 'var(--text-muted)' }}>
                <i /><span>{f.rosto ? 'rosto' : 'sem rosto'} · {NOME_DO_MODO[f.ponto_modo]}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
