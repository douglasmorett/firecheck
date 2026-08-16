import React from 'react';
import { Bot, AlertTriangle, Flame, ArrowLeft } from 'lucide-react';

export default function PhoneMockupProcess() {
  return (
        {/* Right Column: Animated Dual Phones */}
        <div className="hero-mockups" style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative', minHeight: '450px' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '120%', height: '120%', background: 'radial-gradient(circle, rgba(255,77,0,0.15) 0%, transparent 60%)', filter: 'blur(50px)', zIndex: -1 }}></div>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '32px', textAlign: 'center', zIndex: 10 }}>veja como Ã© simples o nosso processo:</div>
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
          {/* Celular do FuncionÃ¡rio */}
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
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Pendente â€¢ 14:30</div>
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.05)', animation: 'pulse 1.5s infinite' }}></div>
                    </div>
                    <div style={{ padding: '16px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', opacity: 0.6 }}>
                      <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}>Limpeza Banheiros</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Pendente â€¢ 15:00</div>
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
                 <p style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center', padding: '0 24px' }}>Verificando conformidade com o padrÃ£o da loja.</p>
                 
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
                     Crostas de gordura carbonizada na lateral direita da chapa. RefaÃ§a a limpeza.
                   </p>
                 </div>
                 <button style={{ marginTop: '32px', padding: '12px 24px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem' }}>
                   Tentar Novamente
                 </button>
              </div>

            </div>
            <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#94a3b8', marginTop: '16px', textAlign: 'center' }}>Celular do FuncionÃ¡rio</div>
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
                       <div style={{ fontWeight: 'bold', color: '#991b1b', fontSize: '0.85rem' }}>AnÃ¡lise da IA</div>
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
  );
}

