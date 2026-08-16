import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import React, { Component, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import ChecklistCreator from './pages/ChecklistCreator';
import ChecklistExecution from './pages/ChecklistExecution';
import ShoppingExecution from './pages/ShoppingExecution';
import EmployeeDashboard from './pages/EmployeeDashboard';
import LandingPage from './pages/LandingPage';
import Checkout from './pages/Checkout';
import PrivacyPolicy from './pages/PrivacyPolicy';
import QuizFunnel from './pages/QuizFunnel';
import TermsOfUse from './pages/TermsOfUse';
import PontoPage from './pages/PontoPage';
import RenewPlan from './pages/RenewPlan';
import ThankYou from './pages/ThankYou';
import ResellerPage from './pages/ResellerPage';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('firecheck_admin_backup');
      localStorage.removeItem('firecheck_impersonated');
    } catch {}
    window.location.reload();
  };

  handleFullClear = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '480px',
            width: '100%',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '32px',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              backgroundColor: 'rgba(255, 77, 0, 0.15)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '1.8rem'
            }}>
              🔥
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '10px' }}>
              Atualização ou Falha Temporária
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '24px' }}>
              Houve uma instabilidade momentânea no carregamento da tela. Seus dados continuam seguros.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={this.handleReset}
                style={{
                  backgroundColor: '#ff4d00',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px 20px',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  cursor: 'pointer'
                }}
              >
                🔄 Recarregar Sistema
              </button>
              <button
                onClick={this.handleFullClear}
                style={{
                  backgroundColor: 'transparent',
                  color: '#94a3b8',
                  border: '1px solid #475569',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Limpar Cache e Fazer Login Novamente
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function RouteTracker() {
  const location = useLocation();

  useEffect(() => {
    if (window.fbq) {
      window.fbq('track', 'PageView');
    }
  }, [location]);

  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <RouteTracker />
        <Routes>
          {/* Site Institucional de Vendas */}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/privacy.html" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfUse />} />
          
          {/* Se for App (Nativo), abre no Login. Se for Web, abre na Landing Page */}
          <Route path="/" element={Capacitor.isNativePlatform() ? <Navigate to="/login" /> : <LandingPage />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/quiz" element={<QuizFunnel />} />
          <Route path="/obrigado" element={<ThankYou />} />
          
          {/* Programa de Revenda / Afiliados */}
          <Route path="/revenda" element={<ResellerPage />} />
          <Route path="/revendedor" element={<ResellerPage />} />
          <Route path="/afiliados" element={<ResellerPage />} />
          
          {/* Tela de Login do Sistema */}
          <Route path="/login" element={<Login />} />
          <Route path="/renovar" element={<RenewPlan />} />
          
          {/* Painel do Dono */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/creator" element={<ChecklistCreator />} />
          <Route path="/admin/creator/:id" element={<ChecklistCreator />} />

          {/* Visão do Funcionário na Loja */}
          <Route path="/funcionario" element={<EmployeeDashboard />} />
          <Route path="/ponto" element={<PontoPage />} />
          <Route path="/execucao/:id" element={<ChecklistExecution />} />
          <Route path="/execucao/veiculo/:vehicleId" element={<ChecklistExecution />} />
          <Route path="/execucao/compras/:shoppingListId" element={<ShoppingExecution />} />
          <Route path="/shopping/execucao/:shoppingListId" element={<ShoppingExecution />} />

          {/* Rota 404 — redireciona para a página inicial */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
