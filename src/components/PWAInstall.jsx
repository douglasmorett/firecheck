import { useState, useEffect } from 'react';
import { Download, Smartphone, X, Share } from 'lucide-react';

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
          backgroundColor: 'rgba(255, 77, 0, 0.1)',
          color: 'var(--primary)',
          border: '1px solid var(--primary)',
          padding: '16px',
          borderRadius: '12px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '1rem',
          marginBottom: '24px',
          width: '100%',
          transition: 'all 0.2s'
        }}
      >
        <Smartphone size={22} />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontWeight: '800' }}>Baixar nosso aplicativo</div>
          <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Instalação rápida para Android e iPhone</div>
        </div>
      </button>

      {showSelection && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.9)',
          display: 'flex',
          alignItems: 'flex-end',
          zIndex: 10000,
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={resetModal}>
          <div 
            style={{
              width: '100%',
              backgroundColor: '#1A1C23',
              padding: '32px 24px',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
              color: 'white',
              animation: 'slideUp 0.3s ease-out'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem' }}>
                {step === 'choice' ? 'Qual seu celular?' : step === 'android' ? 'Instalar no Android' : 'Instalar no iPhone'}
              </h3>
              <button onClick={resetModal} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}><X size={24} /></button>
            </div>

            {step === 'choice' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <button 
                  onClick={handleAndroidInstall}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px', borderRadius: '16px', backgroundColor: '#2D303E', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer' }}
                >
                  <Smartphone size={32} color="#3ddc84" />
                  <span style={{ fontWeight: 'bold' }}>Android</span>
                </button>
                <button 
                  onClick={() => setStep('ios')}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px', borderRadius: '16px', backgroundColor: '#2D303E', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer' }}
                >
                  <Smartphone size={32} color="#A2AAAD" />
                  <span style={{ fontWeight: 'bold' }}>iPhone</span>
                </button>
              </div>
            )}

            {step === 'android' && (
              <div style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                <p>1. Clique nos <b>três pontos (⋮)</b> do navegador Chrome.</p>
                <p>2. Selecione <b>"Instalar aplicativo"</b> ou "Adicionar à tela inicial".</p>
                <button className="btn" style={{ width: '100%', marginTop: '20px' }} onClick={resetModal}>Entendi</button>
              </div>
            )}

            {step === 'ios' && (
              <div style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                   <div style={{ backgroundColor: '#2D303E', padding: '8px', borderRadius: '8px' }}><Share size={20} color="#007AFF" /></div>
                   <span>1. Clique no botão de <b>Compartilhar</b> do Safari.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                   <div style={{ backgroundColor: '#2D303E', padding: '8px', borderRadius: '8px' }}><Plus size={20} /></div>
                   <span>2. Selecione <b>"Adicionar à Tela de Início"</b>.</span>
                </div>
                <button className="btn" style={{ width: '100%' }} onClick={resetModal}>Entendi</button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </>
  );
}
