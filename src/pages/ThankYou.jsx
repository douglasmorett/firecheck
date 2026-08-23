import { useSearchParams, useNavigate } from 'react-router-dom';
import { Flame, Mail, Lock, ArrowRight, ShieldCheck, MessageSquare } from 'lucide-react';

export default function ThankYou() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get('email') || '';
  const isMobile = window.innerWidth < 480;

  return (
    <div style={{ 
      backgroundColor: '#0b0f19', 
      color: '#ffffff', 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '40px 20px',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Background gradients */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(255, 77, 0, 0.15) 0%, transparent 75%)', pointerEvents: 'none' }}></div>
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 75%)', pointerEvents: 'none' }}></div>

      <div style={{ maxWidth: '540px', width: '100%', textAlign: 'center', position: 'relative', zIndex: 10 }}>
        {/* Logo/Icon */}
        <div style={{ 
          display: 'inline-flex', 
          backgroundColor: '#ff4d00', 
          padding: '16px', 
          borderRadius: '50%', 
          boxShadow: '0 0 30px rgba(255, 77, 0, 0.4)', 
          marginBottom: '28px',
          animation: 'pulseGlow 2s infinite alternate'
        }}>
          <Flame size={40} color="white" />
        </div>

        <h1 style={{ fontSize: isMobile ? '1.8rem' : '2.5rem', fontWeight: '900', marginBottom: '12px', letterSpacing: '-1px', background: 'linear-gradient(90deg, #ff4d00, #ffb300)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Assinatura Confirmada! 🎉
        </h1>
        
        <p style={{ fontSize: '1.15rem', color: '#94a3b8', marginBottom: isMobile ? '20px' : '36px', lineHeight: '1.5' }}>
          Sua empresa agora tem tudo para se tornar autogerenciável. Veja como acessar o sistema.
        </p>

        {/* Credentials Card */}
        <div style={{ 
          backgroundColor: '#0f172a', 
          border: '1px solid rgba(255, 255, 255, 0.08)', 
          borderRadius: '24px', 
          padding: isMobile ? '20px 16px' : '32px', 
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          textAlign: 'left',
          marginBottom: '32px'
        }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={22} color="#10b981" /> Dados de Primeiro Acesso
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Login */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{ 
                backgroundColor: 'rgba(255, 77, 0, 0.1)', 
                color: '#ff4d00', 
                padding: '10px', 
                borderRadius: '12px',
                marginTop: '2px'
              }}>
                <Mail size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.9rem', color: '#94a3b8', margin: '0 0 4px 0' }}>Seu e-mail de login:</h4>
                <p style={{ fontSize: '1.05rem', fontWeight: '700', color: '#ffffff', margin: 0, wordBreak: 'break-all' }}>
                  {email ? email : 'O e-mail cadastrado na compra'}
                </p>
              </div>
            </div>

            {/* Password */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{ 
                backgroundColor: 'rgba(6, 182, 212, 0.1)', 
                color: '#06b6d4', 
                padding: '10px', 
                borderRadius: '12px',
                marginTop: '2px'
              }}>
                <Lock size={18} />
              </div>
              {/* A senha fixa "123456" era mostrada a todo mundo, inclusive a quem
                  veio do Checkout e escolheu a própria senha — que então tentava
                  entrar com a errada. Contas criadas pela compra recebem uma senha
                  aleatória por WhatsApp; ninguém mais tem senha previsível. */}
              <div>
                <h4 style={{ fontSize: '0.9rem', color: '#94a3b8', margin: '0 0 4px 0' }}>Como acessar</h4>
                <p style={{ fontSize: '0.95rem', color: '#e2e8f0', margin: 0, lineHeight: 1.5 }}>
                  Use a <strong>senha que você escolheu no cadastro</strong>.
                </p>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '8px 0 0 0', lineHeight: 1.5 }}>
                  Se a conta foi criada pela compra, enviamos sua senha por WhatsApp.
                  Não recebeu? Use <strong>&ldquo;Esqueci minha senha&rdquo;</strong> na tela de login.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button 
          onClick={() => navigate('/login')}
          style={{ 
            width: '100%', 
            padding: '16px', 
            borderRadius: '14px', 
            backgroundColor: '#ff4d00', 
            color: 'white', 
            border: 'none', 
            fontSize: '1.1rem', 
            fontWeight: 'bold', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 20px rgba(255, 77, 0, 0.3)',
            transition: 'all 0.3s ease',
            marginBottom: '20px'
          }}
        >
          Acessar o Painel Administrativo <ArrowRight size={20} />
        </button>

        {/* WhatsApp Support Link */}
        <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
          Precisa de ajuda para começar?{' '}
          <a 
            href={`https://wa.me/5522998851680?text=Olá,%20acabei%20de%20assinar%20o%20FireCheck%20com%20o%20email%20${encodeURIComponent(email)}%20e%20gostaria%20de%20ajuda%20para%20começar.`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ 
              color: '#25D366', 
              textDecoration: 'none', 
              fontWeight: '700',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              marginLeft: '4px',
              padding: '12px 16px'
            }}
          >
            <MessageSquare size={16} /> Falar no Suporte
          </a>
        </p>
      </div>

      <style>{`
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 20px rgba(255, 77, 0, 0.3); }
          100% { box-shadow: 0 0 35px rgba(255, 77, 0, 0.6); }
        }
      `}</style>
    </div>
  );
}
