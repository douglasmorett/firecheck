// Peças do visual novo do painel (aprovado pelo Douglas em 21/11/2026):
// barra quadrada com a luz correndo, velocímetro de conformidade e selo de status.
import './painel.css';

export const iniciais = (nome = '') =>
  String(nome).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';

// Barra por porcentagem (do mesmo tamanho com 5 ou 200 tarefas). `marcas` são as
// posições (0 a 100) das tarefas reprovadas, desenhadas como riscos vermelhos.
export function BarraLuz({ pct = 0, cor = 'var(--ok)', corre = false, marcas = [] }) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div className={`fc-barra${corre ? ' corre' : ''}`} style={{ '--p': `${p}%`, '--c': cor }} role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
      <i />
      {marcas.map((m, k) => <u key={k} style={{ left: `calc(${Math.max(0, Math.min(100, m))}% - 1.5px)` }} />)}
    </div>
  );
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const faixaDaConformidade = (v) => (v >= 90 ? { nome: 'Faixa boa', cor: '#2DD4A0' } : v >= 70 ? { nome: 'Atenção', cor: '#FFB020' } : { nome: 'Abaixo do esperado', cor: '#FF4D5E' });

export function Velocimetro({ valor = 0, dias = [], legenda = 'no período' }) {
  const v = Math.max(0, Math.min(100, Number(valor) || 0));
  const ang = Math.PI * (1 - v / 100);
  const px = 100 + 74 * Math.cos(ang);
  const py = 106 - 74 * Math.sin(ang);
  const faixa = faixaDaConformidade(v);
  const comDado = dias.filter((d) => d.conformidade != null);
  return (
    <div className="fc-velo-caixa">
      <span className="fc-olho-rot">Conformidade da loja</span>
      <div className="fc-velo">
        <svg viewBox="0 0 200 121" aria-hidden="true">
          <defs>
            <linearGradient id="fcLaranja" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#FF5A1F" /><stop offset="1" stopColor="#FFB020" /></linearGradient>
          </defs>
          <path d="M14 106 A86 86 0 0 1 186 106" fill="none" stroke="#FF4D5E" strokeWidth="2.5" pathLength="100" strokeDasharray="69 100" opacity=".8" />
          <path d="M14 106 A86 86 0 0 1 186 106" fill="none" stroke="#FFB020" strokeWidth="2.5" pathLength="100" strokeDasharray="0 70.5 19 100" opacity=".9" />
          <path d="M14 106 A86 86 0 0 1 186 106" fill="none" stroke="#2DD4A0" strokeWidth="2.5" pathLength="100" strokeDasharray="0 91 9 100" />
          <path d="M26 106 A74 74 0 0 1 174 106" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="11" />
          {v > 0 && <path className="fc-velo-v" d="M26 106 A74 74 0 0 1 174 106" fill="none" stroke="url(#fcLaranja)" strokeWidth="11" pathLength="100" strokeDasharray={`${v} 100`} style={{ '--v': v }} />}
          <rect x={px - 7} y={py - 6} width="14" height="12" rx="2" fill="#101014" stroke="#fff" strokeWidth="2.5" transform={`rotate(${-(v * 1.8 - 90)} ${px} ${py})`} />
        </svg>
        <div className="fc-velo-n"><strong className="mono">{v}<sup>%</sup></strong></div>
      </div>
      <div className="fc-velo-sub" style={{ color: faixa.cor }}>{faixa.nome} · {legenda}</div>
      <div className="fc-zona"><span style={{ '--c': '#FF4D5E' }}>abaixo de 70</span><span style={{ '--c': '#FFB020' }}>70 a 90</span><span style={{ '--c': '#2DD4A0' }}>acima de 90</span></div>
      {dias.length > 0 && (
        <div className="fc-semana">
          <span className="fc-olho-rot">Últimos 7 dias</span>
          {comDado.length === 0 ? (
            <p className="fc-semana-vazia">Sem checklists nos últimos 7 dias.</p>
          ) : (
            <>
              <div className="fc-col">
                {dias.map((d, k) => (
                  <span key={d.dia} title={d.conformidade == null ? 'sem checklist' : `${d.conformidade}% em ${d.total} checklist(s)`}>
                    {d.conformidade != null && <em className="mono">{d.conformidade}</em>}
                    <i className={k === dias.length - 1 && d.conformidade != null ? 'h' : ''}
                      style={{ height: d.conformidade == null ? '3px' : `${Math.max(8, d.conformidade) * 0.62}px`, '--c': d.conformidade == null ? 'rgba(255,255,255,.12)' : faixaDaConformidade(d.conformidade).cor }} />
                  </span>
                ))}
              </div>
              <div className="fc-dias mono">
                {dias.map((d, k) => <span key={d.dia}>{k === dias.length - 1 ? 'hoje' : DIAS[new Date(d.dia + 'T12:00:00').getDay()]}</span>)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Status de um checklist enviado: ponto colorido + texto, no lugar do selo cheio.
export const STATUS = {
  aprovado: { label: 'Aprovado pela IA', cor: 'var(--ok)' },
  reprovado: { label: 'Reprovado pela IA', cor: 'var(--bad)' },
  pendente: { label: 'Aguardando a IA', cor: '#D97706' },
  ignorado: { label: 'Sem foto para a IA', cor: 'var(--text-muted)' },
  falha: { label: 'Falha na IA', cor: 'var(--bad)' },
};

export function Selo({ status, sub }) {
  const s = STATUS[status] || STATUS.pendente;
  return (
    <span className="fc-selo" style={{ '--c': s.cor }}>
      <i />
      <span>{s.label}{sub && <small>{sub}</small>}</span>
    </span>
  );
}
