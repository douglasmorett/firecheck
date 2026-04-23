import { useState } from 'react';
import { ArrowRight, CheckCircle, Smartphone, ShieldCheck, Flame, Bot, X } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export default function LandingPage() {
  const [isAnnual, setIsAnnual] = useState(true);
  const navigate = useNavigate();

  return (
    <div style={{ backgroundColor: 'var(--bg-color)', color: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
      
      {/* NavBar */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 5%', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ backgroundColor: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
            <Flame size={24} color="white" />
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', letterSpacing: '-1px' }}>FireCheck</span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', fontSize: '0.9rem' }}>Planos</button>
          <button className="btn" style={{ padding: '10px 24px', boxShadow: '0 0 20px rgba(255, 77, 0, 0.4)' }} onClick={() => navigate('/login')}>
            Entrar no Sistema
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header style={{ padding: '100px 5%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="badge badge-warning" style={{ marginBottom: '24px', padding: '8px 16px', fontSize: '0.9rem' }}>
          ✨ O primeiro checklist do Brasil movido por IA
        </div>
        <h1 style={{ fontSize: 'min(3rem, 8vw)', fontWeight: '800', lineHeight: '1.2', maxWidth: '800px', marginBottom: '20px', background: 'linear-gradient(to right, #ffffff, #a0a0a0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Auditoria com IA que economiza seu tempo.
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', maxWidth: '600px', marginBottom: '32px', lineHeight: '1.5' }}>
          O FireCheck fiscaliza sua operação e te avisa no WhatsApp apenas se algo estiver errado. Chega de conferir centenas de fotos manualmente todos os dias.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn" style={{ fontSize: '1rem', padding: '14px 28px' }} onClick={() => {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          }}>
            Assinar Agora <ArrowRight size={18} />
          </button>
          <button className="btn-secondary" style={{ fontSize: '1rem', padding: '14px 28px' }} onClick={() => navigate('/funcionario')}>
            Simulador da Loja
          </button>
        </div>
      </header>

      {/* Features Comparativas (Onde somos melhores) */}
      <section style={{ padding: '80px 5%', backgroundColor: '#121318' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '16px' }}>Por que somos a evolução do mercado?</h2>
          <p style={{ color: 'var(--text-muted)' }}>Sistemas comuns apenas digitam formulários. Nós pensamos por você.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px', maxWidth: '1200px', margin: '0 auto' }}>
          
          <div className="card" style={{ borderTop: '4px solid #3b82f6' }}>
            <Bot size={40} color="#3b82f6" style={{ marginBottom: '20px' }} />
            <h3 style={{ fontSize: '1.3rem', marginBottom: '12px' }}>Auditoria IA (Exclusivo)</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.5' }}>Enquanto a concorrência exige que o diretor olhe 500 fotos por dia, o FireCheck aciona a inteligência do Google Gemini para auditar a tarefa em 2 segundos.</p>
          </div>

          <div className="card" style={{ borderTop: '4px solid var(--primary)' }}>
            <ShieldCheck size={40} color="var(--primary)" style={{ marginBottom: '20px' }} />
            <h3 style={{ fontSize: '1.3rem', marginBottom: '12px' }}>Bloqueio Anti-Fraude</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.5' }}>Esqueça fotos falsas da galeria. Nossa tecnologia força a câmera nativa do celular do funcionário. Se for falso, o aplicativo nem envia.</p>
          </div>

          <div className="card" style={{ borderTop: '4px solid var(--success)' }}>
            <Smartphone size={40} color="var(--success)" style={{ marginBottom: '20px' }} />
            <h3 style={{ fontSize: '1.3rem', marginBottom: '12px' }}>Alertas no WhatsApp</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.5' }}>Não precisa abrir o painel para descobrir que uma loja não abriu. Se uma tarefa estourar o horário limite, você recebe a notificação direto no zap.</p>
          </div>

        </div>
      </section>

      {/* Seção de Planos (Pricing) */}
      <section style={{ padding: '80px 5%', backgroundColor: 'var(--bg-color)' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '16px' }}>Escolha o plano ideal para a sua operação</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Cancele a qualquer momento. Sem taxas ocultas.</p>
          
          {/* Toggle Mensal / Anual */}
          <div style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#1A1C23', padding: '8px', borderRadius: '30px', gap: '8px' }}>
            <button 
              onClick={() => setIsAnnual(false)}
              style={{ padding: '8px 24px', borderRadius: '20px', border: 'none', backgroundColor: !isAnnual ? 'var(--primary)' : 'transparent', color: !isAnnual ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s' }}
            >
              Mensal
            </button>
            <button 
              onClick={() => setIsAnnual(true)}
              style={{ padding: '8px 24px', borderRadius: '20px', border: 'none', backgroundColor: isAnnual ? 'var(--primary)' : 'transparent', color: isAnnual ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              Anual <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem' }}>2 MESES GRÁTIS</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', maxWidth: '1100px', margin: '0 auto' }}>
          
          {/* Plano Único (Start) */}
          <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', border: '2px solid var(--primary)', transform: 'scale(1.05)', position: 'relative', zIndex: 1, pointerEvents: 'auto' }}>
            <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--primary)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>PLANO COMPLETO</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '8px', color: 'var(--primary)' }}>Start</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Auditoria inteligente para sua operação decolar.</p>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '8px' }}>
              R${isAnnual ? '147' : '197'}<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/mês</span>
            </div>
            {isAnnual && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: 'var(--success)', fontSize: '0.9rem', fontWeight: 'bold' }}>Faturado R$1.764 anualmente</div>
                <div style={{ color: 'rgba(0, 200, 83, 0.6)', fontSize: '0.8rem' }}>Economia de R$600/ano</div>
              </div>
            )}
            {!isAnnual && <div style={{ color: 'transparent', fontSize: '0.9rem', marginBottom: '32px' }}>-</div>}

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', flex: 1 }}>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Até 10 funcionários</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> <strong>Auditoria por IA (Google Gemini)</strong></li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Alertas de Atraso no WhatsApp</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Bloqueio de fotos falsas</li>
            </ul>
            <button className="btn" style={{ width: '100%', padding: '12px' }} onClick={() => navigate(`/checkout?plan=start&cycle=${isAnnual ? 'annual' : 'monthly'}`)}>
              Começar Teste Grátis de 7 Dias
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '12px' }}>
              Acesso total liberado na hora. Faturamento automático após o 7º dia.
            </p>
          </div>

          {/* Plano Custom */}
          <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Custom</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Redes de franquias e grandes indústrias.</p>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '24px' }}>A combinar</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', flex: 1 }}>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Acima de 10 funcionários</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Usuários e Lojas Ilimitados</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Treinamento de IA Personalizado</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Gerente de Conta Dedicado</li>
            </ul>
            <button className="btn-secondary" style={{ width: '100%', padding: '12px' }} onClick={() => window.open('https://wa.me/5522998851680?text=Olá,%20gostaria%20de%20falar%20com%20um%20consultor%20sobre%20o%20plano%20Custom%20do%20FireCheck.')}>Falar com nossos consultores</button>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '40px 5%', textAlign: 'center', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 'auto' }}>
        <p>© 2026 FireCheck Inc. O futuro da auditoria de varejo.</p>
        <p style={{ marginTop: '10px' }}>
          <Link to="/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'underline', fontSize: '0.8rem' }}>Política de Privacidade</Link>
        </p>
      </footer>
    </div>
  );
}
