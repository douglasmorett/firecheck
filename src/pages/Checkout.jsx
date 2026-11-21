import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, ShieldCheck, Flame, Zap } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import API_URL from '../api';
import { afiliadoAtual, comAfiliado } from '../afiliado';
import { CAKTO_DEZ } from '../planos';

// Sem teste grátis desde 21/11/2026: quem chega sem plano (ou com o antigo ?plan=trial)
// escolhe um plano aqui antes de preencher os dados.
const PLANOS = {
  checklists10_mensal: { nome: 'Até 10 pessoas', preco: 'R$ 67/mês' },
  checklists10_anual: { nome: 'Até 10 pessoas (anual)', preco: 'R$ 564/ano' },
  checklists_mensal: { nome: 'Até 30 pessoas', preco: 'R$ 149/mês' },
  checklists_anual: { nome: 'Até 30 pessoas (anual)', preco: 'R$ 1.164/ano' },
};
const linkDoDez = (plano) => CAKTO_DEZ[String(plano).endsWith('anual') ? 'anual' : 'mensal'];

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const plan = searchParams.get('plan') || 'trial';
  const escolherPlano = plan === 'trial' || !plan;
  const nomeDoPlano = PLANOS[plan]?.nome || plan.charAt(0).toUpperCase() + plan.slice(1);
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

    if (String(plan).startsWith('checklists10') && !linkDoDez(plan)) {
      alert('Este plano ainda não está disponível para pagamento. Escolha o plano de até 30 pessoas ou fale com a gente pelo WhatsApp.');
      return;
    }
    if (formData.password.length < 6) {
      alert('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, plan: plan || 'trial', afiliado: afiliadoAtual() })
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
          window.fbq('init', '1475446081169882', {
            em: formData.email.toLowerCase().trim(),
            ph: formData.phone.replace(/\D/g, ''),
            fn: formData.name.trim().toLowerCase(),
            external_id: String(data.user.id)
          });

          window.fbq('trackSingle', '1475446081169882', 'InitiateCheckout', { content_name: plan, currency: 'BRL', value: ({ checklists10_mensal: 67, checklists10_anual: 564, checklists_mensal: 149, checklists_anual: 1164 })[plan] || 0 }, { eventID: eventId });
        }


        const userEmail = encodeURIComponent(formData.email);
        const userName = encodeURIComponent(formData.name);
        
        let checkoutLink = '';
        
        if (String(plan).startsWith('checklists10') && linkDoDez(plan)) {
          checkoutLink = `${linkDoDez(plan)}?email=${userEmail}&name=${userName}`;
        } else if (plan === 'checklists_mensal' || plan === 'mensal' || plan === 'starter') {
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
              window.location.href = comAfiliado(checkoutLink);
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

  if (escolherPlano) {
    const opcoes = [
      ...(CAKTO_DEZ.mensal ? [['checklists10_mensal', 'Até 10 pessoas', 'R$ 67/mês']] : []),
      ...(CAKTO_DEZ.anual ? [['checklists10_anual', 'Até 10 pessoas, anual', 'R$ 564/ano']] : []),
      ['checklists_mensal', 'Até 30 pessoas', 'R$ 149/mês'],
      ['checklists_anual', 'Até 30 pessoas, anual', 'R$ 1.164/ano'],
    ];
    return (
      <div className="page-container animate-fade" style={{ maxWidth: '640px', margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 20px' }}>
        <h1 className="page-title" style={{ marginBottom: '6px' }}>Escolha seu plano</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Todos têm tudo do FireCheck. Garantia de 7 dias: não gostou, devolvemos.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {opcoes.map(([id, nome, preco]) => (
            <button key={id} type="button" className="card" onClick={() => navigate(`/checkout?plan=${id}`)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left', font: 'inherit', padding: '18px 20px' }}>
              <strong style={{ fontSize: '1.05rem' }}>{nome}</strong>
              <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{preco}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade" style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 20px' }}>
      
      <header style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button className="btn-secondary" style={{ padding: '10px', minWidth: '44px', minHeight: '44px', borderRadius: '50%' }} onClick={() => navigate('/')}>
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="page-title" style={{ marginBottom: '4px' }}>
            {`Assinar: ${nomeDoPlano}`}
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {`${PLANOS[plan]?.preco ? PLANOS[plan].preco + ' · ' : ''}Preencha os dados para criar sua conta e seguir para o pagamento seguro. Garantia de 7 dias.`}
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
                  'Criar conta e ir para o pagamento'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Resumo Benefícios */}
        <div style={{ alignSelf: 'start' }}>
          <div className="card" style={{ backgroundColor: 'var(--bg-inset)', border: '1px solid var(--primary)' }}>
            <h3 style={{ marginBottom: '20px' }}>
              Resumo da assinatura
            </h3>
            <ul style={{ padding: 0, margin: 0, listStyle: 'none', fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Flame size={20} color="var(--primary)" /> <strong>Acesso total</strong> ao painel administrativo.</li>
              <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Zap size={20} color="var(--success)" /> Criação de <strong>Checklists com IA</strong>.</li>
              <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><ShieldCheck size={20} color="var(--primary)" /> Painel para seus funcionários.</li>
              <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Zap size={20} color="var(--primary)" /> Ativação na hora, depois do pagamento.</li>
              <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><ShieldCheck size={20} color="var(--success)" /> A gente monta seus checklists com você pelo WhatsApp.</li>
            </ul>
            
            <div style={{ marginTop: '24px', padding: '12px', backgroundColor: 'rgb(var(--primary-rgb) / 0.1)', borderRadius: '8px', color: 'var(--primary)', fontSize: '0.9rem', textAlign: 'center', fontWeight: 'bold' }}>
              {`${nomeDoPlano}${PLANOS[plan]?.preco ? ' · ' + PLANOS[plan].preco : ''} · garantia de 7 dias`}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
