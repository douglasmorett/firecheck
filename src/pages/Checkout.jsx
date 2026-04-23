import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, ShieldCheck, Flame, Zap } from 'lucide-react';
import API_URL from '../api';

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const plan = searchParams.get('plan') || 'pro';
  const cycle = searchParams.get('cycle') || 'monthly';

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cpfCnpj: '',
    phone: '',
    password: '',
  });

  const plansInfo = {
    start: { name: 'FireCheck Start', price: cycle === 'annual' ? 80 : 97 },
    pro: { name: 'FireCheck Pro Vision', price: cycle === 'annual' ? 167 : 197 },
  };

  const currentPlan = plansInfo[plan] || plansInfo.pro;
  const totalPrice = cycle === 'annual' ? currentPlan.price * 12 * 0.8333 : currentPlan.price; // Simples ajuste para bater com a landing

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (formData.password.length < 6) {
      alert('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          plan,
          cycle,
          amount: totalPrice
        })
      });

      const data = await response.json();

      if (data.invoiceUrl) {
        // Redireciona para o link de pagamento do Asaas
        window.location.href = data.invoiceUrl;
      } else {
        alert(data.error || 'Erro ao gerar pagamento. Verifique os dados e tente novamente.');
      }
    } catch (error) {
      alert('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container animate-fade" style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px' }}>
      
      <header style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button className="btn-secondary" style={{ padding: '8px', borderRadius: '50%' }} onClick={() => navigate('/')}>
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="page-title" style={{ marginBottom: '4px' }}>Finalizar Assinatura</h1>
          <p style={{ color: 'var(--text-muted)' }}>Você está a um passo de automatizar sua auditoria com IA.</p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '40px' }}>
        
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

            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label className="input-label">CPF ou CNPJ</label>
                <input 
                  type="text" name="cpfCnpj" className="input-field" required 
                  value={formData.cpfCnpj} onChange={handleInputChange}
                  placeholder="000.000.000-00"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="input-label">WhatsApp</label>
                <input 
                  type="text" name="phone" className="input-field" required 
                  value={formData.phone} onChange={handleInputChange}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Crie uma Senha (Mínimo 6 dígitos)</label>
              <input 
                type="password" name="password" className="input-field" required 
                value={formData.password} onChange={handleInputChange}
                placeholder="******"
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Você usará este e-mail e senha para acessar o painel administrativo.</p>
            </div>

            <div style={{ marginTop: '32px' }}>
              <button 
                type="submit" 
                className="btn" 
                style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}
                disabled={loading}
              >
                {loading ? 'Processando...' : `Pagar R$ ${totalPrice.toFixed(2).replace('.', ',')} agora`}
              </button>
              <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <ShieldCheck size={14} /> Pagamento processado com segurança via Asaas
              </p>
            </div>
          </form>
        </div>

        {/* Resumo do Pedido */}
        <div style={{ alignSelf: 'start' }}>
          <div className="card" style={{ backgroundColor: '#121318', border: '1px solid var(--primary)' }}>
            <h3 style={{ marginBottom: '20px' }}>Resumo da Assinatura</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Plano selecionado:</span>
              <span style={{ fontWeight: 'bold' }}>{currentPlan.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Ciclo de faturamento:</span>
              <span style={{ fontWeight: 'bold' }}>{cycle === 'annual' ? 'Anual (Econômico)' : 'Mensal'}</span>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '20px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1.2rem' }}>Total hoje:</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>R$ {totalPrice.toFixed(2).replace('.', ',')}</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'right' }}>
              Pagamento 100% Seguro
            </p>
            
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(0, 200, 83, 0.1)', borderRadius: '8px', color: 'var(--success)', fontSize: '0.9rem', textAlign: 'center', fontWeight: 'bold' }}>
              🛡️ Garantia incondicional de 7 Dias
            </div>
          </div>

          <div style={{ marginTop: '24px', padding: '0 16px' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>O que acontece agora?</h4>
            <ul style={{ padding: 0, margin: 0, listStyle: 'none', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li style={{ display: 'flex', gap: '8px' }}><CreditCard size={16} color="var(--primary)" /> 1. Escolha pagar via Pix ou Cartão no próximo passo.</li>
              <li style={{ display: 'flex', gap: '8px' }}><Flame size={16} color="var(--primary)" /> 2. Após o pagamento, seu acesso ao painel é liberado na hora.</li>
              <li style={{ display: 'flex', gap: '8px' }}><Zap size={16} color="var(--primary)" /> 3. Você já poderá criar seu primeiro checklist com IA hoje mesmo.</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
