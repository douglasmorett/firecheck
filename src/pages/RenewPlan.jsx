import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Flame, Zap, Building2, ArrowLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

export default function RenewPlan() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // Sem o e-mail na URL (link antigo, acesso direto), cai no e-mail de quem
  // está logado neste aparelho: o pagamento na Cakto precisa casar com a conta
  // — pagar com outro e-mail deixa o webhook sem saber quem ativar.
  const emailLogado = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}').email || ''; } catch { return ''; }
  })();
  const email = searchParams.get('email') || emailLogado;
  const [billingCycle, setBillingCycle] = useState('anual'); // 'mensal' ou 'anual'

  const PLANS = [
    {
      id: 'checklists',
      name: 'Só Checklists',
      icon: <Flame size={28} color="#ff4500" />,
      price: billingCycle === 'anual' ? 'R$ 97' : 'R$ 149',
      cycle: '/mês',
      note: billingCycle === 'anual' ? 'Faturado R$ 1.164/ano (Economiza R$ 624)' : 'Cobrado mensalmente',
      color: '#ff4500',
      highlight: false,
      features: ['Checklists ILIMITADOS', 'Até 30 colaboradores cadastrados', 'Auditoria visual por IA', 'Alertas de irregularidade no WhatsApp', 'Bloqueio de fotos falsas', 'Relatórios PDF e Excel'],
      caktoLink: billingCycle === 'anual' ? 'https://pay.cakto.com.br/e7c88df' : 'https://pay.cakto.com.br/3eph5ko_856837',
    },
    {
      id: 'combo',
      name: 'Combo Tudo em 1',
      icon: <Zap size={28} color="#ff4500" />,
      price: billingCycle === 'anual' ? 'R$ 167' : 'R$ 197',
      cycle: '/mês',
      note: billingCycle === 'anual' ? '12x R$ 167 (Economiza R$ 360/ano)' : 'Economize R$ 101/mês vs 2 separados',
      color: 'var(--primary)',
      highlight: true,
      badge: '🔥 MAIS VENDIDO • MELHOR CUSTO',
      features: ['🎁 BÔNUS: Até 50 colaboradores (+20 grátis!)', 'TUDO do Módulo Checklist Ilimitado', 'TUDO do Módulo Controle de Ponto IA', 'Reconhecimento facial + Trava GPS', 'Alertas de atraso/saída no WhatsApp', 'Suporte VIP com gerente de conta'],
      caktoLink: billingCycle === 'anual' ? 'https://pay.cakto.com.br/36m7kzq' : 'https://pay.cakto.com.br/pavdwiz_869704',
    },
    {
      id: 'ponto',
      name: 'Só Ponto IA',
      icon: <Building2 size={28} color="#3b82f6" />,
      price: billingCycle === 'anual' ? 'R$ 97' : 'R$ 149',
      cycle: '/mês',
      note: billingCycle === 'anual' ? 'Faturado R$ 1.164/ano (Economiza R$ 624)' : 'Cobrado mensalmente',
      color: '#3b82f6',
      highlight: false,
      features: ['Reconhecimento Facial com IA', 'Até 30 colaboradores cadastrados', 'Trava de Geolocalização (GPS)', 'Alerta de atraso no WhatsApp', 'Relatório diário de espelho de ponto', 'Folha de ponto pronta pro contador'],
      caktoLink: billingCycle === 'anual' ? 'https://pay.cakto.com.br/o2xichf' : 'https://pay.cakto.com.br/kfx3fri_869702',
    },
  ];

  const handleChoosePlan = (plan) => {
    const url = `${plan.caktoLink}?email=${encodeURIComponent(email)}`;
    if (Capacitor.isNativePlatform()) {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }
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
      <div style={{ width: '100%', maxWidth: '960px', marginBottom: '32px' }}>
        <button
          className="btn-secondary"
          onClick={() => navigate('/login')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', padding: '8px 16px' }}
        >
          <ArrowLeft size={18} /> Voltar para o Login
        </button>

        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              backgroundColor: 'rgba(255, 77, 0, 0.1)',
              border: '1px solid var(--primary)',
              borderRadius: '12px',
              padding: '12px 20px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px',
              color: 'var(--primary)',
              fontWeight: '600',
              fontSize: '0.9rem',
            }}
          >
            ⚠️ Escolha seu plano para renovar seu acesso ao FireCheck
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
            Renove seu plano e continue operando 🔥
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto 24px' }}>
            Após a confirmação do pagamento, seu acesso é liberado instantaneamente.
          </p>
          {email && (
            <p style={{ marginBottom: '20px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Renovando para: <strong style={{ color: 'var(--text-main)' }}>{email}</strong>
            </p>
          )}

          {/* Toggle Mensal / Anual */}
          <div style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: 'var(--bg-card)', borderRadius: '30px', padding: '6px', border: '1px solid var(--border-color)', gap: '6px' }}>
            <button
              onClick={() => setBillingCycle('mensal')}
              style={{
                padding: '8px 20px',
                borderRadius: '20px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.88rem',
                backgroundColor: billingCycle === 'mensal' ? 'var(--primary)' : 'transparent',
                color: billingCycle === 'mensal' ? 'white' : 'var(--text-muted)',
                transition: 'all 0.2s ease',
              }}
            >
              Pagamento Mensal
            </button>
            <button
              onClick={() => setBillingCycle('anual')}
              style={{
                padding: '8px 20px',
                borderRadius: '20px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.88rem',
                backgroundColor: billingCycle === 'anual' ? '#10b981' : 'transparent',
                color: billingCycle === 'anual' ? 'white' : 'var(--text-muted)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Plano Anual</span>
              <span style={{ backgroundColor: billingCycle === 'anual' ? 'rgba(255,255,255,0.25)' : 'rgba(16, 185, 129, 0.15)', color: billingCycle === 'anual' ? 'white' : '#10b981', padding: '2px 6px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 'bold' }}>Desconto Anual</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cards dos Planos */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          width: '100%',
          maxWidth: '960px',
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
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-card)',
              boxShadow: plan.highlight ? '0 12px 30px rgba(255, 69, 0, 0.15)' : 'none',
            }}
          >
            {plan.badge && (
              <div
                style={{
                  position: 'absolute',
                  top: '-14px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: plan.color,
                  color: 'white',
                  padding: '4px 14px',
                  borderRadius: '999px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  whiteSpace: 'nowrap',
                }}
              >
                {plan.badge}
              </div>
            )}

            {/* Ícone + Nome */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', marginTop: plan.badge ? '6px' : '0' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: `${plan.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {plan.icon}
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '1.2rem', color: plan.highlight ? plan.color : 'var(--text-main)' }}>{plan.name}</div>
              </div>
            </div>

            {/* Preço */}
            <div style={{ marginBottom: '4px' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-main)' }}>{plan.price}</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{plan.cycle}</span>
            </div>
            <div style={{ color: plan.highlight ? '#10b981' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: plan.highlight ? 'bold' : 'normal', marginBottom: '20px' }}>
              {plan.note}
            </div>

            {/* Features */}
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              {plan.features.map((f, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={16} color={plan.color} style={{ flexShrink: 0 }} />
                  {f}
                </li>
              ))}
            </ul>

            {/* Botão */}
            <button
              className={plan.highlight ? 'btn btn-pulse' : 'btn-secondary'}
              onClick={() => handleChoosePlan(plan)}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '0.95rem',
                fontWeight: '700',
                backgroundColor: plan.highlight ? 'var(--primary)' : undefined,
              }}
            >
              Renovar com {plan.name} →
            </button>
          </div>
        ))}
      </div>

      {/* Rodapé */}
      <div
        style={{
          marginTop: '40px',
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
