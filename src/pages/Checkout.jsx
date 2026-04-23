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
    store: '',
    password: '',
  });

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
      const response = await fetch(`${API_URL}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.status === 'success') {
        localStorage.setItem('user', JSON.stringify(data.user));
        
        const userEmail = encodeURIComponent(formData.email);
        const userName = encodeURIComponent(formData.name);
        
        if (plan === 'mensal') {
           window.location.href = `https://pay.cakto.com.br/3eph5ko_856837?email=${userEmail}&name=${userName}`;
        } else if (plan === 'anual') {
           window.location.href = `https://pay.cakto.com.br/e7c88df?email=${userEmail}&name=${userName}`;
        } else {
           navigate('/admin');
        }
      } else {
        alert(data.error || 'Erro ao criar conta. Verifique os dados e tente novamente.');
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
          <h1 className="page-title" style={{ marginBottom: '4px' }}>Criar Conta Gratuita</h1>
          <p style={{ color: 'var(--text-muted)' }}>Comece agora seus 7 dias de teste grátis. Sem cartão de crédito.</p>
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

            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Nome da sua Loja/Empresa</label>
              <input 
                type="text" name="store" className="input-field" required 
                value={formData.store} onChange={handleInputChange}
                placeholder="Ex: Duga Burguer"
              />
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label className="input-label">Telefone / WhatsApp</label>
                <input 
                  type="text" name="phone" className="input-field" required 
                  value={formData.phone} onChange={handleInputChange}
                  placeholder="(11) 99999-9999"
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
                {loading ? 'Processando...' : (
                  plan === 'mensal' || plan === 'anual' 
                  ? 'Criar Conta e Prosseguir para Pagamento' 
                  : 'Criar Conta e Acessar o Sistema'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Resumo Benefícios */}
        <div style={{ alignSelf: 'start' }}>
          <div className="card" style={{ backgroundColor: '#121318', border: '1px solid var(--primary)' }}>
            <h3 style={{ marginBottom: '20px' }}>O que está incluso no Teste?</h3>
            <ul style={{ padding: 0, margin: 0, listStyle: 'none', fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Flame size={20} color="var(--primary)" /> <strong>Acesso total</strong> ao painel administrativo.</li>
              <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Zap size={20} color="var(--success)" /> Criação de <strong>Checklists com IA</strong>.</li>
              <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><ShieldCheck size={20} color="var(--primary)" /> Painel para seus funcionários.</li>
            </ul>
            
            <div style={{ marginTop: '24px', padding: '12px', backgroundColor: 'rgba(255, 77, 0, 0.1)', borderRadius: '8px', color: 'var(--primary)', fontSize: '0.9rem', textAlign: 'center', fontWeight: 'bold' }}>
              🕒 Sem pegadinhas. Sem cobrança surpresa.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
