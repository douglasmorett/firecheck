import { Check, ArrowRight, X } from 'lucide-react';

/**
 * "Primeiros passos" do dono: 3 coisas que fazem o FireCheck começar a funcionar,
 * com o que já foi feito marcado. Substitui os avisos soltos de WhatsApp e WebApp
 * no topo do dashboard enquanto a loja não terminou de configurar.
 *
 * @param passos  [{ feito, titulo, texto, acao, onClick }]
 * @param onDispensar  esconde o cartão (o dono decide; guardado no aparelho)
 */
export default function PrimeirosPassos({ passos, onDispensar }) {
  const feitos = passos.filter((p) => p.feito).length;
  const proximo = passos.findIndex((p) => !p.feito);
  return (
    <section
      aria-label="Primeiros passos"
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px',
        boxShadow: 'var(--shadow-card)', padding: '18px 20px', marginBottom: '24px', position: 'relative',
      }}
    >
      <button
        type="button" onClick={onDispensar} title="Esconder"
        style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: 'var(--text-muted)', padding: '4px', display: 'flex' }}
      >
        <X size={18} />
      </button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', marginBottom: '12px', paddingRight: '28px' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Primeiros passos</h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{feitos} de {passos.length} feitos</span>
      </div>
      <div style={{ height: '6px', borderRadius: '99px', background: 'var(--bg-color)', overflow: 'hidden', marginBottom: '14px' }}>
        <div style={{ width: `${(feitos / passos.length) * 100}%`, height: '100%', background: 'var(--primary)', transition: 'width .3s' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        {passos.map((p, i) => {
          const destaque = i === proximo;
          return (
            <div
              key={p.titulo}
              style={{
                border: `1px solid ${destaque ? 'var(--primary)' : 'var(--border-color)'}`, borderRadius: '10px', padding: '12px 14px',
                background: p.feito ? 'var(--bg-color)' : 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.92rem' }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: '22px', height: '22px', borderRadius: '50%', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: p.feito ? 'var(--ink)' : 'transparent', border: p.feito ? 'none' : '2px solid var(--border-color)', color: '#fff', fontSize: '0.72rem',
                  }}
                >
                  {p.feito ? <Check size={14} strokeWidth={3} /> : <span style={{ color: 'var(--text-muted)' }}>{i + 1}</span>}
                </span>
                <span style={{ textDecoration: p.feito ? 'line-through' : 'none', color: p.feito ? 'var(--text-muted)' : 'var(--text-main)' }}>{p.titulo}</span>
              </div>
              {!p.feito && <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>{p.texto}</p>}
              {!p.feito && (
                <button
                  type="button" onClick={p.onClick} className={destaque ? 'btn' : 'btn-secondary'}
                  style={{ marginTop: 'auto', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {p.acao} <ArrowRight size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
