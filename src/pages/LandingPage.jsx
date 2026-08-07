import { useState, useEffect, useRef } from 'react';
import { ArrowRight, CheckCircle, Smartphone, ShieldCheck, Flame, Bot, X, Video, PlayCircle, Trophy, Image as ImageIcon, ArrowLeft, AlertTriangle, Activity, ShoppingCart, Mic, Volume2, Sparkles, Check, MessageSquare, ClipboardList, Users, Bell } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import API_URL from '../api';

const AI_DEMO_DATA = {
  cozinha: {
    tabLabel: '🍔 Cozinha / Hamburgueria',
    userText: 'Bill, cria um checklist de fechamento para a minha cozinha. Quero que verifiquem a limpeza da chapa com foto, se o lixo foi retirado e se o gás está desligado.',
    isAudio: true,
    audioDuration: '0:07',
    aiReply: 'Entendido! 🎙️ Processando áudio... Gerando checklist para fechamento de cozinha comercial com 3 tarefas críticas e fiscalização por foto na chapa.',
    checklistTitle: 'Fechamento de Cozinha Comercial',
    tasks: [
      { text: 'Limpar e desengordurar a chapa principal', type: '📸 Foto Obrigatória' },
      { text: 'Retirar todos os sacos de lixo e trocar as lixeiras', type: 'Conclusão simples' },
      { text: 'Fechar o registro geral da central de gás', type: 'Conclusão simples' }
    ]
  },
  academia: {
    tabLabel: '💪 Recepção / Academia',
    userText: 'Cria uma rotina de abertura para recepcionista de academia, checar som, ligar ar condicionado em 22 graus e verificar higienização das esteiras.',
    isAudio: false,
    aiReply: 'Excelente! 🤖 Entendido. Criando checklist de abertura de academia para a equipe de recepção com 3 etapas.',
    checklistTitle: 'Rotina de Abertura - Recepção',
    tasks: [
      { text: 'Ligar o som ambiente da recepção e salão', type: 'Conclusão simples' },
      { text: 'Ajustar os aparelhos de ar condicionado para 22°C', type: 'Conclusão simples' },
      { text: 'Verificar e higienizar painel e apoios das esteiras', type: '📸 Foto Obrigatória' }
    ]
  },
  frota: {
    tabLabel: '🚚 Logística / Vistoria Frota',
    userText: 'Cria um checklist rápido de saída de veículo. Tem que ver nível de combustível, calibragem dos pneus e estado da lataria com fotos.',
    isAudio: true,
    audioDuration: '0:06',
    aiReply: 'Perfeito! 🎙️ Áudio recebido. Gerando checklist de vistoria de saída de veículos com auditoria visual da lataria.',
    checklistTitle: 'Vistoria de Saída de Veículo',
    tasks: [
      { text: 'Registrar o nível atual de combustível', type: '📝 Texto' },
      { text: 'Verificar a calibragem de todos os pneus', type: 'Conclusão simples' },
      { text: 'Realizar vistoria geral da lataria contra batidas', type: '📸 Foto Obrigatória' }
    ]
  }
};

export default function LandingPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState('anual'); // 'mensal' ou 'anual'
  const [isVideoActive, setIsVideoActive] = useState(false);
  const videoRef = useRef(null);

  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));

  const [activeAiDemo, setActiveAiDemo] = useState('cozinha');
  const [demoStep, setDemoStep] = useState(3);
  const demoTimeoutRef = useRef(null);

  const startDemoAnimation = (demoId) => {
    if (demoTimeoutRef.current) {
      clearTimeout(demoTimeoutRef.current);
    }
    setActiveAiDemo(demoId);
    setDemoStep(1); // User typing/speaking
    
    demoTimeoutRef.current = setTimeout(() => {
      setDemoStep(2); // AI analyzing
      
      demoTimeoutRef.current = setTimeout(() => {
        setDemoStep(3); // Checklist revealed
      }, 1500);
    }, 1800);
  };

  // Run initial animation on load
  useEffect(() => {
    const timer = setTimeout(() => {
      startDemoAnimation('cozinha');
    }, 800);
    return () => {
      clearTimeout(timer);
      if (demoTimeoutRef.current) clearTimeout(demoTimeoutRef.current);
    };
  }, []);

  const handleTrackAndNavigate = (buttonName, path) => {
    fetch(`${API_URL}/api/track-quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sessionId, 
        step: 0, 
        completed: false, 
        clickedCta: true,
        clickedButton: buttonName
      })
    }).catch(() => {});
    if (path) {
      if (path.startsWith('http')) {
        window.open(path);
      } else {
        navigate(path);
      }
    }
  };

  useEffect(() => {
    // Ping to track live visitors
    const ping = () => {
      fetch(`${API_URL}/api/ping`).catch(() => {});
      
      // Registrar a sessão para acompanhamento de tempo no painel Master
      fetch(`${API_URL}/api/track-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId, 
          step: 0, 
          completed: false, 
          clickedCta: false,
          q1: null, q2: null, q3: null, q4: null 
        })
      }).catch(() => {});
    };
    ping();
    const interval = setInterval(ping, 10000);
    return () => clearInterval(interval);
  }, [sessionId]);

  return (
    <div style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      
      {/* NavBar */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 5%', backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 1000 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ backgroundColor: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
            <Flame size={24} color="white" />
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', letterSpacing: '-1px' }}>FireCheck</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="btn-secondary hide-on-mobile" style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', fontSize: '0.9rem', cursor: 'pointer' }} onClick={() => document.getElementById('como-funciona').scrollIntoView({ behavior: 'smooth' })}>Como Funciona</button>
          <button className="btn-secondary hide-on-mobile" style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', fontSize: '0.9rem', cursor: 'pointer' }} onClick={() => document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' })}>Planos</button>
          <button 
            className="hide-on-mobile" 
            style={{ 
              padding: '10px 18px', 
              borderRadius: '8px', 
              border: '1px solid #FF4D00', 
              backgroundColor: 'rgba(255, 77, 0, 0.08)', 
              color: '#FF4D00', 
              fontSize: '0.9rem', 
              fontWeight: 700, 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }} 
            onClick={() => navigate('/revenda')}
          >
            🤝 Revenda nossa Solução
          </button>
          <button className="btn" style={{ padding: '10px 24px', boxShadow: '0 0 20px rgba(255, 77, 0, 0.4)' }} onClick={() => navigate('/login')}>
            Acessar
          </button>
          <style>{`
            .hamburger-btn { display: none; }
            @media (max-width: 768px) { .hamburger-btn { display: flex; align-items: center; justify-content: center; background: transparent; border: none; font-size: 1.8rem; cursor: pointer; padding: 0 5px; color: var(--text-main); } }
          `}</style>
          <button className="hamburger-btn" onClick={() => setMenuOpen(true)}>
            ☰
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#fff', zIndex: 9999, padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setMenuOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '2rem', cursor: 'pointer', color: '#000' }}>✕</button>
          </div>
          <a onClick={() => { setMenuOpen(false); document.getElementById('como-funciona').scrollIntoView({ behavior: 'smooth' }); }} style={{ fontSize: '1.2rem', fontWeight: 600, color: '#000', cursor: 'pointer' }}>Como Funciona</a>
          <a onClick={() => { setMenuOpen(false); document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' }); }} style={{ fontSize: '1.2rem', fontWeight: 600, color: '#000', cursor: 'pointer' }}>Planos</a>
          <a onClick={() => { setMenuOpen(false); navigate('/revenda'); }} style={{ fontSize: '1.2rem', fontWeight: 700, color: '#FF4D00', cursor: 'pointer' }}>🤝 Revenda Nossa Solução (Afiliados)</a>
          <a onClick={() => { setMenuOpen(false); navigate('/login'); }} style={{ fontSize: '1.2rem', fontWeight: 600, color: '#000', cursor: 'pointer' }}>Acessar</a>
        </div>
      )}

      {/* Hero Section */}
      <section className="hero-section" style={{ padding: '80px 5%', maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
        <style>{`
          .hero-section {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 40px;
          }
          .hero-col-left {
            flex: 1 1 300px;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
          }
          .hero-col-right {
            flex: 1 1 500px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            position: relative;
            min-height: 450px;
          }
          .video-phone-mockup {
            width: 280px; 
            height: 580px; 
            background: #000000; 
            border: 12px solid #18181b; 
            border-radius: 36px; 
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); 
            position: relative; 
            overflow: hidden;
          }
          @media (max-width: 768px) {
            .hero-section {
              display: flex;
              flex-direction: column;
              padding: 40px 20px 32px 20px !important; /* Padding ajustado para mobile */
              gap: 20px !important;
            }
            .hero-col-left, .hero-col-right {
              display: contents;
            }
            .hero-badge { 
              order: 1; 
              align-self: center; 
              margin-bottom: 12px !important; 
              font-size: 0.85rem !important; 
              padding: 6px 14px !important; 
              white-space: normal !important; 
              text-align: center;
            }
            .hero-title { 
              order: 2; 
              text-align: center; 
              font-size: 1.9rem !important; /* Aumenta tamanho do título para ficar imponente e proporcional */
              margin-bottom: 16px !important; 
              line-height: 1.25 !important; /* Aumenta line-height para não cortar acentos no topo */
              letter-spacing: -0.5px !important;
              width: 100%;
            }
            .mobile-video-title { display: none !important; }
            .hero-desc { 
              order: 3; /* Move a descrição para logo abaixo do título */
              text-align: center; 
              font-size: 0.95rem !important; 
              margin-bottom: 24px !important; 
              line-height: 1.5 !important; 
              width: 100%;
            }
            .hero-cta { 
              order: 4; /* Move os botões para baixo da descrição */
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              width: 100%; 
              gap: 12px !important; 
            }
            .hero-cta button { width: 100%; justify-content: center; padding: 14px 28px !important; font-size: 1rem !important; min-height: 48px; }
            .hero-cta p { text-align: center; width: 100%; margin-top: 4px !important; font-size: 0.88rem !important; }
            
            .hero-video-wrapper { 
              order: 5; /* Move o mockup de celular para o final, abaixo do CTA */
              display: flex; 
              justify-content: center; 
              width: 100%; 
              margin-top: 24px; 
            }
            .video-phone-mockup {
               width: 250px !important; /* Tamanho proporcional para celular sem precisar usar scale */
               height: 520px !important;
               border: 8px solid #18181b !important;
               border-radius: 28px !important;
               transform: none !important; /* Desativa scale instável */
               margin-bottom: 0px !important;
            }
          }
        `}</style>
        
        <div className="hero-col-left">
          <div className="hero-badge" style={{ border: '1px solid rgba(255, 77, 0, 0.4)', color: '#ff4d00', padding: '8px 20px', borderRadius: '30px', fontSize: '0.85rem', fontWeight: '800', marginBottom: '24px', letterSpacing: '1px', textTransform: 'uppercase', boxShadow: '0 0 20px rgba(255, 77, 0, 0.2)', backgroundColor: 'rgba(255, 77, 0, 0.05)' }}>
            🎙️ NOVO: Crie checklists por Áudio ou Texto com nossa IA
          </div>
          
          <h1 className="hero-title" style={{ fontSize: 'min(3.5rem, 7vw)', fontWeight: '900', lineHeight: '1.1', marginBottom: '24px', letterSpacing: '-1px', color: 'var(--text-main)' }}>
            Transforme sua empresa em um negócio <br/><span style={{ background: 'linear-gradient(90deg, #ff4d00, #ffb300)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>autogerenciável.</span>
          </h1>
          
          <p className="hero-desc" style={{ fontSize: '1.25rem', color: 'var(--text-muted)', marginBottom: '32px', lineHeight: '1.6', maxWidth: '600px' }}>
            Esqueça o trabalho de digitar checklists manuais. Fale ou digite para o <strong>Bill IA</strong> e ele cria seus checklists automaticamente em segundos. A IA fiscaliza tudo e só avisa você no celular ou WhatsApp se algo der errado.
          </p>

          <div className="hero-cta" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <button className="btn btn-pulse" style={{ fontSize: '1.1rem', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => handleTrackAndNavigate('Começar 7 Dias Grátis', '/checkout?plan=trial')}>
              Começar 7 Dias Grátis <ArrowRight size={20} />
            </button>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '16px' }}>
              Acesso imediato. Não pedimos cartão de crédito.
            </p>
          </div>
        </div>

        <div className="hero-col-right">
           <h3 className="mobile-video-title" style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '24px', textAlign: 'center', zIndex: 10 }}>Veja como funciona nosso aplicativo:</h3>
           
           <div className="hero-video-wrapper" style={{ position: 'relative' }}>
             <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '120%', height: '120%', background: 'radial-gradient(circle, rgba(255,77,0,0.15) 0%, transparent 60%)', filter: 'blur(50px)', zIndex: -1 }}></div>
             <div className="video-phone-mockup">
               <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '120px', height: '24px', background: '#18181b', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', zIndex: 50 }}></div>
               <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                 <video 
                   ref={videoRef}
                   src="/demo2.mp4" 
                   autoPlay
                   muted={!isVideoActive}
                   loop 
                   playsInline
                   onClick={() => {
                      if (videoRef.current) {
                          if (isVideoActive) {
                              videoRef.current.muted = true;
                              setIsVideoActive(false);
                          } else {
                              videoRef.current.currentTime = 0;
                              videoRef.current.muted = false;
                              setIsVideoActive(true);
                              handleTrackAndNavigate('video_play', null);
                          }
                      }
                   }}
                   style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'pointer' }}
                 />
                 {!isVideoActive && (
                   <div 
                     onClick={() => {
                        if (videoRef.current) {
                            videoRef.current.currentTime = 0;
                            videoRef.current.muted = false;
                            setIsVideoActive(true);
                            handleTrackAndNavigate('video_play', null);
                        }
                     }}
                     style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.15)', cursor: 'pointer', zIndex: 60 }}
                   >
                     <div className="btn btn-pulse" style={{ background: 'var(--primary)', color: 'white', padding: '16px 32px', borderRadius: '30px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 20px rgba(255,77,0,0.5)' }}>
                       <PlayCircle size={24} /> Dar Play
                     </div>
                   </div>
                 )}
               </div>
             </div>
           </div>
        </div>
      </section>

      {/* ── Seção: Clientes que confiam ── */}
      <section style={{ padding: '40px 0', backgroundColor: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', overflow: 'hidden', position: 'relative', zIndex: 10 }}>
        <style>{`
          @keyframes marquee-scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .logos-track {
            display: flex;
            gap: 48px;
            width: max-content;
            animation: marquee-scroll 28s linear infinite;
            align-items: center;
          }
          /* Removed hover pause */
          .logo-card {
            display: flex;
            align-items: center;
            gap: 10px;
            background: var(--bg-color);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 14px 22px;
            white-space: nowrap;
            flex-shrink: 0;
            transition: box-shadow 0.2s, transform 0.2s;
            cursor: default;
          }
          .logo-card:hover {
            box-shadow: 0 8px 24px rgba(0,0,0,0.08);
            transform: translateY(-2px);
          }
          .logo-name {
            font-weight: 700;
            font-size: 0.92rem;
            color: var(--text-main);
            letter-spacing: -0.3px;
          }
          .logo-sector {
            font-size: 0.72rem;
            color: var(--text-muted);
            margin-top: 1px;
          }
        `}</style>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Empresas que já automatizaram com o FireCheck
          </span>
        </div>

        <div style={{ display: 'flex', overflow: 'hidden', maskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)' }}>
          <div className="logos-track">
            {/* Logo 1 — Restaurante */}
            <div className="logo-card">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#FFF1EE"/><path d="M10 8v6c0 2.2 1.8 4 4 4v6h4v-6c2.2 0 4-1.8 4-4V8h-2v5h-2V8h-2v5h-2V8h-4z" fill="#C0392B"/></svg>
              <div><div className="logo-name">Grupo Tavares</div><div className="logo-sector">Alimentação & Restaurantes</div></div>
            </div>
            {/* Logo 2 — Academia */}
            <div className="logo-card">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#EEF4FF"/><rect x="7" y="14" width="4" height="4" rx="2" fill="#2563EB"/><rect x="21" y="14" width="4" height="4" rx="2" fill="#2563EB"/><rect x="11" y="15" width="10" height="2" fill="#2563EB"/><rect x="14" y="11" width="4" height="10" rx="1" fill="#1D4ED8"/></svg>
              <div><div className="logo-name">FitMax Academia</div><div className="logo-sector">Fitness & Bem-Estar</div></div>
            </div>
            {/* Logo 3 — Hotel */}
            <div className="logo-card">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#FFFBEB"/><path d="M16 8l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4l2-4z" fill="#D97706"/></svg>
              <div><div className="logo-name">Hotel Meridian</div><div className="logo-sector">Hotelaria & Turismo</div></div>
            </div>
            {/* Logo 4 — Transportes */}
            <div className="logo-card">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#FFF7F0"/><path d="M6 18h14v-4l-4-5H6v9z" fill="#EA580C"/><path d="M20 14h3l3 4v2h-6v-6z" fill="#C2410C"/><circle cx="10" cy="20" r="2" fill="#1E293B"/><circle cx="22" cy="20" r="2" fill="#1E293B"/></svg>
              <div><div className="logo-name">LogFlex Transportes</div><div className="logo-sector">Logística & Frota</div></div>
            </div>
            {/* Logo 5 — Clínica */}
            <div className="logo-card">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#ECFDF5"/><path d="M19 9h-6v4H9v6h4v4h6v-4h4v-6h-4V9z" fill="#059669"/></svg>
              <div><div className="logo-name">Clínica Bem Estar</div><div className="logo-sector">Saúde & Clínicas</div></div>
            </div>
            {/* Logo 6 — Padaria */}
            <div className="logo-card">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#FFFBF0"/><ellipse cx="16" cy="18" rx="7" ry="5" fill="#B45309"/><ellipse cx="16" cy="17" rx="5" ry="3" fill="#D97706"/><path d="M13 12c1-3 5-3 6 0" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round"/></svg>
              <div><div className="logo-name">Padaria São Jorge</div><div className="logo-sector">Panificação & Varejo</div></div>
            </div>
            {/* Logo 7 — Beleza */}
            <div className="logo-card">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#FDF2F8"/><path d="M12 10l8 12M20 10l-8 12" stroke="#DB2777" strokeWidth="2" strokeLinecap="round"/><circle cx="16" cy="16" r="3" fill="#EC4899"/></svg>
              <div><div className="logo-name">Bella Forma Studio</div><div className="logo-sector">Beleza & Estética</div></div>
            </div>
            {/* Logo 8 — Supermercado */}
            <div className="logo-card">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#F0FDF4"/><path d="M8 10h2l2 8h8l2-6H12" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="14" cy="21" r="1.5" fill="#16A34A"/><circle cx="20" cy="21" r="1.5" fill="#16A34A"/></svg>
              <div><div className="logo-name">Mega Supermercados</div><div className="logo-sector">Varejo & Supermercados</div></div>
            </div>
            {/* Logo 9 — Burger */}
            <div className="logo-card">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#FEFCE8"/><rect x="8" y="13" width="16" height="2.5" rx="1.25" fill="#CA8A04"/><rect x="9" y="17" width="14" height="2" rx="1" fill="#854D0E"/><path d="M10 13c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="#EAB308"/></svg>
              <div><div className="logo-name">Rede Burger House</div><div className="logo-sector">Fast Food & Franquias</div></div>
            </div>
            {/* Logo 10 — Concessionária */}
            <div className="logo-card">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#F0F4FF"/><path d="M8 18l2-4h12l2 4" stroke="#3730A3" strokeWidth="1.5" strokeLinecap="round"/><rect x="7" y="18" width="18" height="4" rx="2" fill="#4338CA"/><circle cx="11" cy="22" r="1.5" fill="#1E1B4B"/><circle cx="21" cy="22" r="1.5" fill="#1E1B4B"/><path d="M10 14l1-3h10l1 3" fill="#6366F1"/></svg>
              <div><div className="logo-name">AutoPrime</div><div className="logo-sector">Concessionárias & Auto</div></div>
            </div>

            {/* Duplicata para loop infinito */}
            <div className="logo-card">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#FFF1EE"/><path d="M10 8v6c0 2.2 1.8 4 4 4v6h4v-6c2.2 0 4-1.8 4-4V8h-2v5h-2V8h-2v5h-2V8h-4z" fill="#C0392B"/></svg>
              <div><div className="logo-name">Grupo Tavares</div><div className="logo-sector">Alimentação & Restaurantes</div></div>
            </div>
            <div className="logo-card">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#EEF4FF"/><rect x="7" y="14" width="4" height="4" rx="2" fill="#2563EB"/><rect x="21" y="14" width="4" height="4" rx="2" fill="#2563EB"/><rect x="11" y="15" width="10" height="2" fill="#2563EB"/><rect x="14" y="11" width="4" height="10" rx="1" fill="#1D4ED8"/></svg>
              <div><div className="logo-name">FitMax Academia</div><div className="logo-sector">Fitness & Bem-Estar</div></div>
            </div>
            <div className="logo-card">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#FFFBEB"/><path d="M16 8l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4l2-4z" fill="#D97706"/></svg>
              <div><div className="logo-name">Hotel Meridian</div><div className="logo-sector">Hotelaria & Turismo</div></div>
            </div>
            <div className="logo-card">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#FFF7F0"/><path d="M6 18h14v-4l-4-5H6v9z" fill="#EA580C"/><path d="M20 14h3l3 4v2h-6v-6z" fill="#C2410C"/><circle cx="10" cy="20" r="2" fill="#1E293B"/><circle cx="22" cy="20" r="2" fill="#1E293B"/></svg>
              <div><div className="logo-name">LogFlex Transportes</div><div className="logo-sector">Logística & Frota</div></div>
            </div>
            <div className="logo-card">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#ECFDF5"/><path d="M19 9h-6v4H9v6h4v4h6v-4h4v-6h-4V9z" fill="#059669"/></svg>
              <div><div className="logo-name">Clínica Bem Estar</div><div className="logo-sector">Saúde & Clínicas</div></div>
            </div>
            <div className="logo-card">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#FFFBF0"/><ellipse cx="16" cy="18" rx="7" ry="5" fill="#B45309"/><ellipse cx="16" cy="17" rx="5" ry="3" fill="#D97706"/><path d="M13 12c1-3 5-3 6 0" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round"/></svg>
              <div><div className="logo-name">Padaria São Jorge</div><div className="logo-sector">Panificação & Varejo</div></div>
            </div>
            <div className="logo-card">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#FDF2F8"/><path d="M12 10l8 12M20 10l-8 12" stroke="#DB2777" strokeWidth="2" strokeLinecap="round"/><circle cx="16" cy="16" r="3" fill="#EC4899"/></svg>
              <div><div className="logo-name">Bella Forma Studio</div><div className="logo-sector">Beleza & Estética</div></div>
            </div>
            <div className="logo-card">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#F0FDF4"/><path d="M8 10h2l2 8h8l2-6H12" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="14" cy="21" r="1.5" fill="#16A34A"/><circle cx="20" cy="21" r="1.5" fill="#16A34A"/></svg>
              <div><div className="logo-name">Mega Supermercados</div><div className="logo-sector">Varejo & Supermercados</div></div>
            </div>
            <div className="logo-card">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#FEFCE8"/><rect x="8" y="13" width="16" height="2.5" rx="1.25" fill="#CA8A04"/><rect x="9" y="17" width="14" height="2" rx="1" fill="#854D0E"/><path d="M10 13c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="#EAB308"/></svg>
              <div><div className="logo-name">Rede Burger House</div><div className="logo-sector">Fast Food & Franquias</div></div>
            </div>
            <div className="logo-card">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#F0F4FF"/><path d="M8 18l2-4h12l2 4" stroke="#3730A3" strokeWidth="1.5" strokeLinecap="round"/><rect x="7" y="18" width="18" height="4" rx="2" fill="#4338CA"/><circle cx="11" cy="22" r="1.5" fill="#1E1B4B"/><circle cx="21" cy="22" r="1.5" fill="#1E1B4B"/><path d="M10 14l1-3h10l1 3" fill="#6366F1"/></svg>
              <div><div className="logo-name">AutoPrime</div><div className="logo-sector">Concessionárias & Auto</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Seção MEGA: Assistente WhatsApp + Notificações (Diferencial) ── */}
      <section className="mega-section" style={{ backgroundColor: '#ffffff', padding: '80px 20px', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
        <style>{`
          @media (max-width: 768px) {
            .mega-section {
              padding: 40px 20px !important;
            }
          }
        `}</style>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          
          {/* Badge de destaque */}
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'linear-gradient(135deg, #25D366, #128c7e)', color: 'white', padding: '10px 24px', borderRadius: '30px', fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '20px', boxShadow: '0 8px 20px rgba(37, 211, 102, 0.3)', animation: 'float 3s ease-in-out infinite' }}>
               <MessageSquare size={20} />
               EXCLUSIVO — Gerencie sua operação pelo WhatsApp
            </div>
            <h2 style={{ fontSize: 'min(2.5rem, 7vw)', fontWeight: '800', lineHeight: '1.2', color: '#0f172a', marginBottom: '16px' }}>
               Seu assistente <span style={{ color: '#25D366' }}>WhatsApp</span> com inteligência artificial
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: '1.6', maxWidth: '700px', margin: '0 auto' }}>
               Converse com o <strong>Bill</strong>, nosso assistente IA, direto pelo WhatsApp. Crie checklists, consulte dados da loja, gerencie funcionários e receba relatórios — tudo sem abrir o navegador.
            </p>
          </div>

          {/* Grid: Chat Simulado + Features */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '40px', alignItems: 'flex-start' }}>
            
            {/* Chat WhatsApp Simulado */}
            <div style={{ flex: '1 1 auto', minWidth: 'min(360px, 100%)', display: 'flex', justifyContent: 'center' }}>
              <div className="card" style={{ width: '100%', maxWidth: 'min(380px, 100%)', padding: '0', border: '1px solid var(--border-color)', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', borderRadius: '18px', backgroundColor: '#efeae2', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#075e54', color: 'white', padding: '14px 16px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #06b6d4, #0891b2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bot size={18} color="white" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>Bill IA — FireCheck</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#25D366', display: 'inline-block' }}></span>
                      Online 24h
                    </div>
                  </div>
                </div>
                
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ alignSelf: 'flex-end', backgroundColor: '#dcf8c6', color: '#303030', padding: '8px 12px', borderRadius: '8px 0 8px 8px', fontSize: '0.82rem', maxWidth: '80%', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                    Cria um checklist de abertura de loja com 5 itens
                  </div>
                  
                  <div style={{ alignSelf: 'flex-start', backgroundColor: '#ffffff', color: '#303030', padding: '8px 12px', borderRadius: '0 8px 8px 8px', fontSize: '0.82rem', maxWidth: '85%', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', whiteSpace: 'pre-wrap' }}>{'🤖 *Bill IA*\nEntendi! Antes de montar:\n1. Tem algum item que precisa de foto?\n2. Qual horário limite de execução?'}</div>
                  
                  <div style={{ alignSelf: 'flex-end', backgroundColor: '#dcf8c6', color: '#303030', padding: '8px 12px', borderRadius: '8px 0 8px 8px', fontSize: '0.82rem', maxWidth: '80%', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                    Foto da vitrine e até 08:30
                  </div>

                  <div style={{ alignSelf: 'flex-start', backgroundColor: '#ffffff', color: '#303030', padding: '10px 12px', borderRadius: '0 8px 8px 8px', fontSize: '0.82rem', maxWidth: '85%', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', whiteSpace: 'pre-wrap' }}>{'✅ Checklist *"Abertura de Loja"* criado!\n\n📋 5 tarefas configuradas\n📸 1 com foto obrigatória\n⏰ Limite: 08:30\n🔄 Recorrência: diária\n\nJá disponível para equipe! 🔥'}</div>

                  <div style={{ alignSelf: 'flex-start', backgroundColor: '#ffffff', color: '#303030', padding: '10px 12px', borderRadius: '0 8px 8px 8px', fontSize: '0.82rem', maxWidth: '85%', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', whiteSpace: 'pre-wrap', borderLeft: '3px solid #25D366' }}>{'✅ *Checklist Concluído*\n📋 *Abertura de Loja*\n👤 Thiago Laurentino\n📅 20/07 • 🕐 08:15 → 08:28\nStatus: ✅ Tudo OK! 🚀'}</div>
                </div>
              </div>
            </div>

            {/* Features Grid */}
            <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '20px', borderRadius: '14px', backgroundColor: '#f0fdf4', border: '1px solid rgba(37, 211, 102, 0.2)' }}>
                <div style={{ backgroundColor: '#25D366', padding: '10px', borderRadius: '10px', flexShrink: 0 }}>
                  <Bot size={22} color="white" />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 'bold', color: '#0f172a' }}>Assistente IA via WhatsApp</h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    Crie checklists, consulte relatórios, gerencie funcionários e altere configurações — conversando naturalmente pelo WhatsApp. <strong>24h por dia.</strong>
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '20px', borderRadius: '14px', backgroundColor: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.15)' }}>
                <div style={{ backgroundColor: '#06b6d4', padding: '10px', borderRadius: '10px', flexShrink: 0 }}>
                  <ClipboardList size={22} color="white" />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 'bold', color: '#0f172a' }}>Crie Checklists pelo WhatsApp</h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    Diga <em>"cria um checklist de fechamento de caixa"</em> e o Bill monta tudo automaticamente. Simples assim.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '20px', borderRadius: '14px', backgroundColor: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
                <div style={{ backgroundColor: '#8b5cf6', padding: '10px', borderRadius: '10px', flexShrink: 0 }}>
                  <Users size={22} color="white" />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 'bold', color: '#0f172a' }}>Gerencie sua Equipe</h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    Cadastre funcionários, consulte quem bateu ponto, veja checklists pendentes — sem sair do WhatsApp.
                  </p>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '20px', borderRadius: '14px', backgroundColor: 'rgba(255, 77, 0, 0.04)', border: '1px solid rgba(255, 77, 0, 0.15)' }}>
                <div style={{ backgroundColor: 'var(--primary)', padding: '10px', borderRadius: '10px', flexShrink: 0 }}>
                  <Bell size={22} color="white" />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 'bold', color: '#0f172a' }}>Notificações Automáticas em Tempo Real</h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    Receba alertas de irregularidades, atrasos, comprovantes de ponto e checklists concluídos — com nome, data, hora de início e fim.
                  </p>
                </div>
              </div>

              <div style={{ textAlign: 'center', padding: '16px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.08), rgba(6, 182, 212, 0.08))', border: '1px dashed #25D366' }}>
                <p style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', color: '#0f172a' }}>
                  💚 Incluso em <strong>todos os planos</strong> — sem custo adicional
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Notificações ilimitadas + Assistente IA 24h
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>



      {/* Templates de Checklist (Piloto Automático) - Mapeado como Segunda Seção */}
      <section className="section-mobile-padding" style={{ padding: '80px 5%', backgroundColor: 'var(--bg-card)', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 style={{ fontSize: 'min(3rem, 6vw)', fontWeight: '800', marginBottom: '16px', lineHeight: '1.2', color: '#0f172a' }}>
            O seu negócio rodando <br/><span style={{ color: 'var(--primary)' }}>no piloto automático</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>
            Veja como é simples transformar a gestão da sua empresa em 4 passos rápidos.
          </p>
        </div>

        <style>{`
          .four-steps-grid {
             display: grid;
             grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
             gap: 24px;
             max-width: 1200px;
             margin: 0 auto;
             position: relative;
          }
          @media (max-width: 768px) {
             .four-steps-grid {
                grid-template-columns: 1fr !important;
                gap: 12px !important;
             }
             .four-steps-grid > div {
                padding: 12px !important;
                border-radius: 16px !important;
             }
             .four-steps-grid > div > div:first-child {
                height: 80px !important;
                margin-bottom: 12px !important;
                border-radius: 8px !important;
             }
             .four-steps-grid > div > div:nth-child(2) {
                width: 32px !important;
                height: 32px !important;
                font-size: 0.9rem !important;
                margin-bottom: 8px !important;
             }
             .four-steps-grid > div > h3 {
                font-size: 1rem !important;
                margin-bottom: 6px !important;
             }
             .four-steps-grid > div > p {
                font-size: 0.88rem !important;
             }
          }
        `}</style>
        <div className="four-steps-grid">
          
          {/* Step 1 */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '24px', border: '1px solid var(--border-color)', position: 'relative', zIndex: 1, boxShadow: '0 10px 30px rgba(0,0,0,0.03)', textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: '100%', height: '160px', borderRadius: '16px', overflow: 'hidden', marginBottom: '20px', backgroundColor: '#f8fafc' }}>
               <img src="/step1.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Crie o checklist" />
            </div>
            <div style={{ width: '48px', height: '48px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', margin: '0 auto 16px', boxShadow: '0 0 0 6px rgba(255, 77, 0, 0.1)' }}>1</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '12px', color: '#0f172a' }}>Criação por Áudio ou Texto</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', flex: 1 }}>
              Fale ou digite para nossa IA e ela estrutura o checklist ideal para sua empresa em segundos, sem trabalho manual.
            </p>
          </div>

          {/* Step 2 */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '24px', border: '1px solid var(--border-color)', position: 'relative', zIndex: 1, boxShadow: '0 10px 30px rgba(0,0,0,0.03)', textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: '100%', height: '160px', borderRadius: '16px', overflow: 'hidden', marginBottom: '20px', backgroundColor: '#f8fafc' }}>
               <img src="/step2.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Funcionários executam" />
            </div>
            <div style={{ width: '48px', height: '48px', backgroundColor: '#06b6d4', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', margin: '0 auto 16px', boxShadow: '0 0 0 6px rgba(6, 182, 212, 0.1)' }}>2</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '12px', color: '#0f172a' }}>Execução Inediata</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', flex: 1 }}>
              Seus funcionários recebem no aplicativo e já podem começar a executar a tarefa instantaneamente respondendo se foi feito e tirando foto.
            </p>
          </div>

          {/* Step 3 */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '24px', border: '1px solid var(--border-color)', position: 'relative', zIndex: 1, boxShadow: '0 10px 30px rgba(0,0,0,0.03)', textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: '100%', height: '160px', borderRadius: '16px', overflow: 'hidden', marginBottom: '20px', backgroundColor: '#f8fafc' }}>
               <img src="/step3.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Notificação de falha" />
            </div>
            <div style={{ width: '48px', height: '48px', backgroundColor: '#ef4444', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', margin: '0 auto 16px', boxShadow: '0 0 0 6px rgba(239, 68, 68, 0.1)' }}>3</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '12px', color: '#0f172a' }}>Alertas Inteligentes</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', flex: 1 }}>
              Caso alguma tarefa não seja executada na hora programada ou do jeito que você pediu, nossa IA envia uma notificação push para seu celular para que você só precise agir se realmente algum comando não for cumprido.
            </p>
          </div>

          {/* Step 4 */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '24px', border: '1px solid var(--border-color)', position: 'relative', zIndex: 1, boxShadow: '0 10px 30px rgba(0,0,0,0.03)', textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: '100%', height: '160px', borderRadius: '16px', overflow: 'hidden', marginBottom: '20px', backgroundColor: '#f8fafc' }}>
               <img src="/step4.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Férias e relaxamento" />
            </div>
            <div style={{ width: '48px', height: '48px', backgroundColor: '#10b981', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', margin: '0 auto 16px', boxShadow: '0 0 0 6px rgba(16, 185, 129, 0.1)' }}>4</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '12px', color: '#0f172a' }}>Empresa Auto-Gerenciável</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', flex: 1 }}>
              Relaxe e programe suas férias, agora você tem uma empresa auto gerenciável!
            </p>
          </div>

        </div>
      </section>

      {/* SEÇÃO COMPONENT SHOWCASE INTERATIVO (LAPTOP + CELULAR + CHIPS FLUTUANTES) - TEMA CLARO */}
      <section className="section-mobile-padding" style={{ padding: '100px 0', backgroundColor: '#f8fafc', position: 'relative', overflow: 'hidden', borderBottom: '1px solid #e2e8f0' }}>
        {/* Glows de fundo suaves */}
        <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: '80%', height: '80%', background: 'radial-gradient(circle, rgba(255, 77, 0, 0.04) 0%, transparent 60%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }}></div>
        <div style={{ position: 'absolute', bottom: '0', right: '10%', width: '30%', height: '30%', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.03) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }}></div>

        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 5%', position: 'relative', zIndex: 10 }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(24px, 5vw, 60px)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#ff4d00', letterSpacing: '2px', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
              VISÃO GERAL DO SISTEMA
            </span>
            <h2 style={{ fontSize: 'min(3rem, 6vw)', fontWeight: '900', color: '#0f172a', marginBottom: '16px', lineHeight: '1.1' }}>
              Toda a sua operação <br/>conectada <span style={{ background: 'linear-gradient(90deg, #ff4d00, #ffb300)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>em tempo real</span>
            </h2>
            <p style={{ color: '#475569', fontSize: '1.15rem', maxWidth: '650px', margin: '0 auto' }}>
              Seu painel administrativo no computador integrado ao aplicativo de checklists e ponto eletrônico da equipe.
            </p>
          </div>

          <style>{`
            .showcase-container {
              position: relative;
              width: 100%;
              max-width: 1000px;
              margin: 0 auto;
              height: 520px;
              display: flex;
              justify-content: center;
              align-items: flex-end;
            }
            .laptop-mockup {
              width: 70%;
              position: relative;
              z-index: 2;
              transform: translateX(-5%);
              transition: transform 0.4s ease, box-shadow 0.4s ease;
            }
            .laptop-mockup:hover {
              transform: translateX(-5%) translateY(-5px);
            }
            .phone-mockup-overlap {
              width: 22%;
              position: absolute;
              right: 12%;
              bottom: -5%;
              z-index: 5;
              transform: translateY(0);
              transition: transform 0.4s ease, box-shadow 0.4s ease;
            }
            .phone-mockup-overlap:hover {
              transform: translateY(-8px);
            }
            
            /* Floating Pills - Light Theme */
            .float-chip {
              position: absolute;
              z-index: 15;
              padding: 10px 18px;
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 100px;
              box-shadow: 0 10px 25px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255,255,255,1);
              display: flex;
              align-items: center;
              gap: 10px;
              cursor: pointer;
              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .float-chip:hover {
              transform: scale(1.08) !important;
              border-color: #ff4d00;
              box-shadow: 0 15px 30px rgba(255, 77, 0, 0.12);
            }
            
            .float-a { left: 2%; top: 20%; animation: float-anim-1 6s ease-in-out infinite; }
            .float-b { left: 4%; bottom: 25%; animation: float-anim-2 5s ease-in-out infinite; }
            .float-c { left: 25%; top: 8%; animation: float-anim-3 7s ease-in-out infinite; }
            .float-d { right: 2%; top: 18%; animation: float-anim-2 5.5s ease-in-out infinite; }
            .float-e { right: 4%; bottom: 30%; animation: float-anim-1 6.5s ease-in-out infinite; }
            .float-f { right: 35%; top: 6%; animation: float-anim-3 5.8s ease-in-out infinite; }

            @keyframes float-anim-1 {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-12px); }
            }
            @keyframes float-anim-2 {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(12px); }
            }
            @keyframes float-anim-3 {
              0%, 100% { transform: translateX(0) translateY(0); }
              50% { transform: translateX(8px) translateY(-8px); }
            }

            @media (max-width: 900px) {
              .showcase-container {
                height: 380px;
              }
              .float-chip {
                padding: 6px 12px;
                font-size: 0.8rem;
              }
              .float-chip svg {
                width: 14px;
                height: 14px;
              }
            }
            @media (max-width: 600px) {
              .showcase-container {
                height: auto;
                flex-direction: column;
                align-items: center;
                gap: 24px;
                padding-bottom: 20px;
              }
              .float-chip {
                display: none;
              }
              .laptop-mockup {
                width: 100%;
                transform: none;
                order: 1;
              }
              .laptop-mockup:hover {
                transform: none;
              }
              .phone-mockup-overlap {
                position: relative;
                width: 45%;
                right: 2%;
              }
            }
          `}</style>

          <div className="showcase-container">
            {/* Chips Flutuantes */}
            <div className="float-chip float-a">
              <span style={{ display: 'flex', padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}><AlertTriangle size={16} /></span>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b' }}>Onde agir primeiro</span>
            </div>
            <div className="float-chip float-b">
              <span style={{ display: 'flex', padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}><ShieldCheck size={16} /></span>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b' }}>Quem fez, quem não fez</span>
            </div>
            <div className="float-chip float-c">
              <span style={{ display: 'flex', padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}><CheckCircle size={16} /></span>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b' }}>Tarefa concluída</span>
            </div>
            
            <div className="float-chip float-d">
              <span style={{ display: 'flex', padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><Volume2 size={16} /></span>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b' }}>Alertas em tempo real</span>
            </div>
            <div className="float-chip float-e">
              <span style={{ display: 'flex', padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}><Sparkles size={16} /></span>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b' }}>IA confere a foto</span>
            </div>
            <div className="float-chip float-f">
              <span style={{ display: 'flex', padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(236, 72, 153, 0.1)', color: '#ec4899' }}><Activity size={16} /></span>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b' }}>85% Concluído</span>
            </div>

            {/* Laptop Mockup */}
            <div className="laptop-mockup">
              <div style={{ backgroundColor: '#e2e8f0', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderBottom: 'none' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#eab308' }}></span>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
                <span style={{ fontSize: '0.7rem', color: '#64748b', marginLeft: '8px' }}>admin.firecheckapp.com/dashboard</span>
              </div>
              <div style={{ background: '#F4F4F5', aspectRatio: '1.6', overflow: 'hidden', display: 'flex', border: '1px solid #cbd5e1', position: 'relative', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', width: '100%', fontSize: '0.65rem', fontFamily: 'Inter, system-ui, sans-serif', color: '#18181b', userSelect: 'none' }}>
                
                {/* SIDEBAR MOCK */}
                <div style={{ width: '25%', backgroundColor: '#ffffff', borderRight: '1px solid #e4e4e7', display: 'flex', flexDirection: 'column', padding: '10px 6px', boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px', paddingLeft: '4px' }}>
                    <div style={{ backgroundColor: '#ff4d00', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Flame size={12} color="white" />
                    </div>
                    <span style={{ fontWeight: 'bold', fontSize: '0.75rem', color: '#0f172a' }}>FireCheck</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', borderRadius: '6px', backgroundColor: 'rgba(255, 77, 0, 0.08)', color: '#ff4d00', fontWeight: 'bold' }}>
                      <ClipboardList size={11} /> Auditorias
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', borderRadius: '6px', color: '#64748b' }}>
                      <Trophy size={11} /> Ranking
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', borderRadius: '6px', color: '#64748b' }}>
                      <ClipboardList size={11} /> Checklists
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', borderRadius: '6px', color: '#64748b' }}>
                      <Users size={11} /> Equipe
                    </div>
                  </div>
                </div>

                {/* CONTENT AREA MOCK */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 14px', boxSizing: 'border-box', overflow: 'hidden' }}>
                  {/* Top Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontWeight: '800', fontSize: '0.8rem', color: '#0f172a' }}>Painel Geral</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #ff4d00', color: '#ff4d00', padding: '3px 8px', borderRadius: '6px', fontWeight: '700', fontSize: '0.55rem', backgroundColor: 'rgba(255,77,0,0.02)' }}>
                      <Flame size={9} /> Duga Burguer
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '8px', padding: '8px', boxSizing: 'border-box' }}>
                      <div style={{ color: '#64748b', fontSize: '0.5rem', fontWeight: '600', marginBottom: '2px' }}>CONFORMIDADE</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#10b981' }}>94%</span>
                        <span style={{ fontSize: '0.5rem', color: '#10b981', fontWeight: 'bold' }}>+4.2%</span>
                      </div>
                      <div style={{ height: '4px', backgroundColor: '#e4e4e7', borderRadius: '100px', overflow: 'hidden' }}>
                        <div style={{ width: '94%', height: '100%', backgroundColor: '#10b981' }}></div>
                      </div>
                    </div>
                    
                    <div style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '8px', padding: '8px', boxSizing: 'border-box' }}>
                      <div style={{ color: '#64748b', fontSize: '0.5rem', fontWeight: '600', marginBottom: '2px' }}>CHECKLISTS HOJE</div>
                      <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#ff4d00', marginBottom: '4px' }}>18/20</div>
                      <div style={{ height: '4px', backgroundColor: '#e4e4e7', borderRadius: '100px', overflow: 'hidden' }}>
                        <div style={{ width: '90%', height: '100%', backgroundColor: '#ff4d00' }}></div>
                      </div>
                    </div>

                    <div style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '8px', padding: '8px', boxSizing: 'border-box' }}>
                      <div style={{ color: '#64748b', fontSize: '0.5rem', fontWeight: '600', marginBottom: '2px' }}>ALERTAS DE IA</div>
                      <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#ef4444', marginBottom: '4px' }}>1 Pendente</div>
                      <div style={{ height: '4px', backgroundColor: '#e4e4e7', borderRadius: '100px', overflow: 'hidden' }}>
                        <div style={{ width: '50%', height: '100%', backgroundColor: '#ef4444' }}></div>
                      </div>
                    </div>
                  </div>

                  {/* Auditorias Table Card */}
                  <div style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e4e4e7', padding: '6px 10px', display: 'flex', fontWeight: 'bold', color: '#475569', fontSize: '0.5rem' }}>
                      <div style={{ flex: 2 }}>Checklist / Funcionário</div>
                      <div style={{ flex: 2 }}>Status da IA</div>
                      <div style={{ flex: 1, textAlign: 'right' }}>Horário</div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                      {/* Row 1 */}
                      <div style={{ borderBottom: '1px solid #f1f5f9', padding: '8px 10px', display: 'flex', alignItems: 'center', fontSize: '0.55rem' }}>
                        <div style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '700', color: '#0f172a' }}>Auditoria de Fechamento</span>
                          <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Eduardo Silva</span>
                        </div>
                        <div style={{ flex: 2 }}>
                          <span style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#10b981', padding: '2px 8px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 'bold' }}>✅ Aprovado pela IA</span>
                        </div>
                        <div style={{ flex: 1, textAlign: 'right', color: '#64748b' }}>14:31</div>
                      </div>
                      {/* Row 2 */}
                      <div style={{ borderBottom: '1px solid #f1f5f9', padding: '8px 10px', display: 'flex', alignItems: 'center', fontSize: '0.55rem' }}>
                        <div style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '700', color: '#0f172a' }}>Limpeza da Chapa</span>
                          <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Funcionario Demo</span>
                        </div>
                        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '2px 8px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 'bold', width: 'fit-content' }}>❌ Reprovado pela IA</span>
                          <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: '500' }}>Resíduo de carvão</span>
                        </div>
                        <div style={{ flex: 1, textAlign: 'right', color: '#64748b' }}>14:20</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ backgroundColor: '#cbd5e1', height: '10px', borderBottomLeftRadius: '10px', borderBottomRightRadius: '10px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '60px', height: '4px', backgroundColor: '#94a3b8', borderBottomLeftRadius: '4px', borderBottomRightRadius: '4px' }}></div>
              </div>
            </div>

            {/* Mobile Mockup */}
            <div className="phone-mockup-overlap">
              <div style={{ background: '#000000', border: '8px solid #1e293b', borderRadius: '32px', aspectRatio: '0.485', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', position: 'relative', width: '100%' }}>
                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '50px', height: '10px', backgroundColor: '#1e293b', borderBottomLeftRadius: '6px', borderBottomRightRadius: '6px', zIndex: 100 }}></div>
                
                {/* Employee App View */}
                <div style={{ flex: 1, background: '#F4F4F5', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '0.65rem', color: '#18181b', boxSizing: 'border-box' }}>
                  {/* Status Bar */}
                  <div style={{ padding: '6px 12px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.55rem', fontWeight: 'bold', color: '#64748b' }}>
                    <span>09:41</span>
                    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                      <Smartphone size={8} /> 4G
                    </div>
                  </div>

                  {/* App Header (Orange banner) */}
                  <div style={{ backgroundColor: '#ff4d00', color: 'white', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyItems: 'center', alignItems: 'center', gap: '6px' }}>
                      <div style={{ backgroundColor: 'white', padding: '2px', borderRadius: '3px' }}>
                        <Flame size={10} color="#ff4d00" />
                      </div>
                      <span style={{ fontWeight: 'bold', fontSize: '0.7rem' }}>FireCheck</span>
                    </div>
                    <div style={{ fontSize: '0.5rem', opacity: 0.9 }}>Duga Burguer • Eduardo Silva</div>
                  </div>

                  {/* Checklist List Container */}
                  <div style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
                    <div style={{ color: '#64748b', fontWeight: 'bold', fontSize: '0.55rem' }}>MEUS CHECKLISTS DE HOJE</div>
                    
                    {/* Checklist Card 1 */}
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', borderLeft: '4px solid #10b981', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #e4e4e7', borderRight: '1px solid #e4e4e7', borderBottom: '1px solid #e4e4e7' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '0.6rem' }}>Auditoria de Fechamento</div>
                        <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '1px 6px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 'bold' }}>Concluído</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ flex: 1, height: '4px', backgroundColor: '#e4e4e7', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: '100%', height: '100%', backgroundColor: '#10b981' }}></div>
                        </div>
                        <span style={{ fontSize: '0.5rem', color: '#10b981', fontWeight: 'bold' }}>100%</span>
                      </div>
                    </div>

                    {/* Checklist Card 2 */}
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', borderLeft: '4px solid #ff4d00', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #e4e4e7', borderRight: '1px solid #e4e4e7', borderBottom: '1px solid #e4e4e7' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '0.6rem' }}>Limpeza da Chapa</div>
                        <span style={{ backgroundColor: 'rgba(255, 77, 0, 0.1)', color: '#ff4d00', padding: '1px 6px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 'bold' }}>Aguardando</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ flex: 1, height: '4px', backgroundColor: '#e4e4e7', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: '60%', height: '100%', backgroundColor: '#ff4d00' }}></div>
                        </div>
                        <span style={{ fontSize: '0.5rem', color: '#ff4d00', fontWeight: 'bold' }}>60%</span>
                      </div>
                    </div>

                    {/* Checklist Card 3 */}
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', borderLeft: '4px solid #94a3b8', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #e4e4e7', borderRight: '1px solid #e4e4e7', borderBottom: '1px solid #e4e4e7', opacity: 0.75 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '0.6rem' }}>Ponto Eletrônico</div>
                        <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '1px 6px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 'bold' }}>Pendente</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ flex: 1, height: '4px', backgroundColor: '#e4e4e7', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: '0%', height: '100%' }}></div>
                        </div>
                        <span style={{ fontSize: '0.5rem', color: '#64748b', fontWeight: 'bold' }}>0%</span>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO COMPARATIVA: ANTES VS DEPOIS (A VIRADA) - TEMA CLARO */}
      <section className="section-mobile-padding" id="a-virada" style={{ padding: '100px 5%', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(24px, 5vw, 60px)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#ff4d00', letterSpacing: '2px', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
              A VIRADA
            </span>
            <h2 style={{ fontSize: 'min(2.8rem, 6vw)', fontWeight: '900', color: '#0f172a', marginBottom: '16px', lineHeight: '1.2' }}>
              Você não pode estar em três lugares <br/>ao mesmo tempo. <span style={{ color: '#ff4d00' }}>O padrão, pode.</span>
            </h2>
            <p style={{ color: '#475569', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
              Cada hora que passa entre o erro operacional e a descoberta tem um custo. Veja a diferença quando você começa a gerenciar com o FireCheck.
            </p>
          </div>


          <style>{`
            .comparison-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px 24px;
            }
            .comp-col-title {
              font-size: 0.95rem;
              font-weight: 800;
              letter-spacing: 1px;
              text-transform: uppercase;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .comp-card {
              border-radius: 16px;
              padding: 20px 24px;
              display: flex;
              gap: 16px;
              align-items: flex-start;
            }
            .card-without {
              background: #fef2f2;
              border: 1px solid #fee2e2;
            }
            .card-with {
              background: #f0fdf4;
              border: 1px solid #bbf7d0;
            }
            .comp-card-icon {
              display: flex;
              padding: 8px;
              border-radius: 50%;
              flex-shrink: 0;
            }
            .icon-without { background: #fee2e2; color: #ef4444; }
            .icon-with { background: #dcfce7; color: #16a34a; }
            .comp-card-text {
              font-size: 0.95rem;
              line-height: 1.5;
              color: #475569;
            }
            .card-without .comp-card-text { color: #7f1d1d; }
            .card-with .comp-card-text { color: #14532d; font-weight: 500; }
            
            @media (max-width: 768px) {
              .comparison-grid {
                gap: 6px 8px;
              }
              .comp-col-title {
                font-size: 0.7rem;
                letter-spacing: 0.5px;
              }
              .comp-card {
                padding: 8px 10px;
                gap: 6px;
                border-radius: 10px;
              }
              .comp-card-icon {
                padding: 4px;
              }
              .comp-card-icon svg {
                width: 10px;
                height: 10px;
              }
              .comp-card-text {
                font-size: 0.68rem;
                line-height: 1.35;
              }
            }
          `}</style>

          <div className="comparison-grid">
            {/* Row 1: Títulos */}
            <div className="comp-col-title" style={{ color: '#ef4444' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span> Sem o FireCheck
            </div>
            <div className="comp-col-title" style={{ color: '#16a34a' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a' }}></span> Com o FireCheck
            </div>

            {/* Row 2 */}
            <div className="comp-card card-without">
              <div className="comp-card-icon icon-without"><X size={16} /></div>
              <div className="comp-card-text">Você tem três unidades físicas e não sabe qual delas realmente abriu no horário correto hoje.</div>
            </div>
            <div className="comp-card card-with">
              <div className="comp-card-icon icon-with"><Check size={16} /></div>
              <div className="comp-card-text">Você abre o painel geral no seu celular e vê o status em tempo real de cada unidade, turno a turno, antes do seu primeiro café.</div>
            </div>

            {/* Row 3 */}
            <div className="comp-card card-without">
              <div className="comp-card-icon icon-without"><X size={16} /></div>
              <div className="comp-card-text">Um erro grave aconteceu na cozinha às 7h. Você só fica sabendo no fechamento às 18h, quando não há mais o que reverter.</div>
            </div>
            <div className="comp-card card-with">
              <div className="comp-card-icon icon-with"><Check size={16} /></div>
              <div className="comp-card-text">Alertas de itens críticos (gás aberto, câmara quente) caem no seu WhatsApp no exato segundo em que o desvio ocorre.</div>
            </div>

            {/* Row 4 */}
            <div className="comp-card card-without">
              <div className="comp-card-icon icon-without"><X size={16} /></div>
              <div className="comp-card-text">Você monta processos no papel, delega para a equipe e reza para que eles sigam as regras. Sem nenhuma prova de execução.</div>
            </div>
            <div className="comp-card card-with">
              <div className="comp-card-icon icon-with"><Check size={16} /></div>
              <div className="comp-card-text">Evidências inquestionáveis. As tarefas exigem foto em tempo real tirada na hora e localização via GPS. Se não registrar, não conta.</div>
            </div>

            {/* Row 5 */}
            <div className="comp-card card-without">
              <div className="comp-card-icon icon-without"><X size={16} /></div>
              <div className="comp-card-text">Cada gerente de unidade tem uma versão diferente do que é um "padrão bom". Sua marca perde consistência.</div>
            </div>
            <div className="comp-card card-with">
              <div className="comp-card-icon icon-with"><Check size={16} /></div>
              <div className="comp-card-text">Scoreboard automático por filial, setor e operador. Você compara o desempenho das unidades com dados concretos.</div>
            </div>

            {/* Row 6 */}
            <div className="comp-card card-without">
              <div className="comp-card-icon icon-without"><X size={16} /></div>
              <div className="comp-card-text">Quando você se afasta para viajar ou descansar, a operação segue pura e simplesmente na base da fé.</div>
            </div>
            <div className="comp-card card-with">
              <div className="comp-card-icon icon-with"><Check size={16} /></div>
              <div className="comp-card-text">Dashboard no bolso. Sua equipe executa as tarefas seguindo o padrão pré-definido por IA, mesmo sem a sua presença física.</div>
            </div>
          </div>
          
          <div style={{ textAlign: 'center', marginTop: '48px' }}>
            <button className="btn" style={{ padding: '16px 40px', fontSize: '1.1rem', boxShadow: '0 4px 25px rgba(255,77,0,0.4)' }} onClick={() => handleTrackAndNavigate('A Virada - Começar Teste Grátis', '/checkout?plan=trial')}>
              Quero Testar Grátis por 7 Dias <ArrowRight size={20} style={{ marginLeft: '8px' }} />
            </button>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '16px' }}>Sua operação no piloto automático.</p>
          </div>
        </div>
      </section>


      {/* SEÇÃO INTERATIVA: Criador de Checklist por IA (Voz/Texto) */}
      <section className="section-mobile-padding" style={{ padding: '100px 5%', backgroundColor: '#0b0f19', color: '#ffffff', position: 'relative', zIndex: 12, overflow: 'hidden', borderBottom: '1px solid rgba(255, 77, 0, 0.15)' }}>
        {/* Glow effects */}
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(255, 77, 0, 0.12) 0%, transparent 70%)', pointerEvents: 'none' }}></div>
        <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, transparent 70%)', pointerEvents: 'none' }}></div>

        <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(20px, 4vw, 56px)' }}>
            <div style={{ border: '1px solid rgba(255, 77, 0, 0.4)', color: '#ff4d00', padding: '8px 20px', borderRadius: '30px', fontSize: '0.85rem', fontWeight: '800', marginBottom: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px', letterSpacing: '1px', textTransform: 'uppercase', backgroundColor: 'rgba(255, 77, 0, 0.05)', boxShadow: '0 0 20px rgba(255, 77, 0, 0.15)' }}>
              <Sparkles size={16} /> Adeus Trabalho Manual
            </div>
            <h2 style={{ fontSize: 'min(3rem, 6vw)', fontWeight: '900', marginBottom: '16px', lineHeight: '1.2', color: '#ffffff' }}>
              Crie checklists em segundos <br/>
              <span style={{ background: 'linear-gradient(90deg, #ff4d00, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                conversando com nossa IA
              </span>
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto', lineHeight: '1.6' }}>
              Criar checklists é a parte mais chata. Com o <strong>Bill IA</strong>, basta falar ou digitar. A IA entende e monta tudo automaticamente para a sua equipe.
            </p>
          </div>

          {/* Interactive Demo Tabs */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '40px', flexWrap: 'wrap' }}>
            {Object.keys(AI_DEMO_DATA).map((key) => (
              <button
                key={key}
                onClick={() => startDemoAnimation(key)}
                style={{
                  padding: '12px 24px',
                  borderRadius: '30px',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  border: '1px solid',
                  borderColor: activeAiDemo === key ? '#ff4d00' : 'rgba(255, 255, 255, 0.1)',
                  backgroundColor: activeAiDemo === key ? 'rgba(255, 77, 0, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                  color: activeAiDemo === key ? '#ff4d00' : '#94a3b8',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: activeAiDemo === key ? '0 0 15px rgba(255, 77, 0, 0.15)' : 'none'
                }}
              >
                {AI_DEMO_DATA[key].tabLabel}
              </button>
            ))}
          </div>

          {/* Simulation Grid */}
          <style>{`
            .ai-sim-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 24px;
              align-items: stretch;
            }
            @media (max-width: 768px) {
              .ai-sim-grid {
                grid-template-columns: 1fr 1fr;
                gap: 12px;
              }
              .ai-sim-grid .ai-chat-box {
                padding: 14px !important;
                height: 360px !important;
              }
              .ai-sim-grid .ai-checklist-box {
                padding: 16px !important;
                height: 360px !important;
              }
              .ai-sim-grid .ai-chat-box .chat-header-name { font-size: 0.8rem !important; }
              .ai-sim-grid .ai-chat-box .chat-msg { font-size: 0.75rem !important; padding: 8px 10px !important; }
              .ai-sim-grid .ai-checklist-box h3 { font-size: 0.95rem !important; }
              .ai-sim-grid .ai-checklist-box .task-row { padding: 10px !important; }
              .ai-sim-grid .ai-checklist-box .task-text { font-size: 0.78rem !important; }
              .ai-sim-grid .ai-checklist-box .task-tag { font-size: 0.6rem !important; padding: 2px 5px !important; }
              .ai-sim-grid .ai-checklist-box .deploy-btn { padding: 10px !important; font-size: 0.85rem !important; }
            }
            @media (max-width: 420px) {
              .ai-sim-grid {
                grid-template-columns: 1fr;
              }
              .ai-sim-grid .ai-chat-box,
              .ai-sim-grid .ai-checklist-box {
                height: 340px !important;
              }
            }
          `}</style>
          <div className="ai-sim-grid">
            
            {/* Left Box: Chat Simulator */}
            <div className="ai-chat-box" style={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', height: '420px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', position: 'relative' }}>
              
              {/* Chat Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px', marginBottom: '16px' }}>
                <div style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(6,182,212,0.3)', flexShrink: 0 }}>
                  <Bot size={20} color="white" />
                </div>
                <div>
                  <div className="chat-header-name" style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#ffffff' }}>Bill IA</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#10b981' }}>
                    <span style={{ width: '6px', height: '6px', backgroundColor: '#10b981', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.5s infinite' }}></span>
                    online
                  </div>
                </div>
              </div>

              {/* Chat Messages Log */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>
                
                {/* System/Intro Message */}
                <div className="chat-msg" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '16px', padding: '12px 16px', fontSize: '0.85rem', color: '#94a3b8', maxWidth: '85%' }}>
                  🤖 <strong>Bill IA:</strong> Olá! Me diga qual checklist você quer criar hoje. Você pode falar ou digitar!
                </div>

                {/* User Message (Step >= 1) */}
                {demoStep >= 1 && (
                  <div className="chat-msg" style={{ alignSelf: 'flex-end', backgroundColor: '#ff4d00', color: '#ffffff', borderRadius: '16px 16px 4px 16px', padding: '12px 16px', fontSize: '0.85rem', maxWidth: '85%', boxShadow: '0 4px 10px rgba(255, 77, 0, 0.2)', animation: 'slideUp 0.3s ease' }}>
                    {AI_DEMO_DATA[activeAiDemo].isAudio ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Mic size={16} />
                        <span style={{ fontWeight: '600' }}>Mensagem de Voz ({AI_DEMO_DATA[activeAiDemo].audioDuration})</span>
                        {demoStep === 1 && (
                          <div style={{ display: 'flex', gap: '2px', alignItems: 'center', marginLeft: '8px' }}>
                            <span style={{ width: '3px', height: '12px', backgroundColor: '#ffffff', borderRadius: '2px', animation: 'ai-soundwave 0.8s infinite alternate' }}></span>
                            <span style={{ width: '3px', height: '18px', backgroundColor: '#ffffff', borderRadius: '2px', animation: 'ai-soundwave 0.8s infinite alternate 0.2s' }}></span>
                            <span style={{ width: '3px', height: '14px', backgroundColor: '#ffffff', borderRadius: '2px', animation: 'ai-soundwave 0.8s infinite alternate 0.4s' }}></span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <MessageSquare size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                        <span>"{AI_DEMO_DATA[activeAiDemo].userText}"</span>
                      </div>
                    )}
                  </div>
                )}

                {/* User transcription text if it was audio */}
                {demoStep >= 2 && AI_DEMO_DATA[activeAiDemo].isAudio && (
                  <div className="chat-msg" style={{ alignSelf: 'flex-end', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '8px 12px', fontSize: '0.8rem', color: '#cbd5e1', maxWidth: '85%', fontStyle: 'italic', marginTop: '-8px' }}>
                    Transcrição: "{AI_DEMO_DATA[activeAiDemo].userText}"
                  </div>
                )}

                {/* AI Analyzing status (Step === 2) */}
                {demoStep === 2 && (
                  <div className="chat-msg" style={{ backgroundColor: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '16px 16px 16px 4px', padding: '12px 16px', fontSize: '0.85rem', color: '#06b6d4', maxWidth: '85%', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <span className="dot" style={{ width: '6px', height: '6px', backgroundColor: '#06b6d4', borderRadius: '50%', display: 'inline-block', animation: 'ai-bounce 1.4s infinite' }}></span>
                      <span className="dot" style={{ width: '6px', height: '6px', backgroundColor: '#06b6d4', borderRadius: '50%', display: 'inline-block', animation: 'ai-bounce 1.4s infinite 0.2s' }}></span>
                      <span className="dot" style={{ width: '6px', height: '6px', backgroundColor: '#06b6d4', borderRadius: '50%', display: 'inline-block', animation: 'ai-bounce 1.4s infinite 0.4s' }}></span>
                    </div>
                    Bill está ouvindo e organizando as tarefas...
                  </div>
                )}

                {/* AI Reply (Step >= 3) */}
                {demoStep >= 3 && (
                  <div className="chat-msg" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px 16px 16px 4px', padding: '12px 16px', fontSize: '0.85rem', color: '#cbd5e1', maxWidth: '85%', animation: 'slideUp 0.3s ease' }}>
                    🤖 <strong>Bill IA:</strong> {AI_DEMO_DATA[activeAiDemo].aiReply}
                  </div>
                )}

              </div>

              {/* Chat Input Mockup */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px 16px', fontSize: '0.85rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Fale com o Bill IA...</span>
                  <Mic size={16} color="#64748b" />
                </div>
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '1rem' }}>⚡</span>
                </div>
              </div>

            </div>

            {/* Right Box: Dynamic Checklist Generator */}
            <div className="ai-checklist-box" style={{ backgroundColor: '#ffffff', borderRadius: '24px', border: '1px solid var(--border-color)', padding: '32px', display: 'flex', flexDirection: 'column', height: '420px', boxShadow: '0 20px 40px rgba(0,0,0,0.05)', color: 'var(--text-main)' }}>
              
              {demoStep < 3 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: 'var(--text-muted)' }}>
                  <div style={{ position: 'relative', width: '64px', height: '64px' }}>
                    <div style={{ position: 'absolute', inset: 0, border: '4px solid #f1f5f9', borderRadius: '50%' }}></div>
                    <div style={{ position: 'absolute', inset: 0, border: '4px solid #ff4d00', borderTopColor: 'transparent', borderRadius: '50%', animation: 'ai-spin 1s infinite linear' }}></div>
                  </div>
                  <div style={{ fontWeight: '600', fontSize: '0.95rem', textAlign: 'center' }}>
                    {demoStep === 1 ? 'Aguardando envio do comando...' : 'IA organizando as tarefas e regras...'}
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.5s ease', overflow: 'hidden' }}>
                  {/* Checklist Header */}
                  <div style={{ marginBottom: '16px', borderBottom: '2px dashed var(--border-color)', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', color: '#ff4d00', backgroundColor: 'rgba(255, 77, 0, 0.08)', padding: '4px 10px', borderRadius: '20px' }}>
                        ✓ Checklist Gerado por IA
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>3 tarefas</span>
                    </div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginTop: '10px', color: 'var(--text-main)' }}>
                      {AI_DEMO_DATA[activeAiDemo].checklistTitle}
                    </h3>
                  </div>

                  {/* Tasks List with Progress */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'auto' }}>
                    {AI_DEMO_DATA[activeAiDemo].tasks.map((task, i) => {
                      const pcts = [100, 75, 40];
                      const pct = pcts[i] || 0;
                      const barColor = pct === 100 ? '#10b981' : pct >= 60 ? '#ff4d00' : '#f59e0b';
                      return (
                        <div
                          className="task-row"
                          key={i}
                          style={{
                            padding: '14px',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: '#f8fafc',
                            animation: `slideUp 0.3s ease forwards ${i * 0.15}s`,
                            opacity: 0,
                            transform: 'translateY(10px)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                              <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${barColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: pct === 100 ? 'rgba(16, 185, 129, 0.08)' : 'transparent' }}>
                                {pct === 100 && <Check size={12} color="#10b981" style={{ strokeWidth: '3.5px' }} />}
                              </div>
                              <span className="task-text" style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {task.text}
                              </span>
                            </div>
                            <span className="task-tag" style={{
                              fontSize: '0.65rem',
                              fontWeight: '700',
                              padding: '3px 7px',
                              borderRadius: '6px',
                              backgroundColor: task.type === '📸 Foto Obrigatória' ? 'rgba(255, 77, 0, 0.08)' : task.type === '📝 Texto' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(241, 245, 249, 1)',
                              color: task.type === '📸 Foto Obrigatória' ? '#ff4d00' : task.type === '📝 Texto' ? '#3b82f6' : 'var(--text-muted)',
                              marginLeft: '8px',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}>
                              {task.type}
                            </span>
                          </div>
                          {/* Progress Bar */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '6px', backgroundColor: '#e4e4e7', borderRadius: '100px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', backgroundColor: barColor, borderRadius: '100px', transition: 'width 0.6s ease' }}></div>
                            </div>
                            <span style={{ fontSize: '0.7rem', fontWeight: '700', color: barColor, minWidth: '32px', textAlign: 'right' }}>{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Deploy Action */}
                  <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <button
                      className="btn deploy-btn"
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.95rem', padding: '14px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(255, 77, 0, 0.3)' }}
                      onClick={() => handleTrackAndNavigate('Enviar Checklist IA para Equipe', '/checkout?plan=trial')}
                    >
                      Começar com este Checklist <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              )}

            </div>

          </div>


        </div>

        {/* Global Styles helper for the simulation animations */}
        <style>{`
          @keyframes ai-soundwave {
            0% { transform: scaleY(0.3); }
            100% { transform: scaleY(1); }
          }
          @keyframes ai-bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
          }
          @keyframes ai-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </section>


      {/* Seção: Exemplos Práticos da IA (Cozinha, Academia, Frota, Hotel) */}
      <section className="section-mobile-padding" style={{ padding: '80px 0', backgroundColor: 'var(--bg-card)', position: 'relative', zIndex: 11, overflow: 'hidden' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 5%' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: 'min(2.5rem, 5vw)', fontWeight: '900', marginBottom: '16px', color: 'var(--text-main)' }}>A IA audita <span style={{ color: '#ff4d00' }}>Qualquer Padrão</span></h2>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto' }}>Veja o FireCheck reprovando falhas reais em 4 setores diferentes.</p>
            <div className="mobile-swipe-hint" style={{ display: 'none', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#ff4d00', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '16px' }}>
              Role para o lado para ver mais exemplos <ArrowRight size={16} />
            </div>
          </div>
        </div>

        {/* Container Horizontal com os 4 Exemplos Lado a Lado (Sempre Lado a Lado) */}
        <div className="horizontal-scroll-container" style={{ display: 'flex', gap: '20px', padding: '20px 5%', overflowX: 'auto', flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch', snapType: 'x mandatory', paddingBottom: '40px', alignItems: 'center' }}>
          <style>{`
            .horizontal-scroll-container::-webkit-scrollbar { height: 8px; }
            .horizontal-scroll-container::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 4px; margin: 0 5%; }
            .horizontal-scroll-container::-webkit-scrollbar-thumb { background: rgba(255,77,0,0.5); border-radius: 4px; }
            .example-mockup { flex: 0 0 280px; scroll-snap-align: center; }
            @media (min-width: 1280px) {
              .horizontal-scroll-container { justify-content: center; }
            }
            @media (max-width: 768px) {
              .example-mockup { 
                flex: 0 0 280px !important; 
                transform: scale(0.75);
                transform-origin: left top;
                margin-right: -70px; 
              }
              .horizontal-scroll-container {
                align-items: flex-start !important;
                height: 430px !important;
                overflow-y: hidden !important;
                touch-action: pan-x pan-y;
                overscroll-behavior-y: none;
              }
              .mobile-swipe-hint { display: flex !important; animation: pulse-swipe 1.5s infinite; }
            }
            @keyframes pulse-swipe {
              0% { transform: translateX(0); }
              50% { transform: translateX(10px); }
              100% { transform: translateX(0); }
            }
          `}</style>

          {/* Exemplo 1: Cozinha */}
          <div className="example-mockup phone-mockup" style={{ backgroundColor: '#ffffff', border: '8px solid #18181b', borderRadius: '32px', height: '520px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', overflow: 'hidden', position: 'relative' }}>
            <div className="phone-notch" style={{ width: '100px', height: '20px', backgroundColor: '#18181b' }}></div>
            <div style={{ padding: '40px 16px 16px', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}><ArrowLeft size={16}/> Cozinha Comercial</div>
            <div style={{ position: 'relative', height: '220px', width: '100%' }}>
              <img src="/dirty-grill.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: '#ef4444', color: 'white', padding: '4px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 'bold' }}>Reprovado</div>
            </div>
            <div style={{ padding: '16px', flex: 1, backgroundColor: '#f8fafc' }}>
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '12px', padding: '12px' }}>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}><AlertTriangle size={16} color="#ef4444" /> <span style={{ fontWeight: 'bold', color: '#991b1b', fontSize: '0.8rem' }}>Análise da IA</span></div>
                <p style={{ color: '#7f1d1d', fontSize: '0.75rem', lineHeight: '1.4', margin: 0 }}>Crostas de gordura carbonizada na lateral direita da chapa. Refaça a limpeza.</p>
              </div>
              <button style={{ width: '100%', padding: '10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem', marginTop: '16px' }}>Notificar Funcionário</button>
            </div>
          </div>

          {/* Exemplo 2: Academia */}
          <div className="example-mockup phone-mockup" style={{ backgroundColor: '#ffffff', border: '8px solid #18181b', borderRadius: '32px', height: '520px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', overflow: 'hidden', position: 'relative' }}>
            <div className="phone-notch" style={{ width: '100px', height: '20px', backgroundColor: '#18181b' }}></div>
            <div style={{ padding: '40px 16px 16px', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}><ArrowLeft size={16}/> Academia Fitness</div>
            <div style={{ position: 'relative', height: '220px', width: '100%' }}>
              <img src="/gym-treadmill.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: '#ef4444', color: 'white', padding: '4px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 'bold' }}>Reprovado</div>
            </div>
            <div style={{ padding: '16px', flex: 1, backgroundColor: '#f8fafc' }}>
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '12px', padding: '12px' }}>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}><AlertTriangle size={16} color="#ef4444" /> <span style={{ fontWeight: 'bold', color: '#991b1b', fontSize: '0.8rem' }}>Análise da IA</span></div>
                <p style={{ color: '#7f1d1d', fontSize: '0.75rem', lineHeight: '1.4', margin: 0 }}>Suor não higienizado no painel da esteira 3. Limpeza incompleta.</p>
              </div>
              <button style={{ width: '100%', padding: '10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem', marginTop: '16px' }}>Notificar Recepcionista</button>
            </div>
          </div>

          {/* Exemplo 3: Frota */}
          <div className="example-mockup phone-mockup" style={{ backgroundColor: '#ffffff', border: '8px solid #18181b', borderRadius: '32px', height: '520px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', overflow: 'hidden', position: 'relative' }}>
            <div className="phone-notch" style={{ width: '100px', height: '20px', backgroundColor: '#18181b' }}></div>
            <div style={{ padding: '40px 16px 16px', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}><ArrowLeft size={16}/> Logística e Frota</div>
            <div style={{ position: 'relative', height: '220px', width: '100%' }}>
              <img src="/fleet-tire.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: '#ef4444', color: 'white', padding: '4px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 'bold' }}>Reprovado</div>
            </div>
            <div style={{ padding: '16px', flex: 1, backgroundColor: '#f8fafc' }}>
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '12px', padding: '12px' }}>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}><AlertTriangle size={16} color="#ef4444" /> <span style={{ fontWeight: 'bold', color: '#991b1b', fontSize: '0.8rem' }}>Análise da IA</span></div>
                <p style={{ color: '#7f1d1d', fontSize: '0.75rem', lineHeight: '1.4', margin: 0 }}>Desgaste excessivo detectado no pneu traseiro direito. Abaixo do indicador TWI.</p>
              </div>
              <button style={{ width: '100%', padding: '10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem', marginTop: '16px' }}>Bloquear Veículo</button>
            </div>
          </div>

          {/* Exemplo 4: Hotel */}
          <div className="example-mockup phone-mockup" style={{ backgroundColor: '#ffffff', border: '8px solid #18181b', borderRadius: '32px', height: '520px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', overflow: 'hidden', position: 'relative' }}>
            <div className="phone-notch" style={{ width: '100px', height: '20px', backgroundColor: '#18181b' }}></div>
            <div style={{ padding: '40px 16px 16px', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}><ArrowLeft size={16}/> Hotelaria</div>
            <div style={{ position: 'relative', height: '220px', width: '100%' }}>
              <img src="/hotel-bed.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: '#ef4444', color: 'white', padding: '4px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 'bold' }}>Reprovado</div>
            </div>
            <div style={{ padding: '16px', flex: 1, backgroundColor: '#f8fafc' }}>
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '12px', padding: '12px' }}>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}><AlertTriangle size={16} color="#ef4444" /> <span style={{ fontWeight: 'bold', color: '#991b1b', fontSize: '0.8rem' }}>Análise da IA</span></div>
                <p style={{ color: '#7f1d1d', fontSize: '0.75rem', lineHeight: '1.4', margin: 0 }}>Lençol amassado e travesseiros fora de esquadro. Arrumação fora do padrão da rede.</p>
              </div>
              <button style={{ width: '100%', padding: '10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem', marginTop: '16px' }}>Notificar Camareira</button>
            </div>
          </div>

        </div>
      </section>

      {/* 4 Badges de Benefícios */}
      <section className="section-mobile-padding" style={{ padding: '40px 5%', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
        <div className="badges-mobile" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center', maxWidth: '1000px' }}>
          
          <div className="badge-small" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-card)', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ color: '#06b6d4' }}><Bot size={16} /></div>
            <span style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-main)' }}>IA Auditora</span>
          </div>

          <div className="badge-small" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-card)', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ color: '#06b6d4' }}><Flame size={16} /></div>
            <span style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-main)' }}>Alertas Reais</span>
          </div>

          <div className="badge-small" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-card)', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ color: '#06b6d4' }}><CheckCircle size={16} /></div>
            <span style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-main)' }}>Gestão Equipe</span>
          </div>

          <div className="badge-small" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-card)', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ color: '#06b6d4' }}><ShieldCheck size={16} /></div>
            <span style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-main)' }}>Anti-Fraude</span>
          </div>
        </div>
      </section>

      {/* Seção Showcase de Features */}
      <section id="como-funciona" className="section-mobile-padding" style={{ padding: '100px 5%', backgroundColor: 'var(--bg-card)', position: 'relative', overflow: 'hidden' }}>
        
        <div style={{ position: 'absolute', top: '20%', left: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(255, 77, 0, 0.1) 0%, rgba(0,0,0,0) 70%)', pointerEvents: 'none' }}></div>
        <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(255, 200, 0, 0.05) 0%, rgba(0,0,0,0) 70%)', pointerEvents: 'none' }}></div>

        <div style={{ textAlign: 'center', marginBottom: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 10 }}>
          <div style={{ border: '1px solid rgba(255, 77, 0, 0.4)', color: '#ff4d00', padding: '8px 20px', borderRadius: '30px', fontSize: '0.85rem', fontWeight: '800', marginBottom: '24px', letterSpacing: '1px', textTransform: 'uppercase', boxShadow: '0 0 20px rgba(255, 77, 0, 0.2)' }}>
            <Flame size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-top' }} /> Visão Computacional e IA
          </div>
          <h2 style={{ fontSize: 'min(3.5rem, 7vw)', fontWeight: '900', marginBottom: '24px', lineHeight: '1.1', letterSpacing: '-1px' }}>
            Não espere o cliente <br/><span style={{ background: 'linear-gradient(90deg, #ff4d00, #ffb300)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>reclamar para descobrir.</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.25rem', maxWidth: '700px', lineHeight: '1.6' }}>
            A inteligência artificial do FireCheck age como um gerente onipresente. Se a temperatura da geladeira cair ou o chão estiver sujo, você sabe na hora.
          </p>
          <style>{`
            @media (max-width: 768px) {
              .grid-2-col-mobile {
                display: grid !important;
                grid-template-columns: 1fr !important;
                gap: 12px !important;
                margin-top: 24px !important;
              }
              .grid-2-col-mobile > div {
                padding: 16px !important;
                border-radius: 16px !important;
                display: flex !important;
                flex-direction: column !important;
              }
              .grid-2-col-mobile > div > div:first-child {
                margin-bottom: 8px !important;
              }
              .grid-2-col-mobile > div > div:first-child svg {
                width: 24px !important;
                height: 24px !important;
              }
              .grid-2-col-mobile h3, .grid-2-col-mobile h4 {
                font-size: 0.95rem !important;
                margin-bottom: 4px !important;
                line-height: 1.2 !important;
              }
              .grid-2-col-mobile p {
                font-size: 0.9rem !important;
                margin-bottom: 12px !important;
                line-height: 1.3 !important;
              }
              /* For the nested badges inside the cards */
              .grid-2-col-mobile > div > div:last-child {
                padding: 6px !important;
                font-size: 0.85rem !important;
                margin-top: auto !important;
              }
              .grid-2-col-mobile > div > div:last-child > div {
                font-size: 0.85rem !important;
                padding: 4px !important;
              }
              .scale-on-mobile {
                margin-top: 24px !important;
                width: 100% !important;
              }
            }
          `}</style>
          <div className="grid-2-col-mobile" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', maxWidth: '1200px', margin: '40px auto 0', position: 'relative', zIndex: 10 }}>

          <div style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255, 77, 0, 0.2)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ color: '#ff4d00', marginBottom: '16px' }}><Bot size={28} /></div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '8px' }}>Auditoria Imediata</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem', lineHeight: '1.4' }}>IA analisa a foto e reprova se estiver fora do padrão.</p>
            <div style={{ backgroundColor: 'rgba(255,77,0,0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,77,0,0.2)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#ff4d00', marginBottom: '6px' }}>
                ⚠️ Alerta da IA: Reprovado
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4', fontStyle: 'italic' }}>
                "A imagem mostra crostas de gordura carbonizada na lateral direita da chapa. Limpeza incompleta."
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '24px', border: '1px solid rgba(59, 130, 246, 0.2)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ color: '#3b82f6', marginBottom: '16px' }}><ShieldCheck size={28} /></div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '8px' }}>Provas Reais e Anti-Fraude</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem', lineHeight: '1.4' }}>Substitua a dúvida por evidências. Câmera obrigatória e fotos da galeria bloqueadas.</p>
            <div style={{ backgroundColor: 'rgba(59,130,246,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', color: '#3b82f6' }}>
              📍 GPS & Câmera Bloqueados
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '24px', border: '1px solid rgba(16, 185, 129, 0.2)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ color: '#10b981', marginBottom: '16px' }}><Trophy size={28} /></div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '8px' }}>Ranking</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem', lineHeight: '1.4' }}>Engaje sua equipe. O app ranqueia automaticamente.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ backgroundColor: 'rgba(16,185,129,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', color: '#10b981' }}>
                🥇 1º Lugar: Carlos
              </div>
              <div style={{ backgroundColor: '#f1f5f9', padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>
                🥈 2º Lugar: Marcos
              </div>
              <div style={{ backgroundColor: '#f1f5f9', padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b' }}>
                🥉 3º Lugar: João
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* Seção Agendamentos Automáticos */}
      <section className="section-mobile-padding" style={{ padding: '100px 5%', backgroundColor: 'var(--bg-color)', borderTop: '1px solid rgba(255,77,0,0.1)', borderBottom: '1px solid rgba(255,77,0,0.1)', position: 'relative' }}>
        
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'radial-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px)', backgroundSize: '30px 30px', opacity: 0.5, pointerEvents: 'none' }}></div>

        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '40px', position: 'relative', zIndex: 10 }}>
          
          <div style={{ flex: '1 1 300px' }}>
            <h2 style={{ fontSize: 'min(3rem, 6vw)', fontWeight: '900', marginBottom: '24px', lineHeight: '1.1' }}>
              Automação de Tarefas <br/><span style={{ color: '#ff4d00' }}>como uma Máquina.</span>
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.25rem', marginBottom: '40px', lineHeight: '1.6' }}>
              Você não precisa lembrar ninguém de trabalhar. O núcleo do FireCheck distribui as tarefas, cobra os atrasos via Push e audita com IA. Tudo de forma 100% autônoma.
            </p>

            <div className="grid-2-col-mobile" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
              <div style={{ padding: '24px', backgroundColor: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <div style={{ color: '#ff4d00', marginBottom: '12px' }}><Flame size={28} /></div>
                <h4 style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '8px' }}>Alertas de Atraso em Tempo Real</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Se o fechamento não começar na hora exata, você recebe um aviso no celular. O papel não fala, o FireCheck sim.</p>
              </div>
              <div style={{ padding: '24px', backgroundColor: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <div style={{ color: '#3b82f6', marginBottom: '12px' }}><Bot size={28} /></div>
                <h4 style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '8px' }}>Piloto Automático Ativado</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Equipe autônoma e responsável. Tome seu café relaxado enquanto monitora tudo de qualquer lugar.</p>
              </div>
            </div>
          </div>

          <div className="scale-on-mobile" style={{ flex: '1 1 300px' }}>
            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '1px', border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05)', position: 'relative' }}>
              
              <div style={{ borderRadius: '12px', backgroundColor: 'var(--bg-color)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px', backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '12px', backgroundImage: 'url(/avatar.png)', backgroundSize: 'cover', backgroundPosition: 'center', border: '2px solid #ff4d00' }}></div>
                  <div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: 0, color: 'var(--text-main)' }}>Fechamento de Loja</h3>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Eduardo • Duga Burguer</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>📅 24/04/2026, 12:28:23</div>
                  </div>
                </div>

                <div style={{ padding: '24px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '20px', color: 'var(--text-main)' }}>
                    Respostas do Checklist
                  </div>

                  <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--text-main)' }}>1. A chapa foi limpa e desengordurada?</div>
                      <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '6px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>Sim</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '20px' }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>📸 Evidência Fotográfica:</div>
                        <div style={{ width: '100%', height: '180px', backgroundColor: '#f4f4f5', backgroundImage: 'url(/dirty-grill.png)', backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        </div>
                      </div>
                      
                      <div>
                        <div style={{ backgroundColor: 'rgba(255, 77, 0, 0.05)', border: '1px solid rgba(255, 77, 0, 0.2)', borderRadius: '8px', padding: '16px' }}>
                          <div style={{ color: '#ffb300', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            ⚠️ Alerta da IA
                          </div>
                          <div style={{ color: 'var(--text-main)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                            A imagem mostra crostas de gordura carbonizada na lateral direita da chapa e resíduos no coletor. Limpeza incompleta.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Seção Controle de Ponto com IA */}
      <section style={{ padding: '80px 5%', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(59, 130, 246, 0.15)', padding: '6px 16px', borderRadius: '20px', fontSize: '0.85rem', color: '#60a5fa', fontWeight: '600', marginBottom: '16px' }}>
              ⏰ Módulo de Ponto Eletrônico
            </div>
            <h2 style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', color: '#f8fafc', marginBottom: '16px' }}>
              Controle de Ponto com <span style={{ color: '#3b82f6' }}>Inteligência Artificial</span>
            </h2>
            <p style={{ color: '#94a3b8', fontSize: 'clamp(0.9rem, 2vw, 1.1rem)', maxWidth: '700px', margin: '0 auto' }}>
              Reconhecimento facial, GPS obrigatório e alertas automáticos no WhatsApp quando algo sai do normal.
            </p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '40px' }}>
            {[
              { icon: '📸', title: 'Selfie com Reconhecimento Facial', desc: 'O funcionário precisa tirar uma selfie para bater o ponto. A IA valida que é realmente ele.' },
              { icon: '📍', title: 'Trava de GPS Obrigatória', desc: 'O ponto só é aceito se o funcionário estiver dentro da localização da empresa. Sem fraudes.' },
              { icon: '⏰', title: 'Alerta de Atraso no WhatsApp', desc: 'Se o funcionário não bateu o ponto no horário, você recebe um alerta instantâneo no WhatsApp.' },
              { icon: '🚪', title: 'Controle de Saída', desc: 'Saiu depois do horário? Não bateu saída? Você é notificado em tempo real via WhatsApp.' },
              { icon: '📊', title: 'Relatório Diário Automático', desc: 'Todo dia você recebe no WhatsApp o resumo de quem entrou, saiu, atrasou ou faltou.' },
              { icon: '📋', title: 'Folha de Ponto Digital', desc: 'Gere relatórios mensais de ponto com filtros por funcionário, data e tipo. Pronto para o contador.' },
            ].map((feat, i) => (
              <div key={i} style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>{feat.icon}</div>
                <h4 style={{ color: '#f1f5f9', marginBottom: '8px', fontSize: '1rem' }}>{feat.title}</h4>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>{feat.desc}</p>
              </div>
            ))}
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#60a5fa', fontWeight: '600', fontSize: '0.95rem' }}>💡 Disponível como módulo separado ou junto com Checklists no Pacote Completo</p>
          </div>
        </div>
      </section>


      {/* ── Seção: Depoimentos WhatsApp ── */}
      <section style={{ padding: '80px 5%', backgroundColor: 'var(--bg-card)', position: 'relative', overflow: 'hidden' }}>
        <style>{`
          .wpp-card {
            background: #fff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 24px rgba(0,0,0,0.10);
            display: flex;
            flex-direction: column;
            max-width: 340px;
            width: 100%;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
          .wpp-header {
            background: #075E54;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .wpp-avatar {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 1rem;
            color: white;
            flex-shrink: 0;
          }
          .wpp-contact-name { color: white; font-weight: 600; font-size: 0.9rem; }
          .wpp-contact-status { color: rgba(255,255,255,0.7); font-size: 0.7rem; }
          .wpp-body {
            background: #ECE5DD url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C2B280' fill-opacity='0.12'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
            padding: 16px 12px; display: flex; flex-direction: column; gap: 8px;
          }
          .wpp-bubble-received {
            background: white; border-radius: 0 10px 10px 10px; padding: 8px 12px;
            max-width: 85%; align-self: flex-start; box-shadow: 0 1px 2px rgba(0,0,0,0.13);
            font-size: 0.85rem; color: #111; line-height: 1.45;
          }
          .wpp-bubble-sent {
            background: #DCF8C6; border-radius: 10px 0 10px 10px; padding: 8px 12px;
            max-width: 85%; align-self: flex-end; box-shadow: 0 1px 2px rgba(0,0,0,0.13);
            font-size: 0.85rem; color: #111; line-height: 1.45;
          }
          .wpp-time { font-size: 0.65rem; color: #999; text-align: right; margin-top: 4px; display: flex; align-items: center; justify-content: flex-end; gap: 2px; }
          .wpp-tick { color: #4FC3F7; font-size: 0.8rem; }
          .wpp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; max-width: 1200px; margin: 0 auto; justify-items: center; }
          @media (max-width: 768px) {
            .wpp-grid {
              display: flex;
              flex-direction: row;
              overflow-x: auto;
              scroll-snap-type: x mandatory;
              gap: 16px;
              padding: 8px 20px 20px;
              -webkit-overflow-scrolling: touch;
              scrollbar-width: none;
            }
            .wpp-grid::-webkit-scrollbar { display: none; }
            .wpp-card {
              flex: 0 0 62vw;
              max-width: 240px;
              scroll-snap-align: center;
              transform: none;
              margin-bottom: 0;
            }
          }
        `}</style>

        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#25D366', color: 'white', padding: '6px 18px', borderRadius: '30px', fontSize: '0.8rem', fontWeight: '700', marginBottom: '16px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.888-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.347-.272.297-1.04 1.016-1.04 2.479 0 1.463 1.065 2.876 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
            Clientes Reais no WhatsApp
          </div>
          <h2 style={{ fontSize: 'min(2.5rem, 6vw)', fontWeight: '900', marginBottom: '12px' }}>O que os clientes estão <span style={{ color: '#25D366' }}>dizendo</span></h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem' }}>Mensagens reais de quem já usa o FireCheck no dia a dia.</p>

          {/* Hint de swipe — só aparece no mobile */}
          <style>{`.wpp-swipe-hint { display: none; } @media (max-width: 768px) { .wpp-swipe-hint { display: flex; } }`}</style>
          <div className="wpp-swipe-hint" style={{ alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '16px', color: '#25D366', fontWeight: '700', fontSize: '0.85rem', animation: 'pulse-swipe 1.5s ease-in-out infinite' }}>
            <span>👈</span> Arraste para ver mais <span>👉</span>
          </div>
        </div>

        <div className="wpp-grid">
          {/* Card 1 */}
          <div className="wpp-card">
            <div className="wpp-header">
              <div className="wpp-avatar" style={{ backgroundColor: '#E67E22', padding: 0, overflow: 'hidden' }}><img src="/avatar_ricardo.png" alt="Ricardo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /></div>
              <div><div className="wpp-contact-name">Ricardo Mendes</div><div className="wpp-contact-status">visto por último às 14:41</div></div>
            </div>
            <div className="wpp-body">
              <div className="wpp-bubble-received">A IA pegou um funcionário que tirou foto de outro dia pra enganar o sistema. Nunca mais isso aconteceu aqui 🔥<div className="wpp-time">14:33</div></div>
              <div className="wpp-bubble-received">Incrível! Já indiquei pra 3 amigos que têm restaurante 👏👏<div className="wpp-time">14:36</div></div>
            </div>
          </div>
          {/* Card 2 */}
          <div className="wpp-card">
            <div className="wpp-header">
              <div className="wpp-avatar" style={{ backgroundColor: '#2980B9', padding: 0, overflow: 'hidden' }}><img src="/avatar_fernanda.png" alt="Fernanda" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /></div>
              <div><div className="wpp-contact-name">Fernanda Lima</div><div className="wpp-contact-status">visto por último às 09:27</div></div>
            </div>
            <div className="wpp-body">
              <div className="wpp-bubble-received">A limpeza dos equipamentos melhorou 100%! Zero reclamação dos alunos agora 📸<div className="wpp-time">09:19</div></div>
              <div className="wpp-bubble-received">Melhor software que já comprei pra academia ⭐⭐⭐⭐⭐<div className="wpp-time">09:20</div></div>
            </div>
          </div>
          {/* Card 3 */}
          <div className="wpp-card">
            <div className="wpp-header">
              <div className="wpp-avatar" style={{ backgroundColor: '#27AE60', padding: 0, overflow: 'hidden' }}><img src="/avatar_marcos.png" alt="Marcos" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /></div>
              <div><div className="wpp-contact-name">Marcos Alves</div><div className="wpp-contact-status">visto por último às 08:53</div></div>
            </div>
            <div className="wpp-body">
              <div className="wpp-bubble-received">Viajando recebi notificação que uma loja não fez o checklist. Ligei, resolveram. Sensacional! 🙌<div className="wpp-time">08:42</div></div>
              <div className="wpp-bubble-received">Melhor decisão que tomei esse ano 🔥<div className="wpp-time">08:45</div></div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '48px' }}>
          <button className="btn" style={{ padding: '16px 40px', fontSize: '1.05rem' }} onClick={() => handleTrackAndNavigate('CTA Depoimentos WhatsApp', '/checkout?plan=trial')}>Quero Resultados como Esses →</button>
          <p style={{ marginTop: '10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>7 dias grátis • sem cartão de crédito</p>
        </div>
      </section>

      {/* Seção de Planos (Pricing) */}
      <section id="pricing" className="section-mobile-padding" style={{ padding: '80px 5%', backgroundColor: 'var(--bg-color)' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontSize: 'clamp(1.3rem, 5vw, 2.5rem)', marginBottom: '16px' }}>Escolha o plano ideal para a sua operação</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: 'clamp(0.85rem, 2vw, 1rem)' }}>Cancele a qualquer momento. Sem fidelidade no plano mensal.</p>
          
          {/* Seletor Mensal / Anual */}
          <div style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: 'var(--bg-card)', borderRadius: '30px', padding: '6px', border: '1px solid var(--border-color)', gap: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <button
              onClick={() => setBillingCycle('mensal')}
              style={{
                padding: '10px 24px',
                borderRadius: '24px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.95rem',
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
                padding: '10px 24px',
                borderRadius: '24px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.95rem',
                backgroundColor: billingCycle === 'anual' ? '#10b981' : 'transparent',
                color: billingCycle === 'anual' ? 'white' : 'var(--text-muted)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>Plano Anual</span>
              <span style={{ backgroundColor: billingCycle === 'anual' ? 'rgba(255,255,255,0.25)' : 'rgba(16, 185, 129, 0.15)', color: billingCycle === 'anual' ? 'white' : '#10b981', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>Economize até 35%</span>
            </button>
          </div>
        </div>

        <style>{`
          .pricing-grid-mobile {
             display: grid;
             grid-template-columns: repeat(3, 1fr);
             gap: 24px;
             max-width: 1150px;
             margin: 0 auto;
             align-items: stretch;
          }
          @media (max-width: 960px) {
             .pricing-grid-mobile {
                display: flex;
                overflow-x: auto;
                scroll-snap-type: x mandatory;
                -webkit-overflow-scrolling: touch;
                gap: 12px;
                padding-bottom: 12px;
                max-width: 100%;
                scrollbar-width: none;
             }
             .pricing-grid-mobile::-webkit-scrollbar {
                display: none;
             }
             .pricing-grid-mobile .card {
                min-width: 280px;
                max-width: 300px;
                flex-shrink: 0;
                scroll-snap-align: center;
                transform: none !important;
                padding: 24px 20px !important;
             }
             .pricing-grid-mobile .card > h3 {
                font-size: 1.2rem !important;
             }
             .pricing-grid-mobile .card > .price-text {
                font-size: 2.2rem !important;
             }
          }
        `}</style>
        <p className="hide-on-desktop" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '12px' }}>← Deslize para ver todos os planos →</p>
        
        <div className="pricing-grid-mobile">
          
          {/* SÓ CHECKLISTS */}
          <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#ff4500', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '8px' }}>
              📋 MÓDULO CHECKLIST
            </div>
            <h3 style={{ fontSize: '1.6rem', marginBottom: '8px' }}>Só Checklists</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>Auditoria, fotos e vistorias ilimitadas com IA.</p>
            
            <div className="price-text" style={{ fontSize: '2.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
              R${billingCycle === 'anual' ? '97' : '149'}<span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/mês</span>
            </div>
            {billingCycle === 'anual' ? (
              <div style={{ color: '#10b981', fontSize: '0.82rem', fontWeight: '600', marginBottom: '24px' }}>
                Faturado R$ 1.164/ano (Economiza R$ 624/ano)
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '24px' }}>
                Cobrado mensalmente no cartão
              </div>
            )}

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', flex: 1 }}>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', fontSize: '0.9rem' }}><CheckCircle size={18} color="var(--success)" /> <strong>Checklists ILIMITADOS</strong></li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', fontSize: '0.9rem' }}><CheckCircle size={18} color="var(--success)" /> Auditoria visual por IA</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', fontSize: '0.9rem' }}><CheckCircle size={18} color="var(--success)" /> Alertas de irregularidade no WhatsApp</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', fontSize: '0.9rem' }}><CheckCircle size={18} color="var(--success)" /> Bloqueio de fotos falsas</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', fontSize: '0.9rem' }}><CheckCircle size={18} color="var(--success)" /> Relatórios em PDF e Excel</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', fontSize: '0.9rem' }}><CheckCircle size={18} color="var(--success)" /> Colaboradores ilimitados</li>
            </ul>
            <button className="btn-secondary" style={{ width: '100%', padding: '14px', fontSize: '0.95rem', fontWeight: 'bold' }} onClick={() => handleTrackAndNavigate(`Assinar Só Checklist ${billingCycle}`, `/checkout?plan=checklists_${billingCycle}`)}>
              Assinar Só Checklists
            </button>
          </div>

          {/* COMBO COMPLETO (Destacado) */}
          <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', border: '2px solid var(--primary)', transform: 'scale(1.04)', position: 'relative', zIndex: 2, backgroundColor: 'var(--bg-card)', boxShadow: '0 12px 30px rgba(255, 69, 0, 0.15)' }}>
            <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--primary)', color: 'white', padding: '4px 16px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 'bold', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>🔥 MAIS VENDIDO • MELHOR CUSTO</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '8px', marginTop: '4px' }}>
              ⚡ PACOTE COMPLETO
            </div>
            <h3 style={{ fontSize: '1.8rem', marginBottom: '8px', color: 'var(--primary)' }}>Combo Tudo em 1</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>Checklists Ilimitados + Ponto IA com biometria no mesmo lugar.</p>
            
            <div className="price-text" style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '4px', color: '#0f172a' }}>
              R${billingCycle === 'anual' ? '167' : '197'}<span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/mês</span>
            </div>
            {billingCycle === 'anual' ? (
              <div style={{ color: '#10b981', fontSize: '0.82rem', fontWeight: 'bold', marginBottom: '24px' }}>
                12x R$ 167 (Economiza R$ 360/ano vs mensal!)
              </div>
            ) : (
              <div style={{ color: '#10b981', fontSize: '0.82rem', fontWeight: 'bold', marginBottom: '24px' }}>
                Economize R$ 101/mês comparado aos 2 separados!
              </div>
            )}

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', flex: 1 }}>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', fontSize: '0.9rem' }}><CheckCircle size={18} color="var(--success)" /> <strong>TUDO do Módulo Checklist Ilimitado</strong></li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', fontSize: '0.9rem' }}><CheckCircle size={18} color="var(--success)" /> <strong>TUDO do Módulo Controle de Ponto IA</strong></li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', fontSize: '0.9rem' }}><CheckCircle size={18} color="var(--success)" /> Reconhecimento facial + Trava GPS</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', fontSize: '0.9rem' }}><CheckCircle size={18} color="var(--success)" /> Alertas no WhatsApp (Atraso, Irregularidade)</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', fontSize: '0.9rem' }}><CheckCircle size={18} color="var(--success)" /> Suporte VIP com gerente de conta</li>
            </ul>
            <button className="btn btn-pulse" style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 'bold', backgroundColor: 'var(--primary)' }} onClick={() => handleTrackAndNavigate(`Assinar Combo ${billingCycle}`, `/checkout?plan=combo_${billingCycle}`)}>
              Quero o Combo Completo →
            </button>
          </div>

          {/* SÓ PONTO IA */}
          <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#3b82f6', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '8px' }}>
              ⏰ MÓDULO PONTO IA
            </div>
            <h3 style={{ fontSize: '1.6rem', marginBottom: '8px' }}>Só Ponto Eletrônico</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>Ponto com biometria facial, trava de GPS e alertas WhatsApp.</p>
            
            <div className="price-text" style={{ fontSize: '2.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
              R${billingCycle === 'anual' ? '97' : '149'}<span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/mês</span>
            </div>
            {billingCycle === 'anual' ? (
              <div style={{ color: '#10b981', fontSize: '0.82rem', fontWeight: '600', marginBottom: '24px' }}>
                Faturado R$ 1.164/ano (Economiza R$ 624/ano)
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '24px' }}>
                Cobrado mensalmente no cartão
              </div>
            )}

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', flex: 1 }}>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', fontSize: '0.9rem' }}><CheckCircle size={18} color="var(--success)" /> <strong>Reconhecimento Facial com IA</strong></li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', fontSize: '0.9rem' }}><CheckCircle size={18} color="var(--success)" /> Trava de Geolocalização (GPS)</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', fontSize: '0.9rem' }}><CheckCircle size={18} color="var(--success)" /> Alerta de Atraso e Saída no WhatsApp</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', fontSize: '0.9rem' }}><CheckCircle size={18} color="var(--success)" /> Relatório diário de espelho de ponto</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', fontSize: '0.9rem' }}><CheckCircle size={18} color="var(--success)" /> Folha de ponto pronta pro contador</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', fontSize: '0.9rem' }}><CheckCircle size={18} color="var(--success)" /> Colaboradores ilimitados</li>
            </ul>
            <button className="btn-secondary" style={{ width: '100%', padding: '14px', fontSize: '0.95rem', fontWeight: 'bold' }} onClick={() => handleTrackAndNavigate(`Assinar Só Ponto ${billingCycle}`, `/checkout?plan=ponto_${billingCycle}`)}>
              Assinar Só Ponto
            </button>
          </div>

        </div>

        {/* Plano Custom abaixo */}
        <div className="card" style={{ maxWidth: '1100px', margin: '40px auto 0', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>Precisa de mais de 1.500 checklists?</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '1.1rem' }}>
            Fale conosco para fazer um plano personalizado para a sua operação, com gerente de conta dedicado e IA treinada para o seu negócio.
          </p>
          <button className="btn-secondary" style={{ padding: '12px 32px', fontSize: '1.1rem' }} onClick={() => handleTrackAndNavigate('Falar com consultor (Custom)', 'https://wa.me/5522998851680?text=Olá,%20gostaria%20de%20um%20plano%20Custom%20do%20FireCheck.')}>
            Falar com nossos consultores
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '60px' }}>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>Ainda não tem certeza?</h3>
          <button className="btn" style={{ padding: '16px 32px', fontSize: '1.1rem', backgroundColor: 'transparent', border: '2px solid var(--primary)', color: 'var(--primary)' }} onClick={() => handleTrackAndNavigate('Testar Grátis 7 Dias (Footer)', '/checkout?plan=trial')}>
            Criar conta e Testar Grátis por 7 Dias
          </button>
          <p style={{ marginTop: '12px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Acesso imediato. Não pedimos cartão de crédito.</p>
        </div>
      </section>

      <footer style={{ padding: '40px 5%', textAlign: 'center', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 'auto' }}>
        <p>© 2026 FireCheck Inc. O futuro da auditoria de varejo.</p>
        <p style={{ marginTop: '10px', display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'underline', fontSize: '0.8rem' }}>Política de Privacidade</Link>
          <Link to="/terms" style={{ color: 'var(--text-muted)', textDecoration: 'underline', fontSize: '0.8rem' }}>Termos de Uso</Link>
        </p>
      </footer>

      {/* Floating WhatsApp Button */}
      <a 
        href="https://wa.me/5522998851680?text=Olá,%20estou%20no%20site%20do%20FireCheck%20e%20gostaria%20de%20tirar%20uma%20dúvida."
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: '#25D366',
          color: 'white',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 9999,
          cursor: 'pointer',
          transition: 'transform 0.2s ease-in-out'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        title="Falar com o Suporte via WhatsApp"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.888-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.347-.272.297-1.04 1.016-1.04 2.479 0 1.463 1.065 2.876 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
        </svg>
      </a>
    </div>
  );
}
