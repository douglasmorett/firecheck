import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Mail, Lock, ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import API_URL from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const savedEmail = localStorage.getItem('firecheck_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const response = await fetch(`${API_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (data.status === 'success') {
        localStorage.setItem('user', JSON.stringify(data.user));
        
        if (rememberMe) {
          localStorage.setItem('firecheck_email', email);
        } else {
          localStorage.removeItem('firecheck_email');
        }

        // Redirecionamento baseado na role
        if (data.user.role === 'funcionario') {
          navigate('/funcionario');
        } else {
          navigate('/admin');
        }
      } else {
        setErrorMsg(data.error || 'Erro ao fazer login.');
      }
    } catch {
      setErrorMsg('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const response = await fetch(`${API_URL}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (data.status === 'success') {
        setSuccessMsg(data.message || 'Instruções enviadas para seu e-mail.');
        setIsForgot(false);
      } else {
        setErrorMsg(data.error || 'Erro ao enviar instruções.');
      }
    } catch {
      setErrorMsg('Erro ao conectar com o servidor.');
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
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
            {isForgot ? 'Recuperar Senha' : 'Acessar Painel'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '8px' }}>
            {isForgot ? 'Insira seu e-mail cadastrado' : 'Bem-vindo de volta ao FireCheck'}
          </p>
        </div>

        {errorMsg && (
          <div className="animate-scale" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', border: '1px solid var(--error)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.85rem', textAlign: 'center' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="animate-scale" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: '1px solid var(--success)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.85rem', textAlign: 'center' }}>
            ✅ {successMsg}
          </div>
        )}

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
                  type={showPassword ? "text" : "password"} className="input-field" style={{ paddingLeft: '40px', paddingRight: '40px' }} required 
                  placeholder="******"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            {!isForgot && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ accentColor: 'var(--primary)', width: '16px', height: '16px', cursor: 'pointer' }}
                />
                Lembrar meu e-mail
              </label>
            )}
            <button 
              type="button" 
              onClick={() => { setIsForgot(!isForgot); setErrorMsg(null); setSuccessMsg(null); }}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: '500', marginLeft: 'auto' }}
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
              style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px' }}
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

