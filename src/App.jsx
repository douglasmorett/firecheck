import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import ChecklistCreator from './pages/ChecklistCreator';
import ChecklistExecution from './pages/ChecklistExecution';
import LandingPage from './pages/LandingPage';
import Checkout from './pages/Checkout';
import PrivacyPolicy from './pages/PrivacyPolicy';

function App() {
  return (
    <Router>
      <Routes>
        {/* Site Institucional de Vendas */}
        <Route path="/privacy" element={<PrivacyPolicy />} />
        {/* Se for App (Nativo), abre no Login. Se for Web, abre na Landing Page */}
        <Route path="/" element={Capacitor.isNativePlatform() ? <Navigate to="/login" /> : <LandingPage />} />
        <Route path="/checkout" element={<Checkout />} />
        
        {/* Tela de Login do Sistema */}
        <Route path="/login" element={<Login />} />
        
        {/* Painel do Dono */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/creator" element={<ChecklistCreator />} />
        <Route path="/admin/creator/:id" element={<ChecklistCreator />} />

        {/* Visão do Funcionário na Loja */}
        <Route path="/funcionario" element={<ChecklistExecution />} />
      </Routes>
    </Router>
  );
}

export default App;
