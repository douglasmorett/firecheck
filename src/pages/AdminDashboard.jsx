import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ClipboardList, ShieldAlert, Users, Activity, Trophy, TrendingUp, Clock, CheckCircle, AlertCircle, Bell, Flame, Edit2, Trash2, CalendarClock, UserPlus, Mail, Lock, LogOut, Smartphone, X, Camera, Video, Monitor, Info, Save, ArrowRight, ShieldCheck, Calendar, Target, FileDown, LifeBuoy, Menu, UserCheck, Bot, Car, ShoppingCart, Package, Mic, Send, Sparkles, Settings, Eye } from 'lucide-react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import API_URL from '../api';
import PWAInstall from '../components/PWAInstall';

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '')
});

const handle401 = (res) => {
  if (res.status === 401) {
    localStorage.removeItem('user');
    localStorage.removeItem('firecheck_token');
    window.location.href = '/login';
  }
  return res;
};

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
  if (user.status === 'pending') return { text: '🟡 Pagamento Pendente', color: 'var(--warning)' };
  
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
  if (user.status === 'blocked' || user.status === 'pending') return true;
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
      return ['equipe'].includes(saved) ? saved : 'equipe';
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
  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [stats, setStats] = useState(STATS);
  const [submissions, setSubmissions] = useState([]);
  const submissionsRef = useRef(submissions);
  submissionsRef.current = submissions;
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
  const isFirstFetch = useRef(true);
  const [liveVisitors, setLiveVisitors] = useState(0);
  const [todayVisitors, setTodayVisitors] = useState(0);
  const [todayMobile, setTodayMobile] = useState(0);
  const [todayDesktop, setTodayDesktop] = useState(0);
  const [videoPlays, setVideoPlays] = useState(0);
  const [editingPlan, setEditingPlan] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [quizStats, setQuizStats] = useState([]);
  const [quizOnline, setQuizOnline] = useState(0);
  const [quizVideoPlays, setQuizVideoPlays] = useState(0);
  
  // -- Bill Integration --
  const [billLinked, setBillLinked] = useState(false);
  const [billUser, setBillUser] = useState(null);

  // -- Tutorial Interativo / Tour Guiado --
  const [showWelcomeTourModal, setShowWelcomeTourModal] = useState(false);
  const [showTutorialHub, setShowTutorialHub] = useState(false);
  const [selectedTutorialTopic, setSelectedTutorialTopic] = useState('checklists');
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  useEffect(() => {
    const tourDismissed = localStorage.getItem('firecheck_tour_dismissed');
    if (!tourDismissed) {
      // Marcar imediatamente no localStorage para nunca mais reaparecer sozinho
      localStorage.setItem('firecheck_tour_dismissed', 'true');
      const timer = setTimeout(() => {
        setShowWelcomeTourModal(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const TUTORIAL_TOPICS = {
    checklists: {
      id: 'checklists',
      title: '📝 Como Criar um Checklist com IA (Bill)',
      subtitle: 'Aprenda a criar rotinas automatizadas por voz ou texto em segundos.',
      categoryIcon: <ClipboardList size={22} color="#FF8800" />,
      steps: [
        {
          title: '1. Acesse a Seção de Checklists',
          description: 'Clique no botão laranja "+ Criar Checklist" no topo do seu painel ou acesse a aba "Checklists" no menu lateral.',
          tabTarget: 'checklists',
          icon: <ClipboardList size={24} color="#FF8800" />
        },
        {
          title: '2. Peça ao Bill IA por Voz ou Texto',
          description: 'No criador, digite ou grave um áudio. Exemplo: "Cria um checklist de fechamento para a minha cozinha com foto na chapa e verificação de lixo e gás".',
          tabTarget: 'checklists',
          icon: <Sparkles size={24} color="#FF8800" />
        },
        {
          title: '3. Exigência de Fotos e Respostas',
          description: 'A IA gera as perguntas automaticamente. Marque quais tarefas exigem "Foto Obrigatória" para fiscalizar se a equipe realmente realizou o procedimento.',
          tabTarget: 'checklists',
          icon: <ShieldCheck size={24} color="#10B981" />
        },
        {
          title: '4. Frequência e Definição de Loja',
          description: 'Escolha a frequência (Diário, Semanal ou Mensal) e atribua a filial responsável. Ao salvar, o checklist fica disponível na hora nos celulares da equipe!',
          tabTarget: 'checklists',
          icon: <CheckCircle size={24} color="#10B981" />
        }
      ]
    },

    frota: {
      id: 'frota',
      title: '🚚 Como Cadastrar e Vistoriar Minha Frota',
      subtitle: 'Controle saída de veículos, pneus, lataria e nível de combustível.',
      categoryIcon: <Car size={22} color="#60A5FA" />,
      steps: [
        {
          title: '1. Acesse o Menu Frota e Veículos',
          description: 'No menu lateral esquerdo, clique em "Frota e Veículos" para ver os carros, caminhões ou utilitários cadastrados.',
          tabTarget: 'vehicles',
          icon: <Car size={24} color="#60A5FA" />
        },
        {
          title: '2. Cadastre um Novo Veículo',
          description: 'Clique no botão "+ Cadastrar Veículo", informe a placa, modelo, marca, ano e vincule o motorista responsável.',
          tabTarget: 'vehicles',
          icon: <Plus size={24} color="#60A5FA" />
        },
        {
          title: '3. Vistoria Pré-Viagem Obrigatória',
          description: 'Os motoristas abrem o app no celular e realizam a vistoria antes de sair, enviando fotos dos pneus, lataria e nível de combustível.',
          tabTarget: 'vehicles',
          icon: <ShieldCheck size={24} color="#10B981" />
        }
      ]
    },

    compras: {
      id: 'compras',
      title: '🛒 Como Fazer Lista de Compras e Estoque',
      subtitle: 'Evite falta de insumos com reposição automatizada.',
      categoryIcon: <ShoppingCart size={22} color="#EC4899" />,
      steps: [
        {
          title: '1. Acesse Compras e Estoque',
          description: 'Clique no menu "Compras e Estoque" na barra lateral para visualizar os produtos e listas de reposição.',
          tabTarget: 'compras',
          icon: <ShoppingCart size={24} color="#EC4899" />
        },
        {
          title: '2. Crie uma Lista ou Peça ao Bill IA',
          description: 'Clique em "+ Nova Lista de Compras" ou peça para o Bill IA gerar os insumos da sua empresa por comando de áudio.',
          tabTarget: 'compras',
          icon: <Sparkles size={24} color="#EC4899" />
        },
        {
          title: '3. Alerta de Estoque Mínimo',
          description: 'Cadastre o estoque mínimo de cada item. Quando os funcionários apontarem falta no checklist diário, o item entra direto para a lista de compras!',
          tabTarget: 'compras',
          icon: <CheckCircle size={24} color="#10B981" />
        }
      ]
    },

    equipe: {
      id: 'equipe',
      title: '👥 Como Cadastrar Minha Equipe e Gerentes',
      subtitle: 'Adicione colaboradores, defina níveis de acesso e filiais.',
      categoryIcon: <Users size={22} color="#A855F7" />,
      steps: [
        {
          title: '1. Acesse o Menu Equipe',
          description: 'Clique em "Equipe" na barra lateral para visualizar os colaboradores da sua empresa.',
          tabTarget: 'equipe',
          icon: <Users size={24} color="#A855F7" />
        },
        {
          title: '2. Cadastre o Novo Colaborador',
          description: 'Clique em "+ Novo Colaborador", informe Nome, E-mail, Senha de Acesso e a Loja/Filial correspondente.',
          tabTarget: 'equipe',
          icon: <UserPlus size={24} color="#A855F7" />
        },
        {
          title: '3. Níveis de Permissão (Gerente vs Funcionário)',
          description: 'Defina o perfil de acesso: Gerente (pode criar rotinas e relatórios) ou Funcionário (apenas executa checklists e marca ponto).',
          tabTarget: 'equipe',
          icon: <Lock size={24} color="#10B981" />
        }
      ]
    },

    ponto: {
      id: 'ponto',
      title: '⏰ Como Funciona o Ponto por Reconhecimento Facial',
      subtitle: 'Registro de entrada e saída com foto e GPS sem fraudes.',
      categoryIcon: <Clock size={22} color="#60A5FA" />,
      steps: [
        {
          title: '1. Acesse Controle de Ponto IA',
          description: 'No menu lateral, acesse "Controle de Ponto IA" para acompanhar as batidas de ponto em tempo real.',
          tabTarget: 'ponto',
          icon: <Clock size={24} color="#60A5FA" />
        },
        {
          title: '2. Batida de Ponto pelo Celular ou Tablet da Loja',
          description: 'A equipe abre o aplicativo na loja, tira uma foto rápida da face e o sistema registra o horário e localização GPS exata.',
          tabTarget: 'ponto',
          icon: <UserCheck size={24} color="#60A5FA" />
        },
        {
          title: '3. Relatórios e Espelho de Ponto em PDF',
          description: 'Exporte o relatório mensal completo em PDF/Excel com 1 clique para enviar diretamente à contabilidade.',
          tabTarget: 'ponto',
          icon: <FileDown size={24} color="#10B981" />
        }
      ]
    },

    dashboard: {
      id: 'dashboard',
      title: '📊 Visão Geral do Dashboard & Auditoria com Fotos',
      subtitle: 'Acompanhe a conformidade geral e fiscalização por visão computacional.',
      categoryIcon: <Activity size={22} color="var(--primary)" />,
      steps: [
        {
          title: '1. Indicadores da Sua Empresa em Tempo Real',
          description: 'Na tela inicial (Dashboard), veja o número de checklists concluídos no dia, conformidade percentual e não conformidades.',
          tabTarget: 'auditoria',
          icon: <Activity size={24} color="var(--primary)" />
        },
        {
          title: '2. Auditoria por Visão Computacional (Fotos)',
          description: 'Em Auditoria em Tempo Real, inspecione as fotos enviadas. A IA analisa visualmente se o ambiente está limpo e aprova ou reprova.',
          tabTarget: 'auditoria',
          icon: <ShieldCheck size={24} color="#10B981" />
        },
        {
          title: '3. Detalhamento e Zoom de Evidências',
          description: 'Clique em qualquer auditoria para ver a selfie do funcionário, o horário de execução e dar zoom em alta resolução nas fotos.',
          tabTarget: 'auditoria',
          icon: <CheckCircle size={24} color="#10B981" />
        }
      ]
    }
  };

  const activeTopicObj = TUTORIAL_TOPICS[selectedTutorialTopic] || TUTORIAL_TOPICS.checklists;

  const handleStartSpecificTutorial = (topicId) => {
    setSelectedTutorialTopic(topicId);
    setTourStep(0);
    const target = TUTORIAL_TOPICS[topicId]?.steps[0]?.tabTarget || 'auditoria';
    setTab(target);
    setShowWelcomeTourModal(false);
    setShowTutorialHub(false);
    setIsTourActive(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextTourStep = () => {
    if (tourStep < activeTopicObj.steps.length - 1) {
      const nextStep = tourStep + 1;
      setTourStep(nextStep);
      setTab(activeTopicObj.steps[nextStep].tabTarget);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setIsTourActive(false);
      setShowTutorialHub(true); // Retorna ao Hub após concluir
    }
  };

  const handlePrevTourStep = () => {
    if (tourStep > 0) {
      const prevStep = tourStep - 1;
      setTourStep(prevStep);
      setTab(activeTopicObj.steps[prevStep].tabTarget);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  
  // -- Veículos --
  const [vehicles, setVehicles] = useState([]);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [newVehicle, setNewVehicle] = useState({ plate: '', model: '', brand: '', color: '', year: '', currentKm: '', photoUrl: '', status: 'ativo', employeeId: '', tasks: [], scheduleType: 'manual', scheduleData: null });
  const [newDateInput, setNewDateInput] = useState('');
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('todos');
  // -- Compras / Estoque --
  const [shoppingLists, setShoppingLists] = useState([]);
  const [shoppingSubmissions, setShoppingSubmissions] = useState([]);
  const [selectedShoppingSubModal, setSelectedShoppingSubModal] = useState(null);
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  const [editingShopping, setEditingShopping] = useState(null);
  const [newShopping, setNewShopping] = useState({ title: '', recurrence: 'weekly', weekdays: [], assignedTo: 'todos', items: [{ name: '', unit: 'un', minStock: '', category: 'geral' }] });
  const [isSavingShopping, setIsSavingShopping] = useState(false);
  const [shoppingAIMode, setShoppingAIMode] = useState(false);
  const [shoppingAIConv, setShoppingAIConv] = useState([]);
  const [shoppingAIInput, setShoppingAIInput] = useState('');
  const [shoppingAIGenerating, setShoppingAIGenerating] = useState(false);
  const [shoppingAIRecording, setShoppingAIRecording] = useState(false);
  const shoppingRecorderRef = useRef(null);
  const shoppingAIChatRef = useRef(null);
  const [billEmail, setBillEmail] = useState('');
  const [billPassword, setBillPassword] = useState('');
  const [billLoading, setBillLoading] = useState(false);
  const [billError, setBillError] = useState('');
  
  const [pontoExportPeriod, setPontoExportPeriod] = useState('mes_atual');
  const [pontoCustomDates, setPontoCustomDates] = useState({ start: '', end: '' });
  const [pontoRecords, setPontoRecords] = useState([]);
  const [pontoMonth, setPontoMonth] = useState(new Date().toISOString().slice(0, 7));
  const [pontoFilterEmployee, setPontoFilterEmployee] = useState('todos');
  const [showPontoPanel, setShowPontoPanel] = useState(false);
  const [pontoPhotoPreview, setPontoPhotoPreview] = useState(null);
  const [showPontoManualModal, setShowPontoManualModal] = useState(false);
  const [editingPontoRecord, setEditingPontoRecord] = useState(null);
  const [pontoManualForm, setPontoManualForm] = useState({
    userId: '',
    type: 'entrada',
    date: new Date().toISOString().slice(0, 10),
    time: '08:00',
    notes: ''
  });
  const [pontoSubmitting, setPontoSubmitting] = useState(false);
  const [pontoTimezone, setPontoTimezone] = useState('America/Sao_Paulo');
  const [contadorEmail, setContadorEmail] = useState('');
  const [fechamentoDia, setFechamentoDia] = useState('ultimo_dia');
  const [fechamentoSelection, setFechamentoSelection] = useState('ultimo_dia');
  const [customFechamentoDay, setCustomFechamentoDay] = useState('15');
  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [pontoHoraEntrada, setPontoHoraEntrada] = useState('08:00');
  const [pontoHoraSaida, setPontoHoraSaida] = useState('18:00');
  const [pontoTolerancia, setPontoTolerancia] = useState(15);
  const [whatsappActive, setWhatsappActive] = useState(true);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [waPontoAtraso, setWaPontoAtraso] = useState(true);
  const [waChecklistReprovado, setWaChecklistReprovado] = useState(true);
  const [waChecklistAtrasado, setWaChecklistAtrasado] = useState(true);
  const [waPontoDiario, setWaPontoDiario] = useState(true);
  const [waChecklistAprovado, setWaChecklistAprovado] = useState(true);
  const [rankingPeriod, setRankingPeriod] = useState('mes');
  const [rankingCustomDates, setRankingCustomDates] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  

  const [isPurchasesOpen, setIsPurchasesOpen] = useState(false);

  // -- Registrar Compras Módulo Dinâmico --
  const [purchases, setPurchases] = useState(() => {
    const saved = localStorage.getItem('firecheck_purchases');
    if (saved) return JSON.parse(saved);
    return [
      { id: 1, postedAt: '30/04/2026', postedBy: 'admin@hakim.com.br', date: '2026-04-30', description: 'Sistema de gás', category: 'Insumos para Sistema de Gás', value: 367.20, photo: null },
      { id: 2, postedAt: '29/04/2026', postedBy: 'admin@hakim.com.br', date: '2026-04-29', description: 'Pedágio', category: 'Pedágio', value: 7.50, photo: null }
    ];
  });

  useEffect(() => {
    localStorage.setItem('firecheck_purchases', JSON.stringify(purchases));
  }, [purchases]);

  const [purchaseForm, setPurchaseForm] = useState({ description: '', value: '', category: '', date: new Date().toISOString().split('T')[0], photo: null });
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState(null);
  
  // -- Cota de Checklists --
  const [quotaInfo, setQuotaInfo] = useState(null);
  const [showQuotaUpgradeModal, setShowQuotaUpgradeModal] = useState(false);
  
  const [toasts, setToasts] = useState([]);
  const [knownUserIds, setKnownUserIds] = useState(null);

  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };




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
    if (user.timezone) setPontoTimezone(user.timezone);
    if (user.contador_email) setContadorEmail(user.contador_email);
    
    const fd = user.fechamento_dia || 'ultimo_dia';
    if (['ultimo_dia', 'dia_1', 'dia_5', 'dia_10'].includes(fd)) {
      setFechamentoDia(fd);
      setFechamentoSelection(fd);
    } else {
      setFechamentoSelection('personalizado');
      const dayNum = fd.replace('dia_', '');
      setCustomFechamentoDay(dayNum);
      setFechamentoDia(fd);
    }

    if (user.store) setCompanyName(user.store);
    if (user.name) setOwnerName(user.name);
    if (user.phone) setOwnerPhone(user.phone);

    if (user.ponto_hora_entrada) setPontoHoraEntrada(user.ponto_hora_entrada);
    if (user.ponto_hora_saida) setPontoHoraSaida(user.ponto_hora_saida);
    if (user.ponto_tolerancia !== undefined && user.ponto_tolerancia !== null) setPontoTolerancia(user.ponto_tolerancia);
    if (user.whatsapp_active !== undefined) setWhatsappActive(user.whatsapp_active);
    if (user.whatsapp_phone) setWhatsappPhone(user.whatsapp_phone);
    if (user.wa_ponto_atraso !== undefined) setWaPontoAtraso(user.wa_ponto_atraso);
    if (user.wa_checklist_reprovado !== undefined) setWaChecklistReprovado(user.wa_checklist_reprovado);
    if (user.wa_checklist_atrasado !== undefined) setWaChecklistAtrasado(user.wa_checklist_atrasado);
    if (user.wa_ponto_diario !== undefined) setWaPontoDiario(user.wa_ponto_diario);
    if (user.wa_checklist_aprovado !== undefined) setWaChecklistAprovado(user.wa_checklist_aprovado);
    
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
    fetchQuota();
    fetchPontoRecords();
    fetchVehicles();
    fetchShoppingLists();

     const checkVisitors = () => {
       if (user.role === 'master' || user.email?.toLowerCase() === 'douglas@firecheck.com') {
          fetch(`${API_URL}/api/live-visitors`, { headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') } }).then(r => r.json()).then(d => {
             setLiveVisitors(d.visitors || 0);
             setTodayVisitors(d.today || 0);
             setTodayMobile(d.todayMobile || 0);
             setTodayDesktop(d.todayDesktop || 0);
             setVideoPlays(d.videoPlays || 0);
          }).catch(() => {});
          
          fetch(`${API_URL}/api/quiz-stats`, { headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') } }).then(r => r.json()).then(d => {
             setQuizStats(d.stats || []);
             setQuizOnline(d.online || 0);
             setQuizVideoPlays(d.quizVideoPlays || 0);
          }).catch(() => {});
       }
    };
    checkVisitors();

    // Loop global de atualização do painel a cada 10 segundos (Quase Tempo-Real)
    const globalRefresh = setInterval(() => {
      fetchData();
      fetchQuota();
      fetchVehicles();
      checkVisitors();
    }, 10000);

    return () => clearInterval(globalRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  // Verificar status do Bill ao montar
  useEffect(() => {
    const checkBillStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/bill/status`, { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (data.linked) {
            setBillLinked(true);
            setBillUser({ name: data.name || 'Usuário Bill', plan: data.plan || 'Padrão' });
          }
        }
      } catch (err) {
        // silently fail — user just hasn't linked yet
      }
    };
    checkBillStatus();
  }, []);

  // Atualiza registros de ponto quando o mês muda
  useEffect(() => {
    fetchPontoRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pontoMonth]);

  // Estado de saúde da IA
  const [aiHealth, setAiHealth] = useState(null);

  // Robô Autônomo Melhorado: usa endpoint centralizado + health check
  useEffect(() => {
    if (!userProfile || userProfile.role === 'employee' || userProfile.role === 'funcionario') return;
    
    // Health check da IA a cada 60s
    const checkHealth = () => {
      fetch(`${API_URL}/api/health`, { headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') } }).then(r => r.json()).then(d => setAiHealth(d.ai)).catch(() => setAiHealth(false));
    };
    checkHealth();

    const interval = setInterval(() => {
      // Usa o endpoint centralizado que é mais inteligente
      fetch(`${API_URL}/api/auto-process-pending`, { headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') } })
        .then(r => r.json())
        .then(data => {
          if (data.processed && data.processed.length > 0) {
            console.log(`[Auto-Retry] Processou ${data.processed.length} submissões pendentes!`);
            fetchData();
          }
        }).catch(() => {});
      
      // Também tenta individualmente as que ainda ficaram pendentes no state
      submissionsRef.current.forEach(s => {
        const hasPhotos = (s.tasks || []).some(t => t.photo);
        const feedbacks = s.feedback_info || {};
        const feedbackKeys = Object.keys(feedbacks).filter(k => k !== '_meta' && k !== 'global_error');
        const photosWithFeedback = (s.tasks || []).filter(t => t.photo && feedbacks[t.id]);
        const totalPhotos = (s.tasks || []).filter(t => t.photo).length;
        
        // Se tem foto sem feedback OU feedback parcial (não cobrindo todas as fotos)
        if (hasPhotos && (feedbackKeys.length === 0 || photosWithFeedback.length < totalPhotos)) {
          fetch(`${API_URL}/api/process-audit-background`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ submissionId: s.id })
          }).then(r => r.json()).then(data => {
            if (data.processed > 0) fetchData();
          }).catch(() => {});
        }
      });

      checkHealth();
    }, 20000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  const setupPushNotifications = async (email) => {
    try {
      // Verifica se está rodando como app nativo (Capacitor)
      if (Capacitor.isNativePlatform()) {
        console.log('[Push] App nativo detectado, solicitando permissão...');
        // Adiciona listener ANTES de register para não perder o evento
        PushNotifications.addListener('registration', async (token) => {
          console.log('[Push] Token recebido:', token.value?.substring(0, 30) + '...');
          try {
            await fetch(`${API_URL}/api/register-token`, {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({ email, fcmToken: token.value })
            });
            console.log('[Push] Token registrado no servidor!');
          } catch (err) {
            console.error('[Push] Erro ao salvar token:', err);
          }
        });
        PushNotifications.addListener('registrationError', (error) => {
          console.error('[Push] Erro no registro:', error);
        });
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('[Push] Notificação recebida:', notification);
        });
        const perm = await PushNotifications.requestPermissions();
        console.log('[Push] Permissão:', perm.receive);
        if (perm.receive === 'granted') {
          await PushNotifications.register();
          console.log('[Push] Register chamado com sucesso');
        }
      } else {
        // Método para PWA / Web Push
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          console.log('[Push] Permissão web:', permission);
        }
      }
    } catch (e) { 
      console.warn('[Push] Erro no setup:', e); 
    }
  };

  const fetchCameras = async () => {
    const savedUser = localStorage.getItem('user');
    if (!savedUser) return;
    const user = JSON.parse(savedUser);
    const storeParam = user.role !== 'master' ? `?store=${encodeURIComponent(user.store)}` : '';
    try {
      const res = await fetch(`${API_URL}/api/cameras${storeParam}`, {
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
      });
      const data = await res.json();
      if (Array.isArray(data)) setCameras(data);
    } catch (err) { console.error('Erro ao buscar câmeras:', err); }
  };

  const fetchQuota = async () => {
    try {
      const savedUser = localStorage.getItem('user');
      if (!savedUser) return;
      const user = JSON.parse(savedUser);
      if (user.role === 'master') return; // Master não tem cota
      if (!user.store) return;
      const res = await fetch(`${API_URL}/api/quota?store=${encodeURIComponent(user.store)}`, {
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
      });
      const data = await res.json();
      setQuotaInfo(data);
    } catch (err) { console.error('Erro ao buscar cota:', err); }
  };

  const fetchPontoRecords = async () => {
    try {
      const savedUser = localStorage.getItem('user');
      if (!savedUser) return;
      const user = JSON.parse(savedUser);
      const res = await fetch(`${API_URL}/api/ponto?store=${encodeURIComponent(user.store)}&month=${pontoMonth}`, {
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
      });
      const data = await res.json();
      if (Array.isArray(data)) setPontoRecords(data);
    } catch (err) { console.error('Erro ponto:', err); }
  };

  const handleSavePontoManual = async () => {
    if (!pontoManualForm.userId || !pontoManualForm.date || !pontoManualForm.time) {
      alert('Preencha todos os campos obrigatórios: Funcionário, Data e Horário.');
      return;
    }
    try {
      setPontoSubmitting(true);
      const selectedEmp = (users || []).find(u => String(u.id) === String(pontoManualForm.userId));
      const empName = selectedEmp ? selectedEmp.name : 'Funcionário';
      const timestamp = `${pontoManualForm.date}T${pontoManualForm.time}:00`;
      
      const res = await fetch(`${API_URL}/api/ponto/manual`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userId: pontoManualForm.userId,
          userName: empName,
          store: userProfile?.store,
          type: pontoManualForm.type,
          timestamp,
          notes: pontoManualForm.notes || 'Ajuste manual pelo gestor',
          editedBy: userProfile?.name || 'Gestor'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('Batida de ponto manual cadastrada com sucesso!');
        setShowPontoManualModal(false);
        setPontoManualForm({
          userId: '',
          type: 'entrada',
          date: new Date().toISOString().slice(0, 10),
          time: '08:00',
          notes: ''
        });
        fetchPontoRecords();
      } else {
        alert(data.error || 'Erro ao salvar ponto manual');
      }
    } catch (err) {
      console.error('Erro salvar ponto manual:', err);
      alert('Erro de comunicação com o servidor ao salvar ponto');
    } finally {
      setPontoSubmitting(false);
    }
  };

  const handleUpdatePontoRecord = async () => {
    if (!editingPontoRecord) return;
    try {
      setPontoSubmitting(true);
      const timestamp = `${editingPontoRecord.date}T${editingPontoRecord.time}:00`;
      const res = await fetch(`${API_URL}/api/ponto/record`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: editingPontoRecord.id,
          type: editingPontoRecord.type,
          timestamp,
          notes: editingPontoRecord.notes || 'Editado pelo gestor',
          editedBy: userProfile?.name || 'Gestor'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('Registro de ponto atualizado com sucesso!');
        setEditingPontoRecord(null);
        fetchPontoRecords();
      } else {
        alert(data.error || 'Erro ao atualizar registro');
      }
    } catch (err) {
      console.error('Erro atualizar ponto:', err);
      alert('Erro de comunicação com o servidor ao atualizar');
    } finally {
      setPontoSubmitting(false);
    }
  };

  const handleDeletePontoRecord = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta batida de ponto?')) return;
    try {
      const res = await fetch(`${API_URL}/api/ponto/record?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('Registro de ponto excluído com sucesso!');
        fetchPontoRecords();
      } else {
        alert(data.error || 'Erro ao excluir ponto');
      }
    } catch (err) {
      console.error('Erro excluir ponto:', err);
      alert('Erro ao excluir registro');
    }
  };

  const fetchVehicles = async () => {
    try {
      const savedUser = localStorage.getItem('user');
      if (!savedUser) return;
      const user = JSON.parse(savedUser);
      const res = await fetch(`${API_URL}/api/vehicles?store=${encodeURIComponent(user.store || '')}`, {
        headers: getAuthHeaders()
      });
      handle401(res);
      const data = await res.json();
      if (Array.isArray(data)) setVehicles(data);
    } catch (e) {
      console.error('Erro ao buscar veículos:', e);
    }
  };

  // -- Compras / Estoque --
  const fetchShoppingSubmissions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/shopping/submissions`, {
        headers: getAuthHeaders()
      });
      handle401(res);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setShoppingSubmissions(data);
      }
    } catch (e) { console.error('Erro ao buscar histórico de compras:', e); }
  };

  const fetchShoppingLists = async () => {
    try {
      const savedUser = localStorage.getItem('user');
      if (!savedUser) return;
      const user = JSON.parse(savedUser);
      const res = await fetch(`${API_URL}/api/shopping?store=${encodeURIComponent(user.store || '')}`, {
        headers: getAuthHeaders()
      });
      handle401(res);
      const data = await res.json();
      if (Array.isArray(data)) setShoppingLists(data);
      fetchShoppingSubmissions();
    } catch (e) { console.error('Erro ao buscar listas de compras:', e); }
  };

  const handleSaveShopping = async () => {
    if (!newShopping.title || newShopping.items.filter(i => i.name.trim()).length === 0) {
      alert('⚠️ Nome e pelo menos 1 item são obrigatórios!');
      return;
    }
    setIsSavingShopping(true);
    try {
      const savedUser = localStorage.getItem('user');
      const user = JSON.parse(savedUser);
      const payload = {
        ...(editingShopping ? { id: editingShopping.id } : {}),
        title: newShopping.title,
        recurrence: newShopping.recurrence,
        weekdays: newShopping.weekdays,
        assignedTo: newShopping.assignedTo,
        items: newShopping.items.filter(i => i.name.trim()).map(i => ({
          name: i.name, unit: i.unit || 'un', minStock: parseFloat(i.minStock) || 0, category: i.category || 'geral'
        })),
        store: user.store
      };
      await fetch(`${API_URL}/api/shopping`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setShowShoppingModal(false);
      setEditingShopping(null);
      setNewShopping({ title: '', recurrence: 'weekly', weekdays: [], assignedTo: 'todos', items: [{ name: '', unit: 'un', minStock: '', category: 'geral' }] });
      fetchShoppingLists();
    } catch (e) { console.error('Erro ao salvar lista:', e); }
    setIsSavingShopping(false);
  };

  const handleDeleteShopping = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta lista de compras?')) return;
    try {
      await fetch(`${API_URL}/api/shopping/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      fetchShoppingLists();
    } catch (e) { console.error('Erro ao deletar lista:', e); }
  };

  const handleEditShopping = async (list) => {
    // Buscar itens da lista
    try {
      const res = await fetch(`${API_URL}/api/shopping/items?listId=${list.id}`, { headers: getAuthHeaders() });
      const items = await res.json();
      setEditingShopping(list);
      setNewShopping({
        title: list.title,
        recurrence: list.recurrence || 'weekly',
        weekdays: list.weekdays || [],
        assignedTo: list.assigned_to || 'todos',
        items: items.length > 0 ? items.map(i => ({ name: i.name, unit: i.unit, minStock: i.min_stock, category: i.category })) : [{ name: '', unit: 'un', minStock: '', category: 'geral' }]
      });
      setShowShoppingModal(true);
    } catch(e) { console.error('Erro ao carregar itens:', e); }
  };

  const handleShoppingAISend = async (text, conv = shoppingAIConv) => {
    if (!text?.trim()) return;
    const newConv = [...conv, { role: 'user', content: text }];
    setShoppingAIConv(newConv);
    setShoppingAIInput('');
    setShoppingAIGenerating(true);
    setTimeout(() => shoppingAIChatRef.current?.scrollTo({ top: shoppingAIChatRef.current.scrollHeight, behavior: 'smooth' }), 100);

    try {
      const res = await fetch(`${API_URL}/api/generate-shopping-ai`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: text, conversation: newConv })
      });
      const data = await res.json();

      if (data.needsMoreInfo) {
        let msg = data.message || 'Preciso de mais detalhes:';
        if (data.questions?.length > 0) msg += '\n\n' + data.questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
        setShoppingAIConv(prev => [...prev, { role: 'bill', content: msg }]);
      } else if (data.title && data.items?.length > 0) {
        setShoppingAIConv(prev => [...prev, { role: 'bill', content: `✅ Lista "${data.title}" gerada com ${data.items.length} itens! Aplicando no formulário...` }]);
        setTimeout(() => {
          setNewShopping(p => ({
            ...p,
            title: data.title,
            recurrence: data.recurrence || p.recurrence,
            items: data.items.map(i => ({ name: i.name, unit: i.unit || 'un', minStock: i.minStock || 0, category: i.category || 'geral' }))
          }));
          setShoppingAIMode(false);
        }, 1500);
      }
    } catch (e) {
      setShoppingAIConv(prev => [...prev, { role: 'bill', content: `❌ Erro: ${e.message}` }]);
    }
    setShoppingAIGenerating(false);
    setTimeout(() => shoppingAIChatRef.current?.scrollTo({ top: shoppingAIChatRef.current.scrollHeight, behavior: 'smooth' }), 200);
  };

  const handleShoppingAIRecord = async () => {
    if (shoppingAIRecording) {
      // Parar gravação
      shoppingRecorderRef.current?.stop();
      setShoppingAIRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result.split(',')[1];
          setShoppingAIGenerating(true);
          const conv = [...shoppingAIConv, { role: 'user', content: '🎤 Enviando áudio...' }];
          setShoppingAIConv(conv);
          try {
            const res = await fetch(`${API_URL}/api/generate-shopping-ai`, {
              method: 'POST',
              headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio: base64, mimeType: 'audio/webm', conversation: shoppingAIConv })
            });
            const data = await res.json();
            const transcription = data._transcription || '';
            // Atualizar a mensagem do user com a transcrição
            setShoppingAIConv(prev => {
              const updated = [...prev];
              const lastUserIdx = updated.findLastIndex(m => m.role === 'user');
              if (lastUserIdx >= 0) updated[lastUserIdx] = { role: 'user', content: `🎤 "${transcription}"` };
              return updated;
            });

            if (data.needsMoreInfo) {
              let msg = data.message || '';
              if (data.questions?.length > 0) msg += '\n\n' + data.questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
              setShoppingAIConv(prev => [...prev, { role: 'bill', content: msg }]);
            } else if (data.title && data.items?.length > 0) {
              setShoppingAIConv(prev => [...prev, { role: 'bill', content: `✅ Lista "${data.title}" gerada com ${data.items.length} itens! Aplicando...` }]);
              setTimeout(() => {
                setNewShopping(p => ({
                  ...p, title: data.title, recurrence: data.recurrence || p.recurrence,
                  items: data.items.map(i => ({ name: i.name, unit: i.unit || 'un', minStock: i.minStock || 0, category: i.category || 'geral' }))
                }));
                setShoppingAIMode(false);
              }, 1500);
            }
          } catch (e) {
            setShoppingAIConv(prev => [...prev, { role: 'bill', content: `❌ Erro: ${e.message}` }]);
          }
          setShoppingAIGenerating(false);
          setTimeout(() => shoppingAIChatRef.current?.scrollTo({ top: shoppingAIChatRef.current.scrollHeight, behavior: 'smooth' }), 200);
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      shoppingRecorderRef.current = recorder;
      setShoppingAIRecording(true);
    } catch (e) {
      alert('⚠️ Não foi possível acessar o microfone.');
    }
  };

  const handleSaveVehicle = async () => {
    if (!newVehicle.plate || !newVehicle.model) {
      alert('⚠️ Placa e Modelo são obrigatórios!');
      return;
    }
    setIsSavingVehicle(true);
    try {
      const savedUser = localStorage.getItem('user');
      const user = JSON.parse(savedUser || '{}');
      const res = await fetch(`${API_URL}/api/vehicles`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...newVehicle,
          store: user.store
        })
      });
      if (res.ok) {
        alert(newVehicle.id ? '✅ Veículo atualizado com sucesso!' : '✅ Veículo cadastrado com sucesso!');
        setShowVehicleModal(false);
        setNewVehicle({ plate: '', model: '', brand: '', color: '', year: '', currentKm: '', photoUrl: '', status: 'ativo', employeeId: '', tasks: [], scheduleType: 'manual', scheduleData: null });
        fetchVehicles();
      } else {
        const err = await res.json();
        alert(`❌ Erro: ${err.error || 'Erro desconhecido'}`);
      }
    } catch (e) {
      alert('❌ Erro de conexão com o servidor.');
    } finally {
      setIsSavingVehicle(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId) => {
    if (!window.confirm('⚠️ Tem certeza que deseja remover este veículo?')) return;
    try {
      const res = await fetch(`${API_URL}/api/vehicles/${vehicleId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        alert('✅ Veículo removido com sucesso!');
        fetchVehicles();
      }
    } catch (e) {
      alert('❌ Erro ao remover veículo.');
    }
  };

  const handleVehiclePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewVehicle(prev => ({ ...prev, photoUrl: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSolicitVehicleChecklist = async (vehicleId) => {
    try {
      const res = await fetch(`${API_URL}/api/vehicles/solicit`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ vehicleId })
      });
      if (res.ok) {
        alert('✅ Checklist solicitado com sucesso! O funcionário vinculado verá o alerta no painel.');
        fetchVehicles();
      } else {
        alert('❌ Erro ao solicitar checklist.');
      }
    } catch (e) {
      alert('❌ Erro de conexão.');
    }
  };

  const handleExportPDF = (submission) => {
    const cl = checklists?.find(c => c.id === submission.checklist_id);
    const completedTasks = submission.tasks?.filter(t => t.done)?.length || 0;
    const totalTasks = submission.tasks?.length || 1;
    const pct = Math.round((completedTasks / totalTasks) * 100);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('⚠️ Por favor, permita pop-ups para gerar o relatório em PDF.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório de Auditoria - FireCheck</title>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1f2937;
            padding: 40px;
            background-color: #ffffff;
            margin: 0;
          }
          .header {
            border-bottom: 2px solid #ef4444;
            padding-bottom: 20px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #ef4444;
          }
          .meta-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 30px;
            background: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
          }
          .meta-item {
            font-size: 14px;
          }
          .meta-item strong {
            color: #374151;
          }
          .section-title {
            font-size: 18px;
            font-weight: bold;
            margin-top: 30px;
            margin-bottom: 15px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 6px;
            color: #111827;
          }
          .task-card {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            page-break-inside: avoid;
          }
          .task-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .status-badge {
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
          }
          .status-sim { background-color: #d1fae5; color: #065f46; }
          .status-nao { background-color: #fee2e2; color: #991b1b; }
          .evidence-grid {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 20px;
            margin-top: 10px;
          }
          .evidence-img {
            max-width: 150px;
            max-height: 150px;
            object-fit: cover;
            border-radius: 6px;
            border: 1px solid #d1d5db;
          }
          .ai-feedback {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 10px;
            border-radius: 0 6px 6px 0;
            font-size: 13px;
          }
          .ai-feedback.success {
            background-color: #ecfdf5;
            border-left-color: #10b981;
          }
          .signature-box {
            margin-top: 40px;
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
            text-align: center;
            page-break-inside: avoid;
          }
          .signature-img {
            max-height: 80px;
            border-bottom: 1px solid #9ca3af;
            margin-bottom: 8px;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 11px;
            color: #9ca3af;
            border-top: 1px solid #f3f4f6;
            padding-top: 15px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">🔥 FireCheck Pro</div>
          <div style="font-size: 14px; color: #6b7280;">Relatório de Auditoria Digital</div>
        </div>

        <div class="meta-info">
          <div class="meta-item"><strong>Checklist:</strong> ${cl?.title || 'N/A'}</div>
          <div class="meta-item"><strong>Unidade/Loja:</strong> ${submission.store}</div>
          <div class="meta-item"><strong>Responsável:</strong> ${submission.employee_name}</div>
          <div class="meta-item"><strong>Data/Hora de Envio:</strong> ${new Date(submission.created_at).toLocaleString('pt-BR')} (Horário de Brasília)</div>
          <div class="meta-item"><strong>Resultado/Conclusão:</strong> ${pct}% concluído (${completedTasks}/${totalTasks} tarefas)</div>
          ${submission.vehicle_id ? `<div class="meta-item"><strong>Veículo Inspecionado:</strong> Sim (ID: ${submission.vehicle_id})</div>` : ''}
        </div>

        <div class="section-title">Respostas e Auditoria</div>
        ${submission.tasks.map((task, idx) => {
          const feedback = submission.feedback_info?.[task.id];
          const hasPhoto = task.photos && task.photos.length > 0 || task.photo;
          const photos = task.photos || (task.photo ? [task.photo] : []);
          return `
            <div class="task-card">
              <div class="task-header">
                <div>${idx + 1}. ${task.text}</div>
                <span class="status-badge ${task.done ? 'status-sim' : 'status-nao'}">
                  ${task.done ? 'Sim' : 'Não'}
                </span>
              </div>
              ${hasPhoto || feedback ? `
                <div class="evidence-grid">
                  ${hasPhoto ? `
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                      ${photos.map(p => `<img class="evidence-img" src="${p}" />`).join('')}
                    </div>
                  ` : ''}
                  ${feedback ? `
                    <div class="ai-feedback ${feedback.status === 'success' ? 'success' : ''}">
                      <strong>${feedback.status === 'success' ? '✅ Aprovado pela IA' : '⚠️ Alerta da IA'}:</strong>
                      <p style="margin: 4px 0 0 0;">${feedback.message}</p>
                    </div>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}

        ${submission.signature ? `
          <div class="signature-box">
            <img class="signature-img" src="${submission.signature}" alt="Assinatura" /><br />
            <strong>Assinatura Digital do Funcionário</strong><br />
            <span style="font-size: 11px; color: #6b7280;">Documento assinado digitalmente no dispositivo celular por ${submission.employee_name}.</span>
          </div>
        ` : ''}

        <div class="footer">
          FireCheck v1.0 • Relatório gerado digitalmente em ${new Date().toLocaleString('pt-BR')}<br />
          Auditoria inteligente provida por Google Gemini AI. Todos os direitos reservados.
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
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
        const userRes = await fetch(`${API_URL}/api/users${query}`, { headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') } });
        
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
      } else {
        const [clRes, userRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/api/checklists${query}`, { headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') } }),
          fetch(`${API_URL}/api/users${query}`, { headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') } }),
          fetch(`${API_URL}/api/stats${query}`, { headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') } })
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

        const subRes = await fetch(`${API_URL}/api/submissions${query}`, {
          headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
        });
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
                  // Se tem feedback, foi reprovado, e NÃO é a primeira carga da página
                  if (!isFirstFetch.current && hasWarnings && 'Notification' in window && Notification.permission === 'granted') {
                    new Notification("⚠️ Alerta FireCheck", { 
                      body: `Reprovação detectada na tarefa de ${s.employee_name}!`,
                      icon: '/fire-icon.png' 
                    });
                  }
                  nextSet.add(s.id);
                }
              }
            });
            isFirstFetch.current = false; // Marca que a primeira carga já passou
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
        headers: getAuthHeaders(),
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
      await fetch(`${API_URL}/api/cameras/${id}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') } });
      fetchCameras();
    } catch (e) { alert('Erro ao remover.'); }
  };

  const handleResolveSubmission = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/resolve-submission`, {
        method: 'POST',
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
        body: JSON.stringify(newUser)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(`⚠️ ${data.error || data.message || 'Erro ao adicionar usuário.'}`);
        return;
      }

      setShowUserModal(false);
      setNewUser({ name: '', email: '', password: '', store: isMaster ? '' : userProfile?.store || '' });
      fetchData();
    } catch (e) { alert('Erro de conexão com o servidor.'); }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: editingUser.name,
          phone: editingUser.phone,
          role: editingUser.role,
          ponto_hora_entrada: editingUser.ponto_hora_entrada || undefined,
          ponto_hora_saida: editingUser.ponto_hora_saida || undefined,
          ponto_tolerancia: editingUser.ponto_tolerancia != null ? editingUser.ponto_tolerancia : undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`⚠️ ${data.error || data.message || 'Erro ao editar colaborador.'}`);
        return;
      }
      setShowEditModal(false);
      setEditingUser(null);
      fetchData();
    } catch (e) {
      alert('Erro de conexão ao salvar alterações.');
    }
  };

  const handleImpersonateUser = (member) => {
    const currentAdmin = localStorage.getItem('user');
    if (currentAdmin) {
      localStorage.setItem('firecheck_admin_backup', currentAdmin);
      localStorage.setItem('firecheck_impersonated', 'true');
    }

    const employeeUser = {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role || 'funcionario',
      store: member.store || userProfile?.store,
      plan: userProfile?.plan || 'pro',
      status: 'active'
    };
    localStorage.setItem('user', JSON.stringify(employeeUser));
    navigate('/funcionario');
  };

  const handleDeleteUser = async (id) => {
    if (!confirm('Tem certeza que deseja remover este colaborador?')) return;
    try {
      await fetch(`${API_URL}/api/users/${id}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') } });
      fetchData();
    } catch (e) { alert('Erro ao remover.'); }
  };

  const handleDeleteChecklist = async (clId, title) => {
    const confirmation = prompt(`Tem certeza de que deseja excluir o checklist "${title}"?\nEsta ação é irreversível.\n\nPara confirmar, digite EXCLUIR no campo abaixo:`);
    if (confirmation !== 'EXCLUIR') {
      if (confirmation !== null) {
        addToast('Confirmação incorreta. O checklist não foi excluído.', 'error');
      }
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/checklists/${clId}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
      });
      if (res.ok) {
        addToast('Checklist excluído com sucesso!', 'success');
        setChecklists(prev => prev.filter(c => c.id !== clId));
      } else {
        const err = await res.json();
        addToast(`Erro ao excluir checklist: ${err.error || 'Erro desconhecido'}`, 'error');
      }
    } catch (e) {
      console.error(e);
      addToast('Erro de conexão ao tentar excluir o checklist.', 'error');
    }
  };

  const isMaster = userProfile?.role === 'master' || 
                   userProfile?.email?.toLowerCase() === 'douglas@firecheck.com' || 
                   userProfile?.email?.toLowerCase() === 'contatohakim@gmail.com';
  const isAdmin = userProfile?.role === 'admin' && !isMaster; // Dono da Loja
  const isGestor = userProfile?.role === 'gestor';
  const isFuncionario = userProfile?.role === 'funcionario';
  const isAdminOrGestor = isAdmin || isGestor;
  
  const handleSaveCompanyProfile = async () => {
    if (!userProfile) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${userProfile.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: ownerName,
          store: companyName,
          phone: ownerPhone
        })
      });
      if (res.ok) {
        const updatedMe = {
          ...userProfile,
          name: ownerName,
          store: companyName,
          phone: ownerPhone
        };
        setUserProfile(updatedMe);
        localStorage.setItem('user', JSON.stringify(updatedMe));
        alert('Perfil da empresa atualizado com sucesso!');
        window.location.reload();
      } else {
        const data = await res.json();
        alert('Erro ao atualizar perfil: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (e) {
      alert('Erro de conexão ao salvar perfil.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('firecheck_token');
    navigate('/login');
  };

  // Abas iniciais agora são geridas pelo estado com localStorage no topo do arquivo.



  const handleSavePontoConfig = async () => {
    if (!userProfile) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${userProfile.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          timezone: pontoTimezone,
          contador_email: contadorEmail,
          fechamento_dia: fechamentoDia,
          ponto_hora_entrada: pontoHoraEntrada,
          ponto_hora_saida: pontoHoraSaida,
          ponto_tolerancia: pontoTolerancia
        })
      });
      if (res.ok) {
        const updatedMe = {
          ...userProfile,
          timezone: pontoTimezone,
          contador_email: contadorEmail,
          fechamento_dia: fechamentoDia,
          ponto_hora_entrada: pontoHoraEntrada,
          ponto_hora_saida: pontoHoraSaida,
          ponto_tolerancia: pontoTolerancia
        };
        localStorage.setItem('user', JSON.stringify(updatedMe));
        setUserProfile(updatedMe);
        addToast('Configurações salvas com sucesso!', 'success');
      } else {
        addToast('Erro ao salvar configurações contábeis.', 'error');
      }
    } catch (e) {
      console.error(e);
      addToast('Erro de conexão ao salvar configurações.', 'error');
    }
  };

  const handleSaveWhatsappConfig = async () => {
    if (!userProfile) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${userProfile.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          whatsapp_active: whatsappActive,
          whatsapp_phone: whatsappPhone,
          wa_ponto_atraso: waPontoAtraso,
          wa_checklist_reprovado: waChecklistReprovado,
          wa_checklist_atrasado: waChecklistAtrasado,
          wa_ponto_diario: waPontoDiario,
          wa_checklist_aprovado: waChecklistAprovado
        })
      });
      if (res.ok) {
        const updatedMe = {
          ...userProfile,
          whatsapp_active: whatsappActive,
          whatsapp_phone: whatsappPhone,
          wa_ponto_atraso: waPontoAtraso,
          wa_checklist_reprovado: waChecklistReprovado,
          wa_checklist_atrasado: waChecklistAtrasado,
          wa_ponto_diario: waPontoDiario,
          wa_checklist_aprovado: waChecklistAprovado
        };
        localStorage.setItem('user', JSON.stringify(updatedMe));
        setUserProfile(updatedMe);
        addToast('Configurações de Notificações salvas com sucesso!', 'success');
      } else {
        addToast('Erro ao salvar configurações de Notificações.', 'error');
      }
    } catch (e) {
      console.error(e);
      addToast('Erro de conexão ao salvar configurações.', 'error');
    }
  };



  const handlePurchaseOCRUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsProcessingPurchase(true);
    addToast('Processando foto da nota de compra...', 'info');

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result;
        try {
          const res = await fetch(`${API_URL}/api/scan-purchase`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ photoBase64: base64 })
          });
          if (res.ok) {
            const data = await res.json();
            setPurchaseForm({
              description: data.description || '',
              value: data.value !== undefined ? String(data.value) : '',
              category: data.category || 'Geral',
              date: data.date || new Date().toISOString().split('T')[0],
              photo: base64
            });
            addToast('Nota processada com sucesso!', 'success');
          } else {
            addToast('Erro ao ler a nota fiscal. Digite os dados.', 'error');
          }
        } catch (err) {
          console.error(err);
          addToast('Erro de conexão ao processar compra.', 'error');
        } finally {
          setIsProcessingPurchase(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsProcessingPurchase(false);
      addToast('Erro ao abrir arquivo da imagem.', 'error');
    }
  };

  const handleAddPurchase = () => {
    if (!purchaseForm.description || !purchaseForm.value) {
      addToast('Por favor, preencha a descrição e o valor da compra.', 'error');
      return;
    }
    const newP = {
      id: Date.now(),
      postedAt: new Date().toLocaleDateString('pt-BR'),
      postedBy: userProfile?.email || 'admin@firecheck.com.br',
      date: purchaseForm.date,
      description: purchaseForm.description,
      category: purchaseForm.category || 'Geral',
      value: parseFloat(purchaseForm.value),
      photo: purchaseForm.photo
    };
    setPurchases([newP, ...purchases]);
    setPurchaseForm({ description: '', value: '', category: '', date: new Date().toISOString().split('T')[0], photo: null });
    addToast('Compra registrada com sucesso!', 'success');
  };

  // -- Bill Handlers --
  const handleBillLink = async (e) => {
    e.preventDefault();
    setBillLoading(true);
    setBillError('');
    try {
      const res = await fetch(`${API_URL}/api/bill/link`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ email: billEmail, password: billPassword })
      });
      handle401(res);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao conectar com o Bill');
      setBillLinked(true);
      setBillUser({ name: data.name || 'Usuário Bill', plan: data.plan || 'Padrão' });
      setBillEmail('');
      setBillPassword('');
    } catch (err) {
      setBillError(err.message);
    } finally {
      setBillLoading(false);
    }
  };

  const handleBillUnlink = async () => {
    if (!window.confirm('Tem certeza que deseja desvincular sua conta do Bill?')) return;
    setBillLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/bill/unlink`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      handle401(res);
      if (!res.ok) throw new Error('Erro ao desvincular');
      setBillLinked(false);
      setBillUser(null);
    } catch (err) {
      setBillError(err.message);
    } finally {
      setBillLoading(false);
    }
  };



  const isTrialExpired = () => {
    if (!userProfile) return false;
    if (userProfile.status === 'blocked' || userProfile.status === 'pending') return true;
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
            <h3 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Starter Mensal</h3>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '24px' }}>R$67<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/mês</span></div>
            <button className="btn-secondary" style={{ width: '100%', padding: '12px' }} onClick={() => window.open(`https://pay.cakto.com.br/3eph5ko_856837?email=${encodeURIComponent(userProfile?.email || '')}&name=${encodeURIComponent(userProfile?.name || '')}`, '_blank')}>
              Assinar Mensal
            </button>
          </div>

          <div className="card" style={{ width: '300px', padding: '32px', border: '2px solid var(--primary)', transform: 'scale(1.05)' }}>
            <div style={{ backgroundColor: 'var(--primary)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', width: 'fit-content', margin: '0 auto 12px auto' }}>MAIS POPULAR</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '8px', color: 'var(--primary)' }}>Pro Mensal</h3>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '8px' }}>R$97<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/mês</span></div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: 'var(--success)', fontSize: '0.9rem', fontWeight: 'bold' }}>600 checklists/mês</div>
              <div style={{ color: 'rgba(0, 200, 83, 0.6)', fontSize: '0.8rem' }}>Melhor custo-benefício</div>
            </div>
            <button className="btn" style={{ width: '100%', padding: '12px' }} onClick={() => window.open(`https://pay.cakto.com.br/e7c88df?email=${encodeURIComponent(userProfile?.email || '')}&name=${encodeURIComponent(userProfile?.name || '')}`, '_blank')}>
              Assinar Pro
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
        width: isSidebarCollapsed ? '80px' : '260px', 
        backgroundColor: 'var(--bg-color)', 
        borderRight: '1px solid rgba(255,255,255,0.1)', 
        display: 'flex', 
        flexDirection: 'column', 
        position: 'sticky', 
        top: 0, 
        height: '100vh', 
        overflowY: 'auto',
        color: 'var(--text-main)',
        zIndex: 50,
        transition: 'width 0.3s ease'
      }}>
        {/* LOGO E BOTAO RECOLHER */}
        <div style={{ padding: isSidebarCollapsed ? '24px 0 16px 0' : '24px 20px 16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', gap: '10px', marginBottom: '16px' }}>
            <div style={{ backgroundColor: 'var(--primary)', padding: '6px', borderRadius: '6px' }}>
              <Flame size={20} color="white" />
            </div>
            {!isSidebarCollapsed && <span style={{ fontSize: '1.2rem', fontWeight: 'bold', letterSpacing: '-0.5px' }}>FireCheck</span>}
          </div>
          
          {/* Botão Explícito para Ocultar Menu */}
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} style={{ 
            width: '100%', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', 
            borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', 
            display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.2s', gap: '6px'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card)'}
          >
            {isSidebarCollapsed ? <ArrowRight size={16} /> : "Ocultar Menu"}
          </button>
        </div>

        {/* MENU ITENS */}
        <div style={{ padding: '16px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {(isMaster ? [
            { key: 'equipe',      label: 'Gestão de Clientes', icon: <Users size={18}/> },
            { key: 'quiz',        label: 'Site Principal', icon: <Activity size={18}/> },
          ] : [
            { key: 'auditoria',   label: 'Dashboard', icon: <Activity size={18}/> },
            { key: 'ponto',       label: 'Controle de Ponto IA', icon: <UserCheck size={18}/> },
            { key: 'notificacoes', label: 'Notificações', icon: <Bell size={18}/> },

            { key: 'ranking',     label: 'Ranking', icon: <Trophy size={18}/> },
            (userProfile?.email?.toLowerCase() === 'dugaburguer@gmail.com' ? { key: 'cameras', label: 'Câmeras IA', icon: <Video size={18}/> } : null),
            { key: 'alertas',     label: 'Alertas IA', icon: <ShieldAlert size={18}/> },
            { key: 'checklists',  label: 'Checklists', icon: <ClipboardList size={18}/> },
            { key: 'vehicles',    label: 'Frota e Veículos', icon: <Car size={18}/> },
            { key: 'compras',     label: 'Compras e Estoque', icon: <ShoppingCart size={18}/> },
            { key: 'bill',        label: 'Conectar com Bill', icon: <Bot size={18}/> },
            { key: 'equipe',      label: 'Equipe', icon: <Users size={18}/> },
            { key: 'perfil',      label: 'Perfil da Empresa', icon: <Settings size={18}/> },
          ].filter(Boolean)).map(t => {
            if (isFuncionario && (t.key === 'equipe' || t.key === 'checklists')) return null;
            if (isGestor && t.key === 'perfil') return null;
            const isActive = tab === t.key;
            return (
              <button key={t.key} onClick={() => { setTab(t.key); setIsSidebarOpen(false); }} title={isSidebarCollapsed ? t.label : ''}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '12px', padding: isSidebarCollapsed ? '12px 0' : '12px 16px', 
                  justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                  borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '500', fontSize: '0.95rem', 
                  transition: 'all 0.2s', textAlign: 'left',
                  backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                  color: isActive ? 'white' : 'var(--text-muted)',
                  borderLeft: isActive ? '4px solid var(--primary)' : '4px solid transparent'
                }}
                onMouseOver={(e) => !isActive && (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)')}
                onMouseOut={(e) => !isActive && (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                <span style={{ color: isActive ? 'white' : 'var(--text-muted)' }}>{t.icon}</span>
                {!isSidebarCollapsed && t.label}
              </button>
            );
          })}

          {/* Botão para Acessar a Central de Tutoriais */}
          <button 
            onClick={() => {
              setShowTutorialHub(true);
              setIsSidebarOpen(false);
            }} 
            title="Central de Tutoriais do Sistema"
            style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', padding: isSidebarCollapsed ? '12px 0' : '12px 16px', 
              justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
              borderRadius: '8px', border: '1px solid rgba(255, 77, 0, 0.4)', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', 
              transition: 'all 0.2s', textAlign: 'left',
              backgroundColor: 'rgba(255, 77, 0, 0.1)',
              color: 'var(--primary)',
              marginTop: '10px'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 77, 0, 0.2)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 77, 0, 0.1)'}
          >
            <span><Sparkles size={18} color="var(--primary)" /></span>
            {!isSidebarCollapsed && '🎓 Tour do Sistema'}
          </button>
        </div>

        {/* FOOTER DA SIDEBAR */}
        <div style={{ padding: isSidebarCollapsed ? '20px 0' : '20px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card-hover)' }}>
           {!isSidebarCollapsed && (
             <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '12px' }}>
                👤 {userProfile?.name}<br/>
                🏬 {userProfile?.store || 'Sistema Central'}
             </p>
           )}
           <button onClick={handleLogout} title="Sair do Sistema" style={{ 
               background: 'transparent', 
               border: 'none', 
               color: '#ef4444', 
               cursor: 'pointer', 
               fontSize: '0.9rem', 
               fontWeight: '600',
               display: 'flex', 
               alignItems: 'center',
               justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
               gap: '8px', 
               padding: '8px 0', 
               transition: 'opacity 0.2s',
               width: '100%'
             }}
             onMouseOver={(e) => e.currentTarget.style.opacity = 0.8}
             onMouseOut={(e) => e.currentTarget.style.opacity = 1}
             >
                <LogOut size={16} /> {!isSidebarCollapsed && "Sair do Sistema"}
           </button>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }} className="animate-fade">
        
        {/* TRIAL BANNER */}
        {userProfile?.status === 'trial' && userProfile?.role === 'admin' && (
          <div style={{
            backgroundColor: 'rgba(255, 160, 0, 0.1)',
            border: '1px solid #FFA000',
            borderRadius: '12px',
            padding: '16px 24px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ backgroundColor: '#FFA000', padding: '8px', borderRadius: '50%' }}>
                <Clock size={24} color="#fff" />
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: '#FFA000' }}>Seu período de teste acaba em {7 - Math.ceil(Math.abs(new Date() - new Date(userProfile.created_at || Date.now())) / (1000 * 60 * 60 * 24))} dias!</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Após esse período, o sistema será bloqueado. Não perca seus checklists e dados.</p>
              </div>
            </div>
            <button className="btn" onClick={() => window.open(`https://pay.cakto.com.br/e7c88df?email=${encodeURIComponent(userProfile.email)}&name=${encodeURIComponent(userProfile.name)}`, '_blank')} style={{ whiteSpace: 'nowrap' }}>
              Assinar Plano Agora
            </button>
          </div>
        )}
        
        {/* BANNER APLICATIVO NATIVO */}
        {userProfile?.role === 'admin' && !Capacitor.isNativePlatform() && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '16px 24px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ backgroundColor: 'var(--primary)', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Smartphone size={24} color="#fff" />
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>Monitore sua loja pelo celular!</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Baixe nosso aplicativo oficial para Android ou iOS (TestFlight) e receba notificações push em tempo real.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <a href="https://storage.googleapis.com/fire-check-storage.firebasestorage.app/downloads/firecheck.apk" download className="btn" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#10b981' }}>
                📥 Baixar Android (.APK)
              </a>
              <a href="https://testflight.apple.com/join/5K9U9AF5" target="_blank" rel="noopener noreferrer" className="btn" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#3b82f6' }}>
                🍎 Baixar iPhone (iOS)
              </a>
            </div>
          </div>
        )}

        {/* HEADER SUPERIOR */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '20px', backgroundColor: 'var(--bg-card)', padding: '20px 24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between', flex: 1, minWidth: '100%' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>
                {isMaster ? 'Painel de Gestão Master' : isAdmin ? 'Painel do Dono' : isGestor ? 'Painel do Gestor' : 'Painel do Funcionário'}
              </h1>
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Seja bem-vindo(a), {userProfile?.name}</p>
            </div>
            <button className="mobile-menu-btn" style={{ display: 'none', background: 'transparent', border: 'none', padding: '0', cursor: 'pointer', flexDirection: 'column', alignItems: 'center', gap: '2px' }} onClick={() => setIsSidebarOpen(true)}>
              <div style={{ backgroundColor: 'transparent', padding: '0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Menu size={20} color="white" />
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-main)' }}>Menu</span>
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {/* Indicador de Saúde da IA */}
            {aiHealth !== null && (
              <div style={{ padding: '6px 12px', backgroundColor: aiHealth ? 'rgba(0, 200, 83, 0.1)' : 'rgba(255, 23, 68, 0.15)', color: aiHealth ? 'var(--success)' : 'var(--error)', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', backgroundColor: aiHealth ? 'var(--success)' : 'var(--error)', borderRadius: '50%', boxShadow: aiHealth ? '0 0 8px var(--success)' : '0 0 8px var(--error)', animation: 'pulse 2s infinite' }}></div>
                🤖 IA {aiHealth ? 'Online' : 'Offline'}
              </div>
            )}
            {isMaster && (
               <div style={{ display: 'flex', gap: '8px' }}>
                 <div style={{ padding: '6px 12px', backgroundColor: 'rgba(0, 200, 83, 0.1)', color: 'var(--success)', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                   <div style={{ width: '8px', height: '8px', backgroundColor: 'var(--success)', borderRadius: '50%', boxShadow: '0 0 8px var(--success)', animation: 'pulse 2s infinite' }}></div>
                   {liveVisitors} pessoas online
                 </div>
                 <div style={{ padding: '6px 12px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                   <Users size={12} /> {todayVisitors} acessos
                   <span style={{ fontSize: '0.75rem', opacity: 0.7, marginLeft: '4px' }}>({todayMobile} 📱 / {todayDesktop} 💻)</span>
                 </div>
                 <div style={{ padding: '6px 12px', backgroundColor: 'rgba(255, 77, 0, 0.1)', color: 'var(--primary)', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                   <Video size={12} /> {videoPlays} plays no vídeo
                 </div>
               </div>
            )}
            
            {/* Filtro de Data */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: 'var(--bg-color)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', width: '100%', maxWidth: '300px' }}>
              <CalendarClock size={16} color="var(--primary)" />
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <input type="date" value={dateFilter.start} onChange={(e) => setDateFilter({...dateFilter, start: e.target.value})} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '0.75rem', outline: 'none', width: '95px' }} />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>até</span>
                <input type="date" value={dateFilter.end} onChange={(e) => setDateFilter({...dateFilter, end: e.target.value})} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '0.75rem', outline: 'none', width: '95px' }} />
              </div>
            </div>

            {isMaster ? (
              <button className="btn" style={{ backgroundColor: '#10b981' }} onClick={() => { setNewUser({ name: '', email: '', password: '', store: '', role: 'admin', plan: 'starter' }); setShowUserModal(true); }}>
                <UserPlus size={18} /> Nova Conta
              </button>
            ) : (isAdmin || isGestor) ? (
              <button className="btn" onClick={() => navigate('/admin/creator')}>
                <Plus size={18} /> Criar Checklist
              </button>
            ) : null}
          </div>
        </header>

      {/* Cards de KPIs (Visível apenas nos Dashboards Iniciais) */}
      {tab === 'auditoria' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          
          {isMaster ? (
          <>
            {/* Master não tem KPIs de dashboard, acessa Gestão de Clientes */}
          </>
         ) : (
          <>
            <div className="card" style={{ borderTop: '3px solid var(--primary)', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Checklists Hoje</p>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '8px 0', lineHeight: 1 }}>{stats.checklistsHoje}</h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>✅ {stats.concluidos} concluídos</span>
                </div>
                <ClipboardList color="var(--primary)" size={28} />
              </div>
            </div>

            <div className="card" style={{ borderTop: '3px solid #3b82f6', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Conformidade Geral</p>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '8px 0', lineHeight: 1 }}>{stats.conformidade}%</h2>
                  <BarPct pct={stats.conformidade} color="#3b82f6" />
                </div>
                <TrendingUp color="#3b82f6" size={28} />
              </div>
            </div>

            <div className="card" style={{ borderTop: '3px solid var(--error)', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Alertas IA (Falhas)</p>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '8px 0', lineHeight: 1 }}>{stats.alertasIA}</h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--error)' }}>⚠️ {stats.alertasIA > 0 ? 'Ação necessária' : 'Nenhum alerta'}</span>
                </div>
                <ShieldAlert color="var(--error)" size={28} />
              </div>
            </div>

            <div className="card" style={{ borderTop: '3px solid var(--success)', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '8px 0', lineHeight: 1 }}>{stats.colaboradores}</h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>🏬 {userProfile?.store || 'Filial Centro'}</span>
                </div>
                <Users color="var(--success)" size={28} />
              </div>
            </div>
          </>
        )}
        </div>
      )}

      {/* Instalação do App */}
      <PWAInstall />

      {/* ── Card de Cota de Checklists (Admin Only) ─────────────────── */}
      {!isMaster && quotaInfo && !quotaInfo.isUnlimited && tab === 'auditoria' && (
        <div className="card" style={{ padding: '20px', marginBottom: '24px', border: quotaInfo.percentUsed >= 95 ? '2px solid var(--error)' : quotaInfo.percentUsed >= 80 ? '2px solid #f59e0b' : '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={18} color="var(--primary)" />
              <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>Uso do Plano</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-color)', padding: '2px 8px', borderRadius: '12px' }}>
                {quotaInfo.plan === 'starter' || quotaInfo.plan === 'start' ? 'Starter' : quotaInfo.plan === 'pro' || quotaInfo.plan === 'mensal' ? 'Pro' : quotaInfo.plan === 'business' || quotaInfo.plan === 'anual' ? 'Business' : quotaInfo.plan}
              </span>
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: quotaInfo.percentUsed >= 95 ? 'var(--error)' : quotaInfo.percentUsed >= 80 ? '#f59e0b' : 'var(--success)' }}>
              {quotaInfo.used} / {quotaInfo.limit}
            </span>
          </div>
          <div style={{ height: '8px', backgroundColor: 'var(--bg-color)', borderRadius: '100px', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ width: `${Math.min(quotaInfo.percentUsed, 100)}%`, height: '100%', backgroundColor: quotaInfo.percentUsed >= 95 ? 'var(--error)' : quotaInfo.percentUsed >= 80 ? '#f59e0b' : 'var(--primary)', borderRadius: '100px', transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {quotaInfo.percentUsed >= 100 ? '🔴 Cota esgotada!' : quotaInfo.percentUsed >= 80 ? `⚠️ ${quotaInfo.remaining} restantes` : `✅ ${quotaInfo.remaining} checklists restantes`}
              {quotaInfo.resetDate && ` • Renova em ${Math.max(0, Math.ceil((new Date(quotaInfo.resetDate) - new Date()) / (1000*60*60*24)))} dias`}
            </span>
            {quotaInfo.percentUsed >= 80 && (
              <button className="btn" style={{ padding: '6px 16px', fontSize: '0.8rem' }} onClick={() => setShowQuotaUpgradeModal(true)}>
                Fazer Upgrade
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal de Upgrade de Cota */}
      {showQuotaUpgradeModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowQuotaUpgradeModal(false)}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '40px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ backgroundColor: 'rgba(255, 77, 0, 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Flame size={32} color="var(--primary)" />
            </div>
            <h2 style={{ marginBottom: '12px' }}>Hora de crescer! 🚀</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: '1.6' }}>
              Você {quotaInfo?.percentUsed >= 100 ? 'atingiu' : 'está chegando no'} limite do seu plano.
              Faça upgrade para continuar auditando com IA.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(!quotaInfo?.plan || quotaInfo?.plan === 'starter' || quotaInfo?.plan === 'start') && (
                <button className="btn" style={{ padding: '14px', width: '100%' }} onClick={() => window.open(`https://pay.cakto.com.br/e7c88df?email=${encodeURIComponent(userProfile?.email || '')}`, '_blank')}>
                  Upgrade Pro — R$97/mês (600 checklists)
                </button>
              )}
              {(quotaInfo?.plan === 'pro' || quotaInfo?.plan === 'mensal' || quotaInfo?.plan === 'starter' || quotaInfo?.plan === 'start') && (
                <button className={quotaInfo?.plan === 'pro' || quotaInfo?.plan === 'mensal' ? 'btn' : 'btn-secondary'} style={{ padding: '14px', width: '100%' }} onClick={() => window.open(`https://pay.cakto.com.br/iy4399h?email=${encodeURIComponent(userProfile?.email || '')}`, '_blank')}>
                  {quotaInfo?.plan === 'pro' || quotaInfo?.plan === 'mensal' ? 'Upgrade' : ''} Business — R$197/mês (1000 checklists)
                </button>
              )}
              <button className="btn-secondary" style={{ padding: '14px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={() => window.open('https://wa.me/5522998851680?text=Olá,%20preciso%20de%20um%20plano%20Custom%20com%20mais%20checklists%20no%20FireCheck.', '_blank')}>
                💬 Plano Custom (falar no WhatsApp)
              </button>
            </div>
            <button onClick={() => setShowQuotaUpgradeModal(false)} style={{ marginTop: '20px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}>Fechar</button>
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

      {/* ── Tab: Notificações ─────────────────────────────────── */}
      {tab === 'notificacoes' && (
        <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ padding: '0 8px' }}>
             <h2 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
               <Bell color="var(--primary)" size={32} />
               Notificações do Sistema
             </h2>
             <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Gerencie de forma personalizada todos os alertas enviados no WhatsApp e Push.</p>
          </div>

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* Configurações Gerais do WhatsApp */}
              <div className="card" style={{ padding: '24px', flex: 1, minWidth: '320px' }}>
                 <h3 style={{ marginBottom: '16px', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#25D366' }}>
                    📲 Conexão do WhatsApp
                 </h3>
                 <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
                    Defina o número de telefone que receberá os alertas do sistema.
                 </p>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                       <input 
                          type="checkbox" 
                          checked={whatsappActive} 
                          onChange={e => setWhatsappActive(e.target.checked)} 
                          style={{ accentColor: '#25D366', width: '18px', height: '18px', cursor: 'pointer' }}
                       />
                       Habilitar Disparos no WhatsApp
                    </label>
                    <div>
                       <label className="input-label">Telefone de Contato (WhatsApp)</label>
                       <input 
                          type="text" 
                          className="input-field" 
                          placeholder="Ex: 21999999999" 
                          value={whatsappPhone} 
                          onChange={e => setWhatsappPhone(e.target.value)} 
                       />
                       <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px', fontSize: '0.78rem' }}>
                          Preencha com o DDD (ex: 21999999999). Se deixado em branco, o sistema usará o telefone do seu perfil.
                       </small>
                    </div>
                 </div>
              </div>

              {/* Interruptores de Notificações */}
              <div className="card" style={{ padding: '24px', flex: 1.5, minWidth: '350px' }}>
                 <h3 style={{ marginBottom: '16px', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ⚙️ Alertas de Notificação Personalizados
                 </h3>
                 <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
                    Marque as opções abaixo para receber alertas em tempo real das operações selecionadas.
                 </p>
                 
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                       <input 
                          type="checkbox" 
                          checked={waPontoAtraso} 
                          onChange={e => setWaPontoAtraso(e.target.checked)} 
                          style={{ width: '20px', height: '20px', cursor: 'pointer', marginTop: '3px' }}
                          id="opt-ponto-atraso"
                       />
                       <label htmlFor="opt-ponto-atraso" style={{ cursor: 'pointer' }}>
                          <strong style={{ display: 'block', fontSize: '0.95rem' }}>⏰ Atrasos de Colaborador (Ponto)</strong>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Receber notificações quando um funcionário registrar entrada ou saída após o horário de tolerância configurado.</span>
                       </label>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                       <input 
                          type="checkbox" 
                          checked={waChecklistReprovado} 
                          onChange={e => setWaChecklistReprovado(e.target.checked)} 
                          style={{ width: '20px', height: '20px', cursor: 'pointer', marginTop: '3px' }}
                          id="opt-checklist-reprovado"
                       />
                       <label htmlFor="opt-checklist-reprovado" style={{ cursor: 'pointer' }}>
                          <strong style={{ display: 'block', fontSize: '0.95rem' }}>⚠️ Checklist com Irregularidades (Reprovado)</strong>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Notificar imediatamente quando um colaborador finalizar um checklist que contenha alertas de falha ou irregularidades.</span>
                       </label>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                       <input 
                          type="checkbox" 
                          checked={waChecklistAprovado} 
                          onChange={e => setWaChecklistAprovado(e.target.checked)} 
                          style={{ width: '20px', height: '20px', cursor: 'pointer', marginTop: '3px' }}
                          id="opt-checklist-aprovado"
                       />
                       <label htmlFor="opt-checklist-aprovado" style={{ cursor: 'pointer' }}>
                          <strong style={{ display: 'block', fontSize: '0.95rem' }}>✅ Checklist Concluído com Sucesso</strong>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Receber notificação quando um colaborador finalizar um checklist sem nenhuma irregularidade detectada.</span>
                       </label>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                       <input 
                          type="checkbox" 
                          checked={waChecklistAtrasado} 
                          onChange={e => setWaChecklistAtrasado(e.target.checked)} 
                          style={{ width: '20px', height: '20px', cursor: 'pointer', marginTop: '3px' }}
                          id="opt-checklist-atrasado"
                       />
                       <label htmlFor="opt-checklist-atrasado" style={{ cursor: 'pointer' }}>
                          <strong style={{ display: 'block', fontSize: '0.95rem' }}>📅 Checklist Pendente/Atrasado</strong>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Alertar caso o horário de checklist programado da loja seja ultrapassado e ninguém tenha preenchido o checklist correspondente.</span>
                       </label>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                       <input 
                          type="checkbox" 
                          checked={waPontoDiario} 
                          onChange={e => setWaPontoDiario(e.target.checked)} 
                          style={{ width: '20px', height: '20px', cursor: 'pointer', marginTop: '3px' }}
                          id="opt-ponto-diario"
                       />
                       <label htmlFor="opt-ponto-diario" style={{ cursor: 'pointer' }}>
                          <strong style={{ display: 'block', fontSize: '0.95rem' }}>📊 Fechamento Diário de Ponto</strong>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Receber no final de cada dia de expediente um resumo de fechamento contendo a folha de ponto consolidada da loja.</span>
                       </label>
                    </div>
                 </div>

                 <button className="btn" style={{ width: '100%', padding: '12px', borderRadius: '8px', fontSize: '1rem' }} onClick={handleSaveWhatsappConfig}>
                    Salvar Configurações de Notificações
                 </button>
              </div>
          </div>
        </div>
      )}

      {/* ── Tab: Paywall Módulo Ponto ──────────────────── */}
      {(tab === 'ponto' && !userProfile?.ponto_active && userProfile?.status !== 'trial' && userProfile?.email !== 'dugaburguer@gmail.com') && (
        <div className="card animate-fade" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '24px', borderRadius: '50%', marginBottom: '24px' }}>
            <UserCheck size={48} color="#3b82f6" />
          </div>
          <h2 style={{ fontSize: '2rem', marginBottom: '16px' }}>
            Módulo: Controle de Ponto com IA
          </h2>
          <div style={{ textAlign: 'left', marginBottom: '32px', maxWidth: '500px', width: '100%' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '20px', textAlign: 'center' }}>
                Reconhecimento facial, geolocalização e relatórios automáticos. Diga adeus às fraudes de ponto na sua empresa.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <CheckCircle size={20} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '1rem', color: 'var(--text-main)' }}><strong>Reconhecimento Facial:</strong> Selfie obrigatória para evitar fraudes.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <CheckCircle size={20} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '1rem', color: 'var(--text-main)' }}><strong>Trava de GPS:</strong> O funcionário só bate o ponto se estiver no local de trabalho.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <CheckCircle size={20} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '1rem', color: 'var(--text-main)' }}><strong>Cálculo Automático:</strong> Horas extras, atrasos e faltas já mastigados.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <CheckCircle size={20} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '1rem', color: 'var(--text-main)' }}><strong>Exportação Simples:</strong> Relatório em PDF/Excel pronto para a contabilidade.</span>
                </li>
              </ul>
            </div>

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '24px' }}>
            <div className="card" style={{ width: '280px', padding: '24px', border: '1px solid var(--border-color)', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Ponto Starter</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Ideal para equipes pequenas em crescimento.</p>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '8px' }}>R$67<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/mês</span></div>
                <div style={{ fontSize: '0.9rem', marginBottom: '24px', color: 'var(--text-color)' }}>
                  • Até <strong>5 colaboradores</strong><br/>
                  • Reconhecimento facial<br/>
                  • Trava de GPS integrada
                </div>
              </div>
              <button className="btn-secondary" style={{ width: '100%', padding: '12px' }} onClick={() => window.open(`https://pay.cakto.com.br/kfx3fri_869702?email=${encodeURIComponent(userProfile?.email || '')}&name=${encodeURIComponent(userProfile?.name || '')}`, '_blank')}>
                Assinar Starter
              </button>
            </div>

            <div className="card" style={{ width: '280px', padding: '24px', border: '2px solid var(--primary)', transform: 'scale(1.05)', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--primary)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', color: 'white' }}>MAIS POPULAR</div>
              <div>
                <h3 style={{ fontSize: '1.4rem', marginBottom: '8px', color: 'var(--primary)' }}>Ponto Pro</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Perfeito para médias empresas estruturadas.</p>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '8px' }}>R$97<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/mês</span></div>
                <div style={{ fontSize: '0.9rem', marginBottom: '24px', color: 'var(--text-color)' }}>
                  • Até <strong>15 colaboradores</strong><br/>
                  • Reconhecimento facial<br/>
                  • Trava de GPS integrada<br/>
                  • Automação de folhas
                </div>
              </div>
              <button className="btn" style={{ width: '100%', padding: '12px' }} onClick={() => window.open(`https://pay.cakto.com.br/otm7qgn?email=${encodeURIComponent(userProfile?.email || '')}&name=${encodeURIComponent(userProfile?.name || '')}`, '_blank')}>
                Assinar Pro
              </button>
            </div>

            <div className="card" style={{ width: '280px', padding: '24px', border: '1px solid var(--border-color)', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Ponto Business</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Completo para grandes equipes de varejo.</p>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '8px' }}>R$197<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/mês</span></div>
                <div style={{ fontSize: '0.9rem', marginBottom: '24px', color: 'var(--text-color)' }}>
                  • Até <strong>50 colaboradores</strong><br/>
                  • Reconhecimento facial<br/>
                  • Trava de GPS integrada<br/>
                  • Suporte prioritário
                </div>
              </div>
              <button className="btn-secondary" style={{ width: '100%', padding: '12px' }} onClick={() => window.open(`https://pay.cakto.com.br/o2xichf?email=${encodeURIComponent(userProfile?.email || '')}&name=${encodeURIComponent(userProfile?.name || '')}`, '_blank')}>
                Assinar Business
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs: Módulo Ponto (Ativo) ──────────────────── */}
      {/* ── Tabs: Módulo Ponto (Ativo) ──────────────────── */}
      {(tab === 'ponto' && (userProfile?.ponto_active || userProfile?.status === 'trial' || userProfile?.email === 'dugaburguer@gmail.com')) && (
        <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ padding: '0 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
             <div>
               <h2 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                 <Clock color="var(--primary)" size={32} />
                 Controle de Ponto IA
               </h2>
               <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Reconhecimento Facial, GPS e Automação Contábil.</p>
             </div>
             <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="input-field" style={{ padding: '8px 12px', minWidth: '150px', borderRadius: '8px' }} value={pontoExportPeriod} onChange={e => setPontoExportPeriod(e.target.value)}>
                   <option value="mes_atual">Mês Atual</option>
                   <option value="mes_anterior">Mês Anterior</option>
                   <option value="personalizado">Datas Personalizadas</option>
                </select>
                {pontoExportPeriod === 'personalizado' && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="date" className="input-field" style={{ padding: '8px 12px', borderRadius: '8px' }} value={pontoCustomDates.start} onChange={e => setPontoCustomDates({...pontoCustomDates, start: e.target.value})} />
                    <span style={{ color: 'var(--text-muted)' }}>até</span>
                    <input type="date" className="input-field" style={{ padding: '8px 12px', borderRadius: '8px' }} value={pontoCustomDates.end} onChange={e => setPontoCustomDates({...pontoCustomDates, end: e.target.value})} />
                  </div>
                )}
                <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px' }} onClick={() => window.open(`${API_URL}/api/ponto/export?store=${encodeURIComponent(userProfile?.store)}&month=${pontoMonth}`, '_blank')}>
                   <FileDown size={18} /> Exportar Folha
                </button>
             </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
             
             {/* Horários e Tolerância do Ponto */}
             <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6' }}>
                   ⏰ Horários e Tolerância
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
                   Defina o horário de trabalho e a tolerância de atraso. Se o funcionário registrar entrada após o horário + tolerância, você receberá uma notificação.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                         <label className="input-label">Entrada</label>
                         <input type="time" className="input-field" value={pontoHoraEntrada} onChange={e => setPontoHoraEntrada(e.target.value)} />
                      </div>
                      <div>
                         <label className="input-label">Saída</label>
                         <input type="time" className="input-field" value={pontoHoraSaida} onChange={e => setPontoHoraSaida(e.target.value)} />
                      </div>
                   </div>
                   <div>
                      <label className="input-label">Tolerância de Atraso</label>
                      <select className="input-field" value={pontoTolerancia} onChange={e => setPontoTolerancia(Number(e.target.value))}>
                         <option value={0}>Sem tolerância</option>
                         <option value={5}>5 minutos</option>
                         <option value={10}>10 minutos</option>
                         <option value={15}>15 minutos</option>
                         <option value={20}>20 minutos</option>
                         <option value={30}>30 minutos</option>
                         <option value={60}>1 hora</option>
                      </select>
                   </div>
                   <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.06)', borderRadius: '10px', padding: '12px 16px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                         📲 Se o funcionário bater ponto após <strong>{pontoHoraEntrada}</strong> + <strong>{pontoTolerancia}min</strong>, você receberá uma notificação push no celular.
                      </p>
                   </div>
                </div>
             </div>

             {/* Automação Contábil + Timezone */}
             <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                   <Mail size={20} /> Automação Contábil
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
                   Configure para enviar a folha de ponto detalhada direto para o e-mail do seu contador todo mês.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                   <div>
                      <label className="input-label">E-mail do Contador</label>
                      <input type="email" className="input-field" placeholder="contabilidade@empresa.com.br" value={contadorEmail} onChange={e => setContadorEmail(e.target.value)} />
                   </div>
                   <div>
                      <label className="input-label">Data de Fechamento (Envio Automático)</label>
                      <select className="input-field" value={fechamentoDia} onChange={e => setFechamentoDia(e.target.value)}>
                         <option value="ultimo_dia">Último dia do Mês</option>
                         <option value="dia_1">Todo Dia 1</option>
                         <option value="dia_5">Todo Dia 5</option>
                         <option value="dia_10">Todo Dia 10</option>
                      </select>
                   </div>
                   <div>
                      <label className="input-label">Fuso Horário</label>
                      <select className="input-field" value={pontoTimezone} onChange={e => setPontoTimezone(e.target.value)}>
                         <option value="America/Sao_Paulo">Brasília, SP, RJ, MG, Sul (BRT)</option>
                         <option value="America/Manaus">Manaus, MT, MS (AMT)</option>
                         <option value="America/Rio_Branco">Acre (ACT)</option>
                         <option value="America/Noronha">Fernando de Noronha (FNT)</option>
                      </select>
                   </div>
                   <div>
                      <label className="input-label">Mês de Referência</label>
                      <input type="month" className="input-field" value={pontoMonth} onChange={e => setPontoMonth(e.target.value)} />
                   </div>
                   <button className="btn-secondary" onClick={handleSavePontoConfig} style={{ width: '100%', padding: '12px', borderRadius: '8px' }}>Salvar Configuração</button>
                </div>
             </div>

             {/* Botão Verificar Registros */}
             <div className="card" style={{ padding: '20px', textAlign: 'center', cursor: 'pointer', border: '2px dashed var(--primary)', backgroundColor: 'rgba(255, 77, 0, 0.03)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowPontoPanel(true)}>
                <UserCheck size={36} color="var(--primary)" style={{ marginBottom: '8px' }}/>
                <h3 style={{ margin: '0 0 4px 0', color: 'var(--primary)' }}>Verificar Registros de Ponto</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>{pontoRecords.length} registro(s) em {pontoMonth} — Clique para ver selfies, filtrar por funcionário e exportar</p>
             </div>
          </div>

          {/* ── Painel de Verificação de Ponto ── */}
          {showPontoPanel && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserCheck size={22} color="var(--primary)"/> Verificação de Registros de Ponto
                </h3>
                <button onClick={() => setShowPontoPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20}/></button>
              </div>

              {/* Filtros e Ações */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: 'var(--bg-main)', padding: '12px 16px', borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} color="var(--text-muted)"/>
                  <select className="input-field" style={{ padding: '8px 12px', borderRadius: '8px', minWidth: '180px' }} value={pontoFilterEmployee} onChange={e => setPontoFilterEmployee(e.target.value)}>
                    <option value="todos">Todos os funcionários</option>
                    {[...new Set(pontoRecords.map(r => r.user_name).filter(Boolean))].sort().map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {(pontoFilterEmployee === 'todos' ? pontoRecords : pontoRecords.filter(r => r.user_name === pontoFilterEmployee)).length} registro(s)
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button className="btn-secondary" style={{ padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => setShowPontoManualModal(true)}>
                    <Plus size={16} color="var(--primary)"/> Lançar Ponto Manual
                  </button>
                  <button className="btn" style={{ padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => window.open(`${API_URL}/api/ponto/export?store=${encodeURIComponent(userProfile?.store)}&month=${pontoMonth}`, '_blank')}>
                    <FileDown size={16}/> Exportar Folha
                  </button>
                </div>
              </div>

              {/* Grid de registros com selfies e ações */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '600px', overflowY: 'auto' }}>
                {(() => {
                  const filtered = pontoFilterEmployee === 'todos' ? pontoRecords : pontoRecords.filter(r => r.user_name === pontoFilterEmployee);
                  if (filtered.length === 0) return (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum registro encontrado.</div>
                  );
                  return filtered.map((rec, idx) => {
                    const dt = new Date(rec.timestamp);
                    const dataStr = dt.toLocaleDateString('pt-BR', { timeZone: pontoTimezone });
                    const horaStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: pontoTimezone });
                    const isEntrada = rec.type === 'entrada';
                    return (
                      <div key={rec.id || idx} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', borderRadius: '10px', backgroundColor: idx % 2 === 0 ? 'var(--bg-main)' : 'var(--bg-card)', border: '1px solid var(--border-color)', transition: 'all 0.2s' }}>
                        {/* Selfie */}
                        <div style={{ width: '52px', height: '52px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: `3px solid ${isEntrada ? '#22c55e' : '#ef4444'}`, cursor: rec.selfie_url ? 'pointer' : 'default', backgroundColor: '#f1f5f9' }}
                          onClick={() => rec.selfie_url && setPontoPhotoPreview(rec.selfie_url)}>
                          {rec.selfie_url ? (
                            <img src={rec.selfie_url} alt="Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}><Camera size={20}/></div>
                          )}
                        </div>
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 'bold', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {rec.user_name || '—'}
                            {rec.is_manual && (
                              <span style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#ca8a04', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 'bold' }}>
                                ✏️ Ajuste Manual
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '2px' }}>
                            <span>📅 {dataStr}</span>
                            <span>🕐 {horaStr}</span>
                            {rec.address && <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {rec.address}</span>}
                          </div>
                          {rec.notes && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '3px' }}>
                              📝 Justificativa: {rec.notes}
                            </div>
                          )}
                        </div>
                        {/* Badge tipo */}
                        <span style={{ backgroundColor: isEntrada ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: isEntrada ? '#22c55e' : '#ef4444', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', flexShrink: 0 }}>
                          {rec.type || '—'}
                        </span>
                        {/* Ações de Edição e Exclusão */}
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button onClick={() => {
                            const dtLocal = new Date(rec.timestamp);
                            const dStr = dtLocal.toISOString().slice(0, 10);
                            const tStr = dtLocal.toTimeString().slice(0, 5);
                            setEditingPontoRecord({
                              id: rec.id,
                              type: rec.type || 'entrada',
                              date: dStr,
                              time: tStr,
                              notes: rec.notes || ''
                            });
                          }} title="Editar Ponto" style={{ padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', color: 'var(--text-main)' }}>
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => handleDeletePontoRecord(rec.id)} title="Excluir Ponto" style={{ padding: '6px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', cursor: 'pointer', color: '#ef4444' }}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Preview de foto */}
          {pontoPhotoPreview && (
            <div className="modal-overlay animate-fade" onClick={() => setPontoPhotoPreview(null)} style={{ zIndex: 10000 }}>
              <div style={{ maxWidth: '500px', maxHeight: '80vh', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                <img src={pontoPhotoPreview} alt="Selfie do Ponto" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
              </div>
            </div>
          )}

          {/* ── Modal de Lançamento Manual de Ponto ── */}
          {showPontoManualModal && (
            <div className="modal-overlay animate-fade" style={{ zIndex: 10000 }} onClick={() => setShowPontoManualModal(false)}>
              <div className="card" style={{ maxWidth: '500px', width: '90%', padding: '24px', borderRadius: '16px' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                    <Clock size={20}/> Lançar Ponto Manual (Gestor)
                  </h3>
                  <button onClick={() => setShowPontoManualModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20}/></button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label className="input-label">Funcionário *</label>
                    <select className="input-field" value={pontoManualForm.userId} onChange={e => setPontoManualForm({...pontoManualForm, userId: e.target.value})}>
                      <option value="">Selecione o colaborador...</option>
                      {(users || []).map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role || 'Funcionário'})</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="input-label">Tipo de Batida *</label>
                      <select className="input-field" value={pontoManualForm.type} onChange={e => setPontoManualForm({...pontoManualForm, type: e.target.value})}>
                        <option value="entrada">📥 Entrada</option>
                        <option value="saida">📤 Saída</option>
                      </select>
                    </div>
                    <div>
                      <label className="input-label">Horário *</label>
                      <input type="time" className="input-field" value={pontoManualForm.time} onChange={e => setPontoManualForm({...pontoManualForm, time: e.target.value})} />
                    </div>
                  </div>

                  <div>
                    <label className="input-label">Data *</label>
                    <input type="date" className="input-field" value={pontoManualForm.date} onChange={e => setPontoManualForm({...pontoManualForm, date: e.target.value})} />
                  </div>

                  <div>
                    <label className="input-label">Motivo / Justificativa (Obrigatório)</label>
                    <input type="text" className="input-field" placeholder="Ex: Esqueceu de bater ponto / Atestado médico" value={pontoManualForm.notes} onChange={e => setPontoManualForm({...pontoManualForm, notes: e.target.value})} />
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                    <button className="btn-secondary" style={{ flex: 1, padding: '10px' }} onClick={() => setShowPontoManualModal(false)}>Cancelar</button>
                    <button className="btn" style={{ flex: 1, padding: '10px' }} disabled={pontoSubmitting} onClick={handleSavePontoManual}>
                      {pontoSubmitting ? 'Salvando...' : 'Salvar Ponto'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Modal de Edição de Ponto ── */}
          {editingPontoRecord && (
            <div className="modal-overlay animate-fade" style={{ zIndex: 10000 }} onClick={() => setEditingPontoRecord(null)}>
              <div className="card" style={{ maxWidth: '500px', width: '90%', padding: '24px', borderRadius: '16px' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                    <Edit2 size={20}/> Editar Ponto
                  </h3>
                  <button onClick={() => setEditingPontoRecord(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20}/></button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="input-label">Tipo de Batida</label>
                      <select className="input-field" value={editingPontoRecord.type} onChange={e => setEditingPontoRecord({...editingPontoRecord, type: e.target.value})}>
                        <option value="entrada">📥 Entrada</option>
                        <option value="saida">📤 Saída</option>
                      </select>
                    </div>
                    <div>
                      <label className="input-label">Horário</label>
                      <input type="time" className="input-field" value={editingPontoRecord.time} onChange={e => setEditingPontoRecord({...editingPontoRecord, time: e.target.value})} />
                    </div>
                  </div>

                  <div>
                    <label className="input-label">Data</label>
                    <input type="date" className="input-field" value={editingPontoRecord.date} onChange={e => setEditingPontoRecord({...editingPontoRecord, date: e.target.value})} />
                  </div>

                  <div>
                    <label className="input-label">Justificativa da Alteração</label>
                    <input type="text" className="input-field" placeholder="Ex: Ajuste de horário autorizado pelo gestor" value={editingPontoRecord.notes} onChange={e => setEditingPontoRecord({...editingPontoRecord, notes: e.target.value})} />
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                    <button className="btn-secondary" style={{ flex: 1, padding: '10px' }} onClick={() => setEditingPontoRecord(null)}>Cancelar</button>
                    <button className="btn" style={{ flex: 1, padding: '10px' }} disabled={pontoSubmitting} onClick={handleUpdatePontoRecord}>
                      {pontoSubmitting ? 'Salvando...' : 'Salvar Alteração'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* ── Tab: Auditoria em Tempo Real ─────────────────────────────────── */}
      {tab === 'auditoria' && (
        <div className="card" style={{ padding: '0' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Activity size={20} color="var(--primary)" /> Auditoria em Tempo Real
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Filtrar Categoria:</label>
              <select 
                value={categoryFilter} 
                onChange={e => setCategoryFilter(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-color)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              >
                <option value="todos">Todos os Segmentos</option>
                <option value="geral">Geral / Padrão</option>
                <option value="loja">Loja / Varejo</option>
                <option value="restaurante">Restaurante / Alimentação</option>
                <option value="consultorio">Consultório / Clínicas</option>
                <option value="veiculo">Frota / Veicular</option>
              </select>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Últimas 24h</span>
            </div>
          </div>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(() => {
              const filteredSubmissions = submissions.filter(s => {
                if (categoryFilter === 'todos') return true;
                const cl = checklists?.find(c => c.id === s.checklist_id);
                return cl && cl.category === categoryFilter;
              });

              return filteredSubmissions.length > 0 ? filteredSubmissions.map(s => {
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
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'var(--bg-color)', borderRadius: '10px', gap: '12px', flexWrap: 'wrap', cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = 'transparent'}
                  >
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1, minWidth: '250px' }}>
                      {s.selfie && <img src={s.selfie} alt="Selfie" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }} />}
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '1rem', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {checklists?.find(c => c.id === s.checklist_id)?.title || 'Checklist Concluído'}
                          {checklists?.find(c => c.id === s.checklist_id)?.category === 'veiculo' && (
                            <span style={{ fontSize: '0.7rem', padding: '2px 6px', backgroundColor: 'rgba(255, 69, 0, 0.1)', color: 'var(--primary)', borderRadius: '4px', fontWeight: 'bold' }}>
                              🚗 Veicular
                            </span>
                          )}
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
                  <p>Nenhuma auditoria realizada no período para esta categoria.</p>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Tab: Ranking de Funcionários ─────────────────────────────────── */}
      {tab === 'ranking' && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          {/* Header e Filtros */}
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Trophy size={22} color="#f59e0b" /> Ranking de Performance da Equipe
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', marginBottom: 0 }}>
                Métricas de conformidade e auditorias dos colaboradores
              </p>
            </div>
            
            {/* Filtros de Período */}
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-main)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button 
                onClick={() => setRankingPeriod('hoje')} 
                style={{ border: 'none', padding: '6px 16px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: rankingPeriod === 'hoje' ? 'var(--primary)' : 'transparent', color: rankingPeriod === 'hoje' ? 'white' : 'var(--text-muted)' }}
              >
                Hoje
              </button>
              <button 
                onClick={() => setRankingPeriod('semana')} 
                style={{ border: 'none', padding: '6px 16px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: rankingPeriod === 'semana' ? 'var(--primary)' : 'transparent', color: rankingPeriod === 'semana' ? 'white' : 'var(--text-muted)' }}
              >
                Semana
              </button>
              <button 
                onClick={() => setRankingPeriod('mes')} 
                style={{ border: 'none', padding: '6px 16px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: rankingPeriod === 'mes' ? 'var(--primary)' : 'transparent', color: rankingPeriod === 'mes' ? 'white' : 'var(--text-muted)' }}
              >
                Mês
              </button>
              <button 
                onClick={() => setRankingPeriod('personalizado')} 
                style={{ border: 'none', padding: '6px 16px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: rankingPeriod === 'personalizado' ? 'var(--primary)' : 'transparent', color: rankingPeriod === 'personalizado' ? 'white' : 'var(--text-muted)' }}
              >
                Personalizado
              </button>
            </div>
          </div>

          {/* Seletores Personalizados */}
          {rankingPeriod === 'personalizado' && (
            <div style={{ padding: '12px 24px 20px 24px', backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>De:</span>
                <input 
                  type="date" 
                  value={rankingCustomDates.start} 
                  onChange={(e) => setRankingCustomDates({ ...rankingCustomDates, start: e.target.value })} 
                  className="input-field" 
                  style={{ width: '150px', padding: '6px 10px', fontSize: '0.85rem', margin: 0 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Até:</span>
                <input 
                  type="date" 
                  value={rankingCustomDates.end} 
                  onChange={(e) => setRankingCustomDates({ ...rankingCustomDates, end: e.target.value })} 
                  className="input-field" 
                  style={{ width: '150px', padding: '6px 10px', fontSize: '0.85rem', margin: 0 }}
                />
              </div>
            </div>
          )}

          {/* Dados Calculados */}
          {(() => {
            const now = new Date();
            const filteredSubmissions = submissions.filter(sub => {
              const subDate = new Date(sub.created_at);
              if (rankingPeriod === 'hoje') {
                return subDate.toDateString() === now.toDateString();
              } else if (rankingPeriod === 'semana') {
                const diffTime = Math.abs(now - subDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays <= 7;
              } else if (rankingPeriod === 'mes') {
                return subDate.getMonth() === now.getMonth() && subDate.getFullYear() === now.getFullYear();
              } else if (rankingPeriod === 'personalizado') {
                const startLimit = rankingCustomDates.start ? new Date(rankingCustomDates.start + 'T00:00:00') : null;
                const endLimit = rankingCustomDates.end ? new Date(rankingCustomDates.end + 'T23:59:59') : null;
                if (startLimit && subDate < startLimit) return false;
                if (endLimit && subDate > endLimit) return false;
                return true;
              }
              return true;
            });

            let totalTasksCompleted = 0;
            let totalTasksPossible = 0;

            const rankingData = filteredSubmissions.reduce((acc, sub) => {
              const name = sub.employee_name;
              const completed = sub.tasks?.filter(t => t.done)?.length || 0;
              const total = sub.tasks?.length || 1;
              if (!acc[name]) acc[name] = { name, totalCompleted: 0, totalPossible: 0 };
              acc[name].totalCompleted += completed;
              acc[name].totalPossible += total;
              
              totalTasksCompleted += completed;
              totalTasksPossible += total;
              return acc;
            }, {});

            const teamEfficiency = totalTasksPossible > 0 ? Math.round((totalTasksCompleted / totalTasksPossible) * 100) : 0;

            const sortedRanking = Object.values(rankingData)
              .map(r => ({
                nome: r.name,
                pct: Math.round((r.totalCompleted / r.totalPossible) * 100),
                concluidos: r.totalCompleted,
                total: r.totalPossible
              }))
              .sort((a, b) => b.pct - a.pct)
              .map((r, idx) => ({ ...r, pos: idx + 1 }));

            if (sortedRanking.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
                  <Trophy size={48} color="var(--border-color)" style={{ marginBottom: '16px' }} />
                  <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: '500' }}>Nenhum checklist auditado neste período.</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>Os dados do ranking aparecerão assim que os funcionários realizarem submissões.</p>
                </div>
              );
            }

            return (
              <div>
                {/* Banner de Estatísticas da Equipe */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', padding: '24px 24px 12px 24px' }}>
                  <div style={{ backgroundColor: 'var(--bg-main)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tarefas Concluídas</span>
                    <h4 style={{ margin: '8px 0 4px 0', fontSize: '2rem', color: 'var(--text-main)', fontWeight: '800' }}>{totalTasksCompleted}</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>acumulado do período</span>
                  </div>
                  
                  <div style={{ backgroundColor: 'var(--bg-main)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Média de Conformidade</span>
                    <h4 style={{ margin: '8px 0 4px 0', fontSize: '2rem', color: teamEfficiency >= 90 ? 'var(--success)' : teamEfficiency >= 70 ? '#f59e0b' : 'var(--error)', fontWeight: '800' }}>{teamEfficiency}%</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>auditoria geral da equipe</span>
                  </div>

                  <div style={{ backgroundColor: 'var(--bg-main)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Líder do Ranking</span>
                    <h4 style={{ margin: '8px 0 4px 0', fontSize: '1.2rem', color: 'var(--primary)', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px', textAlign: 'center' }}>
                      👑 {sortedRanking[0].nome}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 'bold' }}>{sortedRanking[0].pct}% de acertos</span>
                  </div>
                </div>

                {/* Visualização de Pódio (Top 3) */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '12px', margin: '32px auto 24px auto', padding: '0 24px', maxWidth: '500px', flexWrap: 'nowrap' }}>
                  {/* 2º Lugar */}
                  {sortedRanking[1] && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '110px' }}>
                      <div style={{ position: 'relative', marginBottom: '8px' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', border: '2px solid #94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                          {sortedRanking[1].nome.substring(0, 2).toUpperCase()}
                        </div>
                        <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', backgroundColor: '#94a3b8', color: '#1e293b', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>🥈</div>
                      </div>
                      <span style={{ fontWeight: '600', fontSize: '0.8rem', color: 'var(--text-main)', textAlign: 'center', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sortedRanking[1].nome}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)' }}>{sortedRanking[1].pct}%</span>
                      <div style={{ height: '60px', width: '70px', background: 'linear-gradient(to top, rgba(148,163,184,0.1), rgba(148,163,184,0.01))', border: '1px solid rgba(148,163,184,0.2)', borderBottom: 'none', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '12px' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#94a3b8' }}>2º</span>
                      </div>
                    </div>
                  )}

                  {/* 1º Lugar */}
                  {sortedRanking[0] && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '130px', zIndex: 2 }}>
                      <div style={{ position: 'relative', marginBottom: '8px' }}>
                        <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'linear-gradient(135deg, #fef08a, #fbbf24)', border: '3px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 'bold', color: '#78350f', boxShadow: '0 6px 20px rgba(245,158,11,0.25)' }}>
                          {sortedRanking[0].nome.substring(0, 2).toUpperCase()}
                        </div>
                        <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%) rotate(-5deg)', fontSize: '1.3rem' }}>👑</div>
                        <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', backgroundColor: '#fbbf24', color: '#78350f', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>🥇</div>
                      </div>
                      <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-main)', textAlign: 'center', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sortedRanking[0].nome}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--success)' }}>{sortedRanking[0].pct}%</span>
                      <div style={{ height: '90px', width: '80px', background: 'linear-gradient(to top, rgba(245,158,11,0.15), rgba(245,158,11,0.02))', border: '2px solid rgba(245,158,11,0.25)', borderBottom: 'none', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '12px' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fbbf24' }}>1º</span>
                      </div>
                    </div>
                  )}

                  {/* 3º Lugar */}
                  {sortedRanking[2] && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '110px' }}>
                      <div style={{ position: 'relative', marginBottom: '8px' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', border: '2px solid #ca8a04', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                          {sortedRanking[2].nome.substring(0, 2).toUpperCase()}
                        </div>
                        <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', backgroundColor: '#ca8a04', color: '#fef08a', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>🥉</div>
                      </div>
                      <span style={{ fontWeight: '600', fontSize: '0.8rem', color: 'var(--text-main)', textAlign: 'center', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sortedRanking[2].nome}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)' }}>{sortedRanking[2].pct}%</span>
                      <div style={{ height: '45px', width: '70px', background: 'linear-gradient(to top, rgba(202,138,4,0.1), rgba(202,138,4,0.01))', border: '1px solid rgba(202,138,4,0.2)', borderBottom: 'none', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '12px' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#ca8a04' }}>3º</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Lista Completa e Detalhada dos Colaboradores */}
                <div style={{ padding: '0 24px 24px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {sortedRanking.map(r => {
                    const badgeColor = r.pct >= 90 ? 'var(--success)' : r.pct >= 70 ? '#f59e0b' : 'var(--error)';
                    const badgeText = r.pct >= 90 ? '🔥 Super Produtivo' : r.pct >= 70 ? '🏃 Em Evolução' : '⚠️ Precisa Atenção';
                    const isTop3 = r.pos <= 3;
                    
                    return (
                      <div 
                        key={r.pos} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '16px', 
                          padding: '16px', 
                          backgroundColor: 'var(--bg-main)', 
                          borderRadius: '12px',
                          border: isTop3 ? `1px solid ${badgeColor}25` : '1px solid var(--border-color)',
                          boxShadow: isTop3 ? `0 4px 12px ${badgeColor}04` : 'none',
                          transition: 'transform 0.2s',
                          cursor: 'default'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; }}
                      >
                        {/* Posição */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.03)', fontWeight: 'bold', fontSize: '0.95rem' }}>
                          {r.pos === 1 ? '🥇' : r.pos === 2 ? '🥈' : r.pos === 3 ? '🥉' : `#${r.pos}`}
                        </div>

                        {/* Foto/Avatar */}
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                          {r.nome.substring(0, 2).toUpperCase()}
                        </div>

                        {/* Informações */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                            <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nome}</span>
                            <span style={{ fontWeight: '800', fontSize: '0.95rem', color: badgeColor }}>{r.pct}%</span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <BarPct pct={r.pct} color={badgeColor} />
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0, fontWeight: '500' }}>
                              {r.concluidos}/{r.total} tarefas
                            </span>
                          </div>
                        </div>

                        {/* Badges de Destaque */}
                        <div style={{ display: 'none', mdDisplay: 'block' }}>
                          <span style={{ backgroundColor: `${badgeColor}15`, color: badgeColor, border: `1px solid ${badgeColor}30`, padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                            {badgeText}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Tab: Landing Page Analytics ─────────────────────────────────────── */}
      {tab === 'quiz' && (
        <div className="card" style={{ padding: '0' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={20} color="var(--primary)" /> Visitantes na Landing Page
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>Monitore quem está no seu site principal e quanto tempo ficaram.</p>
            </div>
            {(() => {
              const landingStats = quizStats.filter(q => q.last_step === 0);
              const total = landingStats.length;
              
              // Calculate average time overall
              let totalDurationSec = 0;
              let validDurations = 0;
              landingStats.forEach(q => {
                const start = new Date(q.created_at_local || q.created_at);
                const end = new Date(q.last_updated_at_local || q.last_updated_at);
                const diff = Math.floor((end - start) / 1000);
                if (diff >= 0 && diff < 86400) { // filter out absurd times
                  totalDurationSec += diff;
                  validDurations++;
                }
              });
              const avgDuration = validDurations > 0 ? Math.floor(totalDurationSec / validDurations) : 0;
              const avgMin = Math.floor(avgDuration / 60);
              const avgSec = avgDuration % 60;
              
              const hoje = landingStats.filter(q => {
                const qDate = new Date(q.created_at_local || q.created_at).toDateString();
                const todayDate = new Date().toDateString();
                return qDate === todayDate;
              }).length;
              
              const onlineNow = landingStats.filter(q => (new Date() - new Date(q.last_updated_at_local || q.last_updated_at)) < 60000).length;

              return (
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                      <div style={{ width: '8px', height: '8px', backgroundColor: '#3b82f6', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
                      {onlineNow}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#3b82f6' }}>Online Agora</div>
                  </div>
                  <div style={{ textAlign: 'center', backgroundColor: 'var(--bg-card)', padding: '10px 20px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{hoje}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Acessos Hoje</div>
                  </div>
                  <div style={{ textAlign: 'center', backgroundColor: 'rgba(0, 200, 83, 0.1)', padding: '10px 20px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--success)' }}>
                      {avgMin}m {avgSec}s
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Tempo Médio Total</div>
                  </div>
                </div>
              );
            })()}
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                  <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Data/IP</th>
                  <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status</th>
                  <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Botão Clicado</th>
                  <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tempo na Página</th>
                </tr>
              </thead>
              <tbody>
                {quizStats.filter(q => q.last_step === 0).map(q => {
                  const isOnline = (new Date() - new Date(q.last_updated_at_local || q.last_updated_at)) < 60000;
                  const start = new Date(q.created_at_local || q.created_at);
                  const end = new Date(q.last_updated_at_local || q.last_updated_at);
                  const diffSec = Math.max(0, Math.floor((end - start) / 1000));
                  const min = Math.floor(diffSec / 60);
                  const sec = diffSec % 60;
                  
                  return (
                  <tr key={q.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '16px 24px', verticalAlign: 'middle' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{new Date(start).toLocaleString('pt-BR')}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        IP: {q.ip}
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', verticalAlign: 'middle' }}>
                      {isOnline ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)' }} title="Online na página"></div>
                          <span style={{ fontSize: '0.85rem', color: '#22c55e', fontWeight: 'bold' }}>Online</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} title="Saiu"></div>
                          <span style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 'bold' }}>Saiu do site</span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '16px 24px', verticalAlign: 'middle' }}>
                      <span style={{ 
                        padding: '4px 8px', 
                        backgroundColor: q.clicked_button ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-color)', 
                        color: q.clicked_button ? '#22c55e' : 'var(--text-muted)',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        border: `1px solid ${q.clicked_button ? '#22c55e' : 'var(--border-color)'}`
                      }}>
                        {q.clicked_button ? `Plano: ${q.clicked_button}` : 'Nenhum clique'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', verticalAlign: 'middle' }}>
                      <span style={{ 
                        padding: '6px 12px', 
                        backgroundColor: 'var(--bg-card)', 
                        borderRadius: '20px', 
                        fontSize: '0.85rem', 
                        fontWeight: 'bold',
                        color: 'var(--text-main)',
                        fontFamily: 'monospace'
                      }}>
                        ⏱️ {min}m {sec.toString().padStart(2, '0')}s
                      </span>
                    </td>
                  </tr>
                  );
                })}
                {quizStats.filter(q => q.last_step === 0).length === 0 && (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nenhuma visita na Landing Page registrada ainda.</td>
                  </tr>
                )}
              </tbody>
            </table>
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
                        👤 Funcionário: <strong style={{ color: 'var(--text-main)' }}>{s.employee_name}</strong> · Loja: {s.store}
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
                      <div key={cl.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'var(--bg-color)', borderRadius: '10px', gap: '12px', flexWrap: 'wrap', borderLeft: '4px solid var(--error)' }}>
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
                          <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--error)', borderColor: 'rgba(255,23,68,0.2)' }}
                            onClick={() => handleDeleteChecklist(cl.id, cl.title)}>
                            <Trash2 size={15} /> Excluir
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
                      <div key={cl.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'var(--bg-color)', borderRadius: '10px', gap: '12px', flexWrap: 'wrap', borderLeft: '4px solid var(--success)', opacity: 0.8 }}>
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
                          <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--error)', borderColor: 'rgba(255,23,68,0.2)' }}
                            onClick={() => handleDeleteChecklist(cl.id, cl.title)}>
                            <Trash2 size={15} /> Excluir
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

      {/* ── Tab: Frota e Veículos ────────────────────────────────────────── */}
      {tab === 'vehicles' && (
        <div className="card" style={{ padding: '0' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Car size={20} color="var(--primary)" /> Gerenciamento de Frota e Veículos
            </h3>
            <button className="btn" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => {
              setEditingVehicle(null);
              setNewVehicle({ plate: '', model: '', brand: '', color: '', year: '', currentKm: '', photoUrl: '', status: 'ativo', employeeId: '', tasks: [], scheduleType: 'manual', scheduleData: null });
              setShowVehicleModal(true);
            }}>
              <Plus size={16} /> Cadastrar Veículo
            </button>
          </div>
          <div style={{ padding: '24px' }}>
            {vehicles.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {vehicles.map(v => (
                  <div key={v.id} className="card" style={{ padding: '20px', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <div style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'rgba(255, 69, 0, 0.05)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {v.photo_url ? (
                          <img src={v.photo_url} alt={v.model} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Car size={36} color="var(--text-muted)" />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {v.brand} {v.model}
                        </h4>
                        <span className="badge" style={{ backgroundColor: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          {v.plate}
                        </span>
                        <p style={{ margin: '6px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          📟 KM Atual: <strong>{v.current_km ? Number(v.current_km).toLocaleString('pt-BR') : '0'} km</strong>
                        </p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          👤 Motorista: <strong>{v.employee_name || 'Sem motorista vinculado'}</strong>
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: v.status === 'ativo' ? 'var(--success)' : 'var(--error)' }}>
                        ● {v.status === 'ativo' ? 'Ativo na Frota' : 'Inativo / Manutenção'}
                      </span>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {v.status === 'ativo' && v.employee_id && (
                          <button className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handleSolicitVehicleChecklist(v.id)}>
                            🚀 Solicitar
                          </button>
                        )}
                        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => {
                          setEditingVehicle(v);
                          setNewVehicle({ 
                            id: v.id, 
                            plate: v.plate, 
                            model: v.model, 
                            brand: v.brand, 
                            color: v.color || '', 
                            year: v.year || '', 
                            currentKm: v.current_km || '', 
                            photoUrl: v.photo_url || '', 
                            status: v.status || 'ativo',
                            employeeId: v.employee_id || '',
                            tasks: v.tasks || [],
                            scheduleType: v.schedule_type || 'manual',
                            scheduleData: v.schedule_data || null
                          });
                          setShowVehicleModal(true);
                        }}>
                          Editar
                        </button>
                        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--error)', borderColor: 'rgba(255,23,68,0.2)' }} onClick={() => handleDeleteVehicle(v.id)}>
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <Car size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                <p>Nenhum veículo cadastrado na frota desta loja.</p>
                <button className="btn-secondary" style={{ marginTop: '16px' }} onClick={() => {
                  setEditingVehicle(null);
                  setNewVehicle({ plate: '', model: '', brand: '', color: '', year: '', currentKm: '', photoUrl: '', status: 'ativo', employeeId: '', tasks: [], scheduleType: 'manual', scheduleData: null });
                  setShowVehicleModal(true);
                }}>
                  Cadastrar Primeiro Veículo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showVehicleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px', pointerEvents: 'auto', backdropFilter: 'blur(5px)' }}>
          <div className="card animate-scale" style={{ width: '100%', maxWidth: '900px', display: 'flex', flexDirection: 'column', position: 'relative', pointerEvents: 'auto', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0 }}>{editingVehicle ? '📝 Editar Veículo' : '🚗 Cadastrar Veículo'}</h3>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowVehicleModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px', padding: '24px' }}>
              
              {/* COLUNA ESQUERDA: Dados Básicos, Motorista e Agendamento */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ margin: '0 0 8px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', color: 'var(--primary)' }}>ℹ️ Informações Gerais</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="input-label">Placa *</label>
                    <input type="text" className="input-field" placeholder="Ex: ABC-1234" value={newVehicle.plate} onChange={e => setNewVehicle({ ...newVehicle, plate: e.target.value.toUpperCase() })} />
                  </div>
                  <div>
                    <label className="input-label">Modelo *</label>
                    <input type="text" className="input-field" placeholder="Ex: Uno Way" value={newVehicle.model} onChange={e => setNewVehicle({ ...newVehicle, model: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="input-label">Marca / Fabricante</label>
                    <input type="text" className="input-field" placeholder="Ex: Fiat" value={newVehicle.brand} onChange={e => setNewVehicle({ ...newVehicle, brand: e.target.value })} />
                  </div>
                  <div>
                    <label className="input-label">Cor</label>
                    <input type="text" className="input-field" placeholder="Ex: Vermelho" value={newVehicle.color} onChange={e => setNewVehicle({ ...newVehicle, color: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="input-label">Ano</label>
                    <input type="number" className="input-field" placeholder="Ex: 2018" value={newVehicle.year} onChange={e => setNewVehicle({ ...newVehicle, year: e.target.value })} />
                  </div>
                  <div>
                    <label className="input-label">Quilometragem (KM) *</label>
                    <input type="number" className="input-field" placeholder="Ex: 120500" value={newVehicle.currentKm} onChange={e => setNewVehicle({ ...newVehicle, currentKm: e.target.value })} />
                  </div>
                </div>

                <div>
                  <label className="input-label">👤 Motorista Vinculado (Equipe)</label>
                  <select className="input-field" value={newVehicle.employeeId} onChange={e => setNewVehicle({ ...newVehicle, employeeId: e.target.value })}>
                    <option value="">Nenhum — Apenas livre demanda</option>
                    {team.filter(m => m.role === 'funcionario' || m.role === 'gestor' || m.role === 'admin' || m.role === 'master').map(m => (
                      <option key={m.id} value={m.id}>👤 {m.name} ({m.email})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
                  <div>
                    <label className="input-label">Status do Veículo</label>
                    <select className="input-field" value={newVehicle.status} onChange={e => setNewVehicle({ ...newVehicle, status: e.target.value })}>
                      <option value="ativo">🟢 Ativo na Frota</option>
                      <option value="manutencao">🟡 Em Manutenção / Inativo</option>
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Foto do Veículo</label>
                    <input type="file" accept="image/*" className="input-field" style={{ padding: '6px' }} onChange={handleVehiclePhotoChange} />
                  </div>
                </div>

                {newVehicle.photoUrl && (
                  <div style={{ width: '80px', height: '80px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <img src={newVehicle.photoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}

                {/* Agendamento de Vistorias */}
                <h4 style={{ margin: '16px 0 8px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', color: 'var(--primary)' }}>📅 Programação do Checklist</h4>
                <div>
                  <label className="input-label">Recorrência / Agendamento</label>
                  <select className="input-field" value={newVehicle.scheduleType} onChange={e => {
                    const type = e.target.value;
                    let initialData = null;
                    if (type === 'weekdays') initialData = [];
                    if (type === 'specific_dates') initialData = [];
                    setNewVehicle({ ...newVehicle, scheduleType: type, scheduleData: initialData });
                  }}>
                    <option value="manual">🚀 Sob Demanda (Manual/Livre)</option>
                    <option value="daily">📅 Diário (Todos os dias)</option>
                    <option value="weekdays">🗓️ Dias da Semana Específicos</option>
                    <option value="specific_dates">📆 Datas Recorrentes / Agendadas</option>
                  </select>
                </div>

                {newVehicle.scheduleType === 'weekdays' && (
                  <div>
                    <label className="input-label">Escolha os dias da semana:</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '6px' }}>
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dayName, index) => {
                        const currentDays = Array.isArray(newVehicle.scheduleData) ? newVehicle.scheduleData : [];
                        const isChecked = currentDays.includes(index);
                        return (
                          <label key={index} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', backgroundColor: isChecked ? 'rgba(255,77,0,0.1)' : 'transparent', fontSize: '0.85rem' }}>
                            <input type="checkbox" checked={isChecked} style={{ display: 'none' }} onChange={() => {
                              const nextDays = isChecked ? currentDays.filter(d => d !== index) : [...currentDays, index];
                              setNewVehicle({ ...newVehicle, scheduleData: nextDays });
                            }} />
                            {dayName}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {newVehicle.scheduleType === 'specific_dates' && (
                  <div>
                    <label className="input-label">Adicionar datas específicas:</label>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <input type="date" className="input-field" style={{ flex: 1 }} value={newDateInput} onChange={e => setNewDateInput(e.target.value)} />
                      <button className="btn" style={{ padding: '0 16px' }} onClick={() => {
                        if (!newDateInput) return;
                        const currentDates = Array.isArray(newVehicle.scheduleData) ? newVehicle.scheduleData : [];
                        if (currentDates.includes(newDateInput)) return;
                        setNewVehicle({ ...newVehicle, scheduleData: [...currentDates, newDateInput].sort() });
                        setNewDateInput('');
                      }}>Adicionar</button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px', maxHeight: '100px', overflowY: 'auto' }}>
                      {(Array.isArray(newVehicle.scheduleData) ? newVehicle.scheduleData : []).map(dt => (
                        <span key={dt} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.8rem' }}>
                          {new Date(dt + 'T00:00:00').toLocaleDateString('pt-BR')}
                          <button style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }} onClick={() => {
                            setNewVehicle({ ...newVehicle, scheduleData: newVehicle.scheduleData.filter(d => d !== dt) });
                          }}>×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* COLUNA DIREITA: Critérios de Checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '1px solid var(--border-color)', paddingLeft: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <h4 style={{ margin: 0, color: 'var(--primary)' }}>📋 Critérios de Checklist</h4>
                  
                  {vehicles.filter(v => v.id !== newVehicle.id && v.tasks && v.tasks.length > 0).length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <select style={{ fontSize: '0.78rem', padding: '4px', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px' }} onChange={e => {
                        const val = e.target.value;
                        if (!val) return;
                        const source = vehicles.find(v => v.id === parseInt(val));
                        if (source && source.tasks) {
                          if (window.confirm(`Deseja copiar o checklist de ${source.brand} ${source.model} (${source.plate})? Isso substituirá os critérios atuais.`)) {
                            setNewVehicle(prev => ({ ...prev, tasks: JSON.parse(JSON.stringify(source.tasks)) }));
                          }
                        }
                        e.target.value = '';
                      }}>
                        <option value="">Copiar Checklist de...</option>
                        {vehicles.filter(v => v.id !== newVehicle.id && v.tasks && v.tasks.length > 0).map(v => (
                          <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto', paddingRight: '8px' }}>
                  {(newVehicle.tasks || []).map((t, index) => (
                    <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>#{index + 1}</span>
                        <input type="text" className="input-field" style={{ flex: 1, padding: '6px 10px', fontSize: '0.85rem' }} placeholder="Descreva o que verificar (ex: Nível do óleo)..." value={t.text} onChange={e => {
                          const nTasks = (newVehicle.tasks || []).map(item => item.id === t.id ? { ...item, text: e.target.value } : item);
                          setNewVehicle({ ...newVehicle, tasks: nTasks });
                        }} />
                        <button style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }} onClick={() => {
                          setNewVehicle({ ...newVehicle, tasks: (newVehicle.tasks || []).filter(item => item.id !== t.id) });
                        }}>🗑️</button>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: '6px' }}>Tipo:</label>
                          <select style={{ fontSize: '0.78rem', padding: '3px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px' }} value={t.type} onChange={e => {
                            const nTasks = (newVehicle.tasks || []).map(item => item.id === t.id ? { ...item, type: e.target.value } : item);
                            setNewVehicle({ ...newVehicle, tasks: nTasks });
                          }}>
                            <option value="boolean">Sim / Não</option>
                            <option value="text">Resposta em Texto</option>
                            <option value="toggle">Feito / Pendente</option>
                            <option value="numeric">Valor Numérico</option>
                            <option value="rating">Avaliação (1-5 Estrelas)</option>
                          </select>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={t.requirePhoto || false} onChange={e => {
                              const nTasks = (newVehicle.tasks || []).map(item => item.id === t.id ? { ...item, requirePhoto: e.target.checked } : item);
                              setNewVehicle({ ...newVehicle, tasks: nTasks });
                            }} />
                            Foto Obrigatória
                          </label>
                          
                          {t.requirePhoto && (
                            <select style={{ fontSize: '0.78rem', padding: '2px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px' }} value={t.maxPhotos || 1} onChange={e => {
                              const nTasks = (newVehicle.tasks || []).map(item => item.id === t.id ? { ...item, maxPhotos: parseInt(e.target.value) } : item);
                              setNewVehicle({ ...newVehicle, tasks: nTasks });
                            }}>
                              <option value="1">1 foto</option>
                              <option value="2">Até 2 fotos</option>
                              <option value="3">Até 3 fotos</option>
                              <option value="4">Até 4 fotos</option>
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <button className="btn-secondary" style={{ padding: '8px', fontSize: '0.85rem', borderStyle: 'dashed', borderWidth: '1.5px' }} onClick={() => {
                    const newTask = {
                      id: 'vtask_' + Math.random().toString(36).substring(2, 9),
                      text: '',
                      type: 'boolean',
                      requirePhoto: false,
                      maxPhotos: 1
                    };
                    setNewVehicle({ ...newVehicle, tasks: [...(newVehicle.tasks || []), newTask] });
                  }}>
                    ➕ Adicionar Item ao Checklist
                  </button>
                </div>
              </div>
            </div>

            <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px', justifyContent: 'flex-end', backgroundColor: 'var(--bg-card)' }}>
              <button className="btn-secondary" style={{ padding: '10px 20px' }} onClick={() => setShowVehicleModal(false)}>Cancelar</button>
              <button className="btn" style={{ padding: '10px 30px' }} onClick={handleSaveVehicle} disabled={isSavingVehicle}>
                {isSavingVehicle ? 'Salvando...' : 'Salvar Veículo'}
              </button>
            </div>
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
              <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'var(--bg-color)', borderRadius: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h4 style={{ fontSize: '1rem', margin: 0 }}>{member.name}</h4>
                    {statusInfo && (
                      <span style={{ backgroundColor: `${statusInfo.color}15`, border: `1px solid ${statusInfo.color}40`, color: statusInfo.color, padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                        {statusInfo.text}
                      </span>
                    )}
                    {!isMaster && member.role === 'gestor' && (
                      <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#3b82f6', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                        Gestor / Gerente
                      </span>
                    )}
                    {!isMaster && member.role === 'admin' && (
                      <span style={{ backgroundColor: 'rgba(255, 77, 0, 0.1)', border: '1px solid rgba(255, 77, 0, 0.3)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                        Dono / Administrador
                      </span>
                    )}
                    {!isMaster && member.ponto_hora_entrada && member.ponto_hora_entrada !== '08:00' && (
                      <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                        ⏰ {member.ponto_hora_entrada} - {member.ponto_hora_saida || '18:00'}
                      </span>
                    )}
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px' }}>
                    {member.email} · {member.phone ? `📱 ${member.phone}` : 'Sem telefone cadastrado'} · {member.store}
                  </p>
                  {isMaster && member.role === 'admin' && member.checklist_limit && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <div style={{ width: '80px', height: '6px', backgroundColor: 'var(--bg-card)', borderRadius: '100px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, Math.round(((member.checklists_used || 0) / (member.checklist_limit || 300)) * 100))}%`, height: '100%', backgroundColor: ((member.checklists_used || 0) / (member.checklist_limit || 300)) >= 0.95 ? 'var(--error)' : ((member.checklists_used || 0) / (member.checklist_limit || 300)) >= 0.8 ? '#f59e0b' : 'var(--primary)', borderRadius: '100px' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: ((member.checklists_used || 0) / (member.checklist_limit || 300)) >= 0.95 ? 'var(--error)' : ((member.checklists_used || 0) / (member.checklist_limit || 300)) >= 0.8 ? '#f59e0b' : 'var(--text-muted)' }}>
                        {member.checklists_used || 0}/{member.checklist_limit >= 999999 ? '∞' : member.checklist_limit} checklists
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {member.id !== userProfile?.id && (
                    <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.3)', fontWeight: 'bold' }}
                      onClick={() => handleImpersonateUser(member)}>
                      <Eye size={14} /> Acessar Conta
                    </button>
                  )}
                  {isMaster && member.role === 'admin' && (
                    <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => {
                       setEditingPlan({ ...member });
                    }}>
                      Alterar Plano
                    </button>
                  )}
                  {(isMaster || (member.role !== 'admin' && member.id !== userProfile?.id)) && (
                    <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => {
                      setEditingUser({ ...member });
                      setShowEditModal(true);
                    }}>
                      Editar
                    </button>
                  )}
                  {(isMaster || (member.role !== 'admin' && member.id !== userProfile?.id)) && (
                    <button className="btn-secondary" style={{ color: 'var(--error)', borderColor: 'rgba(255,23,68,0.2)' }} onClick={() => handleDeleteUser(member.id)}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            )})}
          </div>
        </div>
      )}

      {/* ── Tab: Perfil da Empresa ──────────────────────────────────── */}
      {tab === 'perfil' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '8px' }}>
              <Settings size={20} /> Perfil da Empresa / Conta
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
              Atualize as informações gerais da sua empresa e do administrador responsável.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flexWrap: 'wrap' }}>
              {/* Coluna Esquerda: Dados do Perfil */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="input-label">Nome da Empresa / Loja</label>
                  <input type="text" className="input-field" value={companyName} onChange={e => setCompanyName(e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Nome do Gestor / Dono</label>
                  <input type="text" className="input-field" value={ownerName} onChange={e => setOwnerName(e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Telefone de Contato</label>
                  <input type="text" className="input-field" value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} />
                </div>
                <button className="btn" style={{ padding: '12px', marginTop: '8px' }} onClick={handleSaveCompanyProfile}>
                  Salvar Perfil
                </button>
              </div>

              {/* Coluna Direita: Informações do Plano Atual e Upgrades */}
              <div style={{ backgroundColor: 'var(--bg-main)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-color)' }}>Plano Atual</h4>
                  <p style={{ margin: '4px 0 0 0', fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--primary)', textTransform: 'uppercase' }}>
                    {userProfile?.plan || 'starter'} ({(userProfile?.status === 'trial') ? 'Trial / Teste' : 'Ativo'})
                  </p>
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <p style={{ margin: '4px 0' }}>• Limite de Checklists: <strong>{userProfile?.checklist_limit >= 999999 ? 'Ilimitado' : (userProfile?.checklist_limit || 300)}</strong>/mês</p>
                  <p style={{ margin: '4px 0' }}>• Limite de Ponto: <strong>{userProfile?.ponto_limit >= 999999 ? 'Ilimitado' : (userProfile?.ponto_limit || 5)}</strong> colaboradores</p>
                  <p style={{ margin: '4px 0' }}>• Módulo Financeiro: <strong>{userProfile?.finance_active ? 'Ativo' : 'Inativo'}</strong></p>
                </div>
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem' }}>Deseja fazer um Upgrade de Plano?</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button className="btn-secondary" style={{ width: '100%', padding: '10px', fontSize: '0.85rem' }} onClick={() => window.open(`https://pay.cakto.com.br/e7c88df?email=${encodeURIComponent(userProfile?.email || '')}`, '_blank')}>
                      Upgrade para Plano Pro (R$97/mês)
                    </button>
                    <button className="btn" style={{ width: '100%', padding: '10px', fontSize: '0.85rem' }} onClick={() => window.open(`https://pay.cakto.com.br/iy4399h?email=${encodeURIComponent(userProfile?.email || '')}`, '_blank')}>
                      Upgrade para Plano Business (R$197/mês)
                    </button>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ⚠️ Lembre-se de cancelar o plano anterior na Cakto após o upgrade para evitar cobranças duplicadas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Compras e Estoque ──────────────────────────────────── */}
      {tab === 'compras' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShoppingCart size={24} /> Listas de Compras
            </h2>
            {!isFuncionario && (
              <button className="btn" onClick={() => { setEditingShopping(null); setNewShopping({ title: '', recurrence: 'weekly', weekdays: [], assignedTo: 'todos', items: [{ name: '', unit: 'un', minStock: '', category: 'geral' }] }); setShowShoppingModal(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                <Plus size={18}/> Nova Lista de Compras
              </button>
            )}
          </div>

          {/* Cards de listas de compras */}
          {shoppingLists.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {shoppingLists.map(list => (
                <div key={list.id} className="card" style={{ padding: '20px', position: 'relative', borderLeft: parseInt(list.below_min_count) > 0 ? '4px solid #ef4444' : '4px solid #22c55e' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem' }}>{list.title}</h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CalendarClock size={14}/> {list.recurrence === 'daily' ? 'Diária' : list.recurrence === 'weekly' ? 'Semanal' : list.recurrence === 'monthly' ? 'Mensal' : list.recurrence}
                      </span>
                    </div>
                    {!isFuncionario && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleEditShopping(list)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}><Edit2 size={16}/></button>
                        <button onClick={() => handleDeleteShopping(list.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={16}/></button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                      <Package size={16} color="var(--text-muted)"/>
                      <span><strong>{list.item_count}</strong> itens</span>
                    </div>
                    {parseInt(list.below_min_count) > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: '#ef4444', fontWeight: '600' }}>
                        <AlertCircle size={16}/>
                        <span>{list.below_min_count} abaixo do mínimo</span>
                      </div>
                    )}
                  </div>
                  {list.assigned_to && list.assigned_to !== 'todos' && (
                    <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      👤 Atribuído: {typeof list.assigned_to === 'object' ? list.assigned_to.join(', ') : list.assigned_to}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
              <ShoppingCart size={48} color="var(--text-muted)" style={{ marginBottom: '16px', opacity: 0.5 }}/>
              <h3>Nenhuma lista de compras cadastrada</h3>
              <p style={{ color: 'var(--text-muted)' }}>Crie sua primeira lista de compras para controlar o estoque da sua loja.</p>
            </div>
          )}

          {/* Seção: Histórico de Conferências de Estoque Realizadas */}
          <div style={{ marginTop: '40px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={20} color="var(--primary)" /> Histórico de Conferências de Estoque
            </h3>

            {shoppingSubmissions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {shoppingSubmissions.map(sub => {
                  const belowMin = typeof sub.below_minimum === 'string' ? (() => { try { return JSON.parse(sub.below_minimum); } catch(e) { return []; } })() : (sub.below_minimum || []);
                  const itemsList = typeof sub.items === 'string' ? (() => { try { return JSON.parse(sub.items); } catch(e) { return []; } })() : (sub.items || []);
                  const hasBelowMin = belowMin.length > 0;

                  return (
                    <div
                      key={sub.id}
                      className="card"
                      style={{
                        padding: '16px 20px',
                        borderLeft: hasBelowMin ? '4px solid #ef4444' : '4px solid #10b981',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '1rem' }}>{sub.list_title || 'Lista de Compras'}</strong>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            👤 Conferido por: <strong>{sub.employee_name}</strong>
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            📅 {new Date(sub.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.85rem' }}>
                          <span>📦 Total de itens: <strong>{itemsList.length}</strong></span>
                          {hasBelowMin ? (
                            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>
                              ⚠️ {belowMin.length} item(ns) abaixo do estoque mínimo
                            </span>
                          ) : (
                            <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                              ✓ Estoque Completo
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        className="btn-secondary"
                        onClick={() => setSelectedShoppingSubModal(sub)}
                        style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: 'bold' }}
                      >
                        Ver Relatório Detalhado
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="card" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Nenhuma conferência de estoque realizada recentemente.
              </div>
            )}
          </div>

          {/* Modal de Detalhes da Submissão de Compras */}
          {selectedShoppingSubModal && (
            <div className="modal-overlay animate-fade">
              <div className="modal-content" style={{ maxWidth: '650px', width: '94%', maxHeight: '90vh', overflow: 'auto', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0 }}>Relatório de Conferência de Estoque</h3>
                  <button onClick={() => setSelectedShoppingSubModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20}/></button>
                </div>

                <div style={{ backgroundColor: 'var(--bg-main)', padding: '14px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.9rem' }}>
                  <p style={{ margin: '0 0 4px 0' }}>📋 <strong>Lista:</strong> {selectedShoppingSubModal.list_title || 'Lista de Compras'}</p>
                  <p style={{ margin: '0 0 4px 0' }}>👤 <strong>Funcionário:</strong> {selectedShoppingSubModal.employee_name}</p>
                  <p style={{ margin: 0 }}>📅 <strong>Data:</strong> {new Date(selectedShoppingSubModal.created_at).toLocaleString('pt-BR')}</p>
                  {selectedShoppingSubModal.notes && (
                    <p style={{ margin: '8px 0 0 0', color: 'var(--primary)' }}>📝 <strong>Obs:</strong> {selectedShoppingSubModal.notes}</p>
                  )}
                </div>

                <h4 style={{ fontSize: '0.95rem', marginBottom: '12px' }}>Itens Verificados:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(typeof selectedShoppingSubModal.items === 'string' ? JSON.parse(selectedShoppingSubModal.items || '[]') : (selectedShoppingSubModal.items || [])).map((it, idx) => {
                    const isBelow = parseFloat(it.currentStock) < parseFloat(it.minStock);
                    return (
                      <div key={idx} style={{
                        padding: '12px 16px', borderRadius: '8px',
                        backgroundColor: isBelow ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-main)',
                        border: isBelow ? '1px solid #ef4444' : '1px solid var(--border-color)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div>
                          <strong>{it.name}</strong>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>
                            Mínimo exigido: {it.minStock} {it.unit || 'un'}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '1rem', fontWeight: 'bold', color: isBelow ? '#ef4444' : '#10b981' }}>
                            {it.currentStock} {it.unit || 'un'}
                          </span>
                          {isBelow && (
                            <span style={{ fontSize: '0.75rem', color: '#ef4444', display: 'block', fontWeight: 'bold' }}>
                              (Faltam {(parseFloat(it.minStock) - parseFloat(it.currentStock)).toFixed(1)} {it.unit || 'un'})
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: '24px', textAlign: 'right' }}>
                  <button className="btn" onClick={() => setSelectedShoppingSubModal(null)} style={{ padding: '10px 20px' }}>
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal de criação/edição */}
          {showShoppingModal && (
            <div className="modal-overlay animate-fade">
              <div className="modal-content" style={{ maxWidth: '750px', width: '94%', maxHeight: '90vh', overflow: 'auto', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0 }}>{editingShopping ? 'Editar Lista de Compras' : 'Nova Lista de Compras'}</h3>
                  <button onClick={() => { setShowShoppingModal(false); setEditingShopping(null); setShoppingAIMode(false); setShoppingAIConv([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20}/></button>
                </div>

                {/* Toggle Manual / IA */}
                {!editingShopping && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '4px' }}>
                    <button onClick={() => setShoppingAIMode(false)}
                      style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s',
                        backgroundColor: !shoppingAIMode ? 'var(--primary)' : 'transparent',
                        color: !shoppingAIMode ? 'white' : 'var(--text-muted)' }}>
                      <ClipboardList size={16}/> Manual
                    </button>
                    <button onClick={() => { setShoppingAIMode(true); if (shoppingAIConv.length === 0) setShoppingAIConv([{ role: 'bill', content: 'Olá! 🛒 Sou o Bill e vou te ajudar a criar sua lista de compras.\n\nMe diga o que você precisa! Por exemplo:\n• "Cria uma lista de compras semanal para hamburgueria"\n• "Preciso controlar estoque de limpeza"\n\nVocê pode digitar ou enviar um áudio! 🎤' }]); }}
                      style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s',
                        background: shoppingAIMode ? 'linear-gradient(135deg, #06b6d4, #0891b2)' : 'transparent',
                        color: shoppingAIMode ? 'white' : 'var(--text-muted)' }}>
                      <Sparkles size={16}/> Cadastrar com IA
                    </button>
                  </div>
                )}

                {/* ── MODO IA: Chat com Bill ── */}
                {shoppingAIMode && !editingShopping ? (
                  <div>
                    {/* Chat container */}
                    <div ref={shoppingAIChatRef} style={{ height: '340px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', backgroundColor: 'var(--bg-main)', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {shoppingAIConv.map((msg, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                          <div style={{
                            maxWidth: '80%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                            backgroundColor: msg.role === 'user' ? 'var(--primary)' : 'var(--bg-card)',
                            color: msg.role === 'user' ? 'white' : 'var(--text-main)',
                            fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                          }}>
                            {msg.role === 'bill' && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 'bold', color: '#06b6d4' }}><Bot size={14}/> Bill IA</div>}
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {shoppingAIGenerating && (
                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                          <div style={{ padding: '10px 14px', borderRadius: '2px 12px 12px 12px', backgroundColor: 'var(--bg-card)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#06b6d4' }}>
                            <Bot size={14}/> <span style={{ animation: 'pulse 1s infinite' }}>Pensando...</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Input de mensagem + áudio */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button onClick={handleShoppingAIRecord} disabled={shoppingAIGenerating}
                        style={{ width: '44px', height: '44px', borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                          backgroundColor: shoppingAIRecording ? '#ef4444' : '#06b6d4', color: 'white',
                          animation: shoppingAIRecording ? 'pulse 1s infinite' : 'none' }}>
                        <Mic size={20}/>
                      </button>
                      <input type="text" className="input-field" placeholder={shoppingAIRecording ? '🎤 Gravando... Clique para parar' : 'Digite ou envie um áudio...'}
                        value={shoppingAIInput} onChange={e => setShoppingAIInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleShoppingAISend(shoppingAIInput); } }}
                        disabled={shoppingAIGenerating || shoppingAIRecording}
                        style={{ flex: 1 }}/>
                      <button onClick={() => handleShoppingAISend(shoppingAIInput)} disabled={!shoppingAIInput.trim() || shoppingAIGenerating}
                        style={{ width: '44px', height: '44px', borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: shoppingAIInput.trim() ? 'var(--primary)' : 'var(--border-color)', color: 'white', transition: 'all 0.2s' }}>
                        <Send size={18}/>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── MODO MANUAL: Formulário ── */
                  <>
                    {/* Nome da lista */}
                    <div style={{ marginBottom: '16px' }}>
                      <label className="input-label">Nome da Lista</label>
                      <input type="text" className="input-field" placeholder="Ex: Compras Semanais da Cozinha" value={newShopping.title} onChange={e => setNewShopping(p => ({ ...p, title: e.target.value }))}/>
                    </div>

                    {/* Recorrência */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '150px' }}>
                        <label className="input-label">Recorrência</label>
                        <select className="input-field" value={newShopping.recurrence} onChange={e => setNewShopping(p => ({ ...p, recurrence: e.target.value }))}>
                          <option value="daily">Diária</option>
                          <option value="weekly">Semanal</option>
                          <option value="monthly">Mensal</option>
                        </select>
                      </div>
                      <div style={{ flex: 1, minWidth: '150px' }}>
                        <label className="input-label">Atribuir a</label>
                        <select className="input-field" value={newShopping.assignedTo} onChange={e => setNewShopping(p => ({ ...p, assignedTo: e.target.value }))}>
                          <option value="todos">Qualquer colaborador/admin</option>
                          {team.filter(m => m.role === 'funcionario' || m.role === 'gestor' || m.role === 'admin' || m.role === 'master').map(m => (
                            <option key={m.id} value={m.name}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Itens */}
                    <div style={{ marginBottom: '16px' }}>
                      <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Itens de Compra</label>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', padding: '8px 12px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                        <div style={{ flex: 3 }}>Produto</div>
                        <div style={{ flex: 1 }}>Unidade</div>
                        <div style={{ flex: 1 }}>Estoque Min.</div>
                        <div style={{ width: '32px' }}></div>
                      </div>
                      {newShopping.items.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                          <input type="text" className="input-field" placeholder="Nome do produto" style={{ flex: 3 }} value={item.name}
                            onChange={e => { const items = [...newShopping.items]; items[idx] = { ...items[idx], name: e.target.value }; setNewShopping(p => ({ ...p, items })); }}/>
                          <select className="input-field" style={{ flex: 1 }} value={item.unit}
                            onChange={e => { const items = [...newShopping.items]; items[idx] = { ...items[idx], unit: e.target.value }; setNewShopping(p => ({ ...p, items })); }}>
                            <option value="un">un</option>
                            <option value="kg">kg</option>
                            <option value="L">L</option>
                            <option value="cx">cx</option>
                            <option value="pct">pct</option>
                            <option value="dz">dz</option>
                          </select>
                          <input type="number" className="input-field" placeholder="0" style={{ flex: 1 }} value={item.minStock}
                            onChange={e => { const items = [...newShopping.items]; items[idx] = { ...items[idx], minStock: e.target.value }; setNewShopping(p => ({ ...p, items })); }}/>
                          <button onClick={() => { const items = newShopping.items.filter((_, i) => i !== idx); setNewShopping(p => ({ ...p, items: items.length ? items : [{ name: '', unit: 'un', minStock: '', category: 'geral' }] })); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', width: '32px', flexShrink: 0 }}><Trash2 size={16}/></button>
                        </div>
                      ))}
                      <button onClick={() => setNewShopping(p => ({ ...p, items: [...p.items, { name: '', unit: 'un', minStock: '', category: 'geral' }] }))}
                        style={{ background: 'none', border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '10px', width: '100%', cursor: 'pointer', color: 'var(--primary)', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <Plus size={16}/> Adicionar Item
                      </button>
                    </div>

                    {/* Botões */}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                      <button className="btn-secondary" onClick={() => { setShowShoppingModal(false); setEditingShopping(null); }}
                        style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer' }}>Cancelar</button>
                      <button className="btn" onClick={handleSaveShopping} disabled={isSavingShopping}
                        style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', color: 'white', cursor: 'pointer', fontWeight: '600' }}>
                        {isSavingShopping ? 'Salvando...' : (editingShopping ? 'Atualizar' : 'Criar Lista')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Conectar com o Bill ───────────────────────────────────── */}
      {tab === 'bill' && (
        <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          {billLinked ? (
            /* ── MODO CONECTADO ── */
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', padding: '32px 24px', textAlign: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', backdropFilter: 'blur(8px)' }}>
                  <Bot size={32} color="white" />
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.2)', padding: '8px 20px', borderRadius: '20px', fontSize: '0.95rem', fontWeight: '600', color: 'white', backdropFilter: 'blur(8px)' }}>
                  ✅ Conectado ao Bill
                </div>
              </div>
              <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.3rem' }}>{billUser?.name}</h3>
                <p style={{ margin: '0 0 24px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Plano: <strong style={{ color: '#06b6d4' }}>{billUser?.plan}</strong>
                </p>
                <div style={{ backgroundColor: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                    Sua conta FireCheck está integrada com o Bill. Os dados de checklists e ranking são sincronizados automaticamente.
                  </p>
                </div>
                <button
                  onClick={handleBillUnlink}
                  disabled={billLoading}
                  style={{
                    padding: '10px 24px', borderRadius: '8px', border: '1px solid rgba(255,23,68,0.3)',
                    backgroundColor: 'rgba(255,23,68,0.08)', color: 'var(--error)', cursor: 'pointer',
                    fontWeight: '600', fontSize: '0.9rem', transition: 'all 0.2s',
                    opacity: billLoading ? 0.6 : 1
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,23,68,0.15)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,23,68,0.08)'; }}
                >
                  {billLoading ? 'Desvinculando...' : 'Desvincular conta'}
                </button>
              </div>
            </div>
          ) : (
            /* ── MODO NÃO CONECTADO ── */
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
              {/* Hero */}
              <div style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 50%, #164e63 100%)', padding: '48px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }}></div>
                <div style={{ position: 'absolute', bottom: '-40px', left: '-20px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }}></div>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                  <Bot size={40} color="white" />
                </div>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '1.6rem', color: 'white', fontWeight: '700' }}>Conectar com o Bill</h2>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: '0.95rem', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto', lineHeight: '1.5' }}>
                  O Bill é a IA dos participantes do projeto Empresa Inteligente, por <strong style={{ color: 'white' }}>@douglasmorett</strong>
                </p>
              </div>

              {/* Benefícios */}
              <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>O que a integração faz:</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {[
                    { icon: <ClipboardList size={18} color="#06b6d4" />, text: 'Checklists sincronizados' },
                    { icon: <Activity size={18} color="#06b6d4" />, text: 'Dashboard integrado' },
                    { icon: <Trophy size={18} color="#06b6d4" />, text: 'Ranking unificado' },
                    { icon: <UserCheck size={18} color="#06b6d4" />, text: 'Controle de ponto' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(6, 182, 212, 0.06)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(6, 182, 212, 0.1)' }}>
                      {item.icon}
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '500' }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Formulário */}
              <form onSubmit={handleBillLink} style={{ padding: '24px' }}>
                {billError && (
                  <div style={{ backgroundColor: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.25)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertCircle size={18} color="var(--error)" />
                    <span style={{ fontSize: '0.85rem', color: 'var(--error)' }}>{billError}</span>
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '6px' }}>E-mail do Bill</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="email" required placeholder="seu@email.com" value={billEmail}
                      onChange={(e) => { setBillEmail(e.target.value); setBillError(''); }}
                      style={{ width: '100%', padding: '12px 14px 12px 44px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                      onFocus={(e) => e.target.style.borderColor = '#06b6d4'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '6px' }}>Senha do Bill</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="password" required placeholder="Sua senha do Bill" value={billPassword}
                      onChange={(e) => { setBillPassword(e.target.value); setBillError(''); }}
                      style={{ width: '100%', padding: '12px 14px 12px 44px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                      onFocus={(e) => e.target.style.borderColor = '#06b6d4'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                    />
                  </div>
                </div>

                <button
                  type="submit" disabled={billLoading}
                  style={{
                    width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                    background: billLoading ? '#6b7280' : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                    color: 'white', fontSize: '1rem', fontWeight: '700', cursor: billLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s', boxShadow: billLoading ? 'none' : '0 4px 16px rgba(6,182,212,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                  }}
                  onMouseOver={(e) => { if (!billLoading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(6,182,212,0.45)'; } }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(6,182,212,0.35)'; }}
                >
                  {billLoading ? (
                    <><span style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }}></span> Conectando...</>
                  ) : (
                    <><Bot size={20} /> Conectar minha conta</>
                  )}
                </button>
              </form>

              {/* Rodapé — não tem Bill? */}
              <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-color)', textAlign: 'center', backgroundColor: 'rgba(6, 182, 212, 0.03)' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  Não tem o Bill?{' '}
                  <a href="https://instagram.com/douglasmorett" target="_blank" rel="noopener noreferrer"
                    style={{ color: '#06b6d4', fontWeight: '600', textDecoration: 'none' }}
                    onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                  >
                    Fale com @douglasmorett no Instagram
                  </a>
                </p>
              </div>
            </div>
          )}
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
                   <strong style={{ color: 'var(--text-main)' }}>Plano Flex Padrão:</strong> Você tem direito a 1 câmera inclusa para degustação.
                 </p>
                 <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                   Expanda seu monitoramento conectando até 4 Câmeras com IA em sua loja.
                 </p>
               </div>
               <button 
                 onClick={() => window.open('https://pay.cakto.com.br/njaxxuy_861537', '_blank')}
                 style={{ padding: '8px 16px', backgroundColor: 'var(--primary)', color: 'var(--text-main)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)' }}
               >
                 Liberar 4 Câmeras (R$ 49,90)
               </button>
            </div>

            {cameras.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {cameras.map(cam => (
                  <div key={cam.id} className="card" style={{ padding: '20px', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)' }}>
                    
                    {/* Cabeçalho da Câmera */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <Camera color="var(--primary)" size={20} />
                          <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)' }}>{cam.name}</h4>
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
                         <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', margin: 0, fontWeight: 'bold' }}>Últimos Incidentes</p>
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
              <button style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }} onClick={() => setShowHistoryModal(null)}>
                <X size={24} />
              </button>
            </div>
            
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card)', borderRadius: '12px' }}>
              <ShieldCheck size={48} style={{ marginBottom: '16px', color: 'var(--success)', opacity: 0.8 }} />
              <h4 style={{ color: 'var(--text-main)', marginBottom: '8px' }}>Nenhum incidente registrado</h4>
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
                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: '40px', padding: '12px', backgroundColor: 'var(--bg-card-hover)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
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
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Telefone / WhatsApp</label>
                <input type="text" className="input-field" value={newUser.phone || ''} onChange={e => setNewUser({...newUser, phone: e.target.value})} placeholder="Ex: 21999999999" />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                <div>
                  <label className="input-label">Papel / Nível</label>
                  <select className="input-field" style={{ padding: '10px' }} value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                    {isMaster && <option value="admin">Dono (Cliente)</option>}
                    {(isAdminOrGestor || isMaster) && (
                      <>
                        <option value="funcionario">Funcionário</option>
                        <option value="gestor">Gestor / Gerente</option>
                      </>
                    )}
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
                    <select className="input-field" value={newUser.store} disabled style={{ backgroundColor: 'var(--bg-card)', cursor: 'not-allowed' }}>
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
                    <option value="starter">Starter (300/mês — R$67)</option>
                    <option value="pro">Pro (600/mês — R$97)</option>
                    <option value="business">Business (1000/mês — R$197)</option>
                    <option value="enterprise">Enterprise (Ilimitado)</option>
                  </select>

                  <label className="input-label">Módulos Extras Ativos</label>
                  <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input type="checkbox" checked={newUser.ponto_active || false} onChange={e => setNewUser({...newUser, ponto_active: e.target.checked})} />
                      Controle de Ponto
                    </label>
                   </div>
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
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 10000, padding: '5vh 20px 20px 20px', backdropFilter: 'blur(10px)' }}>
          <div className="card animate-scale" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', padding: '0', position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <button onClick={() => setShowSubmissionModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--text-main)', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', zIndex: 1 }}>
              <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
            </button>
            
            <div style={{ padding: '32px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '20px', alignItems: 'center', backgroundColor: 'var(--bg-color)' }}>
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

            <div style={{ padding: '32px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
              <h3 style={{ marginBottom: '20px', fontSize: '1.1rem' }}>Respostas do Checklist</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {selectedSubmission.tasks.map((task, idx) => {
                  const feedback = selectedSubmission.feedback_info?.[task.id];
                  return (
                    <div key={task.id} style={{ padding: '20px', backgroundColor: 'var(--bg-color)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
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
                            <img src={task.photo} alt="Evidência" onClick={() => window.open(task.photo, '_blank')} title="Clique para ampliar" style={{ width: '100%', height: '140px', objectFit: 'cover', cursor: 'zoom-in', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'center' }}>👆 Clique para ampliar foto</p>
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
              
              {selectedSubmission.signature && (
                <div style={{ marginTop: '24px', padding: '20px', backgroundColor: 'var(--bg-color)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: 'bold' }}>🖋️ Assinatura do Funcionário:</p>
                  <img src={selectedSubmission.signature} alt="Assinatura" style={{ maxHeight: '100px', backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                </div>
              )}
            </div>
            <div style={{ padding: '24px 32px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px', flexWrap: 'wrap', backgroundColor: 'var(--bg-card)', zIndex: 10, borderRadius: '0 0 12px 12px' }}>
               <button className="btn-secondary" style={{ flex: 1, padding: '16px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={() => handleExportPDF(selectedSubmission)}>
                 <FileDown size={20} /> Exportar PDF
               </button>
               {!selectedSubmission.resolved && (
                 <button className="btn" style={{ flex: 2, padding: '16px', fontSize: '1rem' }} onClick={() => handleResolveSubmission(selectedSubmission.id)}>
                    Finalizar Ocorrência (Ciente)
                 </button>
               )}
               {selectedSubmission.resolved && (
                 <div style={{ flex: 2, padding: '16px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', textAlign: 'center', color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ✓ Ocorrência Resolvida
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

      {editingPlan && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '20px', pointerEvents: 'auto', backdropFilter: 'blur(5px)' }}>
          <div className="card animate-scale" style={{ width: '100%', maxWidth: '400px', position: 'relative', border: '1px solid var(--primary)', pointerEvents: 'auto' }}>
            <button style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }} onClick={() => setEditingPlan(null)}><X size={24} /></button>
            <h3 style={{ marginBottom: '24px' }}>Alterar Plano de {editingPlan.name}</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Status da Conta</label>
              <select className="input-field" value={editingPlan.status || 'trial'} onChange={e => setEditingPlan({...editingPlan, status: e.target.value})}>
                <option value="trial">Trial (7 Dias)</option>
                <option value="active">Ativo (Pago)</option>
                <option value="blocked">Bloqueado</option>
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Telefone / WhatsApp</label>
              <input 
                type="text" 
                className="input-field" 
                value={editingPlan.phone || ''} 
                onChange={e => setEditingPlan({...editingPlan, phone: e.target.value})} 
                placeholder="Ex: 21999999999"
              />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label className="input-label">Plano de Checklist</label>
              <select className="input-field" value={editingPlan.plan || 'starter'} onChange={e => {
                const newPlan = e.target.value;
                const limitMap = { starter: 300, pro: 600, business: 1000, enterprise: 999999, mensal: 600, anual: 1000 };
                setEditingPlan({...editingPlan, plan: newPlan, checklist_limit: limitMap[newPlan] || 300 });
              }}>
                <option value="starter">Starter (300 checklists/mês — R$67)</option>
                <option value="pro">Pro (600 checklists/mês — R$97)</option>
                <option value="business">Business (1000 checklists/mês — R$197)</option>
                <option value="enterprise">Enterprise (Ilimitado)</option>
                <option value="mensal">Mensal (Legado)</option>
                <option value="anual">Anual (Legado)</option>
              </select>

              <label className="input-label" style={{ marginTop: '16px' }}>Plano de Ponto</label>
              <select className="input-field" value={editingPlan.ponto_limit !== undefined ? editingPlan.ponto_limit : (editingPlan.ponto_active ? 15 : 0)} onChange={e => {
                const limit = parseInt(e.target.value);
                setEditingPlan({...editingPlan, ponto_limit: limit, ponto_active: limit > 0 });
              }}>
                <option value="0">Desativado</option>
                <option value="5">Ponto Starter (Até 5 colaboradores — R$67)</option>
                <option value="15">Ponto Pro (Até 15 colaboradores — R$97)</option>
                <option value="50">Ponto Business (Até 50 colaboradores — R$197)</option>
                <option value="999999">Ponto Enterprise (Ilimitado)</option>
              </select>
            </div>

            <button className="btn" style={{ width: '100%' }} onClick={async () => {
              try {
                await fetch(`${API_URL}/api/users/${editingPlan.id}`, {
                  method: 'PUT',
                  headers: getAuthHeaders(),
                  body: JSON.stringify({ plan: editingPlan.plan, status: editingPlan.status, ponto_active: editingPlan.ponto_active, ponto_limit: editingPlan.ponto_limit, checklist_limit: editingPlan.checklist_limit, phone: editingPlan.phone })
                });
                setEditingPlan(null);
                fetchData();
              } catch (e) { alert('Erro ao salvar plano.'); }
            }}>Salvar Alterações</button>
          </div>
        </div>
      )}
      {showEditModal && editingUser && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
          zIndex: 99999, padding: '20px', backdropFilter: 'blur(5px)' 
        }}>
          <div className="card animate-scale" style={{ maxWidth: '400px', width: '100%', position: 'relative', border: '1px solid var(--primary)', padding: '24px' }}>
            <button onClick={() => setShowEditModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
            <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Edit2 color="var(--primary)" /> Editar Colaborador
            </h3>
            <form onSubmit={handleEditUser}>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Nome Completo</label>
                <input type="text" className="input-field" required value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Telefone / WhatsApp</label>
                <input type="text" className="input-field" value={editingUser.phone || ''} onChange={e => setEditingUser({...editingUser, phone: e.target.value})} placeholder="Ex: 21999999999" />
              </div>
              
              <div style={{ marginBottom: '24px' }}>
                <label className="input-label">Papel / Nível</label>
                <select className="input-field" style={{ padding: '10px' }} value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})}>
                  {isMaster && <option value="admin">Dono (Cliente)</option>}
                  {(isAdminOrGestor || isMaster) && (
                    <>
                      <option value="funcionario">Funcionário</option>
                      <option value="gestor">Gestor / Gerente</option>
                    </>
                  )}
                  {isMaster && <option value="master">Gestor Master</option>}
                </select>
              </div>

              {/* Escala de Trabalho Individual */}
              <div style={{ marginBottom: '24px', backgroundColor: 'rgba(59, 130, 246, 0.06)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: '#3b82f6', fontWeight: 'bold' }}>
                  ⏰ Escala de Trabalho Individual
                </label>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Defina horários específicos para este colaborador. Se deixar em branco, será usado o horário padrão da loja.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label className="input-label" style={{ fontSize: '0.75rem' }}>Entrada</label>
                    <input type="time" className="input-field" value={editingUser.ponto_hora_entrada || ''} onChange={e => setEditingUser({...editingUser, ponto_hora_entrada: e.target.value})} />
                  </div>
                  <div>
                    <label className="input-label" style={{ fontSize: '0.75rem' }}>Saída</label>
                    <input type="time" className="input-field" value={editingUser.ponto_hora_saida || ''} onChange={e => setEditingUser({...editingUser, ponto_hora_saida: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="input-label" style={{ fontSize: '0.75rem' }}>Tolerância</label>
                  <select className="input-field" style={{ padding: '8px' }} value={editingUser.ponto_tolerancia != null ? editingUser.ponto_tolerancia : ''} onChange={e => setEditingUser({...editingUser, ponto_tolerancia: e.target.value ? Number(e.target.value) : null})}>
                    <option value="">Usar padrão da loja</option>
                    <option value={0}>Sem tolerância</option>
                    <option value={5}>5 minutos</option>
                    <option value={10}>10 minutos</option>
                    <option value={15}>15 minutos</option>
                    <option value={20}>20 minutos</option>
                    <option value={30}>30 minutos</option>
                    <option value={60}>1 hora</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="btn" style={{ width: '100%', padding: '16px', fontWeight: 'bold' }}>
                Salvar Alterações
              </button>
            </form>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '0.85rem', opacity: 0.7 }}>
        Políticas FireCheck: Fotos e registros de checklists são armazenados por 90 dias para otimização de performance e segurança.
      </div>



      {isPurchasesOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '20px', pointerEvents: 'auto', backdropFilter: 'blur(5px)' }}>
          <div className="card animate-scale" style={{ width: '100%', maxWidth: '800px', height: '90vh', maxHeight: '800px', display: 'flex', flexDirection: 'column', position: 'relative', pointerEvents: 'auto', padding: '0', overflow: 'hidden', border: '1px solid var(--primary)', backgroundColor: 'var(--bg-color)' }}>
            <div style={{ backgroundColor: 'var(--primary)', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <Plus size={24} color="white" /> Registrar Compras
              </h3>
              <button style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }} onClick={() => setIsPurchasesOpen(false)}><X size={24} /></button>
            </div>
            
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
                <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', color: 'var(--primary)' }}>Nova Nota Fiscal / Despesa</h3>
                
                <div style={{ marginBottom: '16px' }}>
                  <label className="input-label">📝 O que você comprou?</label>
                  <textarea 
                    className="input-field" 
                    placeholder="Ex: Abastecimento do carro da entrega, Papelão, Manutenção..." 
                    style={{ minHeight: '80px', resize: 'vertical' }}
                    value={purchaseForm.description}
                    onChange={e => setPurchaseForm({ ...purchaseForm, description: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label className="input-label">Valor (R$)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="input-field" 
                      placeholder="0.00" 
                      value={purchaseForm.value}
                      onChange={e => setPurchaseForm({ ...purchaseForm, value: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="input-label">Categoria</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="Combustível, Insumos..." 
                      value={purchaseForm.category}
                      onChange={e => setPurchaseForm({ ...purchaseForm, category: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="input-label">Data da NF</label>
                    <input 
                      type="date" 
                      className="input-field" 
                      value={purchaseForm.date}
                      onChange={e => setPurchaseForm({ ...purchaseForm, date: e.target.value })}
                    />
                  </div>
                </div>

                {purchaseForm.photo && (
                  <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Foto da Nota Fiscal anexada:</p>
                    <img src={purchaseForm.photo} alt="Nota Fiscal" style={{ maxWidth: '150px', maxHeight: '150px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'block', margin: '0 auto' }} />
                  </div>
                )}

                <input type="file" id="purchase-ocr-input" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePurchaseOCRUpload} />

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn-secondary" style={{ flex: 1, padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', borderColor: '#FFA000', color: '#FFA000' }} onClick={() => document.getElementById('purchase-ocr-input')?.click()} disabled={isProcessingPurchase}>
                    {isProcessingPurchase ? <div className="loader" style={{ width: 16, height: 16, borderTopColor: '#FFA000' }} /> : <Camera size={18} />} {isProcessingPurchase ? 'Lendo...' : 'Tirar Foto da Nota (IA)'}
                  </button>
                  <button className="btn" style={{ flex: 1.5, padding: '12px', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold' }} onClick={handleAddPurchase}>
                    Confirmar e Registrar Compra
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Relatório de Gastos</h3>
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', padding: '6px 16px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  Total: R$ {purchases.reduce((acc, curr) => acc + curr.value, 0).toFixed(2)}
                </div>
              </div>

              <div className="card" style={{ padding: '0', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '16px', fontSize: '0.85rem' }}>Postagem</th>
                      <th style={{ padding: '16px', fontSize: '0.85rem' }}>Data da NF</th>
                      <th style={{ padding: '16px', fontSize: '0.85rem' }}>Descrição</th>
                      <th style={{ padding: '16px', fontSize: '0.85rem' }}>Categoria (IA)</th>
                      <th style={{ padding: '16px', fontSize: '0.85rem' }}>Valor</th>
                      <th style={{ padding: '16px', fontSize: '0.85rem', textAlign: 'center' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          Nenhuma compra registrada.
                        </td>
                      </tr>
                    ) : (
                      purchases.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '16px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.postedAt}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', opacity: 0.7 }}>{p.postedBy}</div>
                          </td>
                          <td style={{ padding: '16px', fontSize: '0.9rem', fontWeight: 'bold' }}><Calendar size={14} style={{display:'inline', marginRight:'4px', verticalAlign: 'middle'}}/> {p.date}</td>
                          <td style={{ padding: '16px', fontSize: '0.9rem', fontWeight: 'bold' }}>{p.description}</td>
                          <td style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.category}</td>
                          <td style={{ padding: '16px', fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--error)' }}>R$ {Number(p.value).toFixed(2)}</td>
                          <td style={{ padding: '16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              {p.photo ? (
                                <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => setViewingPhotoUrl(p.photo)}>Ver Foto</button>
                              ) : (
                                <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', opacity: 0.5, cursor: 'not-allowed' }} disabled>Sem Foto</button>
                              )}
                              <button className="btn-secondary" style={{ padding: '4px 8px', color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.2)' }} onClick={() => { setPurchases(prev => prev.filter(item => item.id !== p.id)); addToast('Compra removida.', 'success'); }}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingPhotoUrl && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999999, padding: '20px', pointerEvents: 'auto' }}>
          <div className="card animate-scale" style={{ maxWidth: '600px', width: '100%', padding: '20px', textAlign: 'center', position: 'relative', border: '1px solid var(--primary)', backgroundColor: 'var(--bg-color)' }}>
            <button style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }} onClick={() => setViewingPhotoUrl(null)}><X size={24} /></button>
            <h3 style={{ marginBottom: '16px', color: 'var(--primary)' }}>Comprovante / Nota Fiscal</h3>
            <img src={viewingPhotoUrl} alt="Comprovante" style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px' }} />
          </div>
        </div>
      )}

      {/* 🚀 POP-UP DE BOAS-VINDAS (Abre na primeira visita) */}
      {showWelcomeTourModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="animate-scale" style={{ backgroundColor: 'var(--bg-card)', border: '2px solid var(--primary)', borderRadius: '20px', maxWidth: '520px', width: '100%', padding: '32px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', textAlign: 'center', position: 'relative' }}>
            <button 
              onClick={() => {
                setShowWelcomeTourModal(false);
                localStorage.setItem('firecheck_tour_dismissed', 'true');
              }}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ width: '64px', height: '64px', borderRadius: '16px', backgroundColor: 'rgba(255, 77, 0, 0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 0 20px rgba(255, 77, 0, 0.3)' }}>
              <Flame size={36} />
            </div>

            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '10px' }}>
              Bem-vindo ao FireCheck! 🔥
            </h2>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '24px' }}>
              Gostaria de ver um tutorial rápido de como criar checklists por IA, cadastrar equipe, gerenciar frotas ou bater ponto facial?
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                onClick={() => {
                  setShowWelcomeTourModal(false);
                  localStorage.setItem('firecheck_tour_dismissed', 'true');
                }}
                style={{ padding: '12px 20px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
              >
                Agora Não
              </button>

              <button 
                onClick={() => {
                  setShowWelcomeTourModal(false);
                  setShowTutorialHub(true);
                }}
                style={{ padding: '12px 28px', borderRadius: '10px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 0 20px rgba(255, 77, 0, 0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                🎓 Escolher um Tutorial!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🎓 CENTRAL DE TUTORIAIS INTERATIVOS (HUB) */}
      {showTutorialHub && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="animate-scale" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '24px', maxWidth: '750px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '32px', boxShadow: '0 25px 60px rgba(0,0,0,0.6)', position: 'relative' }}>
            
            <button 
              onClick={() => setShowTutorialHub(false)}
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.08)', border: 'none', color: 'var(--text-main)', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={18} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px', backgroundColor: 'rgba(255,77,0,0.1)', padding: '4px 12px', borderRadius: '20px' }}>
                🎓 Central de Ajuda Interativa
              </span>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '8px' }}>
                O que você deseja aprender agora?
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '6px' }}>
                Clique no tópico desejado para iniciar um guia prático passo a passo no seu painel.
              </p>
            </div>

            {/* Grid de Tópicos de Tutorial */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              {Object.values(TUTORIAL_TOPICS).map(topic => (
                <div 
                  key={topic.id}
                  onClick={() => handleStartSpecificTutorial(topic.id)}
                  style={{
                    backgroundColor: 'var(--bg-color)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                        {topic.categoryIcon}
                      </div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                        {topic.title}
                      </h3>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {topic.subtitle}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', pt: '8px', borderTop: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{topic.steps.length} passos rápidos</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Iniciar Tour <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* 🎓 OVERLAY DO TUTORIAL INTERATIVO PASSO A PASSO (FIXADO NO TOPO) */}
      {isTourActive && activeTopicObj && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 99999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '30px 20px 20px 20px', overflowY: 'auto', pointerEvents: 'auto' }}>
          <div className="animate-scale" style={{ backgroundColor: 'var(--bg-card)', border: '2px solid var(--primary)', borderRadius: '20px', maxWidth: '650px', width: '100%', padding: '28px', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', position: 'relative', marginTop: '10px' }}>
            
            {/* Header do Passo */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: 'rgba(255, 77, 0, 0.12)' }}>
                  {activeTopicObj.steps[tourStep].icon}
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '1px', backgroundColor: 'rgba(255, 77, 0, 0.1)', padding: '4px 10px', borderRadius: '20px' }}>
                  Passo {tourStep + 1} de {activeTopicObj.steps.length}
                </span>
              </div>

              <button 
                onClick={() => {
                  setIsTourActive(false);
                  setShowTutorialHub(true);
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                🎓 Voltar ao Menu
              </button>
            </div>

            {/* Título & Descrição do Passo */}
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '10px' }}>
              {activeTopicObj.steps[tourStep].title}
            </h3>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '24px' }}>
              {activeTopicObj.steps[tourStep].description}
            </p>

            {/* Barra de Progresso */}
            <div style={{ height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '10px', overflow: 'hidden', marginBottom: '24px' }}>
              <div style={{ width: `${((tourStep + 1) / activeTopicObj.steps.length) * 100}%`, height: '100%', backgroundColor: 'var(--primary)', transition: 'width 0.3s ease' }} />
            </div>

            {/* Controles de Navegação */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                onClick={handlePrevTourStep}
                disabled={tourStep === 0}
                style={{ 
                  padding: '10px 18px', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border-color)', 
                  backgroundColor: 'transparent', 
                  color: tourStep === 0 ? 'var(--border-color)' : 'var(--text-main)', 
                  fontWeight: 600, 
                  fontSize: '0.85rem', 
                  cursor: tourStep === 0 ? 'not-allowed' : 'pointer' 
                }}
              >
                ⬅️ Anterior
              </button>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {tourStep + 1} de {activeTopicObj.steps.length}
              </div>

              <button 
                onClick={handleNextTourStep}
                style={{ 
                  padding: '10px 24px', 
                  borderRadius: '8px', 
                  border: 'none', 
                  backgroundColor: 'var(--primary)', 
                  color: 'white', 
                  fontWeight: 800, 
                  fontSize: '0.9rem', 
                  cursor: 'pointer',
                  boxShadow: '0 0 15px rgba(255, 77, 0, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {tourStep === activeTopicObj.steps.length - 1 ? '🎉 Finalizar e Voltar' : 'Próximo ➡️'}
              </button>
            </div>

          </div>
        </div>
      )}

      </main>

      {/* Container de Toasts */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 999999, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {toasts.map(toast => (
          <div key={toast.id} className="animate-scale" style={{ 
            backgroundColor: toast.type === 'success' ? '#10b981' : 'var(--primary)', 
            color: 'var(--text-main)', 
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
            <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', opacity: 0.8, padding: '4px' }}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

