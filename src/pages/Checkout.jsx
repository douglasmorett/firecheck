import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, ShieldCheck, Flame, Zap } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import API_URL from '../api';

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const plan = searchParams.get('plan') || 'trial';
  const isMobile = window.innerWidth < 600;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cpfCnpj: '',
    phone: '',
    store: '',
    password: '',
  });

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (formData.password.length < 6) {
      alert('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, plan: plan || 'trial' })
      });

      const data = await response.json();

      if (data.status === 'success') {
        if (data.token) localStorage.setItem('firecheck_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Dispara os eventos do Meta Pixel APENAS após sucesso real no banco de dados
        // Usa eventID único baseado no ID do banco para deduplicação absoluta
        if (window.fbq && data.user && data.user.id) {
          const eventId = `signup_${data.user.id}_${Date.now()}`;
          
          // Enriquece o pixel com dados do usuário (sem re-inicializar)
          window.fbq('init', '1508278337585097', {
            em: formData.email.toLowerCase().trim(),
            ph: formData.phone.replace(/\D/g, ''),
            fn: formData.name.trim().toLowerCase(),
            external_id: String(data.user.id)
          });

          if (plan === 'trial' || !plan) {
            window.fbq('trackSingle', '1508278337585097', 'StartTrial', { content_name: 'Teste Grátis 7 Dias', currency: 'BRL', value: 0 }, { eventID: eventId });
          } else {
            window.fbq('trackSingle', '1508278337585097', 'InitiateCheckout', { content_name: plan, currency: 'BRL' }, { eventID: eventId });
          }
        }


        const userEmail = encodeURIComponent(formData.email);
        const userName = encodeURIComponent(formData.name);
        
        let checkoutLink = '';
        
        if (plan === 'checklists_mensal' || plan === 'mensal' || plan === 'starter') {
          checkoutLink = `https://pay.cakto.com.br/3eph5ko_856837?email=${userEmail}&name=${userName}`;
        } else if (plan === 'checklists_anual' || plan === 'anual' || plan === 'business') {
          checkoutLink = `https://pay.cakto.com.br/e7c88df?email=${userEmail}&name=${userName}`;
        } else if (plan === 'ponto_mensal' || plan === 'ponto_starter' || plan === 'ponto_pro') {
          checkoutLink = `https://pay.cakto.com.br/kfx3fri_869702?email=${userEmail}&name=${userName}`;
        } else if (plan === 'ponto_anual' || plan === 'ponto_business') {
          checkoutLink = `https://pay.cakto.com.br/o2xichf?email=${userEmail}&name=${userName}`;
        } else if (plan === 'combo_mensal' || plan.includes('completo')) {
          checkoutLink = `https://pay.cakto.com.br/pavdwiz_869704?email=${userEmail}&name=${userName}`;
        } else if (plan === 'combo_anual') {
          checkoutLink = `https://pay.cakto.com.br/36m7kzq?email=${userEmail}&name=${userName}`;
        }
        // Módulo Financeiro fora de venda no momento. A rota continua no código,
        // desativada, para ser reativada quando o módulo voltar — basta descomentar:
        // } else if (plan === 'finance_mensal' || plan === 'finance_anual') {
        //   checkoutLink = `https://pay.cakto.com.br/desa99m_869700?email=${userEmail}&name=${userName}`;

        if (checkoutLink) {
          if (Capacitor.isNativePlatform()) {
            window.open(checkoutLink, '_blank');
            navigate('/login');
          } else {
            // Delay de 350ms para evitar que a requisição de rastreamento do Pixel seja abortada na redireção
            setTimeout(() => {
              window.location.href = checkoutLink;
            }, 350);
          }
        } else {
          // Delay de 350ms para evitar o aborto caso vá para a rota protegida
          setTimeout(() => {
            navigate('/admin');
          }, 350);
        }
      } else {
        alert(data.error || 'Erro ao criar conta. Verifique os dados e tente novamente.');
      }
    } catch {
      alert('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container animate-fade" style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 20px' }}>
      
      <header style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button className="btn-secondary" style={{ padding: '10px', minWidth: '44px', minHeight: '44px', borderRadius: '50%' }} onClick={() => navigate('/')}>
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="page-title" style={{ marginBottom: '4px' }}>
            {plan === 'trial' ? 'Criar Conta Gratuita' : `Assinar Plano ${plan.charAt(0).toUpperCase() + plan.slice(1)}`}
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {plan === 'trial' 
              ? 'Comece agora seus 7 dias de teste grátis. Sem cartão de crédito.' 
              : 'Preencha os dados abaixo para criar sua conta e prosseguir para o pagamento seguro.'}
          </p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: '40px' }}>
        
        {/* Formulário de Cadastro/Pagamento */}
        <div className="card">
          <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={20} color="var(--primary)" /> Seus Dados de Acesso
          </h3>
          
          <form onSubmit={handleCheckout}>
            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Nome Completo / Razão Social</label>
              <input 
                type="text" name="name" className="input-field" required 
                value={formData.name} onChange={handleInputChange}
                placeholder="Ex: João Silva ou Loja do Centro LTDA"
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">E-mail (Será seu login)</label>
              <input 
                type="email" name="email" className="input-field" required 
                value={formData.email} onChange={handleInputChange}
                placeholder="seu@email.com"
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Nome da sua Loja/Empresa</label>
              <input 
                type="text" name="store" className="input-field" required 
                value={formData.store} onChange={handleInputChange}
                placeholder="Ex: Duga Burguer"
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Telefone / WhatsApp</label>
              <input 
                type="text" name="phone" className="input-field" required 
                value={formData.phone} onChange={handleInputChange}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Crie uma Senha (Mínimo 6 dígitos)</label>
              <input 
                type="password" name="password" className="input-field" required 
                value={formData.password} onChange={handleInputChange}
                placeholder="******"
              />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Você usará este e-mail e senha para acessar o painel administrativo.</p>
            </div>

            <div style={{ marginTop: '32px' }}>
              <button 
                type="submit" 
                className="btn" 
                style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}
                disabled={loading}
              >
                {loading ? 'Processando...' : (
                  plan === 'mensal' || plan === 'anual' || plan === 'starter' || plan === 'pro' || plan === 'business'
                  ? 'Criar Conta e Pagar' 
                  : 'Criar Conta e Acessar o Sistema'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Resumo Benefícios */}
        <div style={{ alignSelf: 'start' }}>
          <div className="card" style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--primary)' }}>
            <h3 style={{ marginBottom: '20px' }}>
              {plan === 'trial' ? 'O que está incluso no Teste?' : 'Resumo da Assinatura'}
            </h3>
            <ul style={{ padding: 0, margin: 0, listStyle: 'none', fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Flame size={20} color="var(--primary)" /> <strong>Acesso total</strong> ao painel administrativo.</li>
              <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Zap size={20} color="var(--success)" /> Criação de <strong>Checklists com IA</strong>.</li>
              <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><ShieldCheck size={20} color="var(--primary)" /> Painel para seus funcionários.</li>
              {plan === 'trial' ? (
                <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>✅ Checklists ilimitados durante o teste</li>
              ) : (
                <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>🚀 Ativação imediata pós-pagamento</li>
              )}
            </ul>
            
            <div style={{ marginTop: '24px', padding: '12px', backgroundColor: 'rgba(255, 77, 0, 0.1)', borderRadius: '8px', color: 'var(--primary)', fontSize: '0.9rem', textAlign: 'center', fontWeight: 'bold' }}>
              {plan === 'trial' 
                ? '🕒 Sem pegadinhas. Sem cobrança surpresa.' 
                : `💳 Assinatura do Plano ${plan.charAt(0).toUpperCase() + plan.slice(1)}`}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
