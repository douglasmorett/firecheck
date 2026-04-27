import { useState, useEffect, useRef } from 'react';
import { ArrowRight, CheckCircle, Smartphone, ShieldCheck, Flame, Bot, X, Video, PlayCircle, Trophy } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import API_URL from '../api';

export default function LandingPage() {
  const navigate = useNavigate();
  const [isVideoActive, setIsVideoActive] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    // Ping to track live visitors
    const ping = () => {
      fetch(`${API_URL}/api/ping`).catch(() => {});
    };
    ping();
    const interval = setInterval(ping, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ backgroundColor: 'var(--bg-color)', color: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      
      {/* NavBar */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 5%', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
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
      <section className="section-mobile-padding" style={{ padding: '80px 5%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1200px', margin: '0 auto', gap: '40px', position: 'relative', zIndex: 10 }}>
        
        {/* Left Column: Text & CTA */}
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ border: '1px solid rgba(255, 77, 0, 0.4)', color: '#ff4d00', padding: '8px 20px', borderRadius: '30px', fontSize: '0.85rem', fontWeight: '800', marginBottom: '24px', letterSpacing: '1px', textTransform: 'uppercase', boxShadow: '0 0 20px rgba(255, 77, 0, 0.2)', backgroundColor: 'rgba(255, 77, 0, 0.05)' }}>
            ✨ O primeiro checklist do Brasil movido por IA
          </div>
          
          <h1 style={{ fontSize: 'min(3.5rem, 7vw)', fontWeight: '900', lineHeight: '1.1', marginBottom: '24px', letterSpacing: '-1px' }}>
            Auditoria com IA que <br/><span style={{ background: 'linear-gradient(90deg, #ff4d00, #ffb300)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>economiza seu tempo.</span>
          </h1>
          
          <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', marginBottom: '32px', lineHeight: '1.6', maxWidth: '600px' }}>
            O FireCheck fiscaliza sua operação e te manda uma notificação no celular apenas se algo estiver errado. Chega de conferir centenas de fotos manualmente todos os dias.
          </p>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <button className="btn btn-pulse" style={{ fontSize: '1.1rem', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => navigate('/checkout')}>
              Começar 7 Dias Grátis <ArrowRight size={20} />
            </button>
            <button className="btn-secondary" style={{ fontSize: '1.1rem', padding: '16px 32px', backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center' }} onClick={() => {
              setIsVideoActive(true);
              if (videoRef.current) {
                videoRef.current.muted = false;
                videoRef.current.currentTime = 0;
                videoRef.current.play().catch(() => {});
              }
            }}>
              <PlayCircle size={20} style={{ display: 'inline', marginRight: '8px' }} /> Ver demonstração
            </button>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '16px' }}>
            Acesso imediato. Não pedimos cartão de crédito.
          </p>
        </div>

        {/* Right Column: Video Mockup */}
        <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          
          <div style={{ marginBottom: '16px', color: '#06b6d4', fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1.5px', textAlign: 'center' }}>
            VEJA A IA EM AÇÃO NO NOSSO APP:
          </div>

          <div style={{ position: 'absolute', top: '60%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', height: '90%', background: 'radial-gradient(circle, rgba(255,77,0,0.15) 0%, transparent 60%)', filter: 'blur(40px)', zIndex: -1 }}></div>

          <div className="video-mockup" style={{ width: '100%', maxWidth: '280px', borderRadius: '32px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 60px rgba(255,77,0,0.2)', border: '6px solid #1a1a1a', position: 'relative', backgroundColor: 'var(--bg-card)' }}>
            
            {!isVideoActive && (
              <div 
                onClick={() => {
                  setIsVideoActive(true);
                  if (videoRef.current) {
                    videoRef.current.muted = false;
                    videoRef.current.currentTime = 0;
                    videoRef.current.play().catch(() => {});
                  }
                  if (!sessionStorage.getItem('video_played')) {
                    fetch(`${API_URL}/api/track-video`, { method: 'POST' }).catch(() => {});
                    sessionStorage.setItem('video_played', 'true');
                  }
                }}
                style={{
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                  zIndex: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.1)'
                }}
              >
                <div style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  padding: '12px 20px',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 8px 20px rgba(239, 68, 68, 0.4), 0 0 30px rgba(239, 68, 68, 0.2)',
                  border: '2px solid rgba(255,255,255,0.4)',
                  animation: 'pulse 2s infinite',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '800', letterSpacing: '0.5px' }}>Clique aqui</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '2px 0' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '800' }}>para ativar o som</div>
                </div>
              </div>
            )}

            <video 
              ref={videoRef}
              src="/demo.mp4.MOV" 
              poster="/capa.jpg" 
              autoPlay
              muted
              defaultMuted
              loop
              playsInline
              controls={isVideoActive}
              onLoadedData={() => {
                if (!isVideoActive && videoRef.current) {
                  videoRef.current.play().catch(e => console.log('Autoplay bloqueado pelo celular:', e));
                }
              }}
              style={{ width: '100%', display: 'block', maxHeight: '75vh', objectFit: 'cover' }}
            >
              Seu navegador não suporta a reprodução deste vídeo.
            </video>
          </div>
        </div>
      </section>

      {/* 4 Badges de Benefícios */}
      <section className="section-mobile-padding" style={{ padding: '40px 5%', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
        <div className="badges-mobile" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center', maxWidth: '1000px' }}>
          
          <div className="badge-small" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.03)', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ color: '#06b6d4' }}><Bot size={16} /></div>
            <span style={{ fontWeight: '500', fontSize: '0.85rem', color: '#e2e8f0' }}>IA Auditora</span>
          </div>

          <div className="badge-small" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.03)', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ color: '#06b6d4' }}><Flame size={16} /></div>
            <span style={{ fontWeight: '500', fontSize: '0.85rem', color: '#e2e8f0' }}>Alertas Reais</span>
          </div>

          <div className="badge-small" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.03)', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ color: '#06b6d4' }}><CheckCircle size={16} /></div>
            <span style={{ fontWeight: '500', fontSize: '0.85rem', color: '#e2e8f0' }}>Gestão Equipe</span>
          </div>

          <div className="badge-small" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.03)', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ color: '#06b6d4' }}><ShieldCheck size={16} /></div>
            <span style={{ fontWeight: '500', fontSize: '0.85rem', color: '#e2e8f0' }}>Anti-Fraude</span>
          </div>
        </div>
      </section>

      {/* Seção Showcase de Features */}
      <section id="como-funciona" className="section-mobile-padding" style={{ padding: '100px 5%', background: 'linear-gradient(180deg, #18181b 0%, #27272a 100%)', position: 'relative', overflow: 'hidden' }}>
        
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
          <div className="grid-2-col-mobile" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', maxWidth: '1200px', margin: '40px auto 0', position: 'relative', zIndex: 10 }}>

          <div style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255, 77, 0, 0.2)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ color: '#ff4d00', marginBottom: '16px' }}><Bot size={28} /></div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '8px' }}>Auditoria Imediata</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem', lineHeight: '1.4' }}>IA analisa a foto e reprova se estiver fora do padrão.</p>
            <div style={{ backgroundColor: 'rgba(255,77,0,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', color: '#ff4d00' }}>
              ⚠️ Reprovado pela IA
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '24px', border: '1px solid rgba(59, 130, 246, 0.2)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ color: '#3b82f6', marginBottom: '16px' }}><ShieldCheck size={28} /></div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '8px' }}>Anti-Fraude</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem', lineHeight: '1.4' }}>Bloqueia fotos da galeria e captura o GPS exato.</p>
            <div style={{ backgroundColor: 'rgba(59,130,246,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', color: '#3b82f6' }}>
              📍 GPS Lock Ativo
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '24px', border: '1px solid rgba(16, 185, 129, 0.2)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ color: '#10b981', marginBottom: '16px' }}><Trophy size={28} /></div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '8px' }}>Ranking</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem', lineHeight: '1.4' }}>Engaje sua equipe. O app ranqueia automaticamente.</p>
            <div style={{ backgroundColor: 'rgba(16,185,129,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', color: '#10b981' }}>
              🥇 1º Lugar: Carlos
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* Seção Agendamentos Automáticos */}
      <section className="section-mobile-padding" style={{ padding: '100px 5%', backgroundColor: 'var(--bg-color)', borderTop: '1px solid rgba(255,77,0,0.1)', borderBottom: '1px solid rgba(255,77,0,0.1)', position: 'relative' }}>
        
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)', backgroundSize: '30px 30px', opacity: 0.5, pointerEvents: 'none' }}></div>

        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '40px', position: 'relative', zIndex: 10 }}>
          
          <div style={{ flex: '1 1 300px' }}>
            <h2 style={{ fontSize: 'min(3rem, 6vw)', fontWeight: '900', marginBottom: '24px', lineHeight: '1.1' }}>
              Automação de Tarefas <br/><span style={{ color: '#ff4d00' }}>como uma Máquina.</span>
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.25rem', marginBottom: '40px', lineHeight: '1.6' }}>
              Você não precisa lembrar ninguém de trabalhar. O núcleo do FireCheck distribui as tarefas, cobra os atrasos via Push e audita com IA. Tudo de forma 100% autônoma.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div style={{ padding: '20px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: '#ff4d00', marginBottom: '12px' }}><Flame size={28} /></div>
                <h4 style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '8px' }}>Atribuição Dinâmica</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>A tarefa vai pro celular certo, na hora certa, de acordo com o turno.</p>
              </div>
              <div style={{ padding: '20px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: '#3b82f6', marginBottom: '12px' }}><Bot size={28} /></div>
                <h4 style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '8px' }}>Cobrança Autônoma</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Atrasou? O app envia notificações pesadas até a tarefa ser feita.</p>
              </div>
            </div>
          </div>

          <div className="hide-on-mobile" style={{ flex: '1 1 300px' }}>
            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '8px', border: '1px solid rgba(255, 77, 0, 0.3)', boxShadow: '0 0 50px rgba(255, 77, 0, 0.15)', position: 'relative' }}>
              
              <div style={{ border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px', padding: '32px', backgroundColor: 'var(--bg-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                  <div>
                    <div style={{ color: '#ff4d00', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '2px', marginBottom: '4px' }}>FIRECHECK CORE</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Distribuidor Automático</div>
                  </div>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }}></div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', borderLeft: '2px solid rgba(255, 77, 0, 0.3)', paddingLeft: '24px', position: 'relative' }}>
                  
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '-31px', top: '10px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981', border: '3px solid var(--bg-color)' }}></div>
                    <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '16px', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 'bold', color: 'white' }}>Abertura Loja</span>
                        <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 'bold' }}>CONCLUÍDO (06:05)</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Equipe Manhã • 100% de precisão</div>
                    </div>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '-31px', top: '10px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff4d00', border: '3px solid var(--bg-color)', boxShadow: '0 0 10px #ff4d00' }}></div>
                    <div style={{ backgroundColor: 'rgba(255, 77, 0, 0.05)', border: '1px solid rgba(255, 77, 0, 0.3)', padding: '16px', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 'bold', color: 'white' }}>Fechamento Caixa</span>
                        <span style={{ color: '#ff4d00', fontSize: '0.85rem', fontWeight: 'bold' }}>RODANDO AGORA</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Aguardando fotos do caixa...</div>
                    </div>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '-31px', top: '10px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#3b82f6', border: '3px solid var(--bg-color)' }}></div>
                    <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '16px', borderRadius: '12px', opacity: 0.5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 'bold', color: 'white' }}>Auditoria Madrugada</span>
                        <span style={{ color: '#3b82f6', fontSize: '0.85rem', fontWeight: 'bold' }}>AGENDADO (02:00)</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Vigilância Patrimonial</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Templates de Checklist */}
      <section className="section-mobile-padding" style={{ padding: '80px 5%', backgroundColor: '#18181b' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 style={{ fontSize: 'min(3rem, 6vw)', fontWeight: '800', marginBottom: '16px', lineHeight: '1.2' }}>
            Checklists prontos. Crie o seu em minutos <br/><span style={{ color: '#06b6d4' }}>— ou deixe a IA criar</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>
            Não sabe por onde começar? Use nossos modelos validados por grandes redes de varejo ou peça para a Inteligência Artificial gerar um personalizado para o seu negócio.
          </p>
        </div>

        <div className="grid-2x2-mobile" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'} onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'} onClick={() => document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' })}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '1.2rem' }}>➕</span>
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>Criar Novo</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px', flex: 1 }}>Crie um novo checklist do zero sem usar um template.</p>
            <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>Começar agora <ArrowRight size={14} /></div>
          </div>

          <div style={{ backgroundColor: 'rgba(6, 182, 212, 0.05)', borderRadius: '20px', padding: '24px', border: '1px solid rgba(6, 182, 212, 0.3)', display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease', cursor: 'pointer', boxShadow: '0 0 20px rgba(6, 182, 212, 0.1)' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'} onClick={() => document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' })}>
            <div style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <Bot size={20} />
            </div>
            <h3 className="price-text" style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px', color: '#06b6d4' }}>Criar com IA</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px', flex: 1 }}>Descreva sua operação e a Inteligência Artificial cria o checklist completo para você.</p>
            <div style={{ color: '#06b6d4', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>Gerar checklist <ArrowRight size={14} /></div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', cursor: 'pointer' }} onClick={() => document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' })}>
            <div className="badge-wrap" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', fontSize: '0.7rem', padding: '4px 8px', borderRadius: '8px', fontWeight: 'bold' }}>COZINHA</span>
              <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', fontSize: '0.7rem', padding: '4px 8px', borderRadius: '8px', fontWeight: 'bold' }}>FECHAMENTO</span>
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>Fechamento Cozinha</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px', flex: 1 }}>Checklist para garantir o correto fechamento, higiene e desligamento de equipamentos.</p>
            <div style={{ color: '#06b6d4', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>Usar esse template <ArrowRight size={14} /></div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', cursor: 'pointer' }} onClick={() => document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' })}>
            <div className="badge-wrap" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', fontSize: '0.7rem', padding: '4px 8px', borderRadius: '8px', fontWeight: 'bold' }}>SALÃO</span>
              <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', fontSize: '0.7rem', padding: '4px 8px', borderRadius: '8px', fontWeight: 'bold' }}>ABERTURA</span>
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>Abertura Salão</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px', flex: 1 }}>Verificação de mesas, banheiros, uniformes e iluminação antes de abrir ao público.</p>
            <div style={{ color: '#06b6d4', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>Usar esse template <ArrowRight size={14} /></div>
          </div>
        </div>
      </section>

      {/* Seção de Planos (Pricing) */}
      <section id="pricing" className="section-mobile-padding" style={{ padding: '80px 5%', backgroundColor: 'var(--bg-color)' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '16px' }}>Escolha o plano ideal para a sua operação</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Cancele a qualquer momento. Sem taxas ocultas.</p>
        </div>

        <div className="grid-3-col-mobile" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', maxWidth: '1200px', margin: '0 auto', alignItems: 'center' }}>
          
          <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Start Mensal</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Ideal para testar na sua operação.</p>
            <div className="price-text" style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '8px' }}>
              R$97<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/mês</span>
            </div>
            <div style={{ color: 'transparent', fontSize: '0.9rem', marginBottom: '32px' }}>-</div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', flex: 1 }}>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Até 10 funcionários</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> <strong>Auditoria por IA (Google Gemini)</strong></li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Notificações Push no Celular</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Bloqueio de fotos falsas</li>
            </ul>
            <button className="btn-secondary" style={{ width: '100%', padding: '12px' }} onClick={() => navigate('/checkout?plan=mensal')}>
              Assinar Agora
            </button>
          </div>

          <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', border: '2px solid var(--primary)', transform: 'scale(1.05)', position: 'relative', zIndex: 1, pointerEvents: 'auto' }}>
            <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--primary)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>2 MESES GRÁTIS</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '8px', color: 'var(--primary)' }}>Start Anual</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Auditoria inteligente para sua operação decolar.</p>
            <div className="price-text" style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '8px' }}>
              R$79,90<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/mês</span>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: 'var(--success)', fontSize: '0.9rem', fontWeight: 'bold' }}>Faturado R$958,80 anualmente</div>
              <div style={{ color: 'rgba(0, 200, 83, 0.6)', fontSize: '0.8rem' }}>Economia de R$205/ano</div>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', flex: 1 }}>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Até 10 funcionários</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> <strong>Auditoria por IA (Google Gemini)</strong></li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Notificações Push no Celular</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Bloqueio de fotos falsas</li>
            </ul>
            <button className="btn btn-pulse" style={{ width: '100%', padding: '12px' }} onClick={() => navigate('/checkout?plan=anual')}>
              Assinar Agora
            </button>
          </div>

          <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Custom</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Faremos um plano personalizado para sua empresa.</p>
            <div className="price-text" style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '24px' }}>A combinar</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', flex: 1 }}>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Acima de 10 funcionários</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Treinamento de IA Personalizado</li>
              <li style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}><CheckCircle size={18} color="var(--success)" /> Gerente de Conta Dedicado</li>
            </ul>
            <button className="btn-secondary" style={{ width: '100%', padding: '12px' }} onClick={() => window.open('https://wa.me/5522981118514?text=Olá,%20gostaria%20de%20falar%20com%20um%20consultor%20sobre%20o%20plano%20Custom%20do%20FireCheck.')}>Falar com nossos consultores</button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '60px' }}>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>Ainda não tem certeza?</h3>
          <button className="btn" style={{ padding: '16px 32px', fontSize: '1.1rem', backgroundColor: 'transparent', border: '2px solid var(--primary)', color: 'var(--primary)' }} onClick={() => navigate('/checkout')}>
            Criar conta e Testar Grátis por 7 Dias
          </button>
          <p style={{ marginTop: '12px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Acesso imediato. Não pedimos cartão de crédito.</p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '40px 5%', textAlign: 'center', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 'auto' }}>
        <p>© 2026 FireCheck Inc. O futuro da auditoria de varejo.</p>
        <p style={{ marginTop: '10px' }}>
          <Link to="/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'underline', fontSize: '0.8rem' }}>Política de Privacidade</Link>
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
