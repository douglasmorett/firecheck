import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ClipboardList, ShieldAlert, Users, Activity, Trophy, TrendingUp, Clock, CheckCircle, AlertCircle, Bell, Flame, Edit2, Trash2, CalendarClock, UserPlus, Mail, Lock, LogOut, Smartphone, X, Camera, Video, Monitor, Info, Save, ArrowRight, ShieldCheck, Calendar, Target, FileDown, LifeBuoy, Menu } from 'lucide-react';
import { PushNotifications } from '@capacitor/push-notifications';
import API_URL from '../api';
import PWAInstall from '../components/PWAInstall';

// ── Dados Iniciais (Vazios) ──────────────────────────────────────────────────
const STATS = {
  checklistsHoje: 0,
  concluidos: 0,
  alertasIA: 0,
  colaboradores: 0,
  conformidade: 0,
};

const AUDITORIAS = [];
const CHECKLISTS_MOCK = []; // Placeholder para quando não houver conexão

const RECURRENCE_LABEL = { daily: '📅 Diário', weekly: '📅 Semanal', monthly: '📅 Mensal', '': '—' };

const ALERTAS_IA = [];

// ── Helpers ─────────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    aprovado:  { label: '✅ Aprovado pela IA',   bg: 'rgba(0,200,83,0.15)',   color: 'var(--success)' },
    reprovado: { label: '❌ Reprovado pela IA',  bg: 'rgba(255,23,68,0.15)',  color: 'var(--error)'   },
    pendente:  { label: '⏳ Aguardando',         bg: 'rgba(255,160,0,0.15)', color: '#FFA000'         },
    ignorado:  { label: '⚠️ IA Ignorada',        bg: 'rgba(255,77,0,0.15)',  color: 'var(--primary)' },
    falha:     { label: '🤖 Falha na IA',        bg: 'rgba(255,23,68,0.25)',  color: 'var(--error)'   },
  };
  const s = map[status] || map.pendente;
  return (
    <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 'bold',
      backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
};

const BarPct = ({ pct, color }) => (
  <div style={{ height: '6px', backgroundColor: '#1A1C23', borderRadius: '100px', overflow: 'hidden', width: '100%' }}>
    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color || 'var(--primary)', transition: 'width 0.5s ease' }} />
  </div>
);

const getUserStatus = (user) => {
  if (user.status === 'blocked') return { text: '🔴 Conta Bloqueada', color: 'var(--error)' };
  
  if (user.status === 'active') {
     if (user.expiration_date) {
        const expDate = new Date(user.expiration_date);
        const now = new Date();
        const diffDays = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return { text: '🔴 Plano Expirado (Pendente)', color: 'var(--warning)' };
        return { text: `🟢 Plano Ativo (${diffDays} dias rest. no ciclo)`, color: 'var(--success)' };
     } else {
        return { text: `🟢 Plano Ativo (Pago)`, color: 'var(--success)' };
     }
  }
  
  // Trial
  const createdDate = new Date(user.created_at || Date.now());
  const now = new Date();
  const diffDays = Math.ceil(Math.abs(now - createdDate) / (1000 * 60 * 60 * 24)); 
  const diasRestantes = 7 - diffDays;
  
  if (diasRestantes < 0) return { text: '🔴 Trial Expirado (Bloqueado)', color: 'var(--error)' };
  if (diasRestantes === 0) return { text: '⏳ Último dia de Teste', color: '#FFA000' };
  return { text: `⏳ Teste Ativo (${diasRestantes} dias restantes)`, color: '#FFA000' };
};

const isBlocked = (user) => {
  if (user.status === 'blocked') return true;
  if (user.status === 'trial') {
    const diffDays = Math.ceil(Math.abs(new Date() - new Date(user.created_at || Date.now())) / (1000 * 60 * 60 * 24)); 
    return (7 - diffDays) < 0;
  }
  return false;
};

// ── Componente Principal ─────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(() => {
    const saved = localStorage.getItem('admin_active_tab');
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const isMaster = user && (user.role === 'master' || user.email?.toLowerCase() === 'douglas@firecheck.com' || user.email?.toLowerCase() === 'contatohakim@gmail.com');
    if (isMaster) {
      return ['financeiro', 'equipe'].includes(saved) ? saved : 'financeiro';
    }
    const isCameraAllowed = user?.email?.toLowerCase() === 'dugaburguer@gmail.com';
    const allowedTabs = isCameraAllowed 
      ? ['auditoria', 'ranking', 'cameras', 'alertas', 'checklists', 'equipe']
      : ['auditoria', 'ranking', 'alertas', 'checklists', 'equipe'];
    return allowedTabs.includes(saved) ? saved : 'auditoria';
  });
  
  // Salvar aba no localStorage sempre que mudar
  useEffect(() => {
    localStorage.setItem('admin_active_tab', tab);
  }, [tab]);
  
  // Estados Reais
  const [checklists, setChecklists] = useState([]);
  const [team, setTeam] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', store: 'Filial Centro' });
  const [userProfile, setUserProfile] = useState(null);
  const [stats, setStats] = useState(STATS);
  const [submissions, setSubmissions] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(null);
  const [newCamera, setNewCamera] = useState({ name: '', url: '', username: '', password: '', ai_commands: [] });
  const [newCommand, setNewCommand] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [dateFilter, setDateFilter] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], // Início do mês
    end: new Date().toISOString().split('T')[0]
  });
  const [notifiedIds, setNotifiedIds] = useState(new Set());
  const [liveVisitors, setLiveVisitors] = useState(0);
  const [todayVisitors, setTodayVisitors] = useState(0);
  const [videoPlays, setVideoPlays] = useState(0);
  const [editingPlan, setEditingPlan] = useState(null);
  
  const [toasts, setToasts] = useState([]);
  const [knownUserIds, setKnownUserIds] = useState(null);

  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };


  const [financialStats, setFinancialStats] = useState({
    vendasMes: 0,
    receitaReal: 0,
    totalArrecadado: 0,
    clientesAtivos: 0
  });

  const [plans, setPlans] = useState([
    { id: 'start_mensal', name: 'Start Mensal' },
    { id: 'start_anual',  name: 'Start Anual' },
    { id: 'pro_mensal',    name: 'Pró Mensal' },
    { id: 'pro_anual',     name: 'Pró Anual' },
    { id: 'vitalicio',     name: 'Vitalício' },
  ]);

  // Carregar dados iniciais
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (!savedUser) {
      navigate('/login');
      return;
    }
    
    const user = JSON.parse(savedUser);
    setUserProfile(user);
    
    // Proteção extra: se for funcionário, não deixa ver o admin
    if (user.role === 'employee') {
      navigate('/funcionario');
      return;
    }

    if (user.role === 'admin' || user.role === 'master') {
      setupPushNotifications(user.email);
    }
    fetchData();
    fetchCameras();

     const checkVisitors = () => {
       if (user.role === 'master' || user.email?.toLowerCase() === 'douglas@firecheck.com') {
          fetch(`${API_URL}/api/live-visitors`).then(r => r.json()).then(d => {
             setLiveVisitors(d.visitors || 0);
             setTodayVisitors(d.today || 0);
             setVideoPlays(d.videoPlays || 0);
          }).catch(() => {});
       }
    };
    checkVisitors();

    // Loop global de atualização do painel a cada 10 segundos (Quase Tempo-Real)
    const globalRefresh = setInterval(() => {
      fetchData();
      checkVisitors();
    }, 10000);

    return () => clearInterval(globalRefresh);
  }, [dateFilter]);

  // Robô Autônomo de Retentativa: Fica tentando processar fotos pendentes a cada 30 segundos
  useEffect(() => {
    if (!userProfile || userProfile.role === 'employee' || userProfile.role === 'funcionario') return; // Só roda no painel gerencial
    
    const interval = setInterval(() => {
      // submissions já está no state
      submissions.forEach(s => {
        const hasPhotos = (s.tasks || []).some(t => t.photo);
        const feedbacks = Object.keys(s.feedback_info || {});
        // Se tem foto mas não tem feedback (ficou pendente/falhou na 1ª vez)
        if (hasPhotos && feedbacks.length === 0) {
          console.log(`[Auto-Retry] Tentando processar IA novamente para submissão ${s.id}...`);
          fetch(`${API_URL}/api/process-audit-background`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ submissionId: s.id })
          }).then(res => res.json()).then(data => {
            if (data.processed > 0) {
               console.log(`[Auto-Retry] Sucesso na retentativa da submissão ${s.id}! Atualizando painel.`);
               fetchData(); // Atualiza os cards
            }
          }).catch(() => {});
        }
      });
    }, 15000); // Tenta a cada 15 segundos
    
    return () => clearInterval(interval);
  }, [submissions, userProfile]);

  const setupPushNotifications = async (email) => {
    try {
      // Tenta primeiro o método nativo (Capacitor)
      if (window.Capacitor?.isNativePlatform()) {
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive === 'granted') {
          await PushNotifications.register();
          PushNotifications.addListener('registration', async (token) => {
            await fetch(`${API_URL}/api/register-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, fcmToken: token.value })
            });
          });
        }
      } else {
        // Método para PWA / Web Push (iPhone e Android no navegador)
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            console.log('Permissão de notificação concedida no navegador');
            // Aqui futuramente integraremos o service worker para web push
            // Por enquanto, registramos que o usuário aceitou
          }
        }
      }
    } catch (e) { 
      console.warn('Push não suportado ou negado:', e); 
    }
  };

  const fetchCameras = async () => {
    const savedUser = localStorage.getItem('user');
    if (!savedUser) return;
    const user = JSON.parse(savedUser);
    const storeParam = user.role !== 'master' ? `?store=${encodeURIComponent(user.store)}` : '';
    try {
      const res = await fetch(`${API_URL}/api/cameras${storeParam}`);
      const data = await res.json();
      if (Array.isArray(data)) setCameras(data);
    } catch (err) { console.error('Erro ao buscar câmeras:', err); }
  };

  const fetchData = async () => {
    try {
      const savedUser = localStorage.getItem('user');
      const currentUser = savedUser ? JSON.parse(savedUser) : null;
      
      let query = `?start=${dateFilter.start}&end=${dateFilter.end}`;
      
      // Se não for master, filtra pela loja do usuário
      if (currentUser && currentUser.role !== 'master' && currentUser.store) {
        query += `&store=${encodeURIComponent(currentUser.store)}`;
      }

      if (currentUser?.role === 'master') {
        const [userRes, finRes] = await Promise.all([
          fetch(`${API_URL}/api/users${query}`),
          fetch(`${API_URL}/api/financials${query}`) // Endpoint fictício para Cacto
        ]);
        
        const userData = await userRes.json();
        const teamArray = Array.isArray(userData) ? userData : [];
        setTeam(teamArray);
        
        setKnownUserIds(prev => {
          if (prev === null) {
            return new Set(teamArray.map(u => u.id));
          }
          const nextSet = new Set(prev);
          teamArray.forEach(u => {
            if (!nextSet.has(u.id)) {
              nextSet.add(u.id);
              const planStr = u.status === 'trial' ? 'Gratuito (Trial)' : (u.plan || 'Pago');
              addToast(`Novo cadastro: ${u.name} - Plano: ${planStr}`, 'success');
            }
          });
          return nextSet;
        });
        
        // Mock de dados financeiros (Integração Cacto) se o fetch falhar
        try {
          const finData = await finRes.json();
          if (finData && typeof finData === 'object') {
             setFinancialStats(prev => ({ ...prev, ...finData }));
          }
        } catch {
          setFinancialStats({
            vendasMes: 12500.50,
            receitaReal: 11850.25,
            totalArrecadado: 45200.00,
            clientesAtivos: Array.isArray(userData) ? userData.filter(u => u.role === 'admin').length : 0
          });
        }
      } else {
        const [clRes, userRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/api/checklists${query}`),
          fetch(`${API_URL}/api/users${query}`),
          fetch(`${API_URL}/api/stats${query}`)
        ]);
        const checklistsData = await clRes.json();
        setChecklists(Array.isArray(checklistsData) ? checklistsData : []);
        
        const userData = await userRes.json();
        const teamArray = Array.isArray(userData) ? userData : [];
        setTeam(teamArray);
        
        setKnownUserIds(prev => {
          if (prev === null) {
            return new Set(teamArray.map(u => u.id));
          }
          const nextSet = new Set(prev);
          teamArray.forEach(u => {
            if (!nextSet.has(u.id)) {
              nextSet.add(u.id);
              const planStr = u.status === 'trial' ? 'Gratuito (Trial)' : (u.plan || 'Pago');
              addToast(`Novo cadastro: ${u.name} - Plano: ${planStr}`, 'success');
            }
          });
          return nextSet;
        });
        
        if (currentUser && currentUser.email) {
           const updatedMe = teamArray.find(u => u.email === currentUser.email);
           if (updatedMe) {
              setUserProfile(updatedMe);
              localStorage.setItem('user', JSON.stringify(updatedMe));
           }
        }
        
        const statsData = await statsRes.json();
        setStats(statsData);

        const subRes = await fetch(`${API_URL}/api/submissions${query}`);
        const subData = await subRes.json();
        
        if (Array.isArray(subData)) {
          setSubmissions(subData);
          
          // Sistema de Notificação em Tempo Real no Navegador
          setNotifiedIds(prev => {
            const nextSet = new Set(prev);
            subData.forEach(s => {
              if (!nextSet.has(s.id)) {
                const feedbacks = Object.values(s.feedback_info || {});
                const hasWarnings = feedbacks.some(f => f.status === 'warning' || f.status === 'error');
                
                if (feedbacks.length > 0) {
                  // Se tem feedback e foi reprovado, dispara push
                  if (hasWarnings && 'Notification' in window && Notification.permission === 'granted') {
                    new Notification("⚠️ Alerta FireCheck", { 
                      body: `Reprovação detectada na tarefa de ${s.employee_name}!`,
                      icon: '/fire-icon.png' 
                    });
                  }
                  nextSet.add(s.id);
                }
              }
            });
            return nextSet;
          });
        } else {
          setSubmissions([]);
        }
      }
    } catch (e) { console.error('Erro ao buscar dados:', e); }
  };

  const handleAddCamera = async () => {
    if (!newCamera.name || !newCamera.url) return alert('Preencha o nome e a URL da câmera.');
    
    // Se for edição, ignora o limite de criação
    if (!editingCamera) {
      // Verifica plano de câmeras
      const hasCameraPlan = userProfile?.camera_expiration && new Date(userProfile.camera_expiration) > new Date();
      const cameraLimit = hasCameraPlan ? 4 : 1;
      
      if (cameras.length >= cameraLimit && userProfile?.role !== 'master') {
        alert(`Você atingiu o limite de ${cameraLimit} câmera(s)! Adquira o Módulo Extra ou renove sua assinatura para expandir o monitoramento.`);
        window.open('https://pay.cakto.com.br/njaxxuy_861537', '_blank');
        return;
      }
    }
    
    try {
      const url = editingCamera ? `${API_URL}/api/cameras` : `${API_URL}/api/cameras`;
      const method = editingCamera ? 'PUT' : 'POST';
      const bodyPayload = editingCamera ? { ...newCamera, id: editingCamera, store: userProfile.role === 'master' ? 'Produção' : userProfile.store } : { ...newCamera, store: userProfile.role === 'master' ? 'Produção' : userProfile.store };
      
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      if (res.ok) {
        setShowCameraModal(false);
        setEditingCamera(null);
        setNewCamera({ name: '', url: '', username: '', password: '', ai_commands: [] });
        fetchCameras();
      }
    } catch (err) { console.error('Erro:', err); }
  };


  const handleDeleteCamera = async (id) => {
    if (!confirm('Deseja remover esta câmera?')) return;
    try {
      await fetch(`${API_URL}/api/cameras/${id}`, { method: 'DELETE' });
      fetchCameras();
    } catch (e) { alert('Erro ao remover.'); }
  };

  const handleResolveSubmission = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/resolve-submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resolvedBy: userProfile?.name || 'Admin' })
      });
      if (res.ok) {
        setSubmissions(prev => prev.map(s => s.id === id ? { ...s, resolved: true, resolved_by: userProfile?.name || 'Admin' } : s));
        setShowSubmissionModal(false);
        fetchData(); // Atualiza os cards do topo
      }
    } catch (e) { console.error('Erro ao resolver submissão:', e); }
  };

  const handleReprocessAudit = async (e, submissionId) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`${API_URL}/api/process-audit-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) { console.error('Erro ao reprocessar:', e); }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(`⚠️ ${data.message || 'Erro ao adicionar usuário.'}`);
        return;
      }

      setShowUserModal(false);
      setNewUser({ name: '', email: '', password: '', store: isMaster ? '' : userProfile?.store || '' });
      fetchData();
    } catch (e) { alert('Erro de conexão com o servidor.'); }
  };

  const handleDeleteUser = async (id) => {
    if (!confirm('Tem certeza que deseja remover este colaborador?')) return;
    try {
      await fetch(`${API_URL}/api/users/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) { alert('Erro ao remover.'); }
  };

  const isMaster = userProfile?.role === 'master' || 
                   userProfile?.email?.toLowerCase() === 'douglas@firecheck.com' || 
                   userProfile?.email?.toLowerCase() === 'contatohakim@gmail.com';
  const isAdmin = userProfile?.role === 'admin' && !isMaster; // Dono da Loja

  const isFuncionario = userProfile?.role === 'funcionario';
  
  // Para compatibilidade com a UI antiga onde se usava isGestor para o Master
  const isGestor = isMaster; 


  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Abas iniciais agora são geridas pelo estado com localStorage no topo do arquivo.

  const isTrialExpired = () => {
    if (!userProfile) return false;
    if (userProfile.status === 'blocked') return true;
    if (userProfile.status === 'trial') {
      const createdDate = new Date(userProfile.created_at || Date.now());
      const now = new Date();
      const diffTime = Math.abs(now - createdDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      return diffDays > 7;
    }
    return false;
  };

  const showPaywall = !isMaster && isTrialExpired();

  if (showPaywall) {
    return (
      <div className="page-container animate-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', textAlign: 'center', padding: '20px' }}>
        <div style={{ backgroundColor: 'rgba(255, 23, 68, 0.1)', padding: '20px', borderRadius: '50%', marginBottom: '24px' }}>
          <Lock size={48} color="var(--error)" />
        </div>
        <h1 style={{ fontSize: '2rem', marginBottom: '16px' }}>Sua conta está sem plano</h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: '500px', marginBottom: '40px', fontSize: '1.1rem', lineHeight: '1.6' }}>
          Seu período de teste expirou ou não identificamos o seu pagamento. Escolha um plano abaixo para continuar usando o FireCheck na sua operação.
        </p>

        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div className="card" style={{ width: '300px', padding: '32px' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Start Mensal</h3>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '24px' }}>R$197<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/mês</span></div>
            <button className="btn-secondary" style={{ width: '100%', padding: '12px' }} onClick={() => window.open(`https://pay.cakto.com.br/3eph5ko_856837?email=${encodeURIComponent(userProfile?.email || '')}&name=${encodeURIComponent(userProfile?.name || '')}`, '_blank')}>
              Assinar Mensal
            </button>
          </div>

          <div className="card" style={{ width: '300px', padding: '32px', border: '2px solid var(--primary)', transform: 'scale(1.05)' }}>
            <div style={{ backgroundColor: 'var(--primary)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', width: 'fit-content', margin: '0 auto 12px auto' }}>2 MESES GRÁTIS</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '8px', color: 'var(--primary)' }}>Start Anual</h3>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '8px' }}>R$147<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/mês</span></div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: 'var(--success)', fontSize: '0.9rem', fontWeight: 'bold' }}>Faturado R$1.764 anualmente</div>
              <div style={{ color: 'rgba(0, 200, 83, 0.6)', fontSize: '0.8rem' }}>Economia de R$600/ano</div>
            </div>
            <button className="btn" style={{ width: '100%', padding: '12px' }} onClick={() => window.open(`https://pay.cakto.com.br/e7c88df?email=${encodeURIComponent(userProfile?.email || '')}&name=${encodeURIComponent(userProfile?.name || '')}`, '_blank')}>
              Assinar Anual
            </button>
          </div>
        </div>

        <button onClick={handleLogout} style={{ marginTop: '40px', background: 'transparent', border: 'none', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer' }}>
          Sair do Sistema
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)', width: '100vw', overflowX: 'hidden' }}>
      
      {/* Overlay Mobile */}
      <div className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>

      {/* SIDEBAR LATERAL */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`} style={{ 
        width: '260px', 
        backgroundColor: '#1E1B4B', 
        borderRight: '1px solid rgba(255,255,255,0.1)', 
        display: 'flex', 
        flexDirection: 'column', 
        position: 'sticky', 
        top: 0, 
        height: '100vh', 
        overflowY: 'auto',
        color: 'white',
        zIndex: 50
      }}>
        {/* LOGO */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ backgroundColor: 'white', padding: '6px', borderRadius: '6px' }}>
            <Flame size={20} color="#1E1B4B" />
          </div>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold', letterSpacing: '-0.5px' }}>FireCheck</span>
        </div>

        {/* MENU ITENS */}
        <div style={{ padding: '16px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {(isMaster ? [
            { key: 'financeiro',  label: 'Financeiro', icon: <TrendingUp size={18}/> },
            { key: 'equipe',      label: 'Gestão de Clientes', icon: <Users size={18}/> },
          ] : [
            { key: 'auditoria',   label: 'Dashboard', icon: <Activity size={18}/> },
            { key: 'ranking',     label: 'Ranking', icon: <Trophy size={18}/> },
            (userProfile?.email?.toLowerCase() === 'dugaburguer@gmail.com' ? { key: 'cameras', label: 'Câmeras IA', icon: <Video size={18}/> } : null),
            { key: 'alertas',     label: 'Alertas IA', icon: <ShieldAlert size={18}/> },
            { key: 'checklists',  label: 'Checklists', icon: <ClipboardList size={18}/> },
            { key: 'equipe',      label: 'Equipe', icon: <Users size={18}/> },
          ].filter(Boolean)).map(t => {
            if (isFuncionario && (t.key === 'equipe' || t.key === 'checklists')) return null;
            const isActive = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', 
                  borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '500', fontSize: '0.95rem', 
                  transition: 'all 0.2s', textAlign: 'left',
                  backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                  color: isActive ? 'white' : 'rgba(255,255,255,0.7)',
                  borderLeft: isActive ? '4px solid white' : '4px solid transparent'
                }}>
                <span style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.7)' }}>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* FOOTER DA SIDEBAR */}
        <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
           <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginBottom: '12px' }}>
              👤 {userProfile?.name}<br/>
              🏬 {userProfile?.store || 'Sistema Central'}
           </p>
           <button onClick={handleLogout} style={{ 
               background: 'transparent', 
               border: 'none', 
               color: '#ef4444', 
               cursor: 'pointer', 
               fontSize: '0.9rem', 
               fontWeight: '600',
               display: 'flex', 
               alignItems: 'center', 
               gap: '8px', 
               padding: '8px 0', 
               transition: 'opacity 0.2s'
             }}
             onMouseOver={(e) => e.currentTarget.style.opacity = 0.8}
             onMouseOut={(e) => e.currentTarget.style.opacity = 1}
             >
                <LogOut size={16} /> Sair do Sistema
           </button>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }} className="animate-fade">
        
        {/* HEADER SUPERIOR */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '20px', backgroundColor: 'var(--bg-card)', padding: '20px 24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="mobile-menu-btn" style={{ display: 'none', background: 'transparent', border: 'none', padding: '0', cursor: 'pointer' }} onClick={() => setIsSidebarOpen(true)}>
              <Menu size={24} color="var(--text-main)" />
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>
                {isMaster ? 'Painel de Gestão Master' : isAdmin ? 'Painel do Dono' : 'Painel do Funcionário'}
              </h1>
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Seja bem-vindo(a), {userProfile?.name}</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {isMaster && (
               <div style={{ display: 'flex', gap: '8px' }}>
                 <div style={{ padding: '6px 12px', backgroundColor: 'rgba(0, 200, 83, 0.1)', color: 'var(--success)', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                   <div style={{ width: '8px', height: '8px', backgroundColor: 'var(--success)', borderRadius: '50%', boxShadow: '0 0 8px var(--success)', animation: 'pulse 2s infinite' }}></div>
                   {liveVisitors} pessoas online
                 </div>
                 <div style={{ padding: '6px 12px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                   <Users size={12} /> {todayVisitors} acessos
                 </div>
                 <div style={{ padding: '6px 12px', backgroundColor: 'rgba(255, 77, 0, 0.1)', color: 'var(--primary)', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                   <Video size={12} /> {videoPlays} plays no vídeo
                 </div>
               </div>
            )}
            
            {/* Filtro de Data */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#121318', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <CalendarClock size={18} color="var(--primary)" />
              <input type="date" value={dateFilter.start} onChange={(e) => setDateFilter({...dateFilter, start: e.target.value})} style={{ background: 'none', border: 'none', color: 'white', fontSize: '0.85rem', outline: 'none' }} />
              <span style={{ color: 'var(--text-muted)' }}>até</span>
              <input type="date" value={dateFilter.end} onChange={(e) => setDateFilter({...dateFilter, end: e.target.value})} style={{ background: 'none', border: 'none', color: 'white', fontSize: '0.85rem', outline: 'none' }} />
            </div>

            {isMaster ? (
              <button className="btn" style={{ backgroundColor: '#10b981' }} onClick={() => { setNewUser({ name: '', email: '', password: '', store: '', role: 'admin', plan: 'mensal' }); setShowUserModal(true); }}>
                <UserPlus size={18} /> Nova Conta
              </button>
            ) : isAdmin ? (
              <button className="btn" onClick={() => navigate('/admin/creator')}>
                <Plus size={18} /> Criar Checklist
              </button>
            ) : null}
          </div>
        </header>

      {/* Cards de KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        
        {isMaster ? (
          <>
            <div className="card" style={{ borderTop: '3px solid #10b981', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Vendas do Mês</p>
                  <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: '8px 0', lineHeight: 1 }}>
                    {(financialStats?.vendasMes || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>📈 +12% vs mês anterior</span>
                </div>
                <TrendingUp color="#10b981" size={36} />
              </div>
            </div>

            <div className="card" style={{ borderTop: '3px solid #3b82f6', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Receita Real (Cacto)</p>
                  <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: '8px 0', lineHeight: 1 }}>
                    {(financialStats?.receitaReal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>💰 Líquido após taxas</span>
                </div>
                <Activity color="#3b82f6" size={36} />
              </div>
            </div>

            <div className="card" style={{ borderTop: '3px solid #f59e0b', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Arrecadado</p>
                  <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: '8px 0', lineHeight: 1 }}>
                    {(financialStats?.totalArrecadado || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>📅 Período selecionado</span>
                </div>
                <Flame color="#f59e0b" size={36} />
              </div>
            </div>

            <div className="card" style={{ borderTop: '3px solid var(--primary)', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Clientes Ativos</p>
                  <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: '8px 0', lineHeight: 1 }}>{financialStats?.clientesAtivos || 0}</h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>🏬 Assinaturas vigentes</span>
                </div>
                <Users color="var(--primary)" size={36} />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="card" style={{ borderTop: '3px solid var(--primary)', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Checklists Hoje</p>
                  <h2 style={{ fontSize: '2.5rem', fontWeight: '800', margin: '8px 0', lineHeight: 1 }}>{stats.checklistsHoje}</h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>✅ {stats.concluidos} concluídos</span>
                </div>
                <ClipboardList color="var(--primary)" size={36} />
              </div>
            </div>

            <div className="card" style={{ borderTop: '3px solid #3b82f6', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Conformidade Geral</p>
                  <h2 style={{ fontSize: '2.5rem', fontWeight: '800', margin: '8px 0', lineHeight: 1 }}>{stats.conformidade}%</h2>
                  <BarPct pct={stats.conformidade} color="#3b82f6" />
                </div>
                <TrendingUp color="#3b82f6" size={36} />
              </div>
            </div>

            <div className="card" style={{ borderTop: '3px solid var(--error)', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Alertas IA (Falhas)</p>
                  <h2 style={{ fontSize: '2.5rem', fontWeight: '800', margin: '8px 0', lineHeight: 1 }}>{stats.alertasIA}</h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--error)' }}>⚠️ {stats.alertasIA > 0 ? 'Ação necessária' : 'Nenhum alerta'}</span>
                </div>
                <ShieldAlert color="var(--error)" size={36} />
              </div>
            </div>

            <div className="card" style={{ borderTop: '3px solid var(--success)', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: '2.5rem', fontWeight: '800', margin: '8px 0', lineHeight: 1 }}>{stats.colaboradores}</h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>🏬 {userProfile?.store || 'Filial Centro'}</span>
                </div>
                <Users color="var(--success)" size={36} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Instalação do App */}
      <PWAInstall />

      {/* ── Tab: Financeiro (Master Only) ─────────────────────────────────── */}
      {isMaster && tab === 'financeiro' && (
        <div className="card" style={{ padding: '0' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={20} color="var(--success)" /> Detalhamento de Vendas — Cacto
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dados atualizados em tempo real</span>
          </div>
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
               <div style={{ backgroundColor: '#121318', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '8px' }}>Vendas Brutas</p>
                  <h4 style={{ fontSize: '1.5rem', margin: 0 }}>{(financialStats?.vendasMes || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h4>
               </div>
               <div style={{ backgroundColor: '#121318', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '8px' }}>Taxas de Transação</p>
                  <h4 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--error)' }}>- {((financialStats?.vendasMes || 0) - (financialStats?.receitaReal || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h4>
               </div>
            </div>
            
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Gráfico de evolução financeira em desenvolvimento...
            </p>
          </div>
        </div>
      )}

      {/* ── Tabs Em Construção (Novas Funcionalidades) ──────────────────── */}
      {['agendamentos', 'planos_acao', 'exportacoes', 'suporte'].includes(tab) && (
        <div className="card animate-fade" style={{ padding: '80px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'rgba(255, 77, 0, 0.1)', padding: '24px', borderRadius: '50%', marginBottom: '24px' }}>
            <Activity size={48} color="var(--primary)" />
          </div>
          <h2 style={{ fontSize: '2rem', marginBottom: '16px' }}>Em Construção</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: '500px', fontSize: '1.1rem', lineHeight: '1.6' }}>
            Esta funcionalidade avançada está sendo lapidada por nossos engenheiros e será liberada automaticamente na sua conta em breve.
          </p>
        </div>
      )}

      {/* ── Tab: Auditoria em Tempo Real ─────────────────────────────────── */}
      {tab === 'auditoria' && (
        <div className="card" style={{ padding: '0' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} color="var(--primary)" /> Auditoria em Tempo Real
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Últimas 24h</span>
          </div>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {submissions.length > 0 ? submissions.map(s => {
              const completedTasks = s.tasks?.filter(t => t.done)?.length || 0;
              const totalTasks = s.tasks?.length || 1;
              const pct = Math.round((completedTasks / totalTasks) * 100);
              
              const feedbacks = Object.values(s.feedback_info || {});
              const hasWarnings = feedbacks.some(f => f.status === 'warning' || f.status === 'error');
              const hasPhotos = (s.tasks || []).some(t => t.photo);
              const globalError = s.feedback_info?.global_error;
              
              let status = 'pendente';
              if (globalError) status = 'falha';
              else if (hasPhotos) {
                if (feedbacks.length === 0) status = 'pendente';
                else if (hasWarnings) status = 'reprovado';
                else status = 'aprovado';
              } else {
                status = 'ignorado';
              }

              return (
                <div key={s.id} 
                  onClick={() => { setSelectedSubmission(s); setShowSubmissionModal(true); }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#121318', borderRadius: '10px', gap: '12px', flexWrap: 'wrap', cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = 'transparent'}
                >
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1, minWidth: '250px' }}>
                    {s.selfie && <img src={s.selfie} alt="Selfie" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }} />}
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '1rem', marginBottom: '2px' }}>
                        {checklists?.find(c => c.id === s.checklist_id)?.title || 'Checklist Concluído'}
                      </h4>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>👤 {s.employee_name} · 🏬 {s.store}</p>
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BarPct pct={pct} color={pct === 100 ? 'var(--success)' : pct > 60 ? '#FFA000' : 'var(--error)'} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{pct}%</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <StatusBadge status={status} />
                      {(status === 'pendente' || status === 'falha') && (
                        <button 
                          onClick={(e) => handleReprocessAudit(e, s.id)}
                          style={{ fontSize: '0.7rem', padding: '4px 8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid #3b82f6', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Tentar Novamente
                        </button>
                      )}
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '6px' }}>
                      <Clock size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                      {new Date(s.created_at).toLocaleDateString('pt-BR')} {new Date(s.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            }) : (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <p>Nenhuma auditoria realizada no período.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Ranking de Funcionários ─────────────────────────────────── */}
      {tab === 'ranking' && (
        <div className="card" style={{ padding: '0' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trophy size={20} color="#FFA000" /> Ranking de Funcionários — Hoje
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>Ordenado por % de tarefas concluídas</p>
          </div>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(() => {
              const rankingData = submissions.reduce((acc, sub) => {
                const name = sub.employee_name;
                const completed = sub.tasks?.filter(t => t.done)?.length || 0;
                const total = sub.tasks?.length || 1;
                if (!acc[name]) acc[name] = { name, totalCompleted: 0, totalPossible: 0 };
                acc[name].totalCompleted += completed;
                acc[name].totalPossible += total;
                return acc;
              }, {});

              const sortedRanking = Object.values(rankingData)
                .map(r => ({
                  nome: r.name,
                  pct: Math.round((r.totalCompleted / r.totalPossible) * 100),
                  concluidos: r.totalCompleted,
                  total: r.totalPossible
                }))
                .sort((a, b) => b.pct - a.pct)
                .map((r, idx) => ({ ...r, pos: idx + 1, medalha: idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null }));

              return sortedRanking.length > 0 ? sortedRanking.map(r => (
                <div key={r.pos} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', backgroundColor: '#121318', borderRadius: '10px',
                  border: r.pos === 1 ? '1px solid rgba(255,160,0,0.3)' : '1px solid transparent' }}>
                  <div style={{ fontSize: '1.5rem', minWidth: '36px', textAlign: 'center' }}>
                    {r.medalha || <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>#{r.pos}</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 'bold' }}>{r.nome}</span>
                      <span style={{ fontWeight: 'bold', color: r.pct === 100 ? 'var(--success)' : r.pct > 60 ? '#FFA000' : 'var(--error)' }}>{r.pct}%</span>
                    </div>
                    <BarPct pct={r.pct} color={r.pct === 100 ? 'var(--success)' : r.pct > 60 ? '#FFA000' : 'var(--error)'} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>{r.concluidos}/{r.total} tarefas acumuladas</p>
                  </div>
                </div>
              )) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <p>Ainda não há dados para gerar o ranking.</p>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Tab: Alertas da IA ────────────────────────────────────────────── */}
      {tab === 'alertas' && (
        <div className="card" style={{ padding: '0' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={20} color="var(--error)" /> Alertas da Inteligência Artificial
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>Tarefas reprovadas ou ignoradas pelos funcionários</p>
          </div>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {submissions.some(s => Object.values(s.feedback_info || {}).some(f => f.status === 'warning' || f.status === 'error')) ? (
              submissions.map(s => {
                const alerts = Object.entries(s.feedback_info || {}).filter(([id, f]) => f.status === 'warning' || f.status === 'error');
                if (alerts.length === 0) return null;
                
                return alerts.map(([taskId, feedback]) => {
                  const task = s.tasks.find(t => t.id === taskId);
                  return (
                    <div key={`${s.id}-${taskId}`} style={{ 
                      padding: '16px', 
                      backgroundColor: s.resolved ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255,23,68,0.05)', 
                      borderRadius: '10px', 
                      border: s.resolved ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(255,23,68,0.2)',
                      opacity: s.resolved ? 0.8 : 1
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {s.resolved ? <CheckCircle size={18} color="var(--success)" /> : <AlertCircle size={18} color="var(--error)" />}
                          <span style={{ fontWeight: 'bold', fontSize: '0.95rem', color: s.resolved ? 'var(--success)' : 'white' }}>
                            {task?.text || 'Tarefa Desconhecida'} {s.resolved && '(Concluída)'}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{new Date(s.created_at).toLocaleTimeString('pt-BR')}</span>
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '8px' }}>
                        👤 Funcionário: <strong style={{ color: 'white' }}>{s.employee_name}</strong> · Loja: {s.store}
                      </p>
                      <p style={{ color: s.resolved ? 'var(--text-muted)' : '#FFA000', fontSize: '0.85rem', backgroundColor: 'rgba(255,160,0,0.08)', padding: '8px 12px', borderRadius: '6px' }}>
                        🤖 IA: "{feedback.message}"
                      </p>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button className="btn-secondary" style={{ flex: 1, padding: '12px', fontSize: '0.85rem' }} onClick={() => { setSelectedSubmission(s); setShowSubmissionModal(true); }}>
                          {s.resolved ? 'Ver Evidência Salva' : 'Analisar Evidência e Resolver'}
                        </button>
                      </div>
                    </div>
                  );
                });
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <Activity size={48} style={{ marginBottom: '16px', opacity: 0.2 }} />
                <p>Nenhum alerta crítico da IA no momento.</p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── Tab: Gerenciar Checklists ──────────────────────────────────── */}
      {tab === 'checklists' && (
        <div className="card" style={{ padding: '0' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClipboardList size={20} color="var(--primary)" /> Status dos Checklists (Hoje)
            </h3>
            <button className="btn" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => navigate('/admin/creator')}>
              <Plus size={16} /> Novo Checklist
            </button>
          </div>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {(checklists || []).length > 0 ? (
              <>
                <div>
                  <h4 style={{ color: 'var(--text-muted)', marginBottom: '12px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={16} /> ⏳ Pendentes de Execução
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {checklists.filter(cl => !cl.completedToday).map(cl => (
                      <div key={cl.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#121318', borderRadius: '10px', gap: '12px', flexWrap: 'wrap', borderLeft: '4px solid var(--error)' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                            <h4 style={{ fontSize: '1rem', margin: 0 }}>{cl.title}</h4>
                            <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold', backgroundColor: 'rgba(255,23,68,0.1)', color: 'var(--error)' }}>
                              Pendente
                            </span>
                          </div>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '4px' }}>
                            📋 {cl.tasks?.length || 0} tarefas &nbsp;·&nbsp; <CalendarClock size={12} style={{ verticalAlign: 'middle' }} /> {RECURRENCE_LABEL[cl.recurrence] || 'Único'}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => navigate(`/admin/creator/${cl.id}`)}>
                            <Edit2 size={15} /> Editar
                          </button>
                        </div>
                      </div>
                    ))}
                    {checklists.filter(cl => !cl.completedToday).length === 0 && (
                      <p style={{ color: 'var(--success)', fontSize: '0.85rem', padding: '12px', backgroundColor: 'rgba(0,200,83,0.1)', borderRadius: '8px' }}>🎉 Todos os checklists pendentes já foram executados hoje!</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 style={{ color: 'var(--success)', marginBottom: '12px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={16} /> ✅ Concluídos
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {checklists.filter(cl => cl.completedToday).map(cl => (
                      <div key={cl.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#121318', borderRadius: '10px', gap: '12px', flexWrap: 'wrap', borderLeft: '4px solid var(--success)', opacity: 0.8 }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                            <h4 style={{ fontSize: '1rem', margin: 0, textDecoration: 'line-through' }}>{cl.title}</h4>
                            <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold', backgroundColor: 'rgba(0,200,83,0.1)', color: 'var(--success)' }}>
                              Concluído por {cl.completedBy || 'Sistema'}
                            </span>
                          </div>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '4px' }}>
                            📋 {cl.tasks?.length || 0} tarefas &nbsp;·&nbsp; <CalendarClock size={12} style={{ verticalAlign: 'middle' }} /> {RECURRENCE_LABEL[cl.recurrence] || 'Único'}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => navigate(`/admin/creator/${cl.id}`)}>
                            <Edit2 size={15} /> Editar
                          </button>
                        </div>
                      </div>
                    ))}
                    {checklists.filter(cl => cl.completedToday).length === 0 && (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '12px' }}>Nenhum checklist foi concluído hoje ainda.</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <ClipboardList size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                <p>Nenhum checklist encontrado para esta loja.</p>
                <button className="btn-secondary" style={{ marginTop: '16px' }} onClick={() => navigate('/admin/creator')}>Criar meu primeiro checklist</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Gestão de Equipe / Clientes ───────────────────────────── */}
      {tab === 'equipe' && (
        <div className="card" style={{ padding: '0' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={20} color="var(--primary)" /> {isMaster ? 'Contas de Clientes (Donos de Loja)' : 'Equipe da Loja'}
              </h3>
              {!isFuncionario && (
                <button className="btn" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => {
                  setNewUser({ name: '', email: '', password: '', role: isMaster ? 'admin' : 'funcionario', store: isMaster ? '' : userProfile?.store, plan: 'mensal' });
                  setShowUserModal(true);
                }}>
                  <UserPlus size={16} /> {isMaster ? 'Adicionar Novo Cliente' : 'Adicionar Colaborador'}
                </button>
              )}
            </div>

            {isMaster && (
              <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
                <div style={{ backgroundColor: 'rgba(255,160,0,0.1)', padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(255,160,0,0.3)' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#FFA000' }}>
                    {team.filter(m => m.role === 'admin' && m.status === 'trial' && !isBlocked(m)).length}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '8px' }}>Testes Ativos (7 Dias)</span>
                </div>
                <div style={{ backgroundColor: 'rgba(255,23,68,0.1)', padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(255,23,68,0.3)' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--error)' }}>
                    {team.filter(m => m.role === 'admin' && isBlocked(m)).length}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '8px' }}>Contas Bloqueadas</span>
                </div>
                <div style={{ backgroundColor: 'rgba(0,200,83,0.1)', padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(0,200,83,0.3)' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--success)' }}>
                    {team.filter(m => m.role === 'admin' && m.status === 'active').length}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '8px' }}>Clientes Pagantes</span>
                </div>
              </div>
            )}
          </div>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(team || []).map(member => {
              const statusInfo = isMaster && member.role === 'admin' ? getUserStatus(member) : null;
              
              return (
              <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#121318', borderRadius: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h4 style={{ fontSize: '1rem', margin: 0 }}>{member.name}</h4>
                    {statusInfo && (
                      <span style={{ backgroundColor: `${statusInfo.color}15`, border: `1px solid ${statusInfo.color}40`, color: statusInfo.color, padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                        {statusInfo.text}
                      </span>
                    )}
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px' }}>
                    {member.email} · {member.phone ? `📱 ${member.phone}` : 'Sem telefone cadastrado'} · {member.store}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {isMaster && member.role === 'admin' && (
                    <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => {
                       setEditingPlan({ ...member });
                    }}>
                      Alterar Plano
                    </button>
                  )}
                  <button className="btn-secondary" style={{ color: 'var(--error)', borderColor: 'rgba(255,23,68,0.2)' }} onClick={() => handleDeleteUser(member.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )})}
          </div>
        </div>
      )}

      {/* ── Tab: Monitoramento de Câmeras IA ───────────────────────────── */}
      {tab === 'cameras' && (
        <div className="card" style={{ padding: '0' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Video size={20} color="var(--primary)" /> Monitoramento de Câmeras IP
            </h3>
            <button className="btn" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => setShowCameraModal(true)}>
              <Plus size={16} /> Adicionar Câmera
            </button>
          </div>
          <div style={{ padding: '24px' }}>
            {/* Aviso de Gratuidade e Venda de Módulo */}
            <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
               <Info size={32} color="#3b82f6" />
               <div style={{ flex: 1 }}>
                 <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
                   <strong style={{ color: 'white' }}>Plano Flex Padrão:</strong> Você tem direito a 1 câmera inclusa para degustação.
                 </p>
                 <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                   Expanda seu monitoramento conectando até 4 Câmeras com IA em sua loja.
                 </p>
               </div>
               <button 
                 onClick={() => window.open('https://pay.cakto.com.br/njaxxuy_861537', '_blank')}
                 style={{ padding: '8px 16px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)' }}
               >
                 Liberar 4 Câmeras (R$ 49,90)
               </button>
            </div>

            {cameras.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {cameras.map(cam => (
                  <div key={cam.id} className="card" style={{ padding: '20px', backgroundColor: '#121318', border: '1px solid rgba(255,255,255,0.05)' }}>
                    
                    {/* Cabeçalho da Câmera */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <Camera color="var(--primary)" size={20} />
                          <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'white' }}>{cam.name}</h4>
                        </div>
                        {(() => {
                          const status = (cam.url && cam.url.length > 5) 
                            ? (cam.ai_commands && cam.ai_commands.length > 0 ? 'monitoring' : 'connected') 
                            : 'error';
                            
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', 
                              color: status === 'monitoring' ? 'var(--success)' : 
                                     status === 'connected' ? '#3b82f6' : 'var(--error)' 
                            }}>
                              <span style={{ 
                                width: '8px', height: '8px', borderRadius: '50%', 
                                backgroundColor: status === 'monitoring' ? 'var(--success)' : 
                                                 status === 'connected' ? '#3b82f6' : 'var(--error)', 
                                animation: status === 'monitoring' ? 'pulse 2s infinite' : 'none' 
                              }}></span>
                              {status === 'monitoring' ? 'Conectada e Monitorando (IA)' : 
                               status === 'connected' ? 'Apenas Conectada (Sem Regras IA)' : 'Erro de Conexão'}
                            </div>
                          );
                        })()}
                      </div>
                      <button className="btn-secondary" style={{ padding: '6px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none' }} onClick={() => handleDeleteCamera(cam.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Regras de IA */}
                    <div style={{ marginBottom: '20px' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                         <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>O que a IA está vigiando:</p>
                         <button style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', cursor: 'pointer', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }} onClick={() => {
                            setEditingCamera(cam.id);
                            setNewCamera({ name: cam.name, url: cam.url, username: cam.username, password: cam.password, ai_commands: cam.ai_commands || [] });
                            setShowCameraModal(true);
                         }}>
                           <Edit2 size={12} /> Editar Funções
                         </button>
                       </div>
                       <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {(cam.ai_commands || []).map((cmd, idx) => (
                            <span key={idx} style={{ padding: '6px 12px', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', color: '#60a5fa', borderRadius: '6px', fontSize: '0.75rem' }}>
                              👁️ {cmd}
                            </span>
                          ))}
                       </div>
                    </div>

                    {/* Galeria de Incidentes */}
                    <div style={{ padding: '16px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                         <p style={{ fontSize: '0.85rem', color: 'white', margin: 0, fontWeight: 'bold' }}>Últimos Incidentes</p>
                         <button style={{ backgroundColor: 'transparent', color: 'var(--text-muted)', border: 'none', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', transition: 'all 0.2s' }} 
                            onMouseOver={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'white'; }}
                            onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                            onClick={() => setShowHistoryModal(cam.id)}>
                           Ver histórico completo <ArrowRight size={14} />
                         </button>
                       </div>
                       
                       {/* Empty State de Incidentes */}
                       <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
                         <ShieldCheck size={32} style={{ marginBottom: '10px', color: 'var(--success)', opacity: 0.8 }} />
                         <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--success)' }}>Operação limpa!</p>
                         <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem' }}>Nenhuma quebra de regra detectada nas últimas 24h.</p>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                <Monitor size={64} style={{ marginBottom: '20px', opacity: 0.1 }} />
                <h4>Nenhuma câmera conectada</h4>
                <p style={{ maxWidth: '400px', margin: '8px auto 24px' }}>Monitore sua operação em tempo real com alertas automáticos da nossa IA.</p>
                <button className="btn" onClick={() => { setEditingCamera(null); setNewCamera({ name: '', url: '', username: '', password: '', ai_commands: [] }); setShowCameraModal(true); }}>Conectar minha primeira câmera</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Histórico de Incidentes */}
      {showHistoryModal !== null && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '20px' }}>
          <div className="card animate-scale" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                <Clock color="var(--primary)" /> Histórico de Eventos IA
              </h3>
              <button style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }} onClick={() => setShowHistoryModal(null)}>
                <X size={24} />
              </button>
            </div>
            
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
              <ShieldCheck size={48} style={{ marginBottom: '16px', color: 'var(--success)', opacity: 0.8 }} />
              <h4 style={{ color: 'white', marginBottom: '8px' }}>Nenhum incidente registrado</h4>
              <p style={{ fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>
                O histórico completo ficará disponível assim que a Inteligência Artificial detectar e salvar a primeira quebra de regra na sua operação.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nova Câmera / Editar Câmera */}
      {showCameraModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div className="card animate-scale" style={{ maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--primary)' }}>
            <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Camera color="var(--primary)" /> {editingCamera ? 'Editar Configuração da IA' : 'Configurar Nova Câmera IP'}
            </h3>
            
            <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
               <h4 style={{ fontSize: '0.85rem', marginBottom: '8px', color: '#3b82f6' }}>Como conectar (Atenção):</h4>
               <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                 Para que a nossa Inteligência Artificial consiga ler a imagem da sua câmera, cole o <strong>Link de Compartilhamento Público</strong> dela abaixo.
               </p>
               <ol style={{ fontSize: '0.78rem', color: 'var(--text-muted)', paddingLeft: '16px', margin: 0 }}>
                 <li>Gere o link de compartilhamento no app da sua câmera (Intelbras, Hikvision, etc).</li>
                 <li>Certifique-se de que o link não exige senha na hora de abrir.</li>
               </ol>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
               <div>
                 <label className="input-label">Nome da Câmera (ex: Cozinha, Balcão)</label>
                 <input className="input-field" placeholder="Ex: Câmera Balcão 01" value={newCamera.name} onChange={e => setNewCamera({...newCamera, name: e.target.value})} />
               </div>
               <div>
                 <label className="input-label">Link de Compartilhamento da Câmera IP</label>
                 <input className="input-field" placeholder="Cole aqui o link fornecido pelo seu aplicativo de câmeras..." value={newCamera.url} onChange={e => setNewCamera({...newCamera, url: e.target.value})} />
               </div>
               <div>
                 <label className="input-label">O que a IA deve vigiar? (Adicione um por vez)</label>
                 <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                   <input className="input-field" placeholder="Ex: Me avise se a fila passar de 4 pessoas" 
                     value={newCommand} 
                     onChange={e => setNewCommand(e.target.value)} 
                     onKeyDown={(e) => { 
                       if(e.key === 'Enter') { 
                         e.preventDefault(); 
                         if (newCommand.trim()) { 
                           setNewCamera({...newCamera, ai_commands: [...(newCamera.ai_commands||[]), newCommand.trim()]}); 
                           setNewCommand(''); 
                         }
                       }
                     }} 
                   />
                   <button type="button" className="btn-secondary" style={{ whiteSpace: 'nowrap' }} onClick={() => { 
                     if (newCommand.trim()) { 
                       setNewCamera({...newCamera, ai_commands: [...(newCamera.ai_commands||[]), newCommand.trim()]}); 
                       setNewCommand(''); 
                     }
                   }}>
                     <Plus size={16} /> Adicionar
                   </button>
                 </div>
                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: '40px', padding: '12px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                   {(newCamera.ai_commands || []).length === 0 && (
                     <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>Nenhuma regra adicionada ainda.</span>
                   )}
                   {(newCamera.ai_commands || []).map((cmd, idx) => (
                     <span key={idx} style={{ padding: '6px 12px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                       👁️ {cmd}
                       <button type="button" style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)' }} 
                         onClick={() => setNewCamera({...newCamera, ai_commands: newCamera.ai_commands.filter((_, i) => i !== idx)})}>
                         <X size={12} />
                       </button>
                     </span>
                   ))}
                 </div>
               </div>
               
               <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                 <button className="btn" style={{ flex: 1 }} onClick={handleAddCamera}>
                   {editingCamera ? 'Salvar Alterações' : 'Salvar e Iniciar Monitoramento'}
                 </button>
                 <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowCameraModal(false); setEditingCamera(null); }}>Cancelar</button>
               </div>
            </div>
          </div>
        </div>
      )}
      {showUserModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.85)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 9999, // Garantir que fique acima de tudo
          padding: '20px', 
          backdropFilter: 'blur(5px)' 
        }}>
          <div className="card animate-scale" style={{ maxWidth: '450px', width: '100%', position: 'relative', border: '1px solid var(--primary)' }}>
            <button onClick={() => setShowUserModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Fechar</button>
            <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserPlus color="var(--primary)" /> {isMaster ? 'Cadastrar Novo Cliente' : 'Cadastrar Colaborador'}
            </h3>
            <form onSubmit={handleAddUser}>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Nome Completo</label>
                <input type="text" className="input-field" required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="Ex: Douglas Hakim" />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">E-mail de Acesso</label>
                <input type="email" className="input-field" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="email@exemplo.com" />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Senha Inicial</label>
                <input type="text" className="input-field" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="Defina a senha" />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                <div>
                  <label className="input-label">Papel / Nível</label>
                  <select className="input-field" style={{ padding: '10px' }} value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                    {isMaster && <option value="admin">Dono (Cliente)</option>}
                    {isAdmin && <option value="funcionario">Funcionário</option>}
                    {isMaster && <option value="master">Gestor Master</option>}
                  </select>
                </div>
                <div>
                  <label className="input-label">Empresa / Unidade</label>
                  {isMaster ? (
                    <select 
                      className="input-field" 
                      required 
                      value={newUser.store} 
                      onChange={e => setNewUser({...newUser, store: e.target.value})}
                    >
                      <option value="">Selecione uma Unidade</option>
                      {/* Extrai lojas únicas dos usuários já cadastrados */}
                      {[...new Set(team.map(u => u.store))].filter(Boolean).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      <option value="nova_unidade">+ Cadastrar Nova Unidade (Digite abaixo)</option>
                    </select>
                  ) : (
                    <select className="input-field" value={newUser.store} disabled style={{ backgroundColor: 'rgba(255,255,255,0.05)', cursor: 'not-allowed' }}>
                      <option value={userProfile?.store}>{userProfile?.store}</option>
                    </select>
                  )}
                  
                  {isMaster && newUser.store === 'nova_unidade' && (
                    <input 
                      type="text" 
                      className="input-field" 
                      style={{ marginTop: '8px' }}
                      placeholder="Digite o nome da nova unidade"
                      onChange={e => setNewUser({...newUser, store: e.target.value})}
                    />
                  )}
                </div>
              </div>

              {isMaster && newUser.role === 'admin' && (
                <div style={{ marginBottom: '24px' }}>
                  <label className="input-label">Plano Selecionado</label>
                  <select className="input-field" style={{ padding: '10px' }} value={newUser.plan} onChange={e => setNewUser({...newUser, plan: e.target.value})}>
                    <option value="start_mensal">Start Mensal</option>
                    <option value="start_anual">Start Anual</option>
                    <option value="pro_mensal">Pró Mensal</option>
                    <option value="pro_anual">Pró Anual</option>
                    <option value="vitalicio">Vitalício</option>
                  </select>
                </div>
              )}

              <button type="submit" className="btn" style={{ width: '100%', padding: '16px', fontWeight: 'bold' }}>
                {isMaster ? 'Confirmar Adesão 🚀' : 'Cadastrar Colaborador'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Detalhes da Submissão */}
      {showSubmissionModal && selectedSubmission && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px', backdropFilter: 'blur(10px)' }}>
          <div className="card animate-scale" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '0', position: 'relative' }}>
            <button onClick={() => setShowSubmissionModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', zIndex: 1 }}>
              <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
            </button>
            
            <div style={{ padding: '32px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '20px', alignItems: 'center', backgroundColor: '#121318' }}>
              {selectedSubmission.selfie && <img src={selectedSubmission.selfie} alt="Selfie" style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', border: '3px solid var(--primary)' }} />}
              <div>
                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>
                   {checklists?.find(c => c.id === selectedSubmission.checklist_id)?.title || 'Detalhes da Auditoria'}
                </h2>
                <p style={{ color: 'var(--text-muted)' }}>{selectedSubmission.employee_name} · {selectedSubmission.store}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <CalendarClock size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                  {new Date(selectedSubmission.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>

            <div style={{ padding: '32px' }}>
              <h3 style={{ marginBottom: '20px', fontSize: '1.1rem' }}>Respostas do Checklist</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {selectedSubmission.tasks.map((task, idx) => {
                  const feedback = selectedSubmission.feedback_info?.[task.id];
                  return (
                    <div key={task.id} style={{ padding: '20px', backgroundColor: '#121318', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <h4 style={{ fontSize: '1rem', margin: 0, flex: 1 }}>{idx + 1}. {task.text}</h4>
                        <span style={{ 
                          padding: '4px 12px', 
                          borderRadius: '20px', 
                          fontSize: '0.75rem', 
                          fontWeight: 'bold',
                          backgroundColor: task.done === true ? 'rgba(16, 185, 129, 0.1)' : task.done === false ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)',
                          color: task.done === true ? 'var(--success)' : task.done === false ? 'var(--error)' : 'var(--text-muted)'
                        }}>
                          {task.done === true ? 'Sim' : task.done === false ? 'Não' : (task.done || 'N/A')}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: task.photo ? '1fr 1fr' : '1fr', gap: '20px' }}>
                        {task.photo && (
                          <div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>📸 Evidência Fotográfica:</p>
                            <img src={task.photo} alt="Evidência" style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                          </div>
                        )}
                        
                        {feedback && (
                          <div style={{ 
                            padding: '16px', 
                            borderRadius: '8px', 
                            backgroundColor: feedback.status === 'success' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(245, 158, 11, 0.05)',
                            border: `1px solid ${feedback.status === 'success' ? 'var(--success)' : 'var(--warning)'}`,
                            alignSelf: 'start'
                          }}>
                            <p style={{ fontSize: '0.8rem', color: feedback.status === 'success' ? 'var(--success)' : 'var(--warning)', fontWeight: 'bold', marginBottom: '4px' }}>
                              {feedback.status === 'success' ? '✅ Aprovado pela IA' : '⚠️ Alerta da IA'}
                            </p>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{feedback.message}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ padding: '32px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
               {!selectedSubmission.resolved && (
                 <button className="btn" style={{ flex: 1, padding: '16px', fontSize: '1rem' }} onClick={() => handleResolveSubmission(selectedSubmission.id)}>
                    Finalizar Ocorrência (Ciente)
                 </button>
               )}
               {selectedSubmission.resolved && (
                 <div style={{ flex: 1, padding: '16px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', textAlign: 'center', color: 'var(--success)', fontWeight: 'bold' }}>
                    ✓ Ocorrência Finalizada e Resolvida por {selectedSubmission.resolved_by || userProfile?.name}
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

      {editingPlan && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '20px', pointerEvents: 'auto', backdropFilter: 'blur(5px)' }}>
          <div className="card animate-scale" style={{ width: '100%', maxWidth: '400px', position: 'relative', border: '1px solid var(--primary)', pointerEvents: 'auto' }}>
            <button style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }} onClick={() => setEditingPlan(null)}><X size={24} /></button>
            <h3 style={{ marginBottom: '24px' }}>Alterar Plano de {editingPlan.name}</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Status da Conta</label>
              <select className="input-field" value={editingPlan.status || 'trial'} onChange={e => setEditingPlan({...editingPlan, status: e.target.value})}>
                <option value="trial">Trial (7 Dias)</option>
                <option value="active">Ativo (Pago)</option>
                <option value="blocked">Bloqueado</option>
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label className="input-label">Plano</label>
              <select className="input-field" value={editingPlan.plan || 'mensal'} onChange={e => setEditingPlan({...editingPlan, plan: e.target.value})}>
                <option value="mensal">Mensal</option>
                <option value="anual">Anual</option>
              </select>
            </div>

            <button className="btn" style={{ width: '100%' }} onClick={async () => {
              try {
                await fetch(`${API_URL}/api/users/${editingPlan.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ plan: editingPlan.plan, status: editingPlan.status })
                });
                setEditingPlan(null);
                fetchData();
              } catch (e) { alert('Erro ao salvar plano.'); }
            }}>Salvar Alterações</button>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '0.85rem', opacity: 0.7 }}>
        Políticas FireCheck: Fotos e registros de checklists são armazenados por 90 dias para otimização de performance e segurança.
      </div>

      </main>

      {/* Container de Toasts */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 999999, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {toasts.map(toast => (
          <div key={toast.id} className="animate-scale" style={{ 
            backgroundColor: toast.type === 'success' ? '#10b981' : 'var(--primary)', 
            color: 'white', 
            padding: '16px 24px', 
            borderRadius: '12px', 
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontWeight: 'bold',
            minWidth: '300px'
          }}>
            <Bell size={20} />
            <span style={{ flex: 1, fontSize: '0.9rem' }}>{toast.message}</span>
            <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.8, padding: '4px' }}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

