import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('firecheck_pwa_banner_dismissed') === 'true');

  useEffect(() => {
    // Se é app nativo Capacitor, não mostrar banner de instalação
    if (Capacitor.isNativePlatform()) {
      setIsInstalled(true);
      return;
    }
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsInstalled(true);
    }
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Guarda o evento fora do React para que outras telas possam oferecer a
      // instalação mesmo quando este banner estiver dispensado ou não renderizado.
      window.__firecheckPwaPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstalled(true);
      }
    } else {
      setShowInstructions(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('firecheck_pwa_banner_dismissed', 'true');
  };

  if (isInstalled || dismissed) return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <>
      <div 
        data-pwa-install
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          backgroundColor: 'rgba(255, 77, 0, 0.08)',
          color: 'var(--text-main)',
          border: '1px solid rgba(255, 77, 0, 0.25)',
          padding: '14px 18px',
          borderRadius: '12px',
          marginBottom: '24px',
          width: '100%',
          position: 'relative'
        }}
      >
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1 }}
          onClick={handleInstall}
        >
          <Download size={20} color="#ff4d00" />
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>Instalar WebApp no celular</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Acesso rápido direto da tela inicial</div>
          </div>
        </div>
        <button 
          onClick={handleDismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          title="Fechar"
        >
          <X size={18} />
        </button>
      </div>

      {showInstructions && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }} onClick={() => setShowInstructions(false)}>
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
                Instalar WebApp
              </h3>
              <button onClick={() => setShowInstructions(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={28} /></button>
            </div>

            <div style={{ color: '#ccc', lineHeight: '1.6', fontSize: '1.05rem' }}>
              {isIOS ? (
                <>
                  <p style={{ marginBottom: '12px' }}>1. Toque no botão <b>Compartilhar</b> (ícone de quadrado com seta) na barra do Safari.</p>
                  <p style={{ marginBottom: '20px' }}>2. Role e selecione <b>"Adicionar à Tela de Início"</b>.</p>
                </>
              ) : (
                <>
                  <p style={{ marginBottom: '12px' }}>1. Clique nos <b>três pontos (⋮)</b> no topo do Chrome.</p>
                  <p style={{ marginBottom: '20px' }}>2. Procure por <b>"Instalar aplicativo"</b> ou "Adicionar à tela inicial".</p>
                </>
              )}
              <button className="btn" style={{ width: '100%', padding: '14px' }} onClick={() => setShowInstructions(false)}>Entendi</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes popIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </>
  );
}
