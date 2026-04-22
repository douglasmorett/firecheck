import { useState, useEffect } from 'react';
import { Smartphone, X, Share, Plus, Download } from 'lucide-react';

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showSelection, setShowSelection] = useState(false);
  const [step, setStep] = useState('choice'); // 'choice', 'android', 'ios'
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsInstalled(true);
    }
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const resetModal = () => {
    setShowSelection(false);
    setStep('choice');
  };

  const handleAndroidInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstalled(true);
        resetModal();
      }
    } else {
      setStep('android');
    }
  };

  if (isInstalled) return null;

  return (
    <>
      <button 
        onClick={() => setShowSelection(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          backgroundColor: 'rgba(255, 77, 0, 0.15)',
          color: '#ff4d00',
          border: '2px solid #ff4d00',
          padding: '18px',
          borderRadius: '14px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '1.1rem',
          marginBottom: '24px',
          width: '100%',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
        }}
      >
        <Smartphone size={24} />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontWeight: '900' }}>Baixar nosso aplicativo</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Receba notificações de auditoria</div>
        </div>
      </button>

      {showSelection && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }} onClick={resetModal}>
          <div 
            style={{
              width: '100%',
              maxWidth: '400px',
              backgroundColor: '#1E2028',
              padding: '30px',
              borderRadius: '24px',
              border: '1px solid #333',
              color: 'white',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem', color: 'white' }}>
                {step === 'choice' ? 'Qual seu celular?' : step === 'android' ? 'Instalar no Android' : 'Instalar no iPhone'}
              </h3>
              <button onClick={resetModal} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={28} /></button>
            </div>

            {step === 'choice' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <button 
                  onClick={handleAndroidInstall}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px', borderRadius: '16px', backgroundColor: '#2D303E', border: '1px solid #444', color: 'white', cursor: 'pointer' }}
                >
                  <Smartphone size={32} color="#3ddc84" />
                  <span style={{ fontWeight: 'bold' }}>Android</span>
                </button>
                <button 
                  onClick={() => setStep('ios')}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px', borderRadius: '16px', backgroundColor: '#2D303E', border: '1px solid #444', color: 'white', cursor: 'pointer' }}
                >
                  <Smartphone size={32} color="#A2AAAD" />
                  <span style={{ fontWeight: 'bold' }}>iPhone</span>
                </button>
              </div>
            )}

            {step === 'android' && (
              <div style={{ color: '#ccc', lineHeight: '1.6', fontSize: '1.05rem' }}>
                <p style={{ marginBottom: '12px' }}>1. Clique nos <b>três pontos (⋮)</b> lá no topo do Chrome.</p>
                <p style={{ marginBottom: '20px' }}>2. Procure por <b>"Instalar aplicativo"</b> ou "Adicionar à tela inicial".</p>
                <button className="btn" style={{ width: '100%', padding: '14px' }} onClick={resetModal}>Entendi</button>
              </div>
            )}

            {step === 'ios' && (
              <div style={{ color: '#ccc', lineHeight: '1.6', fontSize: '1.05rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                   <div style={{ backgroundColor: '#333', padding: '10px', borderRadius: '10px' }}>
                     <span style={{ fontSize: '20px', fontWeight: 'bold' }}>...</span>
                   </div>
                   <span>1. Clique nos <b>3 pontinhos (...)</b> no canto inferior direito da tela.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                   <div style={{ backgroundColor: '#333', padding: '10px', borderRadius: '10px' }}><Share size={24} color="#007AFF" /></div>
                   <span>2. No menu que abrir, clique em <b>"Compartilhar"</b>.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                   <div style={{ backgroundColor: '#333', padding: '10px', borderRadius: '10px' }}><Plus size={24} /></div>
                   <span>3. Role para baixo e selecione <b>"Adicionar à Tela de Início"</b>.</span>
                </div>
                <button className="btn" style={{ width: '100%', padding: '14px' }} onClick={resetModal}>Entendi</button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes popIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </>
  );
}
