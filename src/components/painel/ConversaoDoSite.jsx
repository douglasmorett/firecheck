import React, { useEffect, useState } from 'react';
import API_URL from '../../api';
import { BarraLuz } from './Painel';

// Painel de conversão do site (Master › Site Principal, 21/11/2026).
// Funil do dia: acessos → ficaram 10 s+ → viram os planos → foram ao checkout
// (Assinar leva direto à Cakto) → compraram (webhook da Cakto).

const PLANOS = [
  ['checklists10_mensal', 'Até 10 pessoas · mensal', 'R$ 67/mês'],
  ['checklists10_anual', 'Até 10 pessoas · anual', 'R$ 564/ano'],
  ['checklists_mensal', 'Até 30 pessoas · mensal', 'R$ 149/mês'],
  ['checklists_anual', 'Até 30 pessoas · anual', 'R$ 1.164/ano'],
];
const SEM_CICLO = [
  ['checklists10_sem_ciclo', 'Até 10 pessoas · ciclo não registrado', 'cliques de antes do painel'],
  ['checklists_sem_ciclo', 'Até 30 pessoas · ciclo não registrado', 'cliques de antes do painel'],
  ['outro', 'Outros produtos', 'vendas fora destes planos'],
];

const diaSP = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const menosDias = (n) => diaSP(Date.now() - n * 86400000);
const PERIODOS = {
  hoje: ['Hoje', () => [menosDias(0), menosDias(0)]],
  ontem: ['Ontem', () => [menosDias(1), menosDias(1)]],
  '7d': ['7 dias', () => [menosDias(6), menosDias(0)]],
  '30d': ['30 dias', () => [menosDias(29), menosDias(0)]],
};

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const fmtPct = (v) => `${String(v).replace('.', ',')}%`;
const reais = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const tempo = (s) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;

export default function ConversaoDoSite() {
  const [periodo, setPeriodo] = useState('hoje');
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    const carregar = () => {
      const [de, ate] = PERIODOS[periodo][1]();
      fetch(`${API_URL}/api/conversao-do-site?de=${de}&ate=${ate}`, {
        headers: { Authorization: 'Bearer ' + (localStorage.getItem('firecheck_token') || '') },
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d) => { if (vivo) { setDados(d); setErro(false); } })
        .catch(() => { if (vivo) setErro(true); });
    };
    setDados(null);
    carregar();
    const t = setInterval(carregar, 30000);
    return () => { vivo = false; clearInterval(t); };
  }, [periodo]);

  const d = dados;
  const etapas = d ? [
    ['Acessos', d.acessos, 'abriram o site'],
    ['Ficaram 10 s ou mais', d.ficaram, 'tira robô e quem fechou na hora'],
    ['Viram os planos', d.viramPlanos, 'clicaram em Ver planos ou Assinar'],
    ['Foram ao checkout', d.checkout, 'clicaram em Assinar'],
    ['Compraram', d.compras, d.comprasOk ? 'pagamento aprovado na Cakto' : 'compras indisponíveis'],
  ] : [];
  const conversao = d ? pct(d.compras, d.ficaram) : 0;
  const linhasExtras = d ? SEM_CICLO.filter(([k]) => d.porPlano[k]) : [];

  return (
    <section className="fc-conv">
      <div className="fc-barra-ferr">
        <div>
          <span className="fc-olho-rot">Conversão do site</span>
          <h3 className="fc-conv-tit">Quem entrou, o que clicou e quem comprou</h3>
        </div>
        <nav className="fc-seg" aria-label="Período da conversão" style={{ marginLeft: 'auto' }}>
          {Object.entries(PERIODOS).map(([k, [nome]]) => (
            <button key={k} type="button" className={periodo === k ? 'on' : ''} aria-pressed={periodo === k} onClick={() => setPeriodo(k)}>{nome}</button>
          ))}
        </nav>
      </div>

      {erro && !d && <div className="card fc-vazio">Não deu para carregar a conversão agora. Tenta de novo em instantes.</div>}
      {!erro && !d && <div className="card fc-vazio">Carregando a conversão…</div>}

      {d && (
        <>
          <div className="fc-conv-topo">
            <div className="fc-funil">
              {etapas.map(([nome, n, dica], i) => {
                const anterior = i === 0 ? null : etapas[i - 1][1];
                return (
                  <div key={nome} className={`card fc-etapa${i === etapas.length - 1 ? ' fim' : ''}`}>
                    <span className="fc-olho-rot">{nome}</span>
                    <strong className="mono">{n}</strong>
                    <span className="fc-etapa-pct mono">{anterior === null ? '100%' : `${fmtPct(pct(n, anterior))} da etapa anterior`}</span>
                    <BarraLuz pct={pct(n, etapas[0][1])} cor={i === etapas.length - 1 ? 'var(--ok)' : 'var(--primary)'} />
                    <small>{dica}</small>
                  </div>
                );
              })}
            </div>

            <div className="fc-conv-taxa">
              <span className="fc-olho-rot">Taxa de conversão</span>
              <strong className="mono">{fmtPct(conversao)}</strong>
              <p>dos visitantes que ficaram 10 s ou mais compraram</p>
              <div className="fc-conv-taxa-l">
                <span>Checkout → compra</span><b className="mono">{fmtPct(pct(d.compras, d.checkout))}</b>
              </div>
              <div className="fc-conv-taxa-l">
                <span>Acessos → compra</span><b className="mono">{fmtPct(pct(d.compras, d.acessos))}</b>
              </div>
              <div className="fc-conv-taxa-l">
                <span>Faturado no período</span><b className="mono">{reais(d.valor)}</b>
              </div>
            </div>
          </div>

          <div className="fc-conv-mini">
            <div className="card"><span className="fc-olho-rot">Tempo médio no site</span><b className="mono">{tempo(d.tempoMedioSeg)}</b><small>de quem ficou 10 s ou mais</small></div>
            <div className="card"><span className="fc-olho-rot">Chamaram no WhatsApp</span><b className="mono">{d.whatsapp}</b><small>dúvida ou mais de 30 pessoas</small></div>
            <div className="card"><span className="fc-olho-rot">Pix ou boleto gerado</span><b className="mono">{d.pixGerado}</b><small>na Cakto, ainda sem pagar</small></div>
            <div className="card"><span className="fc-olho-rot">Abandonaram o checkout</span><b className="mono">{d.abandonos}</b><small>a Cakto avisa quando desiste</small></div>
            <div className="card"><span className="fc-olho-rot">Renovações</span><b className="mono">{d.renovacoes}</b><small>{reais(d.valorRenovacoes)} · não entram na taxa</small></div>
          </div>

          <div className="card fc-aud">
            <div className="fc-aud-cab"><h3>Por plano</h3><span className="fc-olho-rot" style={{ letterSpacing: '.06em' }}>clique em Assinar × compra aprovada</span></div>
            <div className="fc-conv-tab">
              <div className="fc-conv-lin cab"><span>Plano</span><span>Cliques em Assinar</span><span>Compras</span><span>Conversão</span><span>Faturado</span></div>
              {[...PLANOS, ...linhasExtras].map(([k, nome, preco]) => {
                const l = d.porPlano[k] || { cliques: 0, compras: 0, valor: 0 };
                return (
                  <div key={k} className="fc-conv-lin">
                    <span><b>{nome}</b><small>{preco}</small></span>
                    <span className="mono" data-rot="Cliques">{l.cliques}<i className="fc-conv-barra"><BarraLuz pct={pct(l.cliques, d.checkout)} /></i></span>
                    <span className="mono" data-rot="Compras" style={{ color: l.compras ? 'var(--ok)' : undefined }}>{l.compras}</span>
                    <span className="mono" data-rot="Conversão">{l.cliques ? fmtPct(pct(l.compras, l.cliques)) : '–'}</span>
                    <span className="mono" data-rot="Faturado">{reais(l.valor)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card fc-aud" style={{ marginTop: 20 }}>
            <div className="fc-aud-cab"><h3>Compras do período</h3><span className="fc-olho-rot" style={{ letterSpacing: '.06em' }}>mais recentes primeiro</span></div>
            {!d.comprasOk ? (
              <div className="fc-vazio">Não consegui ler as compras da Cakto agora. O funil do site acima está certo.</div>
            ) : d.lista.length === 0 ? (
              <div className="fc-vazio">Nenhuma compra aprovada neste período.</div>
            ) : d.lista.map((c, i) => (
              <div key={i} className="fc-conv-compra">
                <span className="mono">{new Date(c.quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}</span>
                <span><b>{c.oferta}</b>{c.cliente ? <small>{c.cliente}</small> : null}</span>
                <span className="fc-dado">{c.metodo === 'pix' ? 'Pix' : c.metodo === 'credit_card' ? 'Cartão' : c.metodo === 'boleto' ? 'Boleto' : (c.metodo || 'Cakto')}</span>
                <b className="mono" style={{ color: 'var(--ok)' }}>{reais(c.valor)}</b>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
