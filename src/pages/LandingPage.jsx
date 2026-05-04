import { useState, useEffect, useRef } from 'react';
import { ArrowRight, CheckCircle, Smartphone, ShieldCheck, Flame, Bot, X, Video, PlayCircle, Trophy, Image as ImageIcon, ArrowLeft, AlertTriangle, Activity, ShoppingCart } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import API_URL from '../api';

export default function LandingPage() {
  const navigate = useNavigate();
  const [isVideoActive, setIsVideoActive] = useState(false);
  const videoRef = useRef(null);

  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));

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
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary hide-on-mobile" style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', fontSize: '0.9rem', cursor: 'pointer' }} onClick={() => document.getElementById('como-funciona').scrollIntoView({ behavior: 'smooth' })}>Como Funciona</button>
          <button className="btn-secondary hide-on-mobile" style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', fontSize: '0.9rem', cursor: 'pointer' }} onClick={() => document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' })}>Planos</button>
          <button className="btn" style={{ padding: '10px 24px', boxShadow: '0 0 20px rgba(255, 77, 0, 0.4)' }} onClick={() => navigate('/login')}>
            Acessar
          </button>
        </div>
      </nav>

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
              padding: 24px 5% 24px 5% !important;
              gap: 8px !important;
            }
            .hero-col-left, .hero-col-right {
              display: contents;
            }
            .hero-badge { order: 1; align-self: center; margin-bottom: 0px !important; font-size: 0.6rem !important; padding: 4px 10px !important; white-space: nowrap; }
            .hero-title { order: 2; text-align: center; font-size: 1.15rem !important; margin-bottom: 4px !important; line-height: 1.1 !important; }
            .mobile-video-title { display: none !important; }
            .hero-video-wrapper { order: 3; display: flex; justify-content: center; width: 100%; margin-top: 4px; }
            .video-phone-mockup {
               transform: scale(0.55);
               transform-origin: top center;
               margin-bottom: -261px;
            }
            .hero-desc { order: 4; text-align: center; font-size: 0.75rem !important; margin-bottom: 8px !important; line-height: 1.2 !important; }
            .hero-cta { order: 5; display: flex; flex-direction: column; align-items: center; width: 100%; gap: 6px !important; }
            .hero-cta button { width: 100%; justify-content: center; padding: 12px 24px !important; font-size: 0.95rem !important; }
            .hero-cta p { text-align: center; width: 100%; margin-top: 0 !important; font-size: 0.7rem !important; }
          }
        `}</style>
        
        <div className="hero-col-left">
          <div className="hero-badge" style={{ border: '1px solid rgba(255, 77, 0, 0.4)', color: '#ff4d00', padding: '8px 20px', borderRadius: '30px', fontSize: '0.85rem', fontWeight: '800', marginBottom: '24px', letterSpacing: '1px', textTransform: 'uppercase', boxShadow: '0 0 20px rgba(255, 77, 0, 0.2)', backgroundColor: 'rgba(255, 77, 0, 0.05)' }}>
            ✨ O primeiro checklist do Brasil movido por IA
          </div>
          
          <h1 className="hero-title" style={{ fontSize: 'min(3.5rem, 7vw)', fontWeight: '900', lineHeight: '1.1', marginBottom: '24px', letterSpacing: '-1px', color: 'var(--text-main)' }}>
            Transforme sua empresa em um negócio <br/><span style={{ background: 'linear-gradient(90deg, #ff4d00, #ffb300)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>autogerenciável.</span>
          </h1>
          
          <p className="hero-desc" style={{ fontSize: '1.25rem', color: 'var(--text-muted)', marginBottom: '32px', lineHeight: '1.6', maxWidth: '600px' }}>
            O FireCheck fiscaliza sua operação e te manda uma notificação no celular apenas se algo estiver errado. Chega de conferir centenas de fotos manualmente todos os dias.
          </p>

          <div className="hero-cta" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <button className="btn btn-pulse" style={{ fontSize: '1.1rem', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => handleTrackAndNavigate('Começar 7 Dias Grátis', '/checkout')}>
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
          .logos-track:hover { animation-play-state: paused; }
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

      {/* Templates de Checklist */}
      <section className="section-mobile-padding" style={{ padding: '80px 5%', backgroundColor: 'var(--bg-card)' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 style={{ fontSize: 'min(3rem, 6vw)', fontWeight: '800', marginBottom: '16px', lineHeight: '1.2' }}>
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
                grid-template-columns: repeat(2, 1fr) !important;
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
                font-size: 0.85rem !important;
                margin-bottom: 6px !important;
             }
             .four-steps-grid > div > p {
                font-size: 0.75rem !important;
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
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '12px' }}>Criação Simples</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', flex: 1 }}>
              Crie o checklist para sua equipe de forma manual ou com ajuda da nossa IA.
            </p>
          </div>

          {/* Step 2 */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '24px', border: '1px solid var(--border-color)', position: 'relative', zIndex: 1, boxShadow: '0 10px 30px rgba(0,0,0,0.03)', textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: '100%', height: '160px', borderRadius: '16px', overflow: 'hidden', marginBottom: '20px', backgroundColor: '#f8fafc' }}>
               <img src="/step2.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Funcionários executam" />
            </div>
            <div style={{ width: '48px', height: '48px', backgroundColor: '#06b6d4', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', margin: '0 auto 16px', boxShadow: '0 0 0 6px rgba(6, 182, 212, 0.1)' }}>2</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '12px' }}>Execução Imediata</h3>
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
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '12px' }}>Alertas Inteligentes</h3>
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
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '12px' }}>Empresa Auto-Gerenciável</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', flex: 1 }}>
              Relaxe e programe suas férias, agora você tem uma empresa auto gerenciável!
            </p>
          </div>

        </div>
      </section>

      {/* NOVA SEÇÃO: Processo Simples */}
      <section className="section-mobile-padding" style={{ padding: '80px 0', backgroundColor: 'var(--bg-color)', position: 'relative', zIndex: 11, overflow: 'hidden' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 5%' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: 'min(2.5rem, 5vw)', fontWeight: '900', marginBottom: '16px', color: 'var(--text-main)' }}>Veja como é <span style={{ color: '#ff4d00' }}>simples o nosso processo</span></h2>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto' }}>Do celular do funcionário para o seu bolso em segundos.</p>
          </div>
        </div>
        {/* Right Column: Animated Dual Phones */}
        <div className="hero-mockups" style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative', minHeight: '450px' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '120%', height: '120%', background: 'radial-gradient(circle, rgba(255,77,0,0.15) 0%, transparent 60%)', filter: 'blur(50px)', zIndex: -1 }}></div>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '32px', textAlign: 'center', zIndex: 10 }}></div>
          <style>{`
          .anim-flow-container {
              transform: scale(0.85);
              transform-origin: center center;
            display: flex;
            justify-content: center;
            gap: 40px;
            flex-wrap: nowrap;
            perspective: 1000px;
          }
          .phone-mockup {
            width: 250px;
            height: 500px;
            flex-shrink: 0;
            background: #ffffff;
            border: 12px solid #18181b;
            border-radius: 36px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.05) inset;
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            transform-style: preserve-3d;
          }

          @media (max-width: 992px) {
            .anim-flow-container {
              transform: scale(0.7) !important;
              margin-bottom: -140px;
            }
          }

          @media (max-width: 768px) {
            .anim-flow-container {
              flex-wrap: nowrap !important;
              gap: 12px !important;
              transform: scale(0.6) !important;
              transform-origin: center top;
              margin-left: -100px;
              margin-right: -100px;
              margin-bottom: -180px;
            }
            .anim-flow-container > div {
               font-size: 1.4rem;
            }
          }

          .phone-notch {
            position: absolute;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 120px;
            height: 24px;
            background: #18181b;
            border-bottom-left-radius: 16px;
            border-bottom-right-radius: 16px;
            z-index: 50;
          }

          @keyframes step0-choosing {
            0%, 13% { opacity: 1; z-index: 10; }
            15%, 100% { opacity: 0; z-index: 0; }
          }
          @keyframes step1-photo {
            0%, 13% { opacity: 0; }
            15%, 45% { opacity: 1; z-index: 10; }
            47%, 100% { opacity: 0; z-index: 0; }
          }
          @keyframes step2-analyzing {
            0%, 45% { opacity: 0; z-index: 0; }
            47%, 65% { opacity: 1; z-index: 10; }
            67%, 100% { opacity: 0; z-index: 0; }
          }
          @keyframes step3-result {
            0%, 65% { opacity: 0; z-index: 0; }
            67%, 95% { opacity: 1; z-index: 10; }
            97%, 100% { opacity: 0; z-index: 0; }
          }
          
          @keyframes owner-step1-idle {
            0%, 68% { opacity: 1; z-index: 10; }
            70%, 100% { opacity: 0; z-index: 0; }
          }
          @keyframes owner-step2-notification {
            0%, 48% { opacity: 0; transform: translateY(-20px); }
            50%, 68% { opacity: 1; transform: translateY(0); z-index: 20; }
            70%, 100% { opacity: 0; transform: translateY(-20px); z-index: 0; }
          }
          @keyframes owner-step3-view {
            0%, 68% { opacity: 0; z-index: 0; }
            70%, 95% { opacity: 1; z-index: 10; }
            97%, 100% { opacity: 0; z-index: 0; }
          }

          .seq-anim {
            animation-duration: 18s;
            animation-iteration-count: infinite;
          }
        `}</style>

        <div className="anim-flow-container">
          {/* Celular do Funcionário */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div className="phone-mockup">
              <div className="phone-notch"></div>
              
              {/* Step 0: Escolhendo Tarefa */}
              <div className="seq-anim" style={{ position: 'absolute', inset: 0, background: '#f8fafc', display: 'flex', flexDirection: 'column', animationName: 'step0-choosing', animationFillMode: 'both', opacity: 1 }}>
                 <div style={{ padding: '40px 16px 16px', background: '#ff4d00', color: 'white', fontWeight: 'bold' }}>
                   Minhas Tarefas
                 </div>
                 <div style={{ padding: '16px', flex: 1 }}>
                    <div style={{ padding: '16px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '12px', borderLeft: '4px solid #ff4d00', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}>Fechamento Cozinha</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Pendente • 14:30</div>
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.05)', animation: 'pulse 1.5s infinite' }}></div>
                    </div>
                    <div style={{ padding: '16px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', opacity: 0.6 }}>
                      <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}>Limpeza Banheiros</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Pendente • 15:00</div>
                    </div>
                 </div>
              </div>

              {/* Step 1: Tirando Foto */}
              <div className="seq-anim" style={{ position: 'absolute', inset: 0, backgroundColor: '#000', display: 'flex', flexDirection: 'column', animationName: 'step1-photo', animationFillMode: 'both', opacity: 0 }}>
                 <div style={{ padding: '40px 16px 16px', display: 'flex', justifyContent: 'space-between', color: 'white', fontSize: '0.9rem' }}>
                   <span>Cancelar</span>
                   <span style={{ fontWeight: 'bold' }}>Tirar Foto</span>
                   <span>Flash</span>
                 </div>
                 <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                   <img src="/dirty-grill.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                   <div style={{ position: 'absolute', inset: '40px', border: '2px solid rgba(255,255,255,0.5)', borderRadius: '12px' }}></div>
                 </div>
                 <div style={{ height: '100px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                   <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'white', border: '4px solid #d1d5db', cursor: 'pointer' }}></div>
                 </div>
              </div>

              {/* Step 2: IA Analisando */}
              <div className="seq-anim" style={{ position: 'absolute', inset: 0, background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animationName: 'step2-analyzing', animationFillMode: 'both', opacity: 0 }}>
                 <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #ff4d00, #ffb300)', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '24px', boxShadow: '0 10px 25px rgba(255,77,0,0.3)' }}>
                   <Bot size={40} color="white" />
                 </div>
                 <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>IA Analisando...</h3>
                 <p style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center', padding: '0 24px' }}>Verificando conformidade com o padrão da loja.</p>
                 
                 <div style={{ width: '120px', height: '4px', background: '#e2e8f0', borderRadius: '2px', marginTop: '32px', overflow: 'hidden' }}>
                   <div style={{ width: '50%', height: '100%', background: '#ff4d00', borderRadius: '2px', animation: 'progress 2s infinite ease-in-out' }}></div>
                 </div>
              </div>

              {/* Step 3: Resultado Reprovado */}
              <div className="seq-anim" style={{ position: 'absolute', inset: 0, background: '#fef2f2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '4px solid #ef4444', animationName: 'step3-result', animationFillMode: 'both', opacity: 0 }}>
                 <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#ef4444', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '16px' }}>
                   <AlertTriangle size={32} color="white" />
                 </div>
                 <h3 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#991b1b', marginBottom: '8px' }}>Reprovado!</h3>
                 <div style={{ background: 'white', padding: '16px', borderRadius: '12px', margin: '0 16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                   <p style={{ fontSize: '0.8rem', color: '#7f1d1d', textAlign: 'center', lineHeight: '1.4', margin: 0, fontWeight: '500' }}>
                     Crostas de gordura carbonizada na lateral direita da chapa. Refaça a limpeza.
                   </p>
                 </div>
                 <button style={{ marginTop: '32px', padding: '12px 24px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem' }}>
                   Tentar Novamente
                 </button>
              </div>

            </div>
            <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#94a3b8', marginTop: '16px', textAlign: 'center' }}>Celular do Funcionário</div>
          </div>

          {/* Celular do Dono */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div className="phone-mockup">
              <div className="phone-notch"></div>
              
              {/* Step 1 e 2: Tela Inicial (Idle) + Push Notification */}
              <div className="seq-anim" style={{ position: 'absolute', inset: 0, backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', animationName: 'owner-step1-idle', animationFillMode: 'both', opacity: 0 }}>
                 <div style={{ padding: '60px 20px 20px', color: 'var(--text-main)' }}>
                   <div style={{ fontSize: '3rem', fontWeight: '300', textAlign: 'center' }}>14:32</div>
                   <div style={{ fontSize: '1rem', textAlign: 'center', color: '#64748b' }}>Segunda, 15 de Maio</div>
                 </div>
                 
                 <div className="seq-anim" style={{ position: 'absolute', top: '40px', left: '12px', right: '12px', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', borderRadius: '16px', padding: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', display: 'flex', gap: '12px', animationName: 'owner-step2-notification', animationFillMode: 'both', cursor: 'pointer', opacity: 0 }}>
                   <div style={{ width: '36px', height: '36px', background: '#ff4d00', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white' }}>
                     <Flame size={20} />
                   </div>
                   <div style={{ flex: 1 }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                       <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#0f172a' }}>FireCheck IA</div>
                       <div style={{ fontSize: '0.7rem', color: '#64748b' }}>agora</div>
                     </div>
                     <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#0f172a', marginBottom: '2px' }}>⚠️ Reprovação Crítica</div>
                     <div style={{ fontSize: '0.75rem', color: '#475569', lineHeight: '1.3' }}>A IA reprovou o "Fechamento da Cozinha" de Eduardo. Clique para ver.</div>
                   </div>
                 </div>
              </div>

              {/* Step 3: Visualizando a Reprovação no Dashboard */}
              <div className="seq-anim" style={{ position: 'absolute', inset: 0, background: '#f8fafc', display: 'flex', flexDirection: 'column', animationName: 'owner-step3-view', animationFillMode: 'both', opacity: 0 }}>
                 <div style={{ padding: '40px 16px 16px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', gap: '12px' }}>
                   <ArrowLeft size={20} />
                   <div style={{ fontWeight: 'bold' }}>Detalhes da Tarefa</div>
                 </div>
                 <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                     <img src="/avatar.png" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                     <div>
                       <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '0.9rem' }}>Eduardo Silva</div>
                       <div style={{ color: '#64748b', fontSize: '0.8rem' }}>Fechamento Cozinha (14:31)</div>
                     </div>
                   </div>
                   
                   <div style={{ width: '100%', height: '180px', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                     <img src="/dirty-grill.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                   </div>

                   <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '12px', padding: '16px' }}>
                     <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                       <AlertTriangle size={18} color="#ef4444" />
                       <div style={{ fontWeight: 'bold', color: '#991b1b', fontSize: '0.85rem' }}>Análise da IA</div>
                     </div>
                     <p style={{ color: '#7f1d1d', fontSize: '0.8rem', lineHeight: '1.5', margin: 0 }}>
                       Reprovado. Crostas de gordura carbonizada na lateral direita da chapa.
                     </p>
                   </div>

                   <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                     <button style={{ flex: 1, padding: '12px', background: '#25D366', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                       Chamar no Zap
                     </button>
                   </div>
                 </div>
              </div>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#94a3b8', marginTop: '16px', textAlign: 'center' }}>Celular do Dono</div>
          </div>
        </div>
      </div>

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
                grid-template-columns: repeat(2, 1fr) !important;
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
                font-size: 0.75rem !important;
                margin-bottom: 12px !important;
                line-height: 1.3 !important;
              }
              /* For the nested badges inside the cards */
              .grid-2-col-mobile > div > div:last-child {
                padding: 6px !important;
                font-size: 0.65rem !important;
                margin-top: auto !important;
              }
              .grid-2-col-mobile > div > div:last-child > div {
                font-size: 0.65rem !important;
                padding: 4px !important;
              }
              .scale-on-mobile {
                zoom: 0.75;
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
          @media (max-width: 768px) { .wpp-grid { grid-template-columns: 1fr; } .wpp-card { max-width: 100%; } }
        `}</style>

        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#25D366', color: 'white', padding: '6px 18px', borderRadius: '30px', fontSize: '0.8rem', fontWeight: '700', marginBottom: '16px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.888-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.347-.272.297-1.04 1.016-1.04 2.479 0 1.463 1.065 2.876 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
            Clientes Reais no WhatsApp
          </div>
          <h2 style={{ fontSize: 'min(2.5rem, 6vw)', fontWeight: '900', marginBottom: '12px' }}>O que os clientes estão <span style={{ color: '#25D366' }}>dizendo</span></h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem' }}>Mensagens reais de quem já usa o FireCheck no dia a dia.</p>
        </div>

        <div className="wpp-grid">
          <div className="wpp-card">
            <div className="wpp-header">
              <div className="wpp-avatar" style={{ backgroundColor: '#E67E22' }}>R</div>
              <div><div className="wpp-contact-name">Ricardo M.</div><div className="wpp-contact-status">Restaurante • São Paulo, SP</div></div>
            </div>
            <div className="wpp-body">
              <div className="wpp-bubble-received">Cara, o FireCheck mudou tudo aqui. Antes eu tinha que ficar em cima da equipe toda hora pra saber se fecharam a cozinha direito 😅<div className="wpp-time">14:32</div></div>
              <div className="wpp-bubble-received">Agora a IA reprova na hora se tiver errado. Semana passada pegou um funcionário que não tinha limpado a chapa e tirou foto de outro dia 🔥<div className="wpp-time">14:33</div></div>
              <div className="wpp-bubble-sent">Fico feliz que tá ajudando! Isso é exatamente o anti-fraude do sistema funcionando 👊<div className="wpp-time">14:35 <span className="wpp-tick">✓✓</span></div></div>
              <div className="wpp-bubble-received">Simplesmente incrível. Já indiquei pra 3 amigos que têm restaurante também 👏👏<div className="wpp-time">14:36</div></div>
            </div>
          </div>
          <div className="wpp-card">
            <div className="wpp-header">
              <div className="wpp-avatar" style={{ backgroundColor: '#2980B9' }}>F</div>
              <div><div className="wpp-contact-name">Fernanda L.</div><div className="wpp-contact-status">Academia • Belo Horizonte, MG</div></div>
            </div>
            <div className="wpp-body">
              <div className="wpp-bubble-received">Oi! Queria agradecer muito, o sistema tá funcionando perfeitamente na academia. Os instrutores já se acostumaram rápido 😊<div className="wpp-time">09:15</div></div>
              <div className="wpp-bubble-sent">Que ótimo Fernanda! Como tá sendo o uso no dia a dia?<div className="wpp-time">09:18 <span className="wpp-tick">✓✓</span></div></div>
              <div className="wpp-bubble-received">A limpeza dos equipamentos melhorou 100%! Antes os alunos reclamavam, agora zero reclamação. A foto como prova foi a melhor ideia 📸<div className="wpp-time">09:19</div></div>
              <div className="wpp-bubble-received">Já valeu muito o investimento. Melhor software que já comprei pra academia ⭐⭐⭐⭐⭐<div className="wpp-time">09:20</div></div>
            </div>
          </div>
          <div className="wpp-card">
            <div className="wpp-header">
              <div className="wpp-avatar" style={{ backgroundColor: '#27AE60' }}>M</div>
              <div><div className="wpp-contact-name">Marcos A.</div><div className="wpp-contact-status">Rede de Lojas • Rio de Janeiro, RJ</div></div>
            </div>
            <div className="wpp-body">
              <div className="wpp-bubble-received">Bom dia! Tenho 4 lojas e usar planilha tava virando um caos. Com o FireCheck centralizei tudo num lugar só 🙌<div className="wpp-time">08:41</div></div>
              <div className="wpp-bubble-received">Ontem à noite fiquei viajando e recebi a notificação que uma loja não fez o checklist de fechamento. Ligei, resolveram. Sensacional!<div className="wpp-time">08:42</div></div>
              <div className="wpp-bubble-sent">Isso! Esse é o poder do monitoramento em tempo real 💪<div className="wpp-time">08:44 <span className="wpp-tick">✓✓</span></div></div>
              <div className="wpp-bubble-received">Melhor decisão que tomei esse ano. Obrigado pela ferramenta de qualidade! 🔥<div className="wpp-time">08:45</div></div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '48px' }}>
          <button className="btn" style={{ padding: '16px 40px', fontSize: '1.05rem' }} onClick={() => handleTrackAndNavigate('CTA Depoimentos WhatsApp', '/checkout')}>Quero Resultados como Esses →</button>
          <p style={{ marginTop: '10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>7 dias grátis • sem cartão de crédito</p>
        </div>
      </section>

      {/* Seção de Planos (Pricing) */}
      <section id="pricing" className="section-mobile-padding" style={{ padding: '80px 5%', backgroundColor: 'var(--bg-color)' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '16px' }}>Escolha o plano ideal para a sua operação</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Cancele a qualquer momento. Sem taxas ocultas.</p>
        </div>

        <style>{`
          .pricing-grid-mobile {
             display: grid;
             grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
             gap: 24px;
             max-width: 800px;
             margin: 0 auto;
             align-items: center;
          }
          @media (max-width: 768px) {
             .pricing-grid-mobile {
                grid-template-columns: repeat(2, 1fr) !important;
                gap: 8px !important;
             }
             .pricing-grid-mobile .card {
                padding: 12px !important;
                border-radius: 12px !important;
                transform: none !important;
             }
             .pricing-grid-mobile .card > h3 {
                font-size: 0.95rem !important;
                margin-bottom: 4px !important;
             }
             .pricing-grid-mobile .card > p {
                font-size: 0.7rem !important;
                margin-bottom: 8px !important;
             }
             .pricing-grid-mobile .card > .price-text {
                font-size: 1.4rem !important;
                margin-bottom: 4px !important;
             }
             .pricing-grid-mobile .card > .price-text span {
                font-size: 0.65rem !important;
             }
             .pricing-grid-mobile .card ul {
                margin: 0 0 16px 0 !important;
             }
             .pricing-grid-mobile .card ul li {
                font-size: 0.65rem !important;
                margin-bottom: 6px !important;
                gap: 4px !important;
             }
             .pricing-grid-mobile .card ul li svg {
                width: 12px !important;
                height: 12px !important;
             }
             .pricing-grid-mobile .card button {
                padding: 8px !important;
                font-size: 0.75rem !important;
             }
             .pricing-grid-mobile .card > div[style*="transparent"] {
                display: none !important;
             }
             .pricing-grid-mobile .card > div > div {
                font-size: 0.65rem !important;
             }
             .pricing-grid-mobile .card > div[style*="absolute"] {
                font-size: 0.55rem !important;
                padding: 2px 6px !important;
                top: -8px !important;
             }
          }
        `}</style>
        <div className="pricing-grid-mobile">
          
          <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Start Mensal</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Ideal para testar na sua operação.</p>
            <div className="price-text" style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '8px' }}>
              R$97<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/mês</span>
            </div>
            <div style={{ color: 'transparent', fontSize: '0.9rem', marginBottom: '32px' }}>-</div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', flex: 1 }}>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Até 10 funcionários</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> <strong>Auditoria com nossa IA</strong></li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Notificações Push no Celular</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Bloqueio de fotos falsas</li>
            </ul>
            <button className="btn-secondary" style={{ width: '100%', padding: '12px' }} onClick={() => handleTrackAndNavigate('Assinar Start Mensal', '/checkout?plan=mensal')}>
              Assinar Agora
            </button>
          </div>

          <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', border: '2px solid var(--primary)', transform: 'scale(1.05)', position: 'relative', zIndex: 1, pointerEvents: 'auto' }}>
            <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--primary)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>2 MESES GRÁTIS</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '8px', color: 'var(--primary)' }}>Start Anual</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Auditoria inteligente para sua operação decolar.</p>
            <div className="price-text" style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '8px' }}>
              R$80,83<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/mês</span>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: 'var(--success)', fontSize: '1rem', fontWeight: 'bold' }}>Menos que um cafezinho: R$ 2,65 /dia</div>
              <div style={{ color: 'rgba(0, 200, 83, 0.6)', fontSize: '0.8rem', marginTop: '4px' }}>Faturado R$970,00 anualmente</div>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', flex: 1 }}>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Até 10 funcionários</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> <strong>Auditoria com nossa IA</strong></li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Notificações Push no Celular</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Bloqueio de fotos falsas</li>
            </ul>
            <button className="btn btn-pulse" style={{ width: '100%', padding: '12px' }} onClick={() => handleTrackAndNavigate('Assinar Start Anual', '/checkout?plan=anual')}>
              Assinar Agora
            </button>
          </div>

        </div>

        {/* Plano Custom abaixo */}
        <div className="card" style={{ maxWidth: '800px', margin: '40px auto 0', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>Mais de 10 funcionários?</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '1.1rem' }}>
            Fale conosco para fazer um plano personalizado para a sua operação, com gerente de conta dedicado e IA treinada para o seu negócio.
          </p>
          <button className="btn-secondary" style={{ padding: '12px 32px', fontSize: '1.1rem' }} onClick={() => handleTrackAndNavigate('Falar com consultor (Custom)', 'https://wa.me/5522981118514?text=Olá,%20gostaria%20de%20falar%20com%20um%20consultor%20sobre%20o%20plano%20Custom%20do%20FireCheck.')}>
            Falar com nossos consultores
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '60px' }}>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>Ainda não tem certeza?</h3>
          <button className="btn" style={{ padding: '16px 32px', fontSize: '1.1rem', backgroundColor: 'transparent', border: '2px solid var(--primary)', color: 'var(--primary)' }} onClick={() => handleTrackAndNavigate('Testar Grátis 7 Dias (Footer)', '/checkout')}>
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
        href="https://wa.me/5522981118514?text=Olá,%20estou%20no%20site%20do%20FireCheck%20e%20gostaria%20de%20tirar%20uma%20dúvida."
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
