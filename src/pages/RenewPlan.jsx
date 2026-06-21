import { useSearchParams, useNavigate } from 'react-router-dom';
import { Flame, Zap, Building2, ArrowLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    icon: <Flame size={28} color="#ff4d00" />,
    price: 'R$ 97',
    cycle: '/mês',
    limit: '300 checklists/mês',
    color: '#ff4d00',
    highlight: false,
    features: ['Até 300 checklists por mês', 'Funcionários ilimitados', 'Painel administrativo', 'Suporte por e-mail'],
    caktoLink: 'https://pay.cakto.com.br/3eph5ko_856837',
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: <Zap size={28} color="#7c3aed" />,
    price: 'R$ 147',
    cycle: '/mês',
    limit: '600 checklists/mês',
    color: '#7c3aed',
    highlight: true,
    features: ['Até 600 checklists por mês', 'Funcionários ilimitados', 'Painel administrativo', 'Ponto eletrônico (GPS + foto)', 'Suporte prioritário'],
    caktoLink: 'https://pay.cakto.com.br/3eph5ko_856837',
  },
  {
    id: 'business',
    name: 'Business',
    icon: <Building2 size={28} color="#059669" />,
    price: 'R$ 197',
    cycle: '/mês',
    limit: '1.500 checklists/mês',
    color: '#059669',
    highlight: false,
    features: ['Até 1.500 checklists por mês', 'Funcionários ilimitados', 'Painel administrativo', 'Ponto eletrônico (GPS + foto)', 'Módulo financeiro', 'Suporte VIP via WhatsApp'],
    caktoLink: 'https://pay.cakto.com.br/e7c88df',
  },
];

export default function RenewPlan() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get('email') || '';

  const handleChoosePlan = (plan) => {
    const url = `${plan.caktoLink}?email=${encodeURIComponent(email)}`;
    window.location.href = url;
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-color)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 20px',
      }}
    >
      {/* Header */}
      <div style={{ width: '100%', maxWidth: '900px', marginBottom: '48px' }}>
        <button
          className="btn-secondary"
          onClick={() => navigate('/login')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px', padding: '8px 16px' }}
        >
          <ArrowLeft size={18} /> Voltar para o Login
        </button>

        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              backgroundColor: 'rgba(255, 77, 0, 0.1)',
              border: '1px solid var(--primary)',
              borderRadius: '12px',
              padding: '16px 24px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '24px',
              color: 'var(--primary)',
              fontWeight: '600',
              fontSize: '0.9rem',
            }}
          >
            ⚠️ Seu plano expirou — escolha um plano para continuar
          </div>

          <h1
            style={{
              fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
              fontWeight: '800',
              color: 'var(--text-main)',
              marginBottom: '12px',
              lineHeight: 1.2,
            }}
          >
            Renove agora e volte a usar o FireCheck 🔥
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '520px', margin: '0 auto' }}>
            Escolha o plano ideal para a sua operação. Após o pagamento, seu acesso é liberado automaticamente.
          </p>
          {email && (
            <p style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Renovando para: <strong style={{ color: 'var(--text-main)' }}>{email}</strong>
            </p>
          )}
        </div>
      </div>

      {/* Cards dos Planos */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '24px',
          width: '100%',
          maxWidth: '900px',
        }}
      >
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className="card"
            style={{
              border: plan.highlight ? `2px solid ${plan.color}` : '1px solid var(--border-color)',
              position: 'relative',
              transition: 'transform 0.2s, box-shadow 0.2s',
              cursor: 'default',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = `0 12px 32px ${plan.color}33`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            {plan.highlight && (
              <div
                style={{
                  position: 'absolute',
                  top: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: plan.color,
                  color: 'white',
                  padding: '4px 16px',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  whiteSpace: 'nowrap',
                }}
              >
                ⚡ Mais Popular
              </div>
            )}

            {/* Ícone + Nome */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: `${plan.color}22`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {plan.icon}
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--text-main)' }}>{plan.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{plan.limit}</div>
              </div>
            </div>

            {/* Preço */}
            <div style={{ marginBottom: '24px' }}>
              <span style={{ fontSize: '2.2rem', fontWeight: '800', color: plan.color }}>{plan.price}</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{plan.cycle}</span>
            </div>

            {/* Features */}
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {plan.features.map((f, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={16} color={plan.color} style={{ flexShrink: 0 }} />
                  {f}
                </li>
              ))}
            </ul>

            {/* Botão */}
            <button
              className="btn"
              onClick={() => handleChoosePlan(plan)}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '0.95rem',
                fontWeight: '700',
                background: plan.highlight
                  ? `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)`
                  : `${plan.color}22`,
                color: plan.highlight ? 'white' : plan.color,
                border: `1px solid ${plan.color}`,
                borderRadius: '10px',
              }}
            >
              Escolher {plan.name} →
            </button>
          </div>
        ))}
      </div>

      {/* Rodapé */}
      <div
        style={{
          marginTop: '48px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--text-muted)',
          fontSize: '0.8rem',
        }}
      >
        <ShieldCheck size={14} /> Pagamento 100% seguro via Cakto. Acesso liberado automaticamente após confirmação.
      </div>
    </div>
  );
}
