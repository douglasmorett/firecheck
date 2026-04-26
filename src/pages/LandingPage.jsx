import { useState, useEffect, useRef } from 'react';
import { ArrowRight, CheckCircle, Smartphone, ShieldCheck, Flame, Bot, X, Video, PlayCircle } from 'lucide-react';
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
          <button className="btn-secondary" style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', fontSize: '0.9rem', cursor: 'pointer' }} onClick={() => document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' })}>Planos</button>
          <button className="btn" style={{ padding: '10px 24px', boxShadow: '0 0 20px rgba(255, 77, 0, 0.4)' }} onClick={() => navigate('/login')}>
            Entrar no Sistema
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header style={{ padding: '100px 5% 40px 5%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="badge badge-warning" style={{ marginBottom: '24px', padding: '8px 16px', fontSize: '0.9rem' }}>
          ✨ O primeiro checklist do Brasil movido por IA
        </div>
        <h1 style={{ fontSize: 'min(3rem, 8vw)', fontWeight: '800', lineHeight: '1.2', maxWidth: '800px', marginBottom: '20px', background: 'linear-gradient(to right, #ffffff, #a0a0a0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Auditoria com IA que economiza seu tempo.
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '16px', fontWeight: '500' }}>
          Veja a demonstração do nosso aplicativo:
        </p>
      </header>

      {/* Video de Demonstração */}
      <section style={{ padding: '0 5% 20px 5%', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 2 }}>
        <div style={{ width: '100%', maxWidth: '350px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 60px rgba(255,77,0,0.15)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '40px', position: 'relative' }}>
          
          {/* Overlay da Máscara */}
          {!isVideoActive && (
            <div 
              onClick={() => {
                setIsVideoActive(true);
                if (videoRef.current) {
                  videoRef.current.muted = false;
                  videoRef.current.currentTime = 0; // Reinicia o vídeo com som
                  videoRef.current.play().catch(() => {});
                }
                if (!sessionStorage.getItem('video_played')) {
                  fetch(`${API_URL}/api/track-video`, { method: 'POST' }).catch(() => {});
                  sessionStorage.setItem('video_played', 'true');
                }
              }}
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                zIndex: 10, cursor: 'pointer', transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.4)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'}
            >
              <PlayCircle size={80} color="var(--primary)" style={{ marginBottom: '16px', animation: 'pulse 1.5s infinite ease-in-out' }} />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.8)', textAlign: 'center', padding: '0 20px' }}>
                Aperte play para ver o vídeo do nosso app
              </h2>
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
            style={{ width: '100%', display: 'block', backgroundColor: '#000', maxHeight: '75vh', objectFit: 'contain' }}
          >
            Seu navegador não suporta a reprodução deste vídeo.
          </video>
        </div>

        <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', maxWidth: '600px', marginBottom: '32px', lineHeight: '1.5', textAlign: 'center' }}>
          O FireCheck fiscaliza sua operação e te manda uma notificação no celular apenas se algo estiver errado. Chega de conferir centenas de fotos manualmente todos os dias.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-pulse" style={{ fontSize: '1.1rem', padding: '16px 32px' }} onClick={() => navigate('/checkout')}>
            Começar 7 Dias Grátis (Sem Cartão) <ArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* 4 Badges de Benefícios (Resumo Rápido) */}
      <section style={{ padding: '0 5% 60px 5%', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center', maxWidth: '1000px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'rgba(255,255,255,0.03)', padding: '12px 24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ color: '#06b6d4' }}><Bot size={20} /></div>
            <span style={{ fontWeight: '500', fontSize: '1rem', color: '#e2e8f0' }}>Onde agir primeiro</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'rgba(255,255,255,0.03)', padding: '12px 24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ color: '#06b6d4' }}><Flame size={20} /></div>
            <span style={{ fontWeight: '500', fontSize: '1rem', color: '#e2e8f0' }}>Alertas em tempo real</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'rgba(255,255,255,0.03)', padding: '12px 24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ color: '#06b6d4' }}><CheckCircle size={20} /></div>
            <span style={{ fontWeight: '500', fontSize: '1rem', color: '#e2e8f0' }}>Quem fez, quem não fez</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'rgba(255,255,255,0.03)', padding: '12px 24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ color: '#06b6d4' }}><ShieldCheck size={20} /></div>
            <span style={{ fontWeight: '500', fontSize: '1rem', color: '#e2e8f0' }}>Evidência fotográfica</span>
          </div>

        </div>
      </section>

      {/* Seção Showcase de Features (3 Cards) */}
      <section style={{ padding: '80px 5%', backgroundColor: '#0a0f1c' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ border: '1px solid rgba(6, 182, 212, 0.3)', color: '#06b6d4', padding: '6px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '24px', display: 'inline-block' }}>
            <ShieldCheck size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-top' }} /> GESTÃO À PROVA DE FALHAS
          </div>
          <h2 style={{ fontSize: 'min(3rem, 6vw)', fontWeight: '800', marginBottom: '24px', lineHeight: '1.2' }}>
            Saiba dos problemas <span style={{ color: '#06b6d4' }}>antes que<br/>virem prejuízo</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '700px', lineHeight: '1.6' }}>
            Imagine receber um alerta no seu celular no exato momento em que algo importante ainda não foi feito. E receber a prova em foto quando for.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', maxWidth: '1200px', margin: '0 auto' }}>
          
          {/* Card 1 */}
          <div style={{ backgroundColor: '#111827', borderRadius: '24px', padding: '32px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '12px' }}>Alerta quando não foi feito</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '1rem', lineHeight: '1.5' }}>Tarefa crítica não concluída? Notificação push do app na hora.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ backgroundColor: '#1f2937', borderRadius: '16px', padding: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>⚠️</div>
                  <div>
                    <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px', letterSpacing: '0.5px' }}>ALERTA DO APP</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '500', marginBottom: '4px' }}>Fechamento Cozinha <span style={{ fontWeight: '800' }}>não concluído</span> — Equipe Noite</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>23:05 • via FireCheck App</div>
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: '#1f2937', borderRadius: '16px', padding: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>⏱️</div>
                  <div>
                    <div style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px', letterSpacing: '0.5px' }}>ATRASADO</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '500', marginBottom: '4px' }}>Verificação de Validade <span style={{ fontWeight: '800' }}>atrasada 15 min</span></div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>14:17 • Unidade Centro</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div style={{ backgroundColor: '#111827', borderRadius: '24px', padding: '32px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '12px' }}>Prova em foto do que foi feito</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '1rem', lineHeight: '1.5' }}>Foto em tempo real como evidência. Sem foto, não conta.</p>
            
            <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
              <img src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=800&auto=format&fit=crop" alt="Foto restaurante" style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', bottom: '12px', left: '12px', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                GPS verificado
              </div>
              <div style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: '#10b981', color: 'white', padding: '4px 8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={16} />
              </div>
              <div style={{ position: 'absolute', top: '12px', left: '12px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                6/10
              </div>
            </div>
          </div>

          {/* Card 3 */}
          <div style={{ backgroundColor: '#111827', borderRadius: '24px', padding: '32px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '12px' }}>Score de cada colaborador</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '1rem', lineHeight: '1.5' }}>Quem entrega no prazo e quem atrasa. Com dados, não achismo.</p>
            
            <div style={{ backgroundColor: '#1f2937', borderRadius: '16px', padding: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>COLABORADOR</span>
                <div style={{ display: 'flex', gap: '24px' }}>
                  <span>SCORE</span>
                  <span>PONTUAL.</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#064e3b', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>A</div>
                  <span style={{ fontWeight: '500', fontSize: '0.95rem' }}>Ana B.</span>
                </div>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                  <span style={{ color: '#10b981', fontWeight: 'bold', width: '35px', textAlign: 'right' }}>85.7</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', width: '45px', textAlign: 'right' }}>85.7%</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#1e3a8a', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>L</div>
                  <span style={{ fontWeight: '500', fontSize: '0.95rem' }}>Luciano</span>
                </div>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                  <span style={{ color: '#10b981', fontWeight: 'bold', width: '35px', textAlign: 'right' }}>82.7</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', width: '45px', textAlign: 'right' }}>44%</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#4c1d95', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>M</div>
                  <span style={{ fontWeight: '500', fontSize: '0.95rem' }}>Marcia</span>
                </div>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                  <span style={{ color: '#eab308', fontWeight: 'bold', width: '35px', textAlign: 'right' }}>77.5</span>
                  <span style={{ color: '#ef4444', fontSize: '0.9rem', width: '45px', textAlign: 'right' }}>10%</span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* Seção Agendamentos Automáticos */}
      <section style={{ padding: '80px 5%', backgroundColor: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '64px' }}>
          
          {/* Text Content */}
          <div style={{ flex: '1 1 500px' }}>
            <h2 style={{ fontSize: 'min(2.5rem, 5vw)', fontWeight: '800', marginBottom: '24px', lineHeight: '1.2' }}>
              Processos que rodam sozinhos <span style={{ color: 'var(--text-muted)' }}>(de verdade)</span>
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', marginBottom: '32px', lineHeight: '1.6' }}>
              Configure uma vez e nunca mais se preocupe. Os checklists aparecem automaticamente no app da equipe, no horário certo, para a pessoa certa.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '50%', padding: '4px', marginTop: '2px' }}>
                  <CheckCircle size={16} />
                </div>
                <span style={{ fontSize: '1.1rem', fontWeight: '500' }}>Agendamento automático por turno e dia da semana</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '50%', padding: '4px', marginTop: '2px' }}>
                  <CheckCircle size={16} />
                </div>
                <span style={{ fontSize: '1.1rem', fontWeight: '500' }}>Atribuição de responsáveis por unidade e função</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '50%', padding: '4px', marginTop: '2px' }}>
                  <CheckCircle size={16} />
                </div>
                <span style={{ fontSize: '1.1rem', fontWeight: '500' }}>Recorrência configurável — diário, semanal ou mensal</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '50%', padding: '4px', marginTop: '2px' }}>
                  <CheckCircle size={16} />
                </div>
                <span style={{ fontSize: '1.1rem', fontWeight: '500' }}>Notificação push no celular quando um processo atrasa</span>
              </li>
            </ul>
          </div>

          {/* UI Mockup Card */}
          <div style={{ flex: '1 1 500px', perspective: '1000px' }}>
            <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255,255,255,0.1)', transform: 'rotateY(-5deg) rotateX(5deg)' }}>
              
              {/* Header */}
              <div style={{ backgroundColor: '#020617', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '40px', height: '40px', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontSize: '1.2rem' }}>
                    📅
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Agendamentos Ativos</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>4 processos configurados</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></div>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                </div>
              </div>

              {/* List */}
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ color: '#10b981' }}><CheckCircle size={20} /></div>
                    <div>
                      <div style={{ fontWeight: '600' }}>Abertura Cozinha</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Equipe Manhã • 06:00</div>
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>Ativo</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ color: '#3b82f6', fontSize: '1.2rem', width: '20px', textAlign: 'center' }}>⏳</div>
                    <div>
                      <div style={{ fontWeight: '600' }}>Fechamento Caixa</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Operador Caixa • 23:00</div>
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>Agendado</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ color: '#10b981' }}><CheckCircle size={20} /></div>
                    <div>
                      <div style={{ fontWeight: '600' }}>Abertura Salão</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Equipe Salão • 10:30</div>
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>Ativo</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ color: '#3b82f6', fontSize: '1.2rem', width: '20px', textAlign: 'center' }}>⏳</div>
                    <div>
                      <div style={{ fontWeight: '600' }}>Fechamento Gerência</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Gerente • 23:30</div>
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>Agendado</div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Features Comparativas (Onde somos melhores) */}
      <section style={{ padding: '40px 5% 80px 5%', backgroundColor: '#121318' }}>
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
            <h3 style={{ fontSize: '1.3rem', marginBottom: '12px' }}>Notificações no Celular</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.5' }}>Não precisa abrir o painel para descobrir que uma loja não abriu. Se uma tarefa estourar o limite, você recebe a notificação direto no celular.</p>
          </div>

        </div>
      </section>

      {/* Seção de Planos (Pricing) */}
      <section id="pricing" style={{ padding: '80px 5%', backgroundColor: 'var(--bg-color)' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '16px' }}>Escolha o plano ideal para a sua operação</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Cancele a qualquer momento. Sem taxas ocultas.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', maxWidth: '1200px', margin: '0 auto' }}>
          
          {/* Plano Mensal */}
          <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Start Mensal</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Ideal para testar na sua operação.</p>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '8px' }}>
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

          {/* Plano Anual (Destacado) */}
          <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', border: '2px solid var(--primary)', transform: 'scale(1.05)', position: 'relative', zIndex: 1, pointerEvents: 'auto' }}>
            <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--primary)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>2 MESES GRÁTIS</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '8px', color: 'var(--primary)' }}>Start Anual</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Auditoria inteligente para sua operação decolar.</p>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '8px' }}>
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

          {/* Plano Custom */}
          <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Custom</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Faremos um plano personalizado para sua empresa.</p>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '24px' }}>A combinar</div>
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
