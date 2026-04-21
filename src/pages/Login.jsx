import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import API_URL from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isForgot, setIsForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (data.status === 'success') {
        localStorage.setItem('user', JSON.stringify(data.user));
        // Redirecionamento baseado na role
        if (data.user.role === 'funcionario') {
          navigate('/funcionario');
        } else {
          navigate('/admin');
        }
      } else {
        alert(data.error);
      }
    } catch {
      alert('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      alert(data.message || data.error);
      if (data.status === 'success') setIsForgot(false);
    } catch {
      alert('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade" style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '40px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ backgroundColor: 'var(--primary)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Flame color="white" size={32} />
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'white' }}>
            {isForgot ? 'Recuperar Senha' : 'Acessar Painel'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '8px' }}>
            {isForgot ? 'Insira seu e-mail cadastrado' : 'Bem-vindo de volta ao FireCheck'}
          </p>
        </div>

        <form onSubmit={isForgot ? handleForgot : handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label className="input-label">E-mail</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="email" className="input-field" style={{ paddingLeft: '40px' }} required 
                placeholder="seu@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {!isForgot && (
            <div style={{ marginBottom: '12px' }}>
              <label className="input-label">Senha</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="password" className="input-field" style={{ paddingLeft: '40px' }} required 
                  placeholder="******"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          <div style={{ textAlign: 'right', marginBottom: '24px' }}>
            <button 
              type="button" 
              onClick={() => setIsForgot(!isForgot)}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: '500' }}
            >
              {isForgot ? 'Voltar para o Login' : 'Esqueceu a senha?'}
            </button>
          </div>

          <button className="btn" style={{ width: '100%', padding: '14px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} disabled={loading}>
            {loading ? 'Aguarde...' : (isForgot ? 'Enviar Instruções' : 'Entrar')} <ArrowRight size={18} />
          </button>
        </form>

        <div style={{ marginTop: '32px', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Ainda não tem uma conta? <br/>
            <button 
              onClick={() => navigate('/')}
              style={{ background: 'none', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px' }}
            >
              Ver Planos e Assinar
            </button>
          </p>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          <ShieldCheck size={14} /> Sistema Criptografado e Seguro
        </div>

      </div>
    </div>
  );
}
