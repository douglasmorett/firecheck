import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import ChecklistCreator from './pages/ChecklistCreator';
import ChecklistExecution from './pages/ChecklistExecution';
import EmployeeDashboard from './pages/EmployeeDashboard';
import LandingPage from './pages/LandingPage';
import Checkout from './pages/Checkout';
import PrivacyPolicy from './pages/PrivacyPolicy';
import QuizFunnel from './pages/QuizFunnel';
import TermsOfUse from './pages/TermsOfUse';
import PontoPage from './pages/PontoPage';
import RenewPlan from './pages/RenewPlan';
import ThankYou from './pages/ThankYou';

function App() {
  return (
    <Router>
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

        {/* Rota 404 — redireciona para a página inicial */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
