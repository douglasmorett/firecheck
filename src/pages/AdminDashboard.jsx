import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PrimeirosPassos from '../components/PrimeirosPassos';
import AlterarSenha from '../components/AlterarSenha';
import { BarraLuz, Velocimetro, Selo, iniciais } from '../components/painel/Painel';
import ConversaoDoSite from '../components/painel/ConversaoDoSite';
import { Plus, ArrowUpRight, MessageCircle, ClipboardList, ShieldAlert, Users, Activity, Trophy, TrendingUp, Clock, CheckCircle, AlertCircle, Bell, Flame, Edit2, Trash2, CalendarClock, UserPlus, Mail, Lock, LogOut, Smartphone, X, Camera, Video, Monitor, Info, Save, ArrowRight, ShieldCheck, Calendar, Target, FileDown, LifeBuoy, Menu, UserCheck, Bot, Car, ShoppingCart, Package, Mic, Send, Sparkles, Settings, Eye, ArrowDownAZ, Play, PlayCircle, Loader2, AlertTriangle } from 'lucide-react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import API_URL from '../api';
import { vendeNoApp } from '../vendaNoApp';
import BarraDeAcessoRemoto from '../components/BarraDeAcessoRemoto';
import PontoModule from '../components/ponto/PontoModule';
import WhatsappDaLoja from '../components/WhatsappDaLoja';
import { respostaDaTarefa } from '../utils/respostaDaTarefa';
import EstoqueDaLista from '../components/EstoqueDaLista';
import CodigosDeAtivacao from '../components/CodigosDeAtivacao';
import BotaoTutorial from '../components/tutoriais/BotaoTutorial';
import BotaoTutoriaisEmVideo from '../components/tutoriais/BotaoTutoriaisEmVideo';
import { centralAbreSozinha, lerUsuario } from '../tutoriais/telas';

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

const RECURRENCE_LABEL = { daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal', quarterly: 'Trimestral', semiannual: 'Semestral', '': '—' };

const ALERTAS_IA = [];

const DEFAULT_GESTOR_PERMISSIONS = {
  perm_checklists: true,
  perm_equipe: true,
  perm_ponto: true,
  perm_alertas: true,
  perm_ranking: true,
  perm_compras: true,
  perm_frota: true,
  perm_notificacoes: true,
};

const getSafeGestorPermissions = (perms) => {
  if (!perms) return { ...DEFAULT_GESTOR_PERMISSIONS };
  if (typeof perms === 'string') {
    try {
      perms = JSON.parse(perms);
      if (typeof perms === 'string') perms = JSON.parse(perms);
    } catch {
      return { ...DEFAULT_GESTOR_PERMISSIONS };
    }
  }
  if (!perms || typeof perms !== 'object' || Array.isArray(perms)) {
    return { ...DEFAULT_GESTOR_PERMISSIONS };
  }
  return { ...DEFAULT_GESTOR_PERMISSIONS, ...perms };
};

// Fonte única da regra de teste no painel, espelhando trialExpirado() do backend:
// trial_ends_at manda quando existe; sem ele, valem 7 dias desde a criação.
// Devolve os dias restantes (negativo = expirado) ou null quando não há data.
const diasRestantesDeTeste = (conta) => {
  const fim = conta?.trial_ends_at
    ? new Date(conta.trial_ends_at)
    : conta?.created_at
      ? new Date(new Date(conta.created_at).getTime() + 7 * 24 * 60 * 60 * 1000)
      : null;
  if (!fim || Number.isNaN(fim.getTime())) return null;
  return Math.ceil((fim - new Date()) / (24 * 60 * 60 * 1000));
};

const trialInfo = (conta) => {
  const fim = conta?.trial_ends_at
    ? new Date(conta.trial_ends_at)
    : conta?.created_at
      ? new Date(new Date(conta.created_at).getTime() + 7 * 24 * 60 * 60 * 1000)
      : null;
  if (!fim || Number.isNaN(fim.getTime())) return 'Sem data de término registrada.';
  const dias = Math.ceil((fim - new Date()) / (24 * 60 * 60 * 1000));
  const data = fim.toLocaleDateString('pt-BR');
  if (dias < 0) return `Expirou em ${data}, há ${Math.abs(dias)} dia(s). O cliente está sem acesso.`;
  if (dias === 0) return `Termina hoje (${data}).`;
  return `Termina em ${data}, daqui a ${dias} dia(s).`;
};

// Dia operacional (YYYY-MM-DD) no fuso de São Paulo — o mesmo corte que o
// servidor usa. toISOString() devolve o dia UTC, que vira às 21h de SP: o
// formulário de batida manual vinha pré-preenchido com amanhã e o espelho de
// ponto abria no mês seguinte na noite do último dia do mês.
const diaOperacionalSP = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

// ── Planos comerciais ────────────────────────────────────────────────────────
// Fonte única de preço e link de pagamento dentro do painel, espelhando a landing
// page. Antes cada tela repetia os valores e eles divergiram: o paywall anunciava
// "Starter R$67" apontando para o checkout de R$149, e "Pro R$97/mês" apontando
// para o plano ANUAL de R$1.164 à vista.
const CAKTO = 'https://pay.cakto.com.br';
const PLANOS_COMERCIAIS = [
  {
    id: 'checklists',
    nome: 'Só Checklists',
    resumo: 'Auditoria, fotos e vistorias ilimitadas com IA.',
    itens: ['Checklists ilimitados', 'Até 30 colaboradores', 'Auditoria visual por IA', 'Alertas de irregularidade no WhatsApp', 'Relatórios em PDF e Excel'],
    mensal: { valor: 'R$ 149', periodo: '/mês', nota: null, link: `${CAKTO}/3eph5ko_856837` },
    anual: { valor: '12x R$ 97', periodo: '/mês', nota: 'R$ 1.164 por ano — economia de R$ 624', link: `${CAKTO}/e7c88df` },
  },
  {
    id: 'combo',
    nome: 'Combo Tudo em 1',
    resumo: 'Checklists ilimitados + Ponto IA com biometria no mesmo lugar.',
    destaque: true,
    itens: ['Tudo do módulo Checklist', 'Tudo do módulo Ponto IA', 'Até 50 colaboradores', 'Reconhecimento facial + trava por GPS', 'Suporte VIP com gerente de conta'],
    mensal: { valor: 'R$ 197', periodo: '/mês', nota: null, link: `${CAKTO}/pavdwiz_869704` },
    anual: { valor: '12x R$ 167', periodo: '/mês', nota: 'R$ 2.004 por ano — economia de R$ 360', link: `${CAKTO}/36m7kzq` },
  },
  {
    id: 'ponto',
    nome: 'Só Ponto Eletrônico',
    resumo: 'Ponto com biometria facial, trava de GPS e alertas no WhatsApp.',
    itens: ['Até 30 colaboradores', 'Reconhecimento facial com IA', 'Trava de geolocalização', 'Alerta de atraso e saída no WhatsApp', 'Folha de ponto pronta para o contador'],
    mensal: { valor: 'R$ 149', periodo: '/mês', nota: null, link: `${CAKTO}/kfx3fri_869702` },
    anual: { valor: '12x R$ 97', periodo: '/mês', nota: 'R$ 1.164 por ano — economia de R$ 624', link: `${CAKTO}/o2xichf` },
  },
];

const linkComDados = (link, perfil) =>
  `${link}?email=${encodeURIComponent(perfil?.email || '')}&name=${encodeURIComponent(perfil?.name || '')}`;

const PERMISSION_LABELS = {
  perm_checklists: 'Criar e editar checklists',
  perm_equipe: 'Gerenciar equipe',
  perm_ponto: 'Controle de ponto',
  perm_alertas: 'Alertas da IA',
  perm_ranking: 'Ranking',
  perm_compras: 'Compras e estoque',
  perm_frota: 'Frota e veículos',
  perm_notificacoes: 'Notificações',
};

// O que aparece na tela simples do funcionário (Douglas, 22/10/2026: "no
// cadastro da equipe eu tenho que conseguir selecionar o que aparece para aquele
// funcionário e o que não"). Ligado por padrão — era o que todos viam —, menos
// a entrada e saída de estoque, que o gestor libera. O servidor guarda as mesmas
// chaves (permissoesDoFuncionario) e confere o estoque em podeMovimentarEstoque.
const TELA_DO_FUNCIONARIO = [
  { chave: 'tela_ponto', rotulo: 'Bater ponto', ajuda: 'O card "Meu ponto" (só aparece se a loja tem o ponto).' },
  { chave: 'tela_checklists', rotulo: 'Checklists', ajuda: 'Os checklists atribuídos a ele.' },
  { chave: 'tela_compras', rotulo: 'Conferência de estoque', ajuda: 'As listas de compras para contar o que tem na loja.' },
  { chave: 'perm_estoque', rotulo: 'Entrada e saída de estoque', ajuda: 'Lança a mercadoria que chegou e o que saiu, numa tela simples, sem o painel do gestor.', padrao: false },
  { chave: 'tela_ocorrencia', rotulo: 'Registrar ocorrência', ajuda: 'O botão para avisar o que fugiu da rotina.' },
  { chave: 'tela_descarte', rotulo: 'Registrar descarte', ajuda: 'O botão para lançar perda e descarte.' },
];

const telaDoFuncionario = (perms) => Object.fromEntries(
  TELA_DO_FUNCIONARIO.map(({ chave, padrao = true }) => [chave, padrao ? perms?.[chave] !== false : perms?.[chave] === true])
);

// O que vai para o servidor em `permissions`: o gestor leva o quadro todo; o
// funcionário, o que aparece na tela dele; os outros papéis, nada.
const permissoesParaSalvar = (role, perms) => {
  if (role === 'gestor') return perms || DEFAULT_GESTOR_PERMISSIONS;
  if (role === 'funcionario') return telaDoFuncionario(perms);
  return null;
};

function TelaDoFuncionario({ perms, onChange }) {
  const atual = telaDoFuncionario(perms);
  return (
    <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'rgba(8, 145, 178, 0.05)', border: '1px solid rgba(8, 145, 178, 0.2)', borderRadius: '12px' }}>
      <label className="input-label" style={{ display: 'block', color: 'var(--info)', marginBottom: '4px', fontWeight: 'bold' }}>
        O que aparece na tela deste funcionário
      </label>
      <p style={{ margin: '0 0 12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Desmarque o que ele não usa: a tela fica mais simples e direta.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {TELA_DO_FUNCIONARIO.map(({ chave, rotulo, ajuda }) => (
          <label key={chave} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
            <input type="checkbox" checked={atual[chave]} onChange={e => onChange({ ...atual, [chave]: e.target.checked })} style={{ marginTop: '3px' }} />
            <span>
              <strong style={{ fontSize: '0.9rem' }}>{rotulo}</strong>
              <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{ajuda}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

const TAB_PERMISSION_MAP = {
  checklists: 'perm_checklists',
  equipe: 'perm_equipe', 
  ponto: 'perm_ponto',
  alertas: 'perm_alertas',
  ranking: 'perm_ranking',
  compras: 'perm_compras',
  vehicles: 'perm_frota',
  notificacoes: 'perm_notificacoes',
};

// ── Helpers ─────────────────────────────────────────────────────────────────
// Selo de status sem emoji (visual de 21/11/2026): ponto colorido + texto.
const StatusBadge = ({ status }) => {
  const map = {
    aprovado:  { label: 'Aprovado pela IA', color: 'var(--ok)' },
    reprovado: { label: 'Reprovado pela IA', color: 'var(--bad)' },
    pendente:  { label: 'Aguardando a IA', color: '#D97706' },
    // Checklist sem nenhuma foto: a IA não tem o que analisar. É operação normal,
    // não falha — por isso um rótulo neutro, e não um alerta.
    ignorado:  { label: 'Sem foto para a IA', color: 'var(--text-muted)' },
    falha:     { label: 'Falha na IA', color: 'var(--bad)' },
  };
  const s = map[status] || map.pendente;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '4px 11px 4px 9px', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 600,
      color: s.color, backgroundColor: 'var(--bg-card)', boxShadow: '0 0 0 1px var(--border-color)' }}>
      <i style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
      {s.label}
    </span>
  );
};

// "Verificado por Fulana em 15/10/2026 às 16:02". Baixas antigas, de antes de
// a hora ser gravada, saem só com o nome.
const textoDaBaixa = (s) => {
  const quando = s?.resolved_at ? new Date(s.resolved_at) : null;
  const hora = quando && !isNaN(quando)
    ? ` em ${quando.toLocaleDateString('pt-BR')} às ${quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : '';
  return `Verificado por ${s?.resolved_by_nome || s?.resolved_by || 'gestor'}${hora}`;
};

const BarPct = ({ pct, color }) => <BarraLuz pct={pct} cor={color || 'var(--primary)'} />;

// Status de um checklist enviado, pela régua da IA (usado na lista e nos números
// do Dashboard). _meta e global_error são metadados do processamento, não pareceres
// sobre tarefas: contá-los fazia uma submissão nunca analisada virar "aprovada".
const statusDaSubmissao = (s) => {
  const feedbacks = Object.entries(s?.feedback_info || {})
    .filter(([k]) => !k.startsWith('_') && k !== 'global_error')
    .map(([, v]) => v);
  const hasWarnings = feedbacks.some(f => f?.status === 'warning' || f?.status === 'error');
  const tarefasComFoto = (s?.tasks || []).filter(t => t.photo && !t.forceOverride);
  if (s?.feedback_info?.global_error || s?.feedback_info?._meta?.status === 'revisao_manual') return 'falha';
  if (!tarefasComFoto.length) return 'ignorado';
  if (hasWarnings) return 'reprovado';
  // Só é aprovado quando TODAS as fotos foram analisadas. Antes, uma análise
  // parcial (1 de 8 fotos) já virava aprovação.
  return feedbacks.length >= tarefasComFoto.length ? 'aprovado' : 'pendente';
};
const tarefaReprovada = (s, t) => ['warning', 'error'].includes(s?.feedback_info?.[t.id]?.status);
// A lista de envios chega sem as imagens ("[imagem]", para ficar leve).
const temImagem = (src) => typeof src === 'string' && src.length > 0 && src !== '[imagem]';

// Foto de uma tarefa, buscada no detalhe do envio (o cartão "O que a IA viu").
function FotoDaTarefa({ submissaoId, tarefaId, alt }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let vivo = true;
    setUrl(null);
    fetch(`${API_URL}/api/submissions?id=${submissaoId}`, { headers: getAuthHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(s => { const t = s?.tasks?.find(x => x.id === tarefaId); if (vivo && temImagem(t?.photo)) setUrl(t.photo); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [submissaoId, tarefaId]);
  return url ? <img src={url} alt={alt} /> : null;
}
const ehHojeEmSP = (data) => {
  const dia = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return data && dia(data) === dia(Date.now());
};
// Nome legível do plano (o banco guarda o código: combo_anual, checklists10_mensal...).
const nomeDoPlano = (plano = '') => {
  const p = String(plano || '').toLowerCase();
  const ciclo = p.endsWith('anual') ? ' · anual' : p.endsWith('mensal') ? ' · mensal' : '';
  if (p.startsWith('checklists10')) return 'Até 10 pessoas' + ciclo;
  if (p.startsWith('checklists')) return 'Até 30 pessoas' + ciclo;
  if (p.startsWith('combo')) return 'Checklist + Ponto' + ciclo;
  if (p.startsWith('ponto')) return 'Ponto' + ciclo;
  return p ? p.charAt(0).toUpperCase() + p.slice(1).replace(/_/g, ' ') : 'Starter';
};
const saudacao = () => {
  const h = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};

const getUserStatus = (user) => {
  if (user.status === 'blocked') return { text: 'Conta Bloqueada', color: 'var(--error)' };
  if (user.status === 'pending') return { text: 'Pagamento Pendente', color: 'var(--warning)' };
  
  if (user.status === 'active') {
     if (user.expiration_date) {
        const expDate = new Date(user.expiration_date);
        const now = new Date();
        const diffDays = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return { text: 'Plano Expirado (Pendente)', color: 'var(--warning)' };
        return { text: `🟢 Plano Ativo (${diffDays} dias rest. no ciclo)`, color: 'var(--success)' };
     } else {
        return { text: `🟢 Plano Ativo (Pago)`, color: 'var(--success)' };
     }
  }
  
  // Trial — respeita a extensão concedida no painel (trial_ends_at).
  const diasRestantes = diasRestantesDeTeste(user);
  if (diasRestantes === null) return { text: 'Teste Ativo', color: '#FFA000' };
  if (diasRestantes < 0) return { text: 'Trial Expirado (Bloqueado)', color: 'var(--error)' };
  if (diasRestantes === 0) return { text: 'Último dia de Teste', color: '#FFA000' };
  return { text: `⏳ Teste Ativo (${diasRestantes} dias restantes)`, color: '#FFA000' };
};

const isBlocked = (user) => {
  if (user.status === 'blocked' || user.status === 'pending') return true;
  // Plano vencido não é pagante: o servidor já recusa o acesso (contaEmDia).
  if (user.status === 'active' && user.expiration_date && new Date(user.expiration_date) < new Date()) return true;
  if (user.status === 'trial') {
    const dias = diasRestantesDeTeste(user);
    return dias !== null && dias < 0;
  }
  return false;
};

// ── Componente Principal ─────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(() => {
    let saved = null;
    let user = null;
    try {
      saved = localStorage.getItem('admin_active_tab');
      const userStr = localStorage.getItem('user');
      user = userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      console.error("Erro ao ler localStorage:", e);
    }
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
  const [checklistSortAlphabetical, setChecklistSortAlphabetical] = useState(() => {
    try {
      return localStorage.getItem('firecheck_admin_sort_alphabetical') === 'true';
    } catch (e) {
      return false;
    }
  });

  const sortedAdminChecklists = useMemo(() => {
    if (!checklists || checklists.length === 0) return [];
    if (!checklistSortAlphabetical) return checklists;
    return [...checklists].sort((a, b) =>
      (a.title || '').localeCompare(b.title || '', 'pt-BR', { numeric: true, sensitivity: 'base' })
    );
  }, [checklists, checklistSortAlphabetical]);

  const [team, setTeam] = useState([]);
  // Gestão de Clientes (master): clicar num contador filtra a lista; clicar de novo limpa.
  const [filtroContas, setFiltroContas] = useState(null); // null | 'trial' | 'bloqueadas' | 'pagantes'
  // Alternador mensal/anual da vitrine de planos do Ponto (aba Ponto do admin).
  const [dashBillingCycle, setDashBillingCycle] = useState('mensal');
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', store: 'Filial Centro' });
  // Nome da nova unidade fica separado de newUser.store: escrevê-lo lá faria a
  // condição que renderiza o campo virar falsa e o input sumir ao primeiro caractere.
  const [novaUnidadeNome, setNovaUnidadeNome] = useState('');
  // Dias de teste a conceder ao salvar o modal de plano (null = não alterar).
  const [trialDays, setTrialDays] = useState(null);
  // Submissões com reprocessamento de IA em andamento, para travar o botão.
  const [reprocessando, setReprocessando] = useState(new Set());
  // Foto exibida em tela cheia (null = nenhuma).
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  // Ciclo escolhido na tela de conta sem plano. Anual primeiro, como na landing.
  const [cicloPaywall, setCicloPaywall] = useState('anual');

  // Abrir uma data URI com window.open é bloqueado pelos navegadores e resultava
  // em aba em branco. URL normal abre em nova aba; base64 abre aqui mesmo.
  const ampliarFoto = (src) => {
    if (!src) return;
    if (typeof src === 'string' && src.startsWith('http')) window.open(src, '_blank', 'noopener');
    else setFotoAmpliada(src);
  };
  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [stats, setStats] = useState(STATS);
  const [submissions, setSubmissions] = useState([]);
  // Filtro da lista vindo dos atalhos do Dashboard ("1 reprovado", "20 aprovados"...)
  const [filtroStatus, setFiltroStatus] = useState(null);
  // Aba Checklists: filtro em pílulas (o que falta hoje aparece primeiro)
  const [filtroChecklists, setFiltroChecklists] = useState('pendentes');
  const listaDaAuditoriaRef = useRef(null);
  const submissionsRef = useRef(submissions);
  submissionsRef.current = submissions;
  const [cameras, setCameras] = useState([]);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(null);
  const [newCamera, setNewCamera] = useState({ name: '', url: '', username: '', password: '', ai_commands: [] });
  const [newCommand, setNewCommand] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  // A listagem vem sem as imagens, para não baixar dezenas de MB a cada
  // atualização automática. O registro completo é buscado ao abrir o detalhe.
  const abrirDetalheSubmissao = async (s) => {
    setSelectedSubmission(s);
    setShowSubmissionModal(true);
    try {
      const res = await fetch(`${API_URL}/api/submissions?id=${s.id}`, { headers: getAuthHeaders() });
      if (!res.ok) return; // mantém o resumo já exibido
      const completo = await res.json();
      if (completo && completo.id) setSelectedSubmission(completo);
    } catch (e) {
      console.error('Erro ao carregar detalhe da submissão:', e);
    }
  };
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
  // -- Integração com o FireHub (só leitura: a ligação nasce no FireHub) --
  const [firehubLigacao, setFirehubLigacao] = useState(null);

  // -- Tutorial Interativo / Tour Guiado --
  const [showWelcomeTourModal, setShowWelcomeTourModal] = useState(false);
  const [showTutorialHub, setShowTutorialHub] = useState(false);
  const [selectedTutorialTopic, setSelectedTutorialTopic] = useState('checklists');
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  useEffect(() => {
    const tourDismissed = localStorage.getItem('firecheck_tour_dismissed');
    // O master administra clientes: o convite do tour de loja não faz sentido para ele.
    if (lerUsuario()?.role === 'master') return;
    // Quando a central de tutoriais em vídeo vai abrir sozinha, ela é a boas-vindas:
    // o convite do tour antigo não abre junto nem na próxima visita (o tour
    // continua no botão "Tour do Sistema" do menu).
    if (!tourDismissed && centralAbreSozinha(lerUsuario(), '/admin')) {
      localStorage.setItem('firecheck_tour_dismissed', 'true');
      return;
    }
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
      title: 'Como Criar um Checklist com IA (Bill)',
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
      title: 'Como Cadastrar e Vistoriar Minha Frota',
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
      title: 'Como Fazer Lista de Compras e Estoque',
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
      title: 'Como Cadastrar Minha Equipe e Gerentes',
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
      title: 'Como Funciona o Ponto por Reconhecimento Facial',
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
      title: 'Visão Geral do Dashboard & Auditoria com Fotos',
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
  const [filtroBaixa, setFiltroBaixa] = useState('todos');
  // -- Compras / Estoque --
  const [shoppingLists, setShoppingLists] = useState([]);
  const [shoppingSubmissions, setShoppingSubmissions] = useState([]);
  const [selectedShoppingSubModal, setSelectedShoppingSubModal] = useState(null);
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  const [estoqueAberto, setEstoqueAberto] = useState(null);
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
  const [pontoMonth, setPontoMonth] = useState(diaOperacionalSP().slice(0, 7));
  const [pontoFilterEmployee, setPontoFilterEmployee] = useState('todos');
  const [showPontoPanel, setShowPontoPanel] = useState(false);
  const [pontoPhotoPreview, setPontoPhotoPreview] = useState(null);
  const [showPontoManualModal, setShowPontoManualModal] = useState(false);
  const [editingPontoRecord, setEditingPontoRecord] = useState(null);
  const [pontoManualForm, setPontoManualForm] = useState({
    userId: '',
    type: 'entrada',
    date: diaOperacionalSP(),
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
  const [schedules, setSchedules] = useState([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    name: '', type: 'fixed', hora_entrada: '08:00', hora_saida: '18:00', intervalo_inicio: '12:00', intervalo_fim: '13:00', tolerancia: 15, color: '#3B82F6',
    weekdays: [
      { weekday: 0, is_workday: false, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' },
      { weekday: 1, is_workday: true, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' },
      { weekday: 2, is_workday: true, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' },
      { weekday: 3, is_workday: true, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' },
      { weekday: 4, is_workday: true, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' },
      { weekday: 5, is_workday: true, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' },
      { weekday: 6, is_workday: false, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' }
    ]
  });

  const [whatsappActive, setWhatsappActive] = useState(true);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [waPontoAtraso, setWaPontoAtraso] = useState(true);
  const [waChecklistReprovado, setWaChecklistReprovado] = useState(true);
  const [waChecklistAtrasado, setWaChecklistAtrasado] = useState(true);
  const [waPontoDiario, setWaPontoDiario] = useState(true);
  const [waChecklistAprovado, setWaChecklistAprovado] = useState(true);
  const [waOcorrencia, setWaOcorrencia] = useState(true);
  const [waDescarte, setWaDescarte] = useState(true);
  // Resultado do último teste de WhatsApp: { ok, motivo, numero, avisos }.
  const [testeWhats, setTesteWhats] = useState(null);
  // { conectado, motivo } — nulo enquanto não se sabe.
  const [whatsForaDoAr, setWhatsForaDoAr] = useState(null);
  // Primeiros passos: só desenha depois que WhatsApp, checklists e equipe chegaram (senão pisca).
  const [whatsChecado, setWhatsChecado] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [passosOcultos, setPassosOcultos] = useState(() => { try { return localStorage.getItem('firecheck_primeiros_passos_oculto') === '1'; } catch { return false; } });
  const [testandoWhats, setTestandoWhats] = useState(false);
  const [ocorrencias, setOcorrencias] = useState([]);
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
    
    let user = null;
    try {
      user = JSON.parse(savedUser);
    } catch (e) {
      console.error("Erro ao ler dados do usuário:", e);
      localStorage.removeItem('user');
      localStorage.removeItem('firecheck_token');
      navigate('/login');
      return;
    }
    if (!user) {
      navigate('/login');
      return;
    }
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

    // O campo do Perfil edita o rótulo, não a chave da conta.
    if (user.store_name || user.store) setCompanyName(user.store_name || user.store);
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
    if (user.wa_ocorrencia !== undefined) setWaOcorrencia(user.wa_ocorrencia);
    if (user.wa_descarte !== undefined) setWaDescarte(user.wa_descarte);
    
    // Proteção extra: se for funcionário, não deixa ver o admin.
    // O papel que a API grava é 'funcionario' — 'employee' é nomenclatura antiga
    // que nunca casava, então qualquer funcionário digitando /admin abria o
    // painel do gestor com a equipe inteira. Gestor continua passando.
    if (user.role === 'funcionario' || user.role === 'employee') {
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
    fetchSchedules();
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

  // Ligação com o FireHub: os descartes desta loja vão para lá e viram perda.
  useEffect(() => {
    fetch(`${API_URL}/api/integracoes/firehub/status`, { headers: getAuthHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setFirehubLigacao(d); })
      .catch(() => { /* sem resposta: o bloco mostra "não conectado" */ });
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
        // Android: este build não tem o Firebase configurado (sem google-services.json).
        // PushNotifications.register() lança IllegalStateException na thread nativa e o app
        // inteiro fecha ao abrir — o try/catch do JavaScript não alcança (21/11/2026, 24 falhas
        // no Play, POCO M6 Pro / Android 15). iPhone usa APNs e não passa por aqui.
        if (Capacitor.getPlatform() === 'android') {
          console.log('[Push] Android sem Firebase: registro de notificações ignorado.');
          return;
        }
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

  const fetchSchedules = async () => {
    try {
      const savedUser = localStorage.getItem('user');
      if (!savedUser) return;
      const user = JSON.parse(savedUser);
      const res = await fetch(`${API_URL}/api/schedules?store=${encodeURIComponent(user.store)}`, {
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
      });
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
      }
    } catch (err) { console.error('Erro ao buscar escalas:', err); }
  };

  const handleSaveSchedule = async () => {
    try {
      const savedUser = localStorage.getItem('user');
      if (!savedUser) return;
      const user = JSON.parse(savedUser);
      
      const payload = {
        ...scheduleForm,
        store: user.store
      };

      const url = editingSchedule ? `${API_URL}/api/schedules/${editingSchedule.id}` : `${API_URL}/api/schedules`;
      const method = editingSchedule ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '')
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        fetchSchedules();
        setShowScheduleModal(false);
      }
    } catch (err) {
      console.error('Erro ao salvar escala:', err);
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta escala?')) return;
    try {
      const res = await fetch(`${API_URL}/api/schedules/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
      });
      if (res.ok) {
        fetchSchedules();
      }
    } catch (err) {
      console.error('Erro ao excluir escala:', err);
    }
  };

  const handleEditSchedule = (schedule) => {
    setEditingSchedule(schedule);
    let parsedWeekdays = schedule.weekdays;
    if (typeof parsedWeekdays === 'string') {
      try { parsedWeekdays = JSON.parse(parsedWeekdays); } catch(e) { parsedWeekdays = scheduleForm.weekdays; }
    }
    setScheduleForm({
      name: schedule.name || '',
      type: schedule.type || 'fixed',
      hora_entrada: schedule.hora_entrada || '08:00',
      hora_saida: schedule.hora_saida || '18:00',
      intervalo_inicio: schedule.intervalo_inicio || '12:00',
      intervalo_fim: schedule.intervalo_fim || '13:00',
      tolerancia: schedule.tolerancia || 15,
      color: schedule.color || '#3B82F6',
      weekdays: parsedWeekdays || scheduleForm.weekdays
    });
    setShowScheduleModal(true);
  };


  const handleSavePontoManual = async () => {
    if (!pontoManualForm.userId || !pontoManualForm.date || !pontoManualForm.time) {
      alert('Preencha todos os campos obrigatórios: Funcionário, Data e Horário.');
      return;
    }
    try {
      setPontoSubmitting(true);
      const selectedEmp = (team || []).find(u => String(u.id) === String(pontoManualForm.userId));
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
          date: diaOperacionalSP(),
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
      const res = await fetch(`${API_URL}/api/shopping`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      // A resposta era ignorada: uma falha fechava o modal como se tivesse salvo,
      // e o lojista perdia a lista inteira que acabara de montar.
      if (!res.ok) {
        const erro = await res.json().catch(() => null);
        alert(`⚠️ ${erro?.error || erro?.message || `Não foi possível salvar a lista (erro ${res.status}).`} O conteúdo continua aqui — tente novamente.`);
        return;
      }
      setShowShoppingModal(false);
      setEditingShopping(null);
      setNewShopping({ title: '', recurrence: 'weekly', weekdays: [], assignedTo: 'todos', items: [{ name: '', unit: 'un', minStock: '', category: 'geral' }] });
      fetchShoppingLists();
    } catch (e) {
      console.error('Erro ao salvar lista:', e);
      alert('Erro de conexão ao salvar a lista. O conteúdo continua aqui — tente novamente.');
    }
    setIsSavingShopping(false);
  };

  const handleDeleteShopping = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta lista de compras?')) return;
    try {
      const res = await fetch(`${API_URL}/api/shopping/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      // Sem checar a resposta, uma falha sumia sem aviso e o lojista achava que
      // havia excluído — até a lista reaparecer na próxima atualização da tela.
      if (!res.ok) {
        const erro = await res.json().catch(() => null);
        alert(`⚠️ ${erro?.error || erro?.message || `Não foi possível excluir a lista (erro ${res.status}).`}`);
        return;
      }
      fetchShoppingLists();
    } catch (e) {
      console.error('Erro ao deletar lista:', e);
      alert('Erro de conexão ao excluir a lista. Tente novamente.');
    }
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

  // O texto da resposta vai para dentro do HTML do PDF: escapar evita que um
  // "<" digitado pelo funcionário quebre o relatório.
  const escaparHtml = (v) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
          .status-neutro { background-color: #f3f4f6; color: #111827; max-width: 60%; text-align: right; }
          .lista-itens { list-style: none; padding: 0; margin: 8px 0 0; font-size: 13px; }
          .lista-itens li { padding: 2px 0; }
          .lista-itens li.faltou { color: #991b1b; }
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
          <div class="logo">FireCheck</div>
          <div style="font-size: 14px; color: #6b7280;">Relatório de Auditoria Digital</div>
        </div>

        <div class="meta-info">
          <div class="meta-item"><strong>Checklist:</strong> ${cl?.title || submission.checklist_title || 'N/A'}</div>
          <div class="meta-item"><strong>Unidade/Loja:</strong> ${submission.store}</div>
          <div class="meta-item"><strong>Responsável:</strong> ${submission.employee_name}</div>
          <div class="meta-item"><strong>Data/Hora de Envio:</strong> ${new Date(submission.created_at).toLocaleString('pt-BR')} (Horário de Brasília)</div>
          <div class="meta-item"><strong>Resultado/Conclusão:</strong> ${pct}% concluído (${completedTasks}/${totalTasks} tarefas)</div>
          ${submission.vehicle_id ? `<div class="meta-item"><strong>Veículo Inspecionado:</strong> Sim (ID: ${submission.vehicle_id})</div>` : ''}
        </div>

        <div class="section-title">Respostas e Auditoria</div>
        ${submission.tasks.map((task, idx) => {
          const feedback = submission.feedback_info?.[task.id];
          // A resposta em texto: o PDF reduzia toda tarefa a Sim/Não, e a lista
          // de itens, o número e o texto livre nem apareciam.
          const resposta = respostaDaTarefa(task);
          const hasPhoto = task.photos && task.photos.length > 0 || task.photo;
          const photos = task.photos || (task.photo ? [task.photo] : []);
          return `
            <div class="task-card">
              <div class="task-header">
                <div>${idx + 1}. ${task.text}</div>
                <span class="status-badge ${resposta.tom === 'ok' ? 'status-sim' : resposta.tom === 'falha' ? 'status-nao' : 'status-neutro'}">
                  ${escaparHtml(resposta.itens ? `${resposta.itens.filter(i => i.marcado).length} de ${resposta.itens.length}` : resposta.texto)}
                </span>
              </div>
              ${resposta.itens ? `
                <ul class="lista-itens">
                  ${resposta.itens.map(i => `<li class="${i.marcado ? 'marcado' : 'faltou'}">${i.marcado ? '✔' : '✘'} ${escaparHtml(i.nome)}</li>`).join('')}
                </ul>
              ` : ''}
              ${hasPhoto || feedback ? `
                <div class="evidence-grid">
                  ${hasPhoto ? `
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                      ${photos.map(p => `<img class="evidence-img" src="${p}" />`).join('')}
                    </div>
                  ` : ''}
                  ${feedback ? `
                    <div class="ai-feedback ${feedback.status === 'success' ? 'success' : ''}">
                      <strong>${feedback.status === 'success' ? 'Aprovado pela IA' : 'Reprovado pela IA'}:</strong>
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
        setDadosCarregados(true);
        
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
              setUserProfile(prev => { if (!prev || JSON.stringify(prev) !== JSON.stringify(updatedMe)) { localStorage.setItem('user', JSON.stringify(updatedMe)); return updatedMe; } return prev; });
           }
        }
        
        const statsData = await statsRes.json();
        setStats(statsData);

        // Ocorrências e descartes registrados pela equipe. Falhar aqui não pode
        // derrubar o painel: é uma seção a mais, não o painel inteiro.
        fetch(`${API_URL}/api/ocorrencias${query}`, {
          headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
        })
          .then(r => r.ok ? r.json() : [])
          .then(d => setOcorrencias(Array.isArray(d) ? d : []))
          .catch(() => {});

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
                // Ignora metadados: só pareceres reais da IA sobre tarefas contam.
                const feedbacks = Object.entries(s.feedback_info || {})
                  .filter(([k]) => !k.startsWith('_') && k !== 'global_error')
                  .map(([, v]) => v);
                const hasWarnings = feedbacks.some(f => f?.status === 'warning' || f?.status === 'error');

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
        if (!vendeNoApp) {
          alert(`Você atingiu o limite de ${cameraLimit} câmera(s) do seu plano.`);
          return;
        }
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
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const baixa = {
          resolved: true,
          resolved_by: data.resolved_by || userProfile?.name || 'Gestor',
          resolved_at: data.resolved_at || new Date().toISOString(),
        };
        setSubmissions(prev => prev.map(s => s.id === id ? { ...s, ...baixa } : s));
        setSelectedSubmission(prev => (prev && prev.id === id ? { ...prev, ...baixa } : prev));
        fetchData(); // Atualiza os cards do topo
      } else {
        alert(data.error || 'Não foi possível dar baixa. Tente novamente.');
      }
    } catch (e) { console.error('Erro ao resolver submissão:', e); }
  };

  const handleReprocessAudit = async (e, submissionId) => {
    if (e) e.stopPropagation();
    // Sem trava, cliques repetidos consumiam as 15 tentativas da submissão em
    // segundos e ela era abandonada como "revisão manual".
    if (reprocessando.has(submissionId)) return;
    setReprocessando(prev => new Set(prev).add(submissionId));
    try {
      const res = await fetch(`${API_URL}/api/process-audit-background`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ submissionId })
      });
      if (res.ok) {
        fetchData();
      } else {
        const erro = await res.json().catch(() => null);
        alert(`⚠️ ${erro?.error || erro?.message || `Não foi possível reprocessar (erro ${res.status}).`}`);
      }
    } catch (e) {
      console.error('Erro ao reprocessar:', e);
      alert('Erro de conexão ao reprocessar a auditoria.');
    } finally {
      setReprocessando(prev => { const n = new Set(prev); n.delete(submissionId); return n; });
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      // 'nova_unidade' é só o marcador do select. O nome digitado vive em estado
      // próprio, senão escrevê-lo em newUser.store desmontaria o campo de texto.
      const ehNovaUnidade = newUser.store === 'nova_unidade';
      if (ehNovaUnidade && !novaUnidadeNome.trim()) {
        alert('Digite o nome da nova unidade.');
        return;
      }
      const payload = ehNovaUnidade ? { ...newUser, store: novaUnidadeNome.trim() } : newUser;

      const res = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(`⚠️ ${data.error || data.message || 'Erro ao adicionar usuário.'}`);
        return;
      }

      setShowUserModal(false);
      setNewUser({ name: '', email: '', password: '', store: isMaster ? '' : userProfile?.store || '' });
      setNovaUnidadeNome('');
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
          permissions: permissoesParaSalvar(editingUser.role, editingUser.permissions),
          ponto_hora_entrada: editingUser.ponto_hora_entrada || undefined,
          ponto_hora_saida: editingUser.ponto_hora_saida || undefined,
          ponto_tolerancia: editingUser.ponto_tolerancia != null ? editingUser.ponto_tolerancia : undefined,
          // A escala escolhida no modal nunca era enviada: o admin selecionava,
          // salvava, e o colaborador continuava sem escala. O backend já aceitava
          // este campo — faltava mandá-lo.
          schedule_id: editingUser.schedule_id !== undefined
            ? (editingUser.schedule_id === '' ? null : editingUser.schedule_id)
            : undefined
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

  /**
   * Entra na conta de outro usuário para dar suporte.
   *
   * Dois defeitos moravam aqui, e os dois faziam a tela mostrar algo que não
   * era a conta da pessoa:
   *
   * 1. Ia SEMPRE para /funcionario. O papel do alvo era gravado certo, mas a
   *    navegação era fixa — então acessar a conta de um cliente admin caía no
   *    painel de funcionário, e não havia como ver o painel dele. A regra
   *    correta é a mesma do login: só 'funcionario' vai para /funcionario.
   *
   * 2. O objeto era montado à mão com `plan: userProfile?.plan` e
   *    `status: 'active'` fixo — ou seja, o plano e o status de QUEM ESTÁ
   *    ACESSANDO, não os do alvo. Entrar na conta de um cliente em teste de 7
   *    dias mostrava o plano da matriz e status ativo, escondendo justamente o
   *    que se quer enxergar no suporte: trial vencido, conta bloqueada, limite
   *    de checklists estourado.
   *
   * Agora a conta do alvo é copiada inteira. Só o `store` mantém queda para a
   * loja de quem acessa, porque funcionário sem loja definida herda a do dono.
   */
  const handleImpersonateUser = (member) => {
    const currentAdmin = localStorage.getItem('user');
    if (currentAdmin) {
      localStorage.setItem('firecheck_admin_backup', currentAdmin);
      localStorage.setItem('firecheck_impersonated', 'true');
    }

    const contaAlvo = {
      ...member,
      role: member.role || 'funcionario',
      store: member.store || userProfile?.store,
    };
    localStorage.setItem('user', JSON.stringify(contaAlvo));

    navigate(contaAlvo.role === 'funcionario' ? '/funcionario' : '/admin');
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
        // `store` é a chave da conta e NÃO muda ao renomear a empresa. Gravá-la
        // aqui com o texto digitado era o bastante para o painel passar a pedir
        // os dados de uma loja que não existe — tudo sumia da tela até relogar.
        const updatedMe = {
          ...userProfile,
          name: ownerName,
          store_name: companyName,
          phone: ownerPhone
        };
        setUserProfile(prev => { if (!prev || JSON.stringify(prev) !== JSON.stringify(updatedMe)) { localStorage.setItem('user', JSON.stringify(updatedMe)); return updatedMe; } return prev; });
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
    // O modo simulação não pode sobreviver ao logout: quem entrar depois neste
    // aparelho seria tratado como administrador testando, e seus checklists
    // deixariam de ser gravados sem nenhum aviso.
    localStorage.removeItem('firecheck_admin_backup');
    localStorage.removeItem('firecheck_impersonated');
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
          wa_checklist_aprovado: waChecklistAprovado,
          wa_ocorrencia: waOcorrencia,
          wa_descarte: waDescarte
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
          wa_checklist_aprovado: waChecklistAprovado,
          wa_ocorrencia: waOcorrencia,
          wa_descarte: waDescarte
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



  /**
   * Manda um WhatsApp de verdade para o número que está na tela e mostra o que
   * aconteceu.
   *
   * "Cadastrei meu número e não recebo nada" era impossível de responder sem
   * abrir o log do servidor: o envio era disparado e esquecido, então número
   * sem DDD, WhatsApp do sistema fora do ar e interruptor desmarcado davam
   * exatamente o mesmo silêncio. Aqui cada um desses casos tem um nome.
   */
  /**
   * Pergunta se a loja já conectou o WhatsApp dela.
   *
   * Só a faixa verde ("conecte o WhatsApp da sua empresa") usa esta resposta.
   * O número do sistema não aparece mais no painel (Douglas, 12/10/2026): a
   * senha se recupera por e-mail e a cobrança é o bloqueio da conta.
   *
   * Falhar aqui não pode atrapalhar nada: sem resposta, a faixa simplesmente
   * não aparece.
   */
  useEffect(() => {
    if (!userProfile) return;
    if (!['admin', 'gestor', 'master'].includes(userProfile.role)) return;
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/whatsapp/estado`, { headers: getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        if (vivo) { setWhatsForaDoAr(data && data.conectado === false && data.lojaSemWhatsapp ? data : null); setWhatsChecado(true); }
      } catch { /* sem resposta, sem faixa */ }
    })();
    return () => { vivo = false; };
    // A aba entra na lista: quem acabou de conectar em Notificações vê a faixa sumir ao sair de lá.
  }, [userProfile, tab]);

  const handleTestarWhatsapp = async () => {
    setTestandoWhats(true);
    setTesteWhats(null);
    try {
      const res = await fetch(`${API_URL}/api/whatsapp/testar`, {
        method: 'POST',
        headers: getAuthHeaders(),
        // Vai o número digitado, não o salvo: quem está conferindo quer testar
        // o que acabou de escrever, antes de salvar.
        body: JSON.stringify({ telefone: whatsappPhone }),
      });
      const data = await res.json().catch(() => null);
      if (!data) {
        setTesteWhats({ ok: false, motivo: 'O servidor não respondeu. Tente de novo em instantes.' });
        return;
      }
      setTesteWhats(data);
    } catch {
      setTesteWhats({ ok: false, motivo: 'Sem conexão com o servidor agora.' });
    } finally {
      setTestandoWhats(false);
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
        // Foto de celular em resolução cheia passa de 10 MB depois de codificada em
        // base64 e estoura o limite de tamanho da requisição — o lojista via apenas
        // "erro ao processar". Reduzida para 1200px de largura, o suficiente para a
        // IA ler a nota, como já é feito com as fotos de checklist.
        const base64 = await new Promise((resolve) => {
          const img = new window.Image();
          img.onload = () => {
            const larguraMax = 1200;
            let { width, height } = img;
            if (width > larguraMax) {
              height = Math.round((larguraMax / width) * height);
              width = larguraMax;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.75));
          };
          img.onerror = () => resolve(reader.result); // não conseguiu decodificar: envia como veio
          img.src = reader.result;
        });
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
    // Colaborador herda a situação do ADMIN da loja — a mesma regra do login no
    // backend. O webhook de pagamento só ativa a linha do comprador: o gestor
    // criado no trial fica com status 'trial' para sempre no próprio row e este
    // paywall travava a tela numa loja que já paga. O admin vem no mesmo fetch
    // de /api/users que alimenta `team`; enquanto ele não carrega, não bloqueia
    // (o backend já aplicou a regra do admin ao autorizar este login).
    let conta = userProfile;
    if (userProfile.role === 'gestor' || userProfile.role === 'funcionario') {
      const adminDaLoja = (team || []).find(u => u.role === 'admin');
      if (!adminDaLoja) return false;
      conta = adminDaLoja;
    }
    if (conta.status === 'blocked' || conta.status === 'pending') return true;
    if (conta.status === 'trial') {
      // Usa a mesma regra do backend: quando há trial_ends_at, é ele que vale.
      // Antes esta tela contava sempre 7 dias desde a criação e ignorava a
      // extensão concedida no painel — o cliente com teste estendido continuava
      // preso na tela de pagamento.
      const dias = diasRestantesDeTeste(conta);
      return dias !== null && dias < 0;
    }
    return false;
  };

  const showPaywall = !isMaster && isTrialExpired();

  // No app da loja, sem preço nem checkout (ver vendaNoApp.js).
  if (showPaywall && !vendeNoApp) {
    return (
      <div className="page-container animate-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', textAlign: 'center', padding: '20px' }}>
        <div style={{ backgroundColor: 'rgba(255, 23, 68, 0.1)', padding: '20px', borderRadius: '50%', marginBottom: '24px' }}>
          <Lock size={48} color="var(--error)" />
        </div>
        <h1 style={{ fontSize: '1.6rem', marginBottom: '16px' }}>Acesso inativo</h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: '420px', fontSize: '1rem', lineHeight: '1.6' }}>
          O acesso da sua empresa ao FireCheck não está ativo no momento. Fale com o responsável pela conta da empresa.
        </p>
        <button onClick={handleLogout} style={{ marginTop: '32px', background: 'transparent', border: 'none', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer' }}>
          Sair do Sistema
        </button>
      </div>
    );
  }

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

        {/* Alternador mensal/anual e os três planos, vindos de PLANOS_COMERCIAIS —
            a mesma tabela que alimenta o resto do painel, para preço e link nunca
            mais divergirem do checkout. */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px', borderRadius: '30px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', marginBottom: '28px' }}>
          {[['mensal', 'Pagamento Mensal'], ['anual', 'Plano Anual · economize até 35%']].map(([chave, rotulo]) => (
            <button
              key={chave}
              type="button"
              onClick={() => setCicloPaywall(chave)}
              style={{
                padding: '8px 18px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.86rem',
                backgroundColor: cicloPaywall === chave ? 'var(--primary)' : 'transparent',
                color: cicloPaywall === chave ? 'white' : 'var(--text-muted)',
              }}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'stretch' }}>
          {PLANOS_COMERCIAIS.map(plano => {
            const preco = plano[cicloPaywall];
            return (
              <div
                key={plano.id}
                className="card"
                style={{
                  width: '300px', padding: '28px', textAlign: 'left', display: 'flex', flexDirection: 'column',
                  border: plano.destaque ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                }}
              >
                {plano.destaque && (
                  <div style={{ backgroundColor: 'var(--primary)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 'bold', width: 'fit-content', marginBottom: '12px' }}>
                    MAIS VENDIDO
                  </div>
                )}
                <h3 style={{ fontSize: '1.3rem', marginBottom: '6px' }}>{plano.nome}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '16px', lineHeight: 1.45 }}>{plano.resumo}</p>

                <div style={{ fontSize: '2rem', fontWeight: 'bold', lineHeight: 1.1 }}>
                  {preco.valor}<span style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>{preco.periodo}</span>
                </div>
                <div style={{ minHeight: '20px', marginBottom: '16px' }}>
                  {preco.nota && <span style={{ color: 'var(--success)', fontSize: '0.76rem', fontWeight: 600 }}>{preco.nota}</span>}
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', flex: 1 }}>
                  {plano.itens.map(item => (
                    <li key={item} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '9px', fontSize: '0.84rem', color: 'var(--text-main)' }}>
                      <CheckCircle size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className={plano.destaque ? 'btn' : 'btn-secondary'}
                  style={{ width: '100%', padding: '12px' }}
                  onClick={() => window.open(linkComDados(preco.link, userProfile), '_blank')}
                >
                  Assinar {plano.nome}
                </button>
              </div>
            );
          })}
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '20px' }}>
          Precisa de mais de 50 colaboradores?{' '}
          <a href="https://wa.me/5522981118514?text=Ol%C3%A1,%20preciso%20de%20um%20plano%20para%20mais%20de%2050%20colaboradores%20no%20FireCheck." target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Fale com um consultor
          </a>
        </p>


        <button onClick={handleLogout} style={{ marginTop: '40px', background: 'transparent', border: 'none', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer' }}>
          Sair do Sistema
        </button>
      </div>
    );
  }

  const TITULO_DA_ABA = { ponto: 'Controle de Ponto', notificacoes: 'Notificações', ranking: 'Ranking da equipe', alertas: 'Alertas da IA', checklists: 'Checklists', vehicles: 'Frota e Veículos', compras: 'Compras e Estoque', bill: 'Assistente Bill', equipe: isMaster ? 'Gestão de Clientes' : 'Equipe', perfil: 'Perfil da Empresa', quiz: 'Site Principal', codigos: 'Códigos de ativação' };

  // "Primeiros passos" (só o dono, até a loja terminar de configurar ou ele esconder).
  const passosDoDono = [
    { feito: whatsChecado && !whatsForaDoAr, titulo: 'Conectar o WhatsApp da empresa', texto: 'Para o aviso de checklist reprovado ou atrasado chegar no seu celular.', acao: 'Conectar', onClick: () => setTab('notificacoes') },
    { feito: checklists.length > 0, titulo: 'Criar o primeiro checklist', texto: 'Fale a rotina e a IA monta as tarefas, com foto obrigatória e horário.', acao: 'Criar checklist', onClick: () => navigate('/admin/creator'), extra: { texto: 'ou mande sua rotina no WhatsApp que a gente monta', href: `https://wa.me/5522981118514?text=${encodeURIComponent('Olá! Uso o FireCheck (' + (userProfile?.email || '') + ') e quero ajuda para montar meus checklists.')}` } },
    { feito: team.length > 1, titulo: 'Cadastrar a equipe', texto: 'Quem vai fazer os checklists pelo celular.', acao: 'Cadastrar equipe', onClick: () => setTab('equipe') },
  ];
  const mostrarPassos = userProfile?.role === 'admin' && !isMaster && !passosOcultos && whatsChecado && dadosCarregados && passosDoDono.some((p) => !p.feito);

  // overflowX 'clip' e não 'hidden': hidden vira contêiner de rolagem e o menu lateral
  // deixava de ficar fixo (sticky). Fundo transparente para o brilho do body aparecer.
  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw', overflowX: 'clip' }}>

      {/* Aviso de que este painel é de OUTRA conta.
          O painel do funcionário já tinha o dele; aqui não havia nada, porque
          até agora era impossível chegar nesta tela acessando a conta de
          alguém — a impersonação levava sempre para /funcionario. Sem esta
          faixa, você veria um painel de administrador idêntico ao seu, com os
          dados de outra empresa, e sem saída a não ser o logout. */}
      <BarraDeAcessoRemoto />

      {/* Overlay Mobile */}
      <div className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>

      {/* SIDEBAR LATERAL */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`} style={{ 
        width: isSidebarCollapsed ? '80px' : '260px', 
        backgroundColor: 'var(--sidebar-bg)', 
        borderRight: 'none', 
        display: 'flex', 
        flexDirection: 'column', 
        position: 'sticky', 
        top: 0, 
        height: '100vh', 
        overflowY: 'auto',
        color: 'var(--sidebar-strong)',
        zIndex: 50,
        transition: 'width 0.3s ease'
      }}>
        {/* LOGO E BOTAO RECOLHER */}
        <div style={{ padding: isSidebarCollapsed ? '16px 0 12px 0' : '16px 20px 12px 20px', borderBottom: '1px solid var(--sidebar-line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', gap: '10px', marginBottom: '10px' }}>
            <div style={{ backgroundColor: 'var(--primary)', padding: '6px', borderRadius: '6px' }}>
              <Flame size={20} color="white" />
            </div>
            {!isSidebarCollapsed && <span style={{ fontSize: '1.2rem', fontWeight: 'bold', letterSpacing: '-0.5px' }}>FireCheck</span>}
          </div>
          
          {/* Botão Explícito para Ocultar Menu */}
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} style={{ 
            width: '100%', padding: '8px', background: 'var(--sidebar-hover)', border: '1px solid var(--sidebar-line)', 
            borderRadius: '6px', color: 'var(--sidebar-text)', cursor: 'pointer', fontSize: '0.8rem', 
            display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.2s', gap: '6px'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.13)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'}
          >
            {isSidebarCollapsed ? <ArrowRight size={16} /> : "Ocultar Menu"}
          </button>
        </div>

        {/* MENU ITENS */}
        <div style={{ padding: '10px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {/* Tutoriais em vídeo no alto do menu, destacado (Douglas, 21/11): abre a central com
              todos os vídeos. Só aparece quando há vídeo publicado para quem está logado. */}
          {!isMaster && (
            <div style={{ marginBottom: '8px' }}>
              <BotaoTutoriaisEmVideo usuario={userProfile} recolhido={isSidebarCollapsed} onClick={() => setIsSidebarOpen(false)} />
            </div>
          )}
          {(isMaster ? [
            { key: 'equipe',      label: 'Gestão de Clientes', icon: <Users size={18}/> },
            { key: 'quiz',        label: 'Site Principal', icon: <Activity size={18}/> },
            { key: 'codigos',     label: 'Códigos de ativação', icon: <Lock size={18}/> },
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
            { key: 'bill',        label: 'Assistente Bill', icon: <Bot size={18}/> },
            { key: 'equipe',      label: 'Equipe', icon: <Users size={18}/> },
            { key: 'perfil',      label: 'Perfil da Empresa', icon: <Settings size={18}/> },
          ].filter(Boolean)).map(t => {
            if (isFuncionario && (t.key === 'equipe' || t.key === 'checklists')) return null;
            if (isGestor && t.key === 'perfil') return null;
            if (isGestor && TAB_PERMISSION_MAP[t.key]) {
              const perms = getSafeGestorPermissions(userProfile?.permissions);
              if (!perms[TAB_PERMISSION_MAP[t.key]]) return null;
            }
            const isActive = tab === t.key;
            return (
              <button key={t.key} onClick={() => { setTab(t.key); setIsSidebarOpen(false); }} title={isSidebarCollapsed ? t.label : ''}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '12px', padding: isSidebarCollapsed ? '9px 0' : '9px 16px', 
                  justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                  borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '500', fontSize: '0.95rem', 
                  transition: 'all 0.2s', textAlign: 'left',
                  backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                  color: isActive ? 'white' : 'var(--sidebar-text)',
                  borderLeft: isActive ? '4px solid var(--primary)' : '4px solid transparent'
                }}
                onMouseOver={(e) => !isActive && (e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)')}
                onMouseOut={(e) => !isActive && (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                <span style={{ color: isActive ? 'white' : 'var(--sidebar-text)' }}>{t.icon}</span>
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
              borderRadius: '8px', border: '1px solid var(--sidebar-line)', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', 
              transition: 'all 0.2s', textAlign: 'left',
              backgroundColor: 'transparent',
              color: 'var(--sidebar-text)',
              marginTop: '8px'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <span><Sparkles size={18} color="currentColor" /></span>
            {!isSidebarCollapsed && 'Tour do Sistema'}
          </button>

          {/* Suporte no WhatsApp do FireHub (Douglas, 21/11): dono e gestor chamam a equipe direto. */}
          {!isMaster && !isFuncionario && (
            <a
              href={`https://wa.me/5522981118514?text=${encodeURIComponent(`Olá! Sou cliente do FireCheck (${userProfile?.store_name || userProfile?.store || ''} · ${userProfile?.email || ''}) e preciso de ajuda.`)}`}
              target="_blank" rel="noopener noreferrer" title="Suporte no WhatsApp"
              onClick={() => setIsSidebarOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: isSidebarCollapsed ? '12px 0' : '12px 16px',
                justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                borderRadius: '8px', border: '1px solid rgba(37,211,102,.45)', fontWeight: '600', fontSize: '0.9rem',
                color: '#4ade80', textDecoration: 'none', marginTop: '8px'
              }}
            >
              <span><MessageCircle size={18} color="currentColor" /></span>
              {!isSidebarCollapsed && 'Suporte no WhatsApp'}
            </a>
          )}
        </div>

        {/* FOOTER DA SIDEBAR */}
        <div style={{ padding: isSidebarCollapsed ? '20px 0' : '20px', borderTop: '1px solid var(--sidebar-line)', backgroundColor: 'rgba(0,0,0,0.22)' }}>
           {!isSidebarCollapsed && (
             <p style={{ color: 'var(--sidebar-text)', fontSize: '0.8rem', marginBottom: '12px' }}>
                <strong style={{ color: 'var(--sidebar-strong)' }}>{userProfile?.name}</strong><br/>
                {userProfile?.store_name || userProfile?.store || 'Sistema Central'}
             </p>
           )}
           <button onClick={handleLogout} title="Sair do Sistema" style={{ 
               background: 'transparent', 
               border: 'none', 
               color: '#f87171', 
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

        {/* Loja sem o WhatsApp dela: o convite para conectar (na própria aba
            Notificações o cartão do WhatsApp da loja já diz isso). */}
        {whatsForaDoAr?.lojaSemWhatsapp && tab !== 'notificacoes' && !(tab === 'auditoria' && mostrarPassos) && (
          // Faixa compacta (visual de 21/11/2026): uma linha, botão em pílula à direita.
          <div className="card" style={{ padding: '14px 16px 14px 18px', marginBottom: '26px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <span style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'rgb(37 211 102 / 0.12)', color: '#16A34A', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Bell size={18} />
            </span>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <strong style={{ display: 'block', fontSize: '0.95rem', fontWeight: 600 }}>Conecte o WhatsApp da sua empresa para receber os avisos</strong>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>{whatsForaDoAr.motivo}</span>
            </div>
            {whatsForaDoAr.podeConectar && (
              <button type="button" className="fc-pilula" onClick={() => setTab('notificacoes')}>
                Conectar agora <i><ArrowUpRight size={15} /></i>
              </button>
            )}
          </div>
        )}

        {/* TRIAL BANNER */}
        {vendeNoApp && userProfile?.status === 'trial' && userProfile?.role === 'admin' && (
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
                {/* Contava sempre 7 dias desde a criação e ignorava a extensão
                    concedida no painel: quem ganhava mais prazo continuava vendo a
                    contagem antiga. Usa a mesma regra do backend. */}
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: '#FFA000' }}>Seu período de teste acaba em {Math.max(0, diasRestantesDeTeste(userProfile) ?? 0)} dias!</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Após esse período, o sistema será bloqueado. Não perca seus checklists e dados.</p>
              </div>
            </div>
            {/* Dizia apenas "Assinar Plano Agora" e levava ao checkout anual de
                Só Checklists, sem informar plano nem valor. Agora o botão diz para
                onde leva, com preço e link vindos de PLANOS_COMERCIAIS.
                O e-mail vai na URL porque o webhook da Cakto casa o pagamento
                com a conta pelo e-mail: sem ele, o cliente digita outro no
                checkout e o pagamento cria uma conta nova em vez de ativar esta. */}
            {vendeNoApp && (
            <button
              className="btn"
              onClick={() => navigate(`/renovar?email=${encodeURIComponent(userProfile?.email || '')}`)}
              style={{ whiteSpace: 'nowrap' }}
            >
              Ver planos e assinar
            </button>
            )}
          </div>
        )}
        

        {/* CABEÇALHO (visual de 21/11/2026): sem caixa, título grande; no Dashboard,
            a saudação já diz quantos checklists esperam o dono. */}
        <header className="fc-cab">
          <div>
            {tab === 'auditoria' && !isMaster && (
              <span className="fc-olho" style={{ marginBottom: '10px' }}>
                <i className={`fc-vivo${aiHealth === false ? ' off' : ''}`} />
                {aiHealth === false ? 'IA fora do ar' : 'IA ao vivo'} · {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' }).replace(/\./g, '')}
              </span>
            )}
            <h1>
              {tab === 'auditoria' && !isMaster ? (
                <>
                  {saudacao()}, {String(userProfile?.name || '').split(' ')[0] || 'tudo bem'}.{' '}
                  <span>{stats.alertasIA > 0 ? `${stats.alertasIA} checklist${stats.alertasIA > 1 ? 's precisam' : ' precisa'} de você.` : 'Tudo em dia na loja.'}</span>
                </>
              ) : (tab !== 'auditoria' && TITULO_DA_ABA[tab] ? TITULO_DA_ABA[tab] : isMaster ? 'Painel de Gestão Master' : isAdmin ? 'Painel do Dono' : isGestor ? 'Painel do Gestor' : 'Painel do Funcionário')}
            </h1>
            {tab !== 'auditoria' && !TITULO_DA_ABA[tab] && <p className="fc-sub">Seja bem-vindo(a), {userProfile?.name}</p>}
          </div>

          <div className="fc-cab-dir">
            {aiHealth === false && tab !== 'auditoria' && (
              <span className="fc-olho" style={{ color: 'var(--bad)' }}><i className="fc-vivo off" />IA fora do ar</span>
            )}
            {isMaster && (
              <>
                <span className="fc-olho"><i className="fc-vivo" />{liveVisitors} pessoas online</span>
                <span className="fc-olho"><Users size={12} /> {todayVisitors} acessos <span className="mono" style={{ letterSpacing: 0 }}>({todayMobile} cel / {todayDesktop} pc)</span></span>
                <span className="fc-olho"><Video size={12} /> {videoPlays} plays no vídeo</span>
              </>
            )}

            {/* Filtro de Data: só nas abas que usam o período (nas outras era ruído). */}
            {!['notificacoes', 'equipe', 'perfil', 'bill', 'compras', 'vehicles'].includes(tab) && (
              <div className="fc-periodo">
                <CalendarClock size={15} color="var(--primary)" />
                <input type="date" value={dateFilter.start} onChange={(e) => setDateFilter({...dateFilter, start: e.target.value})} aria-label="Início do período" />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>até</span>
                <input type="date" value={dateFilter.end} onChange={(e) => setDateFilter({...dateFilter, end: e.target.value})} aria-label="Fim do período" />
              </div>
            )}

            {/* "Tutorial <aba>": o vídeo da aba aberta (src/tutoriais/telas.js). */}
            {!isMaster && <BotaoTutorial key={tab} tela={`admin:${tab}`} usuario={userProfile} encolhe />}
            <button onClick={() => navigate('/funcionario')} className="btn btn-secondary animate-scale" style={{ padding: '9px 16px', fontSize: '0.86rem' }}>
              <Play size={14} /> Tela de Execução
            </button>

            {isMaster ? (
              <button className="fc-pilula" onClick={() => { setNewUser({ name: '', email: '', password: '', store: '', role: 'admin', plan: 'starter' }); setShowUserModal(true); }}>
                Nova Conta <i><UserPlus size={15} /></i>
              </button>
            ) : (isAdmin || isGestor) && tab === 'auditoria' ? (
              <button className="fc-pilula" onClick={() => navigate('/admin/creator')}>
                Criar checklist <i><ArrowUpRight size={15} /></i>
              </button>
            ) : null}

            <button className="mobile-menu-btn" style={{ display: 'none', background: 'transparent', border: 'none', padding: '0', cursor: 'pointer', flexDirection: 'column', alignItems: 'center', gap: '2px' }} onClick={() => setIsSidebarOpen(true)}>
              <div style={{ backgroundColor: 'transparent', padding: '0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Menu size={20} color="white" />
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'white' }}>Menu</span>
            </button>
          </div>
        </header>

      {/* Faixa "Tem um tutorial desta tela" no alto da aba, como no FireHub; some com
          "Não mostrar mais nesta tela" (por aba, neste aparelho). */}
      {!isMaster && <BotaoTutorial key={`faixa-${tab}`} tela={`admin:${tab}`} usuario={userProfile} variante="faixa" />}

      {tab === 'auditoria' && mostrarPassos && (
        <PrimeirosPassos
          passos={passosDoDono}
          onDispensar={() => { setPassosOcultos(true); try { localStorage.setItem('firecheck_primeiros_passos_oculto', '1'); } catch { /* sem armazenamento: some só nesta visita */ } }}
        />
      )}

      {/* Topo do Dashboard (visual aprovado em 21/11/2026): velocímetro, números do dia
          com atalho para onde o assunto está, e a última foto que a IA reprovou. */}
      {tab === 'auditoria' && !isMaster && (() => {
        const deHoje = submissions.filter(s => ehHojeEmSP(s.created_at));
        const conta = { aprovado: 0, reprovado: 0, outros: 0 };
        deHoje.forEach(s => { const st = statusDaSubmissao(s); if (st === 'aprovado') conta.aprovado++; else if (st === 'reprovado') conta.reprovado++; else conta.outros++; });
        const ativosHoje = [...new Set(deHoje.map(s => s.employee_name).filter(Boolean))];
        const ultimaReprovada = submissions.find(s => !s.resolved && statusDaSubmissao(s) === 'reprovado');
        const tarefaRuim = ultimaReprovada?.tasks?.find(t => tarefaReprovada(ultimaReprovada, t));
        const motivo = tarefaRuim && (ultimaReprovada.feedback_info?.[tarefaRuim.id]?.message || ultimaReprovada.feedback_info?.[tarefaRuim.id]?.mensagem);
        const posicao = tarefaRuim ? (ultimaReprovada.tasks.indexOf(tarefaRuim) + 1) : 0;
        const filtrar = (st) => { setFiltroStatus(st); setTimeout(() => listaDaAuditoriaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); };
        return (
          <div className="fc-bento">
            <section className="card fc-c-velo">
              <Velocimetro valor={stats.conformidade} dias={stats.ultimos7 || []} legenda="no período" />
            </section>

            <section className="card fc-kpi fc-c-hoje">
              <span className="fc-olho-rot">Checklists hoje</span>
              <strong className="fc-grande">{stats.checklistsHoje}<small>{stats.concluidos} no período</small></strong>
              {deHoje.length > 0 ? (
                <>
                  <div className="fc-pilha">
                    {conta.aprovado > 0 && <i style={{ flex: conta.aprovado, background: 'var(--ok)' }} />}
                    {conta.reprovado > 0 && <i style={{ flex: conta.reprovado, background: 'var(--bad)' }} />}
                    {conta.outros > 0 && <i style={{ flex: conta.outros, background: '#B8B4AC' }} />}
                  </div>
                  <div className="fc-leg">
                    <button style={{ '--c': 'var(--ok)' }} className={filtroStatus === 'aprovado' ? 'on' : ''} onClick={() => filtrar('aprovado')}><b>{conta.aprovado}</b> aprovado{conta.aprovado === 1 ? '' : 's'}</button>
                    <button style={{ '--c': 'var(--bad)' }} className={filtroStatus === 'reprovado' ? 'on' : ''} onClick={() => filtrar('reprovado')}><b>{conta.reprovado}</b> reprovado{conta.reprovado === 1 ? '' : 's'}</button>
                    <button style={{ '--c': '#B8B4AC' }} className={filtroStatus === 'outros' ? 'on' : ''} onClick={() => filtrar('outros')}><b>{conta.outros}</b> sem foto ou aguardando</button>
                  </div>
                </>
              ) : (
                <span className="fc-pouco">Nenhum checklist enviado hoje ainda.</span>
              )}
              <button className="fc-ir" onClick={() => filtrar(null)}>Ver checklists de hoje <ArrowUpRight size={14} /></button>
            </section>

            <section className="card fc-kpi fc-c-mini">
              <span className="fc-olho-rot">Reprovados</span>
              <strong className="fc-grande" style={{ color: stats.alertasIA > 0 ? 'var(--bad)' : 'var(--text-main)' }}>{String(stats.alertasIA).padStart(2, '0')}</strong>
              <span className="fc-pouco">pela IA, sem baixa no período</span>
              <button className={`fc-ir${stats.alertasIA > 0 ? ' red' : ''}`} onClick={() => setTab('alertas')}>Ver agora <ArrowUpRight size={14} /></button>
            </section>

            <section className="card fc-kpi fc-c-mini">
              <span className="fc-olho-rot">Equipe</span>
              <strong className="fc-grande">{ativosHoje.length}<small style={{ marginLeft: '2px' }}>/{stats.colaboradores}</small></strong>
              {ativosHoje.length > 0 ? (
                <div className="fc-gente" title={ativosHoje.join(', ')}>
                  {ativosHoje.slice(0, 3).map(n => <span key={n} className="on">{iniciais(n)}</span>)}
                  {ativosHoje.length > 3 && <span>+{ativosHoje.length - 3}</span>}
                </div>
              ) : (
                <span className="fc-pouco">ninguém enviou hoje</span>
              )}
              <button className="fc-ir" onClick={() => setTab('equipe')}>Ver equipe <ArrowUpRight size={14} /></button>
            </section>

            <section className="card fc-c-ia" style={{ padding: 0 }}>
              {ultimaReprovada ? (
                <div className="fc-ia">
                  <div className="fc-ia-foto">
                    {tarefaRuim && <FotoDaTarefa submissaoId={ultimaReprovada.id} tarefaId={tarefaRuim.id} alt={tarefaRuim.text || 'Foto reprovada'} />}
                    <div className="fc-varre" />
                    <span className="fc-tag">foto ao vivo · {new Date(ultimaReprovada.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="fc-ia-txt">
                    <span className="fc-olho-rot"><Eye size={14} /> O que a IA viu · precisa de você</span>
                    <h3>{tarefaRuim?.text || 'Foto fora do padrão'}</h3>
                    <p><b>Reprovada.</b> {motivo || 'A IA apontou problema nesta foto.'}</p>
                    <p>{checklists?.find(c => c.id === ultimaReprovada.checklist_id)?.title || ultimaReprovada.checklist_title || 'Checklist'} · {ultimaReprovada.employee_name}{posicao ? ` · tarefa ${posicao} de ${ultimaReprovada.tasks.length}` : ''}</p>
                    <button className="fc-pilula" style={{ marginTop: 'auto' }} onClick={() => abrirDetalheSubmissao(ultimaReprovada)}>Conferir agora <i><ArrowUpRight size={15} /></i></button>
                  </div>
                </div>
              ) : (
                <div className="fc-ia fc-ia-ok" style={{ display: 'flex' }}>
                  <span className="fc-ok-ico"><CheckCircle size={22} /></span>
                  <span className="fc-olho-rot"><Eye size={14} /> O que a IA viu</span>
                  <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Nenhuma foto reprovada esperando você.</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>Quando a IA reprovar uma foto, ela aparece aqui com o motivo, para você conferir na hora.</p>
                </div>
              )}
            </section>
          </div>
        );
      })()}

      {/* ── Card de Cota de Checklists (Admin Only) ─────────────────── */}
      {!isMaster && quotaInfo && !quotaInfo.isUnlimited && tab === 'auditoria' && (
        <div className="card" style={{ padding: '20px', marginBottom: '24px', border: quotaInfo.percentUsed >= 95 ? '2px solid var(--error)' : quotaInfo.percentUsed >= 80 ? '2px solid #f59e0b' : '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={18} color="var(--primary)" />
              <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>Uso do Plano</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-inset)', padding: '2px 8px', borderRadius: '12px' }}>
                {quotaInfo.plan === 'starter' || quotaInfo.plan === 'start' ? 'Starter' : quotaInfo.plan === 'pro' || quotaInfo.plan === 'mensal' ? 'Pro' : quotaInfo.plan === 'business' || quotaInfo.plan === 'anual' ? 'Business' : quotaInfo.plan}
              </span>
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: quotaInfo.percentUsed >= 95 ? 'var(--error)' : quotaInfo.percentUsed >= 80 ? '#f59e0b' : 'var(--success)' }}>
              {quotaInfo.used} / {quotaInfo.limit}
            </span>
          </div>
          <div style={{ height: '8px', backgroundColor: 'var(--bg-inset)', borderRadius: '100px', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ width: `${Math.min(quotaInfo.percentUsed, 100)}%`, height: '100%', backgroundColor: quotaInfo.percentUsed >= 95 ? 'var(--error)' : quotaInfo.percentUsed >= 80 ? '#f59e0b' : 'var(--primary)', borderRadius: '100px', transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {quotaInfo.percentUsed >= 100 ? '🔴 Cota esgotada!' : quotaInfo.percentUsed >= 80 ? `⚠️ ${quotaInfo.remaining} restantes` : `✅ ${quotaInfo.remaining} checklists restantes`}
              {quotaInfo.resetDate && ` • Renova em ${Math.max(0, Math.ceil((new Date(quotaInfo.resetDate) - new Date()) / (1000*60*60*24)))} dias`}
            </span>
            {vendeNoApp && quotaInfo.percentUsed >= 80 && (
              <button className="btn" style={{ padding: '6px 16px', fontSize: '0.8rem' }} onClick={() => setShowQuotaUpgradeModal(true)}>
                Fazer Upgrade
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal de Upgrade de Cota */}
      {vendeNoApp && showQuotaUpgradeModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowQuotaUpgradeModal(false)}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '40px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ backgroundColor: 'rgb(var(--primary-rgb) / 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Flame size={32} color="var(--primary)" />
            </div>
            <h2 style={{ marginBottom: '12px' }}>Hora de crescer! 🚀</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: '1.6' }}>
              Você {quotaInfo?.percentUsed >= 100 ? 'atingiu' : 'está chegando no'} limite do seu plano.
              Faça upgrade para continuar auditando com IA.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button className="btn btn-pulse" style={{ padding: '14px', width: '100%', fontWeight: 'bold', backgroundColor: 'var(--primary)' }} onClick={() => window.open(`https://pay.cakto.com.br/pavdwiz_869704?email=${encodeURIComponent(userProfile?.email || '')}&name=${encodeURIComponent(userProfile?.name || '')}`, '_blank')}>
                Combo Completo (Checklist + Ponto IA) — R$197/mês
              </button>
              <button className="btn-secondary" style={{ padding: '14px', width: '100%', fontWeight: 'bold' }} onClick={() => window.open(`https://pay.cakto.com.br/e7c88df?email=${encodeURIComponent(userProfile?.email || '')}&name=${encodeURIComponent(userProfile?.name || '')}`, '_blank')}>
                {/* Dizia só "Plano Anual com Desconto" logo abaixo do Combo, e o
                    link é o de Só Checklists anual: dava para entender que era o
                    Combo anual, que custa 12x R$167, não 12x R$97. */}
                Só Checklists anual — 12x R$ 97/mês
              </button>
              <button className="btn-secondary" style={{ padding: '14px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={() => window.open('https://wa.me/5522981118514?text=Olá,%20preciso%20de%20um%20plano%20Custom%20com%20mais%20funcionários%20no%20FireCheck.', '_blank')}>
                Plano Custom (&gt;50 funcionários no WhatsApp)
              </button>
            </div>
            <button onClick={() => setShowQuotaUpgradeModal(false)} style={{ marginTop: '20px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}>Fechar</button>
          </div>
        </div>
      )}



      {/* ── Tabs Em Construção (Novas Funcionalidades) ──────────────────── */}
      {['agendamentos', 'planos_acao', 'exportacoes', 'suporte'].includes(tab) && (
        <div className="card animate-fade" style={{ padding: '80px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'rgb(var(--primary-rgb) / 0.1)', padding: '24px', borderRadius: '50%', marginBottom: '24px' }}>
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
        <div className="animate-fade fc-notif" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* O título já está no cabeçalho do painel (visual de 21/11/2026). */}
          <p style={{ color: 'var(--text-muted)', margin: '-18px 0 0 2px', fontSize: '0.92rem' }}>Os avisos que chegam no WhatsApp e no celular.</p>

          {/* O WhatsApp da loja (quem envia) e os números extras (quem recebe). */}
          <WhatsappDaLoja />

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* Configurações Gerais do WhatsApp */}
              <div className="card" style={{ padding: '24px', flex: 1, minWidth: '320px' }}>
                 <h3 style={{ marginBottom: '16px', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Seu número para receber os avisos
                 </h3>
                 <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
                    Defina o número de telefone em que <strong>você</strong> recebe os alertas.
                 </p>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                       <input 
                          type="checkbox" 
                          checked={whatsappActive} 
                          onChange={e => setWhatsappActive(e.target.checked)} 
                          style={{ cursor: 'pointer' }}
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

                    {/* ── Prova de que o canal funciona ─────────────────────
                        O lojista salvava o número e ficava esperando um alerta
                        que talvez nunca viesse, sem forma de saber se o problema
                        era o número, o interruptor ou o servidor. Um botão que
                        manda a mensagem na hora e diz o motivo da falha resolve
                        isso sem passar por suporte. */}
                    <div>
                       <button
                          type="button"
                          className="btn-secondary"
                          onClick={handleTestarWhatsapp}
                          disabled={testandoWhats}
                          style={{ width: '100%', padding: '12px', borderRadius: '8px', fontSize: '0.92rem', fontWeight: 'bold', cursor: testandoWhats ? 'wait' : 'pointer', opacity: testandoWhats ? 0.7 : 1 }}
                       >
                          {testandoWhats ? 'Enviando...' : 'Enviar mensagem de teste agora'}
                       </button>
                       <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '6px', fontSize: '0.78rem' }}>
                          Manda uma mensagem real para o número acima. Se não chegar, o motivo aparece aqui.
                       </small>

                       {testeWhats && (
                         <div style={{
                           marginTop: '12px',
                           padding: '12px 14px',
                           borderRadius: '10px',
                           fontSize: '0.86rem',
                           lineHeight: '1.5',
                           backgroundColor: testeWhats.ok ? 'rgba(37, 211, 102, 0.10)' : 'rgba(239, 68, 68, 0.10)',
                           border: `1px solid ${testeWhats.ok ? '#25D366' : '#ef4444'}`,
                           color: testeWhats.ok ? '#0f766e' : '#b91c1c',
                         }}>
                           {testeWhats.ok ? (
                             <>
                               <strong>Mensagem enviada.</strong> Confira o WhatsApp do número
                               {testeWhats.numero ? ` ${testeWhats.numero}` : ''}. Se não aparecer em até um minuto,
                               o número está certo mas o aparelho pode estar sem internet.
                               {Array.isArray(testeWhats.avisos) && testeWhats.avisos.map((aviso, i) => (
                                 <div key={i} style={{ marginTop: '8px', color: '#b45309', fontWeight: 'bold' }}>{aviso}</div>
                               ))}
                             </>
                           ) : (
                             <><strong>Não foi possível enviar.</strong> {testeWhats.motivo}</>
                           )}
                         </div>
                       )}
                    </div>
                 </div>
              </div>

              {/* Interruptores de Notificações */}
              <div className="card" style={{ padding: '24px', flex: 1.5, minWidth: '350px' }}>
                 <h3 style={{ marginBottom: '16px', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Alertas de Notificação Personalizados
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
                          <strong style={{ display: 'block', fontSize: '0.95rem' }}>Atrasos de Colaborador (Ponto)</strong>
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
                          <strong style={{ display: 'block', fontSize: '0.95rem' }}>Checklist com Irregularidades (Reprovado)</strong>
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
                          <strong style={{ display: 'block', fontSize: '0.95rem' }}>Checklist Concluído com Sucesso</strong>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Receber notificação quando um colaborador finalizar um checklist sem nenhuma irregularidade detectada.</span>
                       </label>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                       <input
                          type="checkbox"
                          checked={waOcorrencia}
                          onChange={e => setWaOcorrencia(e.target.checked)}
                          style={{ width: '20px', height: '20px', cursor: 'pointer', marginTop: '3px' }}
                          id="opt-ocorrencia"
                       />
                       <label htmlFor="opt-ocorrencia" style={{ cursor: 'pointer' }}>
                          <strong style={{ display: 'block', fontSize: '0.95rem' }}>Ocorrência registrada pelo colaborador</strong>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Receber na hora quando alguém registrar algo fora da rotina — freezer desligado, equipamento quebrado, problema com fornecedor.</span>
                       </label>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                       <input
                          type="checkbox"
                          checked={waDescarte}
                          onChange={e => setWaDescarte(e.target.checked)}
                          style={{ width: '20px', height: '20px', cursor: 'pointer', marginTop: '3px' }}
                          id="opt-descarte"
                       />
                       <label htmlFor="opt-descarte" style={{ cursor: 'pointer' }}>
                          <strong style={{ display: 'block', fontSize: '0.95rem' }}>Descarte registrado pelo colaborador</strong>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Receber na hora o que foi jogado fora, com quantidade, motivo e valor estimado.</span>
                       </label>
                    </div>

                    {/* Integração com o FireHub. Só mostra o estado: a ligação é
                        feita de dentro do FireHub, com o e-mail e a senha daqui. */}
                    <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                       <strong style={{ display: 'block', fontSize: '0.95rem', marginBottom: '4px' }}>Integração com o FireHub</strong>
                       {firehubLigacao?.conectado ? (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                             Conectado à loja <strong>{firehubLigacao.firehubLojaNome || '—'}</strong> do FireHub
                             {firehubLigacao.conectadoEm ? <> desde {new Date(firehubLigacao.conectadoEm).toLocaleDateString('pt-BR')}</> : null}.
                             {' '}Os descartes desta loja vão para o FireHub e contam como perda lá.
                          </span>
                       ) : (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                             Não conectado — conecte pelo FireHub, na tela Checklist e ponto.
                          </span>
                       )}
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
                          <strong style={{ display: 'block', fontSize: '0.95rem' }}>Checklist Pendente/Atrasado</strong>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Avisar quando passar a Hora Limite de uma tarefa e ninguém tiver enviado o checklist no dia.</span>
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
                          <strong style={{ display: 'block', fontSize: '0.95rem' }}>Fechamento Diário de Ponto</strong>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Todo dia às 8h, o resumo do ponto do dia anterior: as batidas de cada um, horas trabalhadas, faltas e batidas faltando.</span>
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
      {(vendeNoApp && tab === 'ponto' &&!userProfile?.ponto_active && !userProfile?.cobranca_firehub && userProfile?.status !== 'trial' && userProfile?.email !== 'dugaburguer@gmail.com') && (
        <div className="card animate-fade" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ backgroundColor: 'rgb(var(--info-rgb) / 0.1)', padding: '24px', borderRadius: '50%', marginBottom: '24px' }}>
            <UserCheck size={48} color="var(--info)" />
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

          <div style={{ textAlign: 'center', marginBottom: '24px', marginTop: '32px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: 'var(--bg-card)', borderRadius: '30px', padding: '6px', border: '1px solid var(--border-color)', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setDashBillingCycle('mensal')}
                style={{
                  padding: '8px 20px',
                  borderRadius: '20px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  backgroundColor: dashBillingCycle === 'mensal' ? 'var(--primary)' : 'transparent',
                  color: dashBillingCycle === 'mensal' ? 'white' : 'var(--text-muted)',
                  transition: 'all 0.2s ease',
                }}
              >
                Pagamento Mensal
              </button>
              <button
                type="button"
                onClick={() => setDashBillingCycle('anual')}
                style={{
                  padding: '8px 20px',
                  borderRadius: '20px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  backgroundColor: dashBillingCycle === 'anual' ? '#10b981' : 'transparent',
                  color: dashBillingCycle === 'anual' ? 'white' : 'var(--text-muted)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>Plano Anual</span>
                <span style={{ backgroundColor: dashBillingCycle === 'anual' ? 'rgba(255,255,255,0.25)' : 'rgba(16, 185, 129, 0.15)', color: dashBillingCycle === 'anual' ? 'white' : '#10b981', padding: '2px 6px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 'bold' }}>Economize até 35%</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '16px' }}>
            
            {/* SÓ PONTO */}
            <div className="card" style={{ width: '280px', padding: '24px', border: '1px solid var(--border-color)', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: 'var(--info)', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '4px' }}>MÓDULO PONTO IA</div>
                <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Só Ponto IA</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Ponto com biometria facial e trava de GPS.</p>
                <div style={{ fontSize: '2.4rem', fontWeight: 'bold', marginBottom: '4px' }}>
                  R${dashBillingCycle === 'anual' ? '97' : '149'}<span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/mês</span>
                </div>
                <div style={{ color: dashBillingCycle === 'anual' ? '#10b981' : 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '20px' }}>
                  {dashBillingCycle === 'anual' ? '12x R$ 97 (R$ 1.164/ano)' : 'Até 30 colaboradores'}
                </div>
                <div style={{ fontSize: '0.85rem', marginBottom: '24px', color: 'var(--text-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>• Reconhecimento facial IA</div>
                  <div>• Trava de GPS integrada</div>
                  <div>• Alertas no WhatsApp</div>
                  <div>• Até <strong>30 colaboradores</strong></div>
                </div>
              </div>
              <button className="btn-secondary" style={{ width: '100%', padding: '12px' }} onClick={() => window.open(dashBillingCycle === 'anual' ? `https://pay.cakto.com.br/o2xichf?email=${encodeURIComponent(userProfile?.email || '')}&name=${encodeURIComponent(userProfile?.name || '')}` : `https://pay.cakto.com.br/kfx3fri_869702?email=${encodeURIComponent(userProfile?.email || '')}&name=${encodeURIComponent(userProfile?.name || '')}`, '_blank')}>
                Assinar Só Ponto
              </button>
            </div>

            {/* COMBO COMPLETO (DESTACADO) */}
            <div className="card" style={{ width: '290px', padding: '24px', border: '2px solid var(--primary)', transform: 'scale(1.04)', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 12px 30px rgb(var(--primary-rgb) / 0.15)' }}>
              <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--primary)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', color: 'white', whiteSpace: 'nowrap' }}>MAIS VENDIDO • MELHOR CUSTO</div>
              <div>
                <div style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '4px', marginTop: '6px' }}>PACOTE COMPLETO</div>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '8px', color: 'var(--primary)' }}>Combo Tudo em 1</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Checklists Ilimitados + Ponto IA juntos.</p>
                <div style={{ fontSize: '2.6rem', fontWeight: 'bold', marginBottom: '4px', color: '#0f172a' }}>
                  R${dashBillingCycle === 'anual' ? '167' : '197'}<span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/mês</span>
                </div>
                <div style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '20px' }}>
                  {dashBillingCycle === 'anual' ? '12x R$ 167 (Economiza R$ 360)' : 'Economize R$ 101/mês vs 2 separados'}
                </div>
                <div style={{ fontSize: '0.85rem', marginBottom: '24px', color: 'var(--text-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ color: '#047857', fontWeight: 'bold' }}>BÔNUS: Até 50 colaboradores</div>
                  <div>• <strong>Checklists ILIMITADOS</strong></div>
                  <div>• Ponto com Reconhecimento Facial</div>
                  <div>• Trava de GPS + WhatsApp</div>
                </div>
              </div>
              <button className="btn btn-pulse" style={{ width: '100%', padding: '12px', fontWeight: 'bold', backgroundColor: 'var(--primary)' }} onClick={() => window.open(dashBillingCycle === 'anual' ? `https://pay.cakto.com.br/36m7kzq?email=${encodeURIComponent(userProfile?.email || '')}&name=${encodeURIComponent(userProfile?.name || '')}` : `https://pay.cakto.com.br/pavdwiz_869704?email=${encodeURIComponent(userProfile?.email || '')}&name=${encodeURIComponent(userProfile?.name || '')}`, '_blank')}>
                Quero o Combo Completo →
              </button>
            </div>

            {/* SÓ CHECKLISTS */}
            <div className="card" style={{ width: '280px', padding: '24px', border: '1px solid var(--border-color)', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '4px' }}>MÓDULO CHECKLIST</div>
                <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Só Checklists</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Auditorias e vistorias ilimitadas com IA.</p>
                <div style={{ fontSize: '2.4rem', fontWeight: 'bold', marginBottom: '4px' }}>
                  R${dashBillingCycle === 'anual' ? '97' : '149'}<span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/mês</span>
                </div>
                <div style={{ color: dashBillingCycle === 'anual' ? '#10b981' : 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '20px' }}>
                  {dashBillingCycle === 'anual' ? '12x R$ 97 (R$ 1.164/ano)' : 'Até 30 colaboradores'}
                </div>
                <div style={{ fontSize: '0.85rem', marginBottom: '24px', color: 'var(--text-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>• <strong>Checklists ILIMITADOS</strong></div>
                  <div>• Auditoria visual por IA</div>
                  <div>• Alertas no WhatsApp</div>
                  <div>• Até <strong>30 colaboradores</strong></div>
                </div>
              </div>
              <button className="btn-secondary" style={{ width: '100%', padding: '12px' }} onClick={() => window.open(dashBillingCycle === 'anual' ? `https://pay.cakto.com.br/e7c88df?email=${encodeURIComponent(userProfile?.email || '')}&name=${encodeURIComponent(userProfile?.name || '')}` : `https://pay.cakto.com.br/3eph5ko_856837?email=${encodeURIComponent(userProfile?.email || '')}&name=${encodeURIComponent(userProfile?.name || '')}`, '_blank')}>
                Assinar Checklists
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs: Módulo Ponto (Ativo) ──────────────────── */}
      {(tab === 'ponto' && (userProfile?.ponto_active || userProfile?.status === 'trial' || userProfile?.email === 'dugaburguer@gmail.com')) && (
        <PontoModule userProfile={userProfile} />
      )}
      {/* ── Tabs: Módulo Ponto (Inativo) ──────────────────── */}
      {(tab === 'ponto' && !userProfile?.ponto_active && userProfile?.status !== 'trial' && userProfile?.email !== 'dugaburguer@gmail.com') && (
        <div className="card animate-fade-up" style={{ textAlign: 'center', padding: '60px 20px' }}>
           <Clock size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }}/>
           <h2 style={{ margin: '0 0 12px 0' }}>Controle de Ponto Bloqueado</h2>
           <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 24px' }}>
             {userProfile?.cobranca_firehub
               ? 'O Controle de ponto está desligado. Para usar, ligue em Checklist e ponto, no painel do FireHub: a cobrança vem no boleto da mensalidade.'
               : 'Seu plano atual não inclui o módulo de Ponto Inteligente com reconhecimento facial e GPS.'}
           </p>
           {/* Levava para setTab('assinatura'), aba que não existe: a tela ficava em
               branco. Quem está aqui não tem o módulo de Ponto, então o produto certo
               é o Combo — o mesmo destino do botão "Combo Completo" usado na tela de
               limite de cota. */}
           {vendeNoApp && !userProfile?.cobranca_firehub && (
           <button
             className="btn"
             onClick={() => window.open(`https://pay.cakto.com.br/pavdwiz_869704?email=${encodeURIComponent(userProfile?.email || '')}&name=${encodeURIComponent(userProfile?.name || '')}`, '_blank')}
             style={{ padding: '12px 24px', borderRadius: '12px', fontSize: '1.05rem' }}
           >
             Fazer Upgrade Agora
           </button>
           )}
        </div>
      )}

      {/* ── Tab: Auditoria em Tempo Real (visual de 21/11/2026) ─────────────── */}
      {tab === 'auditoria' && (
        <div className="card fc-aud" ref={listaDaAuditoriaRef} style={{ scrollMarginTop: '20px' }}>
          <div className="fc-aud-cab">
            <h3>Auditoria em tempo real</h3>
            <span className="fc-olho"><i className="fc-vivo" />atualiza sozinho</span>
            <div className="fc-filtros">
              {filtroStatus && (
                <span className="fc-chip">
                  hoje, só: <b>{filtroStatus === 'aprovado' ? 'aprovados' : filtroStatus === 'reprovado' ? 'reprovados' : 'sem foto ou aguardando'}</b>
                  <button onClick={() => setFiltroStatus(null)} aria-label="Ver todos">×</button>
                </span>
              )}
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} aria-label="Filtrar por segmento">
                <option value="todos">Todos os segmentos</option>
                <option value="geral">Geral / Padrão</option>
                <option value="loja">Loja / Varejo</option>
                <option value="restaurante">Restaurante / Alimentação</option>
                <option value="consultorio">Consultório / Clínicas</option>
                <option value="veiculo">Frota / Veicular</option>
              </select>
              <select value={filtroBaixa} onChange={e => setFiltroBaixa(e.target.value)} aria-label="Filtrar por baixa">
                <option value="todos">Todos</option>
                <option value="pendentes">Aguardando baixa</option>
                <option value="verificados">Verificados</option>
              </select>
            </div>
          </div>
          <div>
            {(() => {
              const filteredSubmissions = submissions.filter(s => {
                if (filtroBaixa === 'pendentes' && s.resolved) return false;
                if (filtroBaixa === 'verificados' && !s.resolved) return false;
                if (filtroStatus) {
                  const st = statusDaSubmissao(s);
                  if (filtroStatus === 'outros' ? ['aprovado', 'reprovado'].includes(st) : st !== filtroStatus) return false;
                  if (!ehHojeEmSP(s.created_at)) return false;
                }
                if (categoryFilter === 'todos') return true;
                const cl = checklists?.find(c => c.id === s.checklist_id);
                return cl && cl.category === categoryFilter;
              });

              return filteredSubmissions.length > 0 ? filteredSubmissions.map(s => {
                const tarefas = s.tasks || [];
                const completedTasks = tarefas.filter(t => t.done).length;
                const totalTasks = tarefas.length || 1;
                const pct = Math.round((completedTasks / totalTasks) * 100);
                const status = statusDaSubmissao(s);
                const cl = checklists?.find(c => c.id === s.checklist_id);
                const marcas = tarefas.map((t, i) => (tarefaReprovada(s, t) ? ((i + 0.5) / tarefas.length) * 100 : null)).filter(m => m != null);
                // Reprovado = barra inteira vermelha (pedido do Douglas, 21/11: sem o risco no meio).
                const cor = ['reprovado', 'falha'].includes(status) ? 'var(--bad)' : status === 'ignorado' ? '#A8A4AB' : pct === 100 ? 'var(--ok)' : 'var(--primary)';
                const quando = new Date(s.created_at);

                return (
                  <div key={s.id} className="fc-lin" onClick={() => abrirDetalheSubmissao(s)}>
                    <span className="fc-av">{temImagem(s.selfie) ? <img src={s.selfie} alt="" /> : iniciais(s.employee_name)}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="fc-t">
                        {cl?.title || s.checklist_title || 'Checklist'}
                        {cl?.category === 'veiculo' && <span className="fc-tag-p">Veicular</span>}
                      </div>
                      <div className="fc-m">{s.employee_name} · {completedTasks} de {tarefas.length} tarefas{marcas.length ? `, ${marcas.length} reprovada${marcas.length > 1 ? 's' : ''}` : ''}</div>
                      {/* Enviado depois de a conferência ter apontado o erro na tela do
                          funcionário: ele leu o motivo, pôde refazer e enviou assim. */}
                      {s.enviado_ciente && <span className="fc-ciente">Enviou ciente da reprovação</span>}
                    </div>
                    <div className="fc-lin-barra"><BarraLuz pct={pct} cor={cor} corre={pct < 100} /></div>
                    <span className="fc-pct"><b>{pct}</b>%</span>
                    <span className="fc-selo-cel">
                      {/* A baixa do gestor: sem ela a lista não dizia quais checklists já tinham sido conferidos. */}
                      <Selo status={status} sub={s.resolved ? textoDaBaixa(s) : status === 'reprovado' ? 'aguardando você conferir' : null} />
                    </span>
                    <div className="fc-acoes">
                      <span className="fc-hora">{ehHojeEmSP(s.created_at) ? 'hoje' : quando.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {!s.resolved && (
                        <button className="fc-mini-btn" onClick={(e) => { e.stopPropagation(); handleResolveSubmission(s.id); }}>Dar baixa</button>
                      )}
                      {(status === 'pendente' || status === 'falha') && (
                        <button className="fc-mini-btn info" onClick={(e) => handleReprocessAudit(e, s.id)} disabled={reprocessando.has(s.id)}>
                          {reprocessando.has(s.id) ? 'Reprocessando…' : 'Tentar de novo'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              }) : (
                <div className="fc-vazio">
                  {filtroStatus ? 'Nenhum checklist de hoje neste filtro.' : 'Nenhuma auditoria realizada no período para esta categoria.'}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Tab: Ranking de Funcionários ─────────────────────────────────── */}
      {tab === 'ranking' && (() => {
        // Ranking (visual de 21/11/2026): mesma conta de antes, apresentação nova.
        const now = new Date();
        const filteredSubmissions = submissions.filter(sub => {
          const subDate = new Date(sub.created_at);
          if (rankingPeriod === 'hoje') {
            return subDate.toDateString() === now.toDateString();
          } else if (rankingPeriod === 'semana') {
            const diffDays = Math.ceil(Math.abs(now - subDate) / (1000 * 60 * 60 * 24));
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
          if (!acc[name]) acc[name] = { name, totalCompleted: 0, totalPossible: 0, envios: 0 };
          acc[name].totalCompleted += completed;
          acc[name].totalPossible += total;
          acc[name].envios += 1;
          totalTasksCompleted += completed;
          totalTasksPossible += total;
          return acc;
        }, {});
        const teamEfficiency = totalTasksPossible > 0 ? Math.round((totalTasksCompleted / totalTasksPossible) * 100) : 0;
        const sortedRanking = Object.values(rankingData)
          .map(r => ({ nome: r.name, pct: Math.round((r.totalCompleted / r.totalPossible) * 100), concluidos: r.totalCompleted, total: r.totalPossible, envios: r.envios }))
          .sort((a, b) => b.pct - a.pct || b.concluidos - a.concluidos)
          .map((r, idx) => ({ ...r, pos: idx + 1 }));
        const corDoPct = (p) => (p >= 90 ? 'var(--ok)' : p >= 70 ? '#D97706' : 'var(--bad)');
        const rotuloDoPct = (p) => (p >= 90 ? 'Destaque' : p >= 70 ? 'Em evolução' : 'Precisa de atenção');
        const podio = [sortedRanking[1], sortedRanking[0], sortedRanking[2]].filter(Boolean);

        return (
          <>
            <div className="fc-barra-ferr">
              <div className="fc-seg" role="tablist" aria-label="Período do ranking">
                {[['hoje', 'Hoje'], ['semana', '7 dias'], ['mes', 'Este mês'], ['personalizado', 'Escolher datas']].map(([chave, nome]) => (
                  <button key={chave} role="tab" aria-selected={rankingPeriod === chave} className={rankingPeriod === chave ? 'on' : ''} onClick={() => setRankingPeriod(chave)}>{nome}</button>
                ))}
              </div>
              {rankingPeriod === 'personalizado' && (
                <div className="fc-periodo">
                  <CalendarClock size={15} color="var(--primary)" />
                  <input type="date" value={rankingCustomDates.start} onChange={(e) => setRankingCustomDates({ ...rankingCustomDates, start: e.target.value })} aria-label="De" />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>até</span>
                  <input type="date" value={rankingCustomDates.end} onChange={(e) => setRankingCustomDates({ ...rankingCustomDates, end: e.target.value })} aria-label="Até" />
                </div>
              )}
            </div>

            {sortedRanking.length === 0 ? (
              <div className="card fc-vazio">
                <Trophy size={36} style={{ marginBottom: '10px', opacity: 0.35 }} />
                <p style={{ fontWeight: 500, color: 'var(--text-main)' }}>Nenhum checklist enviado neste período.</p>
                <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>O ranking aparece assim que a equipe começar a enviar.</p>
              </div>
            ) : (
              <>
                <div className="fc-resumo card">
                  <div><span className="fc-olho-rot">Tarefas feitas</span><strong className="mono">{totalTasksCompleted}</strong></div>
                  <div><span className="fc-olho-rot">Pessoas no ranking</span><strong className="mono">{sortedRanking.length}</strong></div>
                  <div><span className="fc-olho-rot">Na liderança</span><strong style={{ fontSize: '20px', letterSpacing: '-0.5px', marginTop: '12px' }}>{sortedRanking[0].nome}</strong></div>
                  <div className="fc-resumo-barra">
                    <span className="fc-olho-rot">Conformidade da equipe <b className="mono" style={{ marginLeft: 'auto', color: corDoPct(teamEfficiency), letterSpacing: 0 }}>{teamEfficiency}%</b></span>
                    <BarraLuz pct={teamEfficiency} cor={corDoPct(teamEfficiency)} />
                  </div>
                </div>

                {/* Pódio: 2º, 1º (destaque grafite) e 3º */}
                <div className="fc-podio">
                  {podio.map(r => (
                    <div key={r.pos} className={`fc-podio-c card${r.pos === 1 ? ' lider' : ''}`}>
                      <span className="fc-podio-pos mono">{String(r.pos).padStart(2, '0')}</span>
                      {r.pos === 1 && <span className="fc-podio-trofeu"><Trophy size={16} /></span>}
                      <span className="fc-podio-av">{iniciais(r.nome)}</span>
                      <strong className="fc-podio-nome">{r.nome}</strong>
                      <span className="fc-podio-pct mono">{r.pct}<small>%</small></span>
                      <span className="fc-podio-sub">{r.concluidos} de {r.total} tarefas</span>
                    </div>
                  ))}
                </div>

                <div className="card fc-aud">
                  <div className="fc-aud-cab"><h3>Classificação completa</h3></div>
                  {sortedRanking.map(r => (
                    <div key={r.pos} className="fc-rk">
                      <span className="fc-rk-pos mono">{String(r.pos).padStart(2, '0')}</span>
                      <span className="fc-av">{iniciais(r.nome)}</span>
                      <div style={{ minWidth: 0 }}>
                        <div className="fc-t">{r.nome}</div>
                        <div className="fc-m">{r.concluidos} de {r.total} tarefas · {r.envios} checklist{r.envios === 1 ? '' : 's'}</div>
                      </div>
                      <div className="fc-lin-barra"><BarraLuz pct={r.pct} cor={corDoPct(r.pct)} /></div>
                      <span className="fc-pct"><b>{r.pct}</b>%</span>
                      <span className="fc-selo" style={{ '--c': corDoPct(r.pct) }}><i /><span>{rotuloDoPct(r.pct)}</span></span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        );
      })()}

      {/* ── Tab: Landing Page Analytics ─────────────────────────────────────── */}
      {tab === 'codigos' && isMaster && <CodigosDeAtivacao addToast={addToast} />}

      {tab === 'quiz' && isMaster && <ConversaoDoSite />}
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
                  <div style={{ textAlign: 'center', backgroundColor: 'rgb(var(--info-rgb) / 0.1)', padding: '10px 20px', borderRadius: '8px', border: '1px solid rgb(var(--info-rgb) / 0.3)' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--info)', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                      <div style={{ width: '8px', height: '8px', backgroundColor: 'var(--info)', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
                      {onlineNow}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--info)' }}>Online Agora</div>
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
        <div className="card fc-aud">
          <div className="fc-aud-cab" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
            <h3>Reprovações e registros da equipe</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Fotos que a IA reprovou e o que a equipe registrou fora da rotina.</p>
          </div>

          {/* ── O que a equipe registrou por conta própria ────────────────────
              Fica acima das reprovações porque é informação que ninguém pediu:
              alguém parou o serviço para avisar de um problema, e isso costuma
              ser mais urgente do que uma foto que saiu torta. */}
          {ocorrencias.length > 0 && (
            <div style={{ padding: '4px 8px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span className="fc-olho-rot" style={{ padding: '6px 6px 0' }}>Registrado pela equipe</span>
              {ocorrencias.map(o => (
                <div key={`oc-${o.id}`} className="fc-alerta" style={{ '--c': o.tipo === 'descarte' ? '#0F766E' : '#D97706' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div className="fc-alerta-t">
                      <span className="fc-tag-p" style={{ color: 'var(--c)', borderColor: 'currentColor' }}>{o.tipo === 'descarte' ? 'Descarte' : 'Ocorrência'}</span>
                      {o.employee_name}
                    </div>
                    <span className="fc-hora">{new Date(o.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>

                    {o.tipo === 'descarte' && (
                      <p style={{ margin: '8px 0 0 0', fontSize: '0.88rem' }}>
                        <strong>{o.item}</strong>
                        {(o.quantidade || o.unidade) && <> — {[o.quantidade, o.unidade].filter(Boolean).join(' ')}</>}
                        {o.motivo && <> · {o.motivo}</>}
                        {o.valor_estimado != null && <> · <strong>R$ {Number(o.valor_estimado).toFixed(2).replace('.', ',')}</strong></>}
                      </p>
                    )}
                    {o.tipo === 'descarte' && o.firehub_status && (
                      <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '0.75rem', color: o.firehub_status === 'enviado' ? '#0f766e' : '#b45309' }}>
                        {o.firehub_status === 'enviado'
                          ? 'Lançado como perda no FireHub'
                          : 'Ainda não chegou ao FireHub — vai de novo junto com o próximo descarte'}
                      </span>
                    )}
                    {o.descricao && (
                      <p style={{ margin: '8px 0 0 0', fontSize: '0.88rem', color: 'var(--text-main)' }}>{o.descricao}</p>
                    )}
                  </div>
                  {o.photo && (
                    <img
                      src={o.photo}
                      alt="Foto do registro"
                      onClick={() => window.open(o.photo, '_blank')}
                      style={{ width: '84px', height: '84px', objectFit: 'cover', borderRadius: '12px', cursor: 'pointer', flexShrink: 0 }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ padding: '4px 8px 8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {submissions.some(s => Object.values(s.feedback_info || {}).some(f => f?.status === 'warning' || f?.status === 'error')) ? (
              <>
                <span className="fc-olho-rot" style={{ padding: '6px 6px 0' }}>Reprovado pela IA</span>
                {submissions.map(s => {
                  const alerts = Object.entries(s.feedback_info || {}).filter(([, f]) => f?.status === 'warning' || f?.status === 'error');
                  if (alerts.length === 0) return null;

                  return alerts.map(([taskId, feedback]) => {
                    // As chaves de feedback_info chegam como string (chave de JSON),
                    // mas os ids das tarefas são números — sem coerção o find nunca
                    // casava e todo alerta virava "Tarefa Desconhecida".
                    const task = (s.tasks || []).find(t => String(t.id) === String(taskId));
                    return (
                      <div key={`${s.id}-${taskId}`} className="fc-alerta" style={{ '--c': s.resolved ? 'var(--ok)' : 'var(--bad)', opacity: s.resolved ? 0.75 : 1 }}>
                        <div style={{ flex: 1, minWidth: '220px' }}>
                          <div className="fc-alerta-t">
                            {s.resolved ? <CheckCircle size={16} color="var(--ok)" /> : <AlertCircle size={16} color="var(--bad)" />}
                            {task?.text || 'Tarefa'}
                          </div>
                          <span className="fc-hora">
                            {new Date(s.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {s.employee_name}
                            {s.resolved ? ` · ${textoDaBaixa(s)}` : ''}
                          </span>
                          <p className="fc-alerta-ia">
                            <b>A IA viu:</b> {feedback?.message || feedback?.mensagem || 'Foto fora do padrão.'}
                          </p>
                        </div>
                        <button className={s.resolved ? 'fc-mini-btn' : 'fc-pilula'} style={{ alignSelf: 'center' }} onClick={() => abrirDetalheSubmissao(s)}>
                          {s.resolved ? 'Ver evidência' : <>Conferir e resolver <i><ArrowUpRight size={15} /></i></>}
                        </button>
                      </div>
                    );
                  });
                })}
              </>
            ) : (
              <div className="fc-vazio">
                <CheckCircle size={36} color="var(--ok)" style={{ marginBottom: '10px' }} />
                <p>Nenhuma foto reprovada pela IA no período.</p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── Tab: Checklist desligado no FireHub ─────────────────────────── */}
      {(tab === 'checklists' && userProfile?.cobranca_firehub && userProfile?.checklists_active === false) && (
        <div className="card animate-fade-up" style={{ textAlign: 'center', padding: '60px 20px' }}>
           <ClipboardList size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }}/>
           <h2 style={{ margin: '0 0 12px 0' }}>Checklist desligado</h2>
           <p style={{ color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto' }}>Para usar os checklists, ligue o Checklist em Checklist e ponto, no painel do FireHub. A cobrança vem no boleto da mensalidade.</p>
        </div>
      )}
      {/* ── Tab: Gerenciar Checklists ──────────────────────────────────── */}
      {tab === 'checklists' && !(userProfile?.cobranca_firehub && userProfile?.checklists_active === false) && (() => {
        // Aba Checklists (visual de 21/11/2026): resumo do dia, filtro em pílulas e
        // uma linha por checklist com status e ações em ícone.
        const todos = sortedAdminChecklists || [];
        const feitos = todos.filter(cl => cl.completedToday);
        const pendentes = todos.filter(cl => !cl.completedToday);
        const pctHoje = todos.length ? Math.round((feitos.length / todos.length) * 100) : 0;
        const lista = filtroChecklists === 'feitos' ? feitos : filtroChecklists === 'pendentes' ? pendentes : todos;
        return (
          <>
            {todos.length > 0 && (
              <div className="fc-resumo card">
                <div><span className="fc-olho-rot">Checklists ativos</span><strong className="mono">{todos.length}</strong></div>
                <div><span className="fc-olho-rot">Feitos hoje</span><strong className="mono" style={{ color: 'var(--ok)' }}>{feitos.length}</strong></div>
                <div><span className="fc-olho-rot">Faltam hoje</span><strong className="mono" style={{ color: pendentes.length ? '#D97706' : 'var(--text-main)' }}>{pendentes.length}</strong></div>
                <div className="fc-resumo-barra">
                  <span className="fc-olho-rot">Andamento do dia <b className="mono" style={{ marginLeft: 'auto', color: 'var(--text-main)', letterSpacing: 0 }}>{pctHoje}%</b></span>
                  <BarraLuz pct={pctHoje} cor={pctHoje === 100 ? 'var(--ok)' : 'var(--primary)'} corre={pctHoje < 100} />
                </div>
              </div>
            )}

            <div className="card fc-aud">
              <div className="fc-aud-cab">
                <div className="fc-seg" role="tablist" aria-label="Filtrar checklists">
                  {[['pendentes', `Faltam hoje`, pendentes.length], ['feitos', 'Feitos hoje', feitos.length], ['todos', 'Todos', todos.length]].map(([chave, nome, n]) => (
                    <button key={chave} role="tab" aria-selected={filtroChecklists === chave} className={filtroChecklists === chave ? 'on' : ''} onClick={() => setFiltroChecklists(chave)}>
                      {nome} <span className="mono">{n}</span>
                    </button>
                  ))}
                </div>
                <div className="fc-filtros">
                  {todos.length > 1 && (
                    <button
                      type="button"
                      className={`fc-mini-btn${checklistSortAlphabetical ? ' on' : ''}`}
                      onClick={() => {
                        const nextVal = !checklistSortAlphabetical;
                        setChecklistSortAlphabetical(nextVal);
                        try { localStorage.setItem('firecheck_admin_sort_alphabetical', String(nextVal)); } catch (e) { /* sem armazenamento: vale só nesta visita */ }
                      }}
                      title={checklistSortAlphabetical ? 'Ordem alfabética ativa (clique para voltar à ordem padrão)' : 'Ordenar de A a Z'}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 13px' }}
                    >
                      <ArrowDownAZ size={14} /> {checklistSortAlphabetical ? 'A a Z' : 'Ordenar A a Z'}
                    </button>
                  )}
                  <button className="fc-pilula" onClick={() => navigate('/admin/creator')}>Novo checklist <i><Plus size={15} /></i></button>
                </div>
              </div>

              {todos.length === 0 ? (
                <div className="fc-vazio">
                  <ClipboardList size={36} style={{ marginBottom: '10px', opacity: 0.35 }} />
                  <p style={{ marginBottom: '14px' }}>Nenhum checklist criado nesta loja ainda.</p>
                  <button className="fc-pilula" style={{ alignSelf: 'center', margin: '0 auto' }} onClick={() => navigate('/admin/creator')}>Criar meu primeiro checklist <i><Plus size={15} /></i></button>
                </div>
              ) : lista.length === 0 ? (
                <div className="fc-vazio">
                  {filtroChecklists === 'pendentes'
                    ? <><CheckCircle size={32} color="var(--ok)" style={{ marginBottom: '8px' }} /><p>Todos os checklists de hoje já foram feitos.</p></>
                    : <p>Nenhum checklist foi feito hoje ainda.</p>}
                </div>
              ) : (
                <div>
                  {lista.map(cl => (
                    <div key={cl.id} className="fc-cl">
                      <span className="fc-av" style={cl.completedToday ? { color: 'var(--ok)' } : undefined}>
                        {cl.completedToday ? <CheckCircle size={18} /> : <ClipboardList size={18} />}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="fc-t">{cl.title}</div>
                        <div className="fc-m">{cl.tasks?.length || 0} tarefa{(cl.tasks?.length || 0) === 1 ? '' : 's'} · {RECURRENCE_LABEL[cl.recurrence] || 'Único'}</div>
                      </div>
                      <span className="fc-selo-cel">
                        {cl.completedToday
                          ? <span className="fc-selo" style={{ '--c': 'var(--ok)' }}><i /><span>Feito hoje<small>por {cl.completedBy || 'equipe'}</small></span></span>
                          : <span className="fc-selo" style={{ '--c': '#D97706' }}><i /><span>Falta fazer hoje</span></span>}
                      </span>
                      <div className="fc-ico-acoes">
                        <button className="fc-ico" title="Ver como o funcionário vê" aria-label={`Visualizar ${cl.title}`} onClick={() => navigate(`/execucao/${cl.id}?preview=true`)}><Eye size={16} /></button>
                        <button className="fc-ico" title="Editar" aria-label={`Editar ${cl.title}`} onClick={() => navigate(`/admin/creator/${cl.id}`)}><Edit2 size={16} /></button>
                        <button className="fc-ico perigo" title="Excluir" aria-label={`Excluir ${cl.title}`} onClick={() => handleDeleteChecklist(cl.id, cl.title)}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* ── Tab: Frota e Veículos ────────────────────────────────────────── */}
      {tab === 'vehicles' && (() => {
        // Frota (visual de 21/11/2026): cartões com a foto em destaque, placa no
        // formato de placa, km e motorista em linhas de dado, ações em pílula.
        const abrirCadastro = () => {
          setEditingVehicle(null);
          setNewVehicle({ plate: '', model: '', brand: '', color: '', year: '', currentKm: '', photoUrl: '', status: 'ativo', employeeId: '', tasks: [], scheduleType: 'manual', scheduleData: null });
          setShowVehicleModal(true);
        };
        const ativos = vehicles.filter(v => v.status === 'ativo').length;
        return (
          <>
            <div className="fc-barra-ferr">
              {vehicles.length > 0 && (
                <span className="fc-olho-rot" style={{ letterSpacing: '.06em' }}>
                  <span className="mono" style={{ color: 'var(--text-main)' }}>{vehicles.length}</span> veículo{vehicles.length === 1 ? '' : 's'} ·
                  <span className="mono" style={{ color: 'var(--ok)' }}>{ativos}</span> ativo{ativos === 1 ? '' : 's'}
                </span>
              )}
              {/* Funcionário consulta a frota para escolher o veículo na vistoria,
                  mas não a administra — mesma trava já usada na aba de compras. */}
              {!isFuncionario && (
                <button className="fc-pilula" style={{ marginLeft: 'auto' }} onClick={abrirCadastro}>Cadastrar veículo <i><Plus size={15} /></i></button>
              )}
            </div>

            {vehicles.length > 0 ? (
              <div className="fc-frota">
                {vehicles.map(v => (
                  <div key={v.id} className="card fc-veic">
                    <div className="fc-veic-foto">
                      {v.photo_url ? <img src={v.photo_url} alt={v.model} /> : <Car size={40} color="var(--text-muted)" />}
                      <span className="fc-selo fc-veic-st" style={{ '--c': v.status === 'ativo' ? 'var(--ok)' : 'var(--bad)' }}><i /><span>{v.status === 'ativo' ? 'Ativo' : 'Em manutenção'}</span></span>
                    </div>
                    <div className="fc-veic-corpo">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
                        <h4 className="fc-veic-nome">{v.brand} {v.model}</h4>
                        <span className="fc-placa mono">{v.plate}</span>
                      </div>
                      <div className="fc-veic-dados">
                        <div><span className="fc-olho-rot">Km atual</span><b className="mono">{v.current_km ? Number(v.current_km).toLocaleString('pt-BR') : '0'}</b></div>
                        <div><span className="fc-olho-rot">Motorista</span><b>{v.employee_name || 'Sem motorista'}</b></div>
                      </div>
                      <div className="fc-veic-acoes">
                        {v.status === 'ativo' && v.employee_id && (
                          <button className="fc-pilula" onClick={() => handleSolicitVehicleChecklist(v.id)}>Pedir vistoria <i><ArrowUpRight size={15} /></i></button>
                        )}
                        {!isFuncionario && (<>
                          <button className="fc-ico" title="Editar" aria-label={`Editar ${v.plate}`} style={{ marginLeft: 'auto' }} onClick={() => {
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
                          }}><Edit2 size={15} /></button>
                          <button className="fc-ico perigo" title="Excluir" aria-label={`Excluir ${v.plate}`} onClick={() => handleDeleteVehicle(v.id)}><Trash2 size={15} /></button>
                        </>)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card fc-vazio">
                <Car size={36} style={{ marginBottom: '10px', opacity: 0.35 }} />
                <p style={{ marginBottom: '14px' }}>Nenhum veículo cadastrado na frota desta loja.</p>
                {!isFuncionario && <button className="fc-pilula" style={{ margin: '0 auto' }} onClick={abrirCadastro}>Cadastrar o primeiro veículo <i><Plus size={15} /></i></button>}
              </div>
            )}
          </>
        );
      })()}

      {showVehicleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px', pointerEvents: 'auto', backdropFilter: 'blur(5px)' }}>
          <div className="card animate-scale modal-janela" style={{ width: '100%', maxWidth: '900px', display: 'flex', flexDirection: 'column', position: 'relative', pointerEvents: 'auto', maxHeight: '90vh', overflowY: 'auto' }}>
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
                  <label className="input-label">Motorista Vinculado (Equipe)</label>
                  <select className="input-field" value={newVehicle.employeeId} onChange={e => setNewVehicle({ ...newVehicle, employeeId: e.target.value })}>
                    <option value="">Nenhum — Apenas livre demanda</option>
                    {team.filter(m => m.role === 'funcionario' || m.role === 'gestor' || m.role === 'admin' || m.role === 'master').map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
                  <div>
                    <label className="input-label">Status do Veículo</label>
                    <select className="input-field" value={newVehicle.status} onChange={e => setNewVehicle({ ...newVehicle, status: e.target.value })}>
                      <option value="ativo">Ativo na Frota</option>
                      <option value="manutencao">Em Manutenção / Inativo</option>
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
                <h4 style={{ margin: '16px 0 8px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', color: 'var(--primary)' }}>Programação do Checklist</h4>
                <div>
                  <label className="input-label">Recorrência / Agendamento</label>
                  <select className="input-field" value={newVehicle.scheduleType} onChange={e => {
                    const type = e.target.value;
                    let initialData = null;
                    if (type === 'weekdays') initialData = [];
                    if (type === 'specific_dates') initialData = [];
                    setNewVehicle({ ...newVehicle, scheduleType: type, scheduleData: initialData });
                  }}>
                    <option value="manual">Sob Demanda (Manual/Livre)</option>
                    <option value="daily">Diário (Todos os dias)</option>
                    <option value="weekdays">Dias da Semana Específicos</option>
                    <option value="specific_dates">Datas Recorrentes / Agendadas</option>
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
                          <label key={index} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', backgroundColor: isChecked ? 'rgb(var(--primary-rgb) / 0.1)' : 'transparent', fontSize: '0.85rem' }}>
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
                        <span key={dt} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', backgroundColor: 'var(--bg-inset)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.8rem' }}>
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
                  <h4 style={{ margin: 0, color: 'var(--primary)' }}>Critérios de Checklist</h4>
                  
                  {vehicles.filter(v => v.id !== newVehicle.id && v.tasks && v.tasks.length > 0).length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <select style={{ fontSize: '0.78rem', padding: '4px', backgroundColor: 'var(--bg-inset)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px' }} onChange={e => {
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
                    <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: 'var(--bg-inset)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
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
                    Adicionar Item ao Checklist
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
        // Equipe / Gestão de Clientes (visual de 21/11/2026)
        <>
          {isMaster && (
            <div className="fc-filtros-num">
              {[
                ['trial', 'Testes ativos', '#D97706', team.filter(m => m.role === 'admin' && m.status === 'trial' && !isBlocked(m)).length],
                ['bloqueadas', 'Contas bloqueadas', 'var(--bad)', team.filter(m => m.role === 'admin' && isBlocked(m)).length],
                ['pagantes', 'Clientes pagantes', 'var(--ok)', team.filter(m => m.role === 'admin' && m.status === 'active' && !isBlocked(m)).length],
              ].map(([chave, nome, cor, n]) => (
                <button key={chave} type="button" className={`card${filtroContas === chave ? ' on' : ''}`} style={{ '--c': cor }}
                  onClick={() => setFiltroContas(filtroContas === chave ? null : chave)} aria-pressed={filtroContas === chave}
                  title={filtroContas === chave ? 'Mostrar todas as contas' : 'Filtrar a lista por esta situação'}>
                  <span className="fc-olho-rot"><i />{nome}</span>
                  <strong className="mono">{n}</strong>
                </button>
              ))}
            </div>
          )}

          <div className="card fc-aud">
            <div className="fc-aud-cab">
              <h3>{isMaster ? 'Contas de clientes (donos de loja)' : 'Equipe da loja'}</h3>
              <span className="fc-olho-rot" style={{ letterSpacing: '.06em' }}><span className="mono">{(team || []).length}</span> {isMaster ? 'contas' : 'pessoas'}</span>
              <div className="fc-filtros">
                {isMaster && filtroContas && (
                  <span className="fc-chip">filtro ativo<button onClick={() => setFiltroContas(null)} aria-label="Mostrar todas">×</button></span>
                )}
                {!isFuncionario && (
                  <button className="fc-pilula" onClick={() => {
                    setNewUser({ name: '', email: '', password: '', role: isMaster ? 'admin' : 'funcionario', store: isMaster ? '' : userProfile?.store, plan: 'mensal' });
                    setShowUserModal(true);
                  }}>
                    {isMaster ? 'Adicionar cliente' : 'Adicionar colaborador'} <i><UserPlus size={15} /></i>
                  </button>
                )}
              </div>
            </div>

            <div>
              {(team || []).filter(m => !isMaster || !filtroContas || (m.role === 'admin' && (filtroContas === 'trial' ? (m.status === 'trial' && !isBlocked(m)) : filtroContas === 'bloqueadas' ? isBlocked(m) : (m.status === 'active' && !isBlocked(m))))).map(member => {
                const statusInfo = isMaster && member.role === 'admin' ? getUserStatus(member) : null;
                const papel = isMaster ? null
                  : member.role === 'gestor' ? ['Gestor / Gerente', 'var(--info)']
                  : member.role === 'admin' ? (member.id === userProfile?.id ? ['Dono / Administrador', 'var(--primary)'] : ['Conta secundária', '#D97706'])
                  : ['Funcionário', '#A8A4AB'];
                const sch = !isMaster && member.schedule_id ? schedules.find(s => String(s.id) === String(member.schedule_id)) : null;
                return (
                  <div key={member.id} className="fc-eq">
                    <span className="fc-av">{iniciais(member.name)}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="fc-t">
                        {member.name}
                        {member.id === userProfile?.id && <span className="fc-tag-p">você</span>}
                      </div>
                      <div className="fc-m">{member.email} · {member.phone ? <span className="mono">{member.phone}</span> : 'sem telefone'}{isMaster ? ` · ${member.store}` : ''}</div>
                      <div className="fc-eq-dados">
                        {statusInfo && <span className="fc-dado" style={{ '--c': statusInfo.color }}>{statusInfo.text}</span>}
                        {isMaster && member.role === 'admin' && member.cobranca_firehub === true && (
                          <span className="fc-dado" title={member.firehub_motivo ? `Bloqueada pelo FireHub: ${member.firehub_motivo}` : 'A mensalidade desta loja é cobrada no boleto do FireHub'}
                            style={{ '--c': 'var(--primary)', background: 'var(--ink)', color: '#fff', boxShadow: 'none' }}>
                            <Flame size={11} /> Pago pelo FireHub{member.firehub_motivo ? ` · ${member.firehub_motivo}` : ''}
                          </span>
                        )}
                        {papel && <span className="fc-dado" style={{ '--c': papel[1] }}>{papel[0]}</span>}
                        {sch && <span className="fc-dado" style={{ '--c': sch.color }}>Escala: {sch.name}</span>}
                        {!isMaster && !member.schedule_id && member.ponto_hora_entrada && member.ponto_hora_entrada !== '08:00' && (
                          <span className="fc-dado mono" style={{ '--c': 'var(--ok)' }}>{member.ponto_hora_entrada} - {member.ponto_hora_saida || '18:00'}</span>
                        )}
                      </div>
                      {/* ── O que o plano de fato limita ─────────────────────────
                          Os planos vendem "até N colaboradores" e checklists sem limite;
                          o número que importa, para saber quando um cliente vai precisar
                          de upgrade, é quantas pessoas ele já cadastrou. */}
                      {isMaster && member.role === 'admin' && (() => {
                        const usados = Number(member.colaboradores || 0);
                        const teto = Number(member.colaboradores_limite || member.ponto_limit || 0);
                        const semTeto = !teto || teto >= 999999;
                        const fracao = semTeto ? 0 : Math.min(1, usados / teto);
                        const cor = fracao >= 0.95 ? 'var(--bad)' : fracao >= 0.8 ? '#D97706' : 'var(--primary)';
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                            <div style={{ width: '96px' }}><BarraLuz pct={Math.round(fracao * 100)} cor={cor} /></div>
                            <span className="mono" style={{ fontSize: '0.75rem', color: fracao >= 0.8 ? cor : 'var(--text-muted)' }}>{usados}/{semTeto ? '∞' : teto}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>colaboradores · checklists ilimitados</span>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="fc-ico-acoes" style={{ alignItems: 'center' }}>
                      {member.id !== userProfile?.id && (
                        <button className="fc-mini-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 13px' }} onClick={() => handleImpersonateUser(member)}>
                          <Eye size={14} /> Acessar conta
                        </button>
                      )}
                      {isMaster && member.role === 'admin' && (
                        <button className="fc-mini-btn" style={{ padding: '7px 13px' }} onClick={() => { setTrialDays(null); setEditingPlan({ ...member }); }}>
                          Alterar plano
                        </button>
                      )}
                      {(isMaster || member.id !== userProfile?.id) && (
                        <button className="fc-ico" title="Editar" aria-label={`Editar ${member.name}`} onClick={() => {
                          // A coluna permissions é TEXT, então a API devolve uma string JSON.
                          // Sem normalizar aqui, as caixas do modal liam string[chave] (sempre
                          // undefined, todas apareciam desmarcadas) e o onChange espalhava a
                          // string, gravando um objeto de caracteres soltos. Como o merge usa
                          // defaults todos verdadeiros, os acessos revogados voltavam sozinhos.
                          setEditingUser({ ...member, permissions: getSafeGestorPermissions(member.permissions) });
                          setShowEditModal(true);
                        }}>
                          <Edit2 size={15} />
                        </button>
                      )}
                      {/* Nunca na própria linha: com `isMaster ||` o curto-circuito fazia a
                          lixeira aparecer para o master em si mesmo, e o backend não impede.
                          Um clique apagaria a conta que administra o sistema inteiro. */}
                      {member.id !== userProfile?.id && (
                        <button className="fc-ico perigo" title="Excluir" aria-label={`Excluir ${member.name}`} onClick={() => handleDeleteUser(member.id)}>
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Tab: Perfil da Empresa ──────────────────────────────────── */}
      {tab === 'perfil' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '1.05rem', fontWeight: 600 }}>
              Dados da empresa
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
              <div className="fc-plano">
                <div>
                  <span className="fc-olho-rot">Plano atual</span>
                  <p className="fc-plano-nome">{nomeDoPlano(userProfile?.plan)}</p>
                  <span className="fc-selo" style={{ '--c': userProfile?.status === 'trial' ? '#FFB020' : '#2DD4A0', marginTop: '6px' }}><i /><span>{userProfile?.status === 'trial' ? 'Em teste' : 'Ativo'}</span></span>
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {/* Aqui dizia "Limite de Checklists: 300/mês" para quem comprou
                      justamente checklists ilimitados. O número saia da coluna
                      antiga do banco, que os planos atuais nem usam. */}
                  <p style={{ margin: '4px 0' }}>• Checklists: <strong>Ilimitados</strong></p>
                  <p style={{ margin: '4px 0' }}>• Colaboradores: <strong>até {(userProfile?.colaboradores_limite || userProfile?.ponto_limit) >= 999999 ? 'ilimitados' : (userProfile?.colaboradores_limite || userProfile?.ponto_limit || 30)}</strong> cadastrados</p>
                  {/* Módulo Financeiro não é oferecido no momento. A linha só aparece
                      para quem já o tem ativo — para os demais dizia sempre "Inativo",
                      anunciando um recurso que o cliente não consegue contratar. */}
                  {userProfile?.finance_active && (
                    <p style={{ margin: '4px 0' }}>• Módulo Financeiro: <strong>Ativo</strong></p>
                  )}
                </div>
                {vendeNoApp && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem' }}>Deseja fazer um Upgrade de Plano?</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Antes havia "Plano Pro (R$97/mês)" apontando para o checkout
                        ANUAL de R$1.164 à vista, e um "Plano Business" cujo link não
                        corresponde a nenhum produto vendido. Agora sai de
                        PLANOS_COMERCIAIS, com preço e link sempre coerentes. */}
                    {PLANOS_COMERCIAIS.filter(pl => pl.id === 'combo').map(pl => (
                      <div key={pl.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button className="btn" style={{ width: '100%', padding: '10px', fontSize: '0.85rem' }} onClick={() => window.open(linkComDados(pl.anual.link, userProfile), '_blank')}>
                          {pl.nome} anual — {pl.anual.valor}{pl.anual.periodo}
                        </button>
                        <button className="btn-secondary" style={{ width: '100%', padding: '10px', fontSize: '0.85rem' }} onClick={() => window.open(linkComDados(pl.mensal.link, userProfile), '_blank')}>
                          {pl.nome} mensal — {pl.mensal.valor}{pl.mensal.periodo}
                        </button>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Lembre-se de cancelar o plano anterior na Cakto após o upgrade para evitar cobranças duplicadas.
                  </p>
                </div>
                )}
              </div>
            </div>
          </div>
          <AlterarSenha apiUrl={API_URL} />
        </div>
      )}

      {/* ── Tab: Compras e Estoque ──────────────────────────────────── */}
      {tab === 'compras' && (
        <div>
          {/* Compras e Estoque (visual de 21/11/2026) */}
          <div className="fc-barra-ferr">
            <span className="fc-olho-rot">Listas de compras</span>
            {!isFuncionario && (
              <button className="fc-pilula" style={{ marginLeft: 'auto' }} onClick={() => { setEditingShopping(null); setNewShopping({ title: '', recurrence: 'weekly', weekdays: [], assignedTo: 'todos', items: [{ name: '', unit: 'un', minStock: '', category: 'geral' }] }); setShowShoppingModal(true); }}>
                Nova lista de compras <i><Plus size={15} /></i>
              </button>
            )}
          </div>

          {shoppingLists.length > 0 ? (
            <div className="fc-frota">
              {shoppingLists.map(list => {
                const abaixo = parseInt(list.below_min_count) || 0;
                const itens = parseInt(list.item_count) || 0;
                const okPct = itens ? Math.round(((itens - abaixo) / itens) * 100) : 100;
                return (
                  <div key={list.id} className="card fc-lista">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ minWidth: 0 }}>
                        <h4 className="fc-veic-nome" style={{ marginBottom: '4px' }}>{list.title}</h4>
                        <span className="fc-m" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {list.recurrence === 'daily' ? 'Diária' : list.recurrence === 'weekly' ? 'Semanal' : list.recurrence === 'monthly' ? 'Mensal' : list.recurrence}
                          {list.assigned_to && list.assigned_to !== 'todos' ? ` · ${typeof list.assigned_to === 'object' ? list.assigned_to.join(', ') : list.assigned_to}` : ''}
                        </span>
                      </div>
                      {!isFuncionario && (
                        <div className="fc-ico-acoes">
                          <button className="fc-ico" title="Editar" aria-label={`Editar ${list.title}`} onClick={() => handleEditShopping(list)}><Edit2 size={15} /></button>
                          <button className="fc-ico perigo" title="Excluir" aria-label={`Excluir ${list.title}`} onClick={() => handleDeleteShopping(list.id)}><Trash2 size={15} /></button>
                        </div>
                      )}
                    </div>
                    <div className="fc-veic-dados">
                      <div><span className="fc-olho-rot">Itens</span><b className="mono">{itens}</b></div>
                      <div><span className="fc-olho-rot">Abaixo do mínimo</span><b className="mono" style={{ color: abaixo ? 'var(--bad)' : 'var(--ok)' }}>{abaixo}</b></div>
                    </div>
                    <div>
                      <span className="fc-olho-rot" style={{ marginBottom: '8px' }}>Estoque em dia <b className="mono" style={{ marginLeft: 'auto', color: 'var(--text-main)', letterSpacing: 0 }}>{okPct}%</b></span>
                      <BarraLuz pct={okPct} cor={abaixo ? '#D97706' : 'var(--ok)'} />
                    </div>
                    {!isFuncionario && (
                      <button className="fc-mini-btn" onClick={() => setEstoqueAberto(list)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '9px 14px' }}>
                        <Package size={15} /> Estoque: entradas e saídas
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card fc-vazio">
              <ShoppingCart size={36} style={{ marginBottom: '10px', opacity: 0.35 }} />
              <p style={{ fontWeight: 500, color: 'var(--text-main)' }}>Nenhuma lista de compras cadastrada.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>Crie a primeira lista para controlar o estoque da loja.</p>
            </div>
          )}

          {/* Histórico de conferências de estoque */}
          <div className="card fc-aud" style={{ marginTop: '28px' }}>
            <div className="fc-aud-cab"><h3>Conferências de estoque</h3><span className="fc-olho-rot" style={{ letterSpacing: '.06em' }}>mais recentes primeiro</span></div>
            {shoppingSubmissions.length > 0 ? (
              <div>
                {shoppingSubmissions.map(sub => {
                  const belowMin = typeof sub.below_minimum === 'string' ? (() => { try { return JSON.parse(sub.below_minimum); } catch(e) { return []; } })() : (sub.below_minimum || []);
                  const itemsList = typeof sub.items === 'string' ? (() => { try { return JSON.parse(sub.items); } catch(e) { return []; } })() : (sub.items || []);
                  const hasBelowMin = belowMin.length > 0;
                  const quando = new Date(sub.created_at);
                  return (
                    <div key={sub.id} className="fc-cl" style={{ cursor: 'pointer' }} onClick={() => setSelectedShoppingSubModal(sub)}>
                      <span className="fc-av"><Package size={17} /></span>
                      <div style={{ minWidth: 0 }}>
                        <div className="fc-t">{sub.list_title || 'Lista de compras'}</div>
                        <div className="fc-m">{sub.employee_name} · {itemsList.length} itens conferidos</div>
                      </div>
                      <span className="fc-selo-cel">
                        <span className="fc-selo" style={{ '--c': hasBelowMin ? 'var(--bad)' : 'var(--ok)' }}><i />
                          <span>{hasBelowMin ? `${belowMin.length} abaixo do mínimo` : 'Estoque completo'}<small className="mono">{quando.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small></span>
                        </span>
                      </span>
                      <button className="fc-mini-btn" onClick={(e) => { e.stopPropagation(); setSelectedShoppingSubModal(sub); }}>Ver relatório</button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="fc-vazio">Nenhuma conferência de estoque feita ainda.</div>
            )}
          </div>

          {estoqueAberto && (
            <EstoqueDaLista lista={estoqueAberto} onFechar={() => setEstoqueAberto(null)} onMudou={fetchShoppingLists} />
          )}

          {/* Modal de Detalhes da Submissão de Compras */}
          {selectedShoppingSubModal && (
            <div className="modal-overlay animate-fade">
              <div className="modal-content" style={{ maxWidth: '650px', width: '94%', maxHeight: '90vh', overflow: 'auto', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0 }}>Relatório de Conferência de Estoque</h3>
                  <button onClick={() => setSelectedShoppingSubModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20}/></button>
                </div>

                <div style={{ backgroundColor: 'var(--bg-main)', padding: '14px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.9rem' }}>
                  <p style={{ margin: '0 0 4px 0' }}><strong>Lista:</strong> {selectedShoppingSubModal.list_title || 'Lista de Compras'}</p>
                  <p style={{ margin: '0 0 4px 0' }}><strong>Funcionário:</strong> {selectedShoppingSubModal.employee_name}</p>
                  <p style={{ margin: 0 }}><strong>Data:</strong> {new Date(selectedShoppingSubModal.created_at).toLocaleString('pt-BR')}</p>
                  {selectedShoppingSubModal.notes && (
                    <p style={{ margin: '8px 0 0 0', color: 'var(--primary)' }}><strong>Obs:</strong> {selectedShoppingSubModal.notes}</p>
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
                        background: shoppingAIMode ? 'linear-gradient(135deg, var(--info), var(--info))' : 'transparent',
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
                            {msg.role === 'bill' && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--info)' }}><Bot size={14}/> Bill IA</div>}
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {shoppingAIGenerating && (
                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                          <div style={{ padding: '10px 14px', borderRadius: '2px 12px 12px 12px', backgroundColor: 'var(--bg-card)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--info)' }}>
                            <Bot size={14}/> <span style={{ animation: 'pulse 1s infinite' }}>Pensando...</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Input de mensagem + áudio */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button onClick={handleShoppingAIRecord} disabled={shoppingAIGenerating}
                        style={{ width: '44px', height: '44px', borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                          backgroundColor: shoppingAIRecording ? '#ef4444' : 'var(--info)', color: 'white',
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
              <div style={{ background: 'linear-gradient(135deg, var(--info) 0%, var(--info) 100%)', padding: '32px 24px', textAlign: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', backdropFilter: 'blur(8px)' }}>
                  <Bot size={32} color="white" />
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.2)', padding: '8px 20px', borderRadius: '20px', fontSize: '0.95rem', fontWeight: '600', color: 'white', backdropFilter: 'blur(8px)' }}>
                  Conectado ao Bill
                </div>
              </div>
              <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.3rem' }}>{billUser?.name}</h3>
                <p style={{ margin: '0 0 24px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Plano: <strong style={{ color: 'var(--info)' }}>{billUser?.plan}</strong>
                </p>
                <div style={{ backgroundColor: 'rgb(var(--info-rgb) / 0.08)', border: '1px solid rgb(var(--info-rgb) / 0.2)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
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
              <div style={{ background: 'radial-gradient(420px 220px at 85% 0%, rgb(var(--primary-rgb) / 0.35), transparent 70%), #101014', padding: '48px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
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
                    { icon: <ClipboardList size={18} color="var(--info)" />, text: 'Checklists sincronizados' },
                    { icon: <Activity size={18} color="var(--info)" />, text: 'Dashboard integrado' },
                    { icon: <Trophy size={18} color="var(--info)" />, text: 'Ranking unificado' },
                    { icon: <UserCheck size={18} color="var(--info)" />, text: 'Controle de ponto' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgb(var(--info-rgb) / 0.06)', padding: '12px', borderRadius: '10px', border: '1px solid rgb(var(--info-rgb) / 0.1)' }}>
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
                      style={{ width: '100%', padding: '12px 14px 12px 44px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-inset)', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--info)'}
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
                      style={{ width: '100%', padding: '12px 14px 12px 44px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-inset)', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--info)'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                    />
                  </div>
                </div>

                <button
                  type="submit" disabled={billLoading}
                  style={{
                    width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                    background: billLoading ? '#6b7280' : 'var(--ink)', borderRadius: '999px',
                    color: 'white', fontSize: '1rem', fontWeight: '700', cursor: billLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s', boxShadow: billLoading ? 'none' : '0 10px 24px -12px rgba(22,22,26,.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                  }}
                  onMouseOver={(e) => { if (!billLoading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 14px 28px -12px rgba(22,22,26,.6)'; } }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 24px -12px rgba(22,22,26,.55)'; }}
                >
                  {billLoading ? (
                    <><span style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }}></span> Conectando...</>
                  ) : (
                    <><Bot size={20} /> Conectar minha conta</>
                  )}
                </button>
              </form>

              {/* Rodapé — não tem Bill? */}
              <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-color)', textAlign: 'center', backgroundColor: 'rgb(var(--info-rgb) / 0.03)' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  Não tem o Bill?{' '}
                  <a href="https://instagram.com/douglasmorett" target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--info)', fontWeight: '600', textDecoration: 'none' }}
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
            {vendeNoApp && (
            <div style={{ backgroundColor: 'rgb(var(--info-rgb) / 0.05)', border: '1px solid rgb(var(--info-rgb) / 0.2)', padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
               <Info size={32} color="var(--info)" />
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
                 style={{ padding: '8px 16px', backgroundColor: 'var(--primary)', color: 'var(--text-main)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', boxShadow: '0 4px 15px rgb(var(--info-rgb) / 0.4)' }}
               >
                 Liberar 4 Câmeras (R$ 49,90)
               </button>
            </div>
            )}

            {cameras.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {cameras.map(cam => (
                  <div key={cam.id} className="card" style={{ padding: '20px', backgroundColor: 'var(--bg-inset)', border: '1px solid var(--border-color)' }}>
                    
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
                                     status === 'connected' ? 'var(--info)' : 'var(--error)' 
                            }}>
                              <span style={{ 
                                width: '8px', height: '8px', borderRadius: '50%', 
                                backgroundColor: status === 'monitoring' ? 'var(--success)' : 
                                                 status === 'connected' ? 'var(--info)' : 'var(--error)', 
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
                         <button style={{ backgroundColor: 'rgb(var(--info-rgb) / 0.1)', color: 'var(--info)', border: '1px solid rgb(var(--info-rgb) / 0.2)', cursor: 'pointer', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }} onClick={() => {
                            setEditingCamera(cam.id);
                            setNewCamera({ name: cam.name, url: cam.url, username: cam.username, password: cam.password, ai_commands: cam.ai_commands || [] });
                            setShowCameraModal(true);
                         }}>
                           <Edit2 size={12} /> Editar Funções
                         </button>
                       </div>
                       <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {(cam.ai_commands || []).map((cmd, idx) => (
                            <span key={idx} style={{ padding: '6px 12px', backgroundColor: 'rgb(var(--info-rgb) / 0.08)', border: '1px solid rgb(var(--info-rgb) / 0.2)', color: 'var(--info)', borderRadius: '6px', fontSize: '0.75rem' }}>
                              {cmd}
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
          <div className="card animate-scale modal-janela" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-color)' }}>
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
          <div className="card animate-scale modal-janela" style={{ maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--primary)' }}>
            <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Camera color="var(--primary)" /> {editingCamera ? 'Editar Configuração da IA' : 'Configurar Nova Câmera IP'}
            </h3>
            
            <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'rgb(var(--info-rgb) / 0.05)', borderRadius: '12px', border: '1px solid rgb(var(--info-rgb) / 0.2)' }}>
               <h4 style={{ fontSize: '0.85rem', marginBottom: '8px', color: 'var(--info)' }}>Como conectar (Atenção):</h4>
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
                     <span key={idx} style={{ padding: '6px 12px', backgroundColor: 'rgb(var(--info-rgb) / 0.1)', border: '1px solid rgb(var(--info-rgb) / 0.3)', color: 'var(--info)', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                       {cmd}
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
                  <select className="input-field" style={{ padding: '10px' }} value={newUser.role} onChange={e => {
                    const role = e.target.value;
                    setNewUser({
                      ...newUser, 
                      role,
                      permissions: role === 'gestor' ? getSafeGestorPermissions(newUser.permissions) : permissoesParaSalvar(role, newUser.permissions)
                    });
                  }}>
                    {isMaster && <option value="admin">Dono (Cliente)</option>}
                    {(isAdminOrGestor || isMaster) && (
                      <>
                        <option value="funcionario">Funcionário</option>
                        {(isAdmin || isMaster) && <option value="gestor">Gestor / Gerente</option>}
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
                      <option value={userProfile?.store}>{userProfile?.store_name || userProfile?.store}</option>
                    </select>
                  )}
                  
                  {isMaster && newUser.store === 'nova_unidade' && (
                    <input
                      type="text"
                      className="input-field"
                      style={{ marginTop: '8px' }}
                      placeholder="Digite o nome da nova unidade"
                      value={novaUnidadeNome}
                      onChange={e => setNovaUnidadeNome(e.target.value)}
                    />
                  )}
                </div>
              </div>

              {newUser.role === 'funcionario' && (
                <TelaDoFuncionario
                  perms={newUser.permissions}
                  onChange={perms => setNewUser({ ...newUser, permissions: perms })}
                />
              )}

              {newUser.role === 'gestor' && (
                <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '12px' }}>
                  <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', marginBottom: '12px', fontWeight: 'bold' }}>
                    Permissões do Gestor
                  </label>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Marque as funções que este gestor poderá acessar:</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', backgroundColor: (newUser.permissions || DEFAULT_GESTOR_PERMISSIONS)[key] ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-color)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                        <input type="checkbox" checked={(newUser.permissions || DEFAULT_GESTOR_PERMISSIONS)[key] || false} onChange={e => setNewUser({...newUser, permissions: {...(newUser.permissions || DEFAULT_GESTOR_PERMISSIONS), [key]: e.target.checked}})} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

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
          <div className="card animate-scale modal-janela" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', padding: '0', position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <button onClick={() => setShowSubmissionModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--text-main)', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', zIndex: 1 }}>
              <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
            </button>
            
            <div style={{ padding: '32px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '20px', alignItems: 'center', backgroundColor: 'var(--bg-inset)' }}>
              {selectedSubmission.selfie && <img src={selectedSubmission.selfie} alt="Selfie" style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', border: '3px solid var(--primary)' }} />}
              <div>
                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>
                   {checklists?.find(c => c.id === selectedSubmission.checklist_id)?.title || selectedSubmission.checklist_title || 'Detalhes da Auditoria'}
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
              {/* Envio feito quando o checklist abria "0 de 0" para o funcionário
                  (todas as tarefas atribuídas a outra pessoa). Hoje o envio vazio é
                  barrado; os antigos ficam explicados em vez de abrir em branco. */}
              {(!Array.isArray(selectedSubmission.tasks) || selectedSubmission.tasks.length === 0) && (
                <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.35)', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  Este envio não tem nenhuma resposta: o funcionário abriu um checklist que não estava liberado para ele e tocou em Finalizar. O sistema agora não deixa mais enviar assim — pode dar baixa neste registro.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {(Array.isArray(selectedSubmission.tasks) ? selectedSubmission.tasks : []).map((task, idx) => {
                  const feedback = selectedSubmission.feedback_info?.[task.id];
                  return (
                    <div key={task.id} style={{ padding: '20px', backgroundColor: 'var(--bg-inset)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <h4 style={{ fontSize: '1rem', margin: 0, flex: 1 }}>{idx + 1}. {task.text}</h4>
                        {(() => {
                          const r = respostaDaTarefa(task);
                          return (
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: '20px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              marginLeft: '8px',
                              textAlign: 'right',
                              backgroundColor: r.tom === 'ok' ? 'rgba(16, 185, 129, 0.1)' : r.tom === 'falha' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(120,130,145,0.12)',
                              color: r.tom === 'ok' ? 'var(--success)' : r.tom === 'falha' ? 'var(--error)' : 'var(--text-main)'
                            }}>
                              {r.itens ? `${r.itens.filter(i => i.marcado).length} de ${r.itens.length}` : r.texto}
                            </span>
                          );
                        })()}
                      </div>
                      {/* Lista de itens: cada opção com o nome, marcada ou não. Antes
                          saíam as posições ("01234") no lugar dos nomes. */}
                      {respostaDaTarefa(task).itens && (
                        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {respostaDaTarefa(task).itens.map((i, k) => (
                            <li key={k} style={{ fontSize: '0.88rem', color: i.marcado ? 'var(--text-main)' : 'var(--error)' }}>
                              {i.marcado ? '✔' : '✘'} {i.nome}
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* O funcionário viu esta reprovação na tela e enviou assim
                          mesmo. A justificativa dele vem junto, quando escreveu. */}
                      {feedback?.enviado_ciente && (
                        <div style={{ marginBottom: '12px', padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                          <strong style={{ display: 'block', fontSize: '0.82rem', color: '#b91c1c', marginBottom: '4px' }}>
                            Enviado ciente da reprovação
                          </strong>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block' }}>
                            A IA apontou: {feedback.message || feedback.mensagem || '—'}
                          </span>
                          {feedback.justificativa && (
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-main)', display: 'block', marginTop: '6px' }}>
                              Justificativa do funcionário: <em>“{feedback.justificativa}”</em>
                            </span>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: task.photo ? '1fr 1fr' : '1fr', gap: '20px' }}>
                        {task.photo && (
                          <div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Evidência Fotográfica:</p>
                            {/* window.open com uma data URI é bloqueado pelo navegador e
                                abria aba em branco. Com URL do Firebase, abre normal;
                                com base64, mostra a imagem numa janela própria. */}
                            <img src={task.photo} alt="Evidência" onClick={() => ampliarFoto(task.photo)} title="Clique para ampliar" style={{ width: '100%', height: '140px', objectFit: 'cover', cursor: 'zoom-in', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'center' }}>Clique para ampliar foto</p>
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
                              {feedback.status === 'success' ? 'Aprovado pela IA' : 'Reprovado pela IA'}
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
                <div style={{ marginTop: '24px', padding: '20px', backgroundColor: 'var(--bg-inset)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: 'bold' }}>Assinatura do Funcionário:</p>
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
                    Dar baixa
                 </button>
               )}
               {selectedSubmission.resolved && (
                 <div style={{ flex: 2, padding: '16px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', textAlign: 'center', color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {textoDaBaixa(selectedSubmission)}
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

      {/* Visualizador de foto em tela cheia, para evidências gravadas em base64. */}
      {fotoAmpliada && (
        <div
          onClick={() => setFotoAmpliada(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.92)', zIndex: 1000000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', cursor: 'zoom-out' }}
        >
          <img src={fotoAmpliada} alt="Evidência ampliada" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} />
          <button
            onClick={() => setFotoAmpliada(null)}
            style={{ position: 'absolute', top: '20px', right: '24px', background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', fontSize: '1.4rem', lineHeight: 1 }}
            aria-label="Fechar"
          >
            &times;
          </button>
        </div>
      )}

      {editingPlan && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '20px', pointerEvents: 'auto', backdropFilter: 'blur(5px)' }}>
          {/* maxHeight + overflow: o conteúdo rola DENTRO da janela. Sem isso, num
              monitor menor a caixa passava da tela e era preciso rolar a página
              atrás dela para alcançar os campos de plano. */}
          <div className="card animate-scale modal-janela" style={{ width: '100%', maxWidth: '440px', maxHeight: '88vh', overflowY: 'auto', position: 'relative', border: '1px solid var(--primary)', pointerEvents: 'auto' }}>
            <button style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', zIndex: 2 }} onClick={() => setEditingPlan(null)}><X size={24} /></button>
            <h3 style={{ marginBottom: '20px', paddingRight: '32px' }}>Alterar Plano de {editingPlan.name}</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Status da Conta</label>
              <select className="input-field" value={editingPlan.status || 'trial'} onChange={e => setEditingPlan({...editingPlan, status: e.target.value})}>
                <option value="trial">Teste gratuito</option>
                <option value="active">Ativo (Pago)</option>
                <option value="blocked">Bloqueado</option>
                <option value="pending">Pagamento pendente</option>
              </select>
            </div>

            {/* Extensão do teste. Antes não havia como dar mais prazo a um cliente:
                o teste era sempre 7 dias contados da criação da conta. */}
            {(editingPlan.status || 'trial') === 'trial' && (
              <div style={{ marginBottom: '16px', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-inset)' }}>
                <label className="input-label" style={{ display: 'block', marginBottom: '6px' }}>Período de teste</label>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.45 }}>
                  {trialInfo(editingPlan)}
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[7, 15, 30].map(d => (
                    <button
                      key={d}
                      type="button"
                      className={trialDays === d ? 'btn' : 'btn-secondary'}
                      style={{ flex: '1 1 0', minWidth: '90px', padding: '8px 10px', fontSize: '0.82rem' }}
                      onClick={() => setTrialDays(trialDays === d ? null : d)}
                    >
                      + {d} dias
                    </button>
                  ))}
                </div>
                {trialDays !== null && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--primary)', marginTop: '10px', fontWeight: 600 }}>
                    Ao salvar, o teste passa a valer por mais {trialDays} dias a partir de hoje.
                  </p>
                )}
              </div>
            )}

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
                // Espelha PLAN_LIMITS do backend (api/index.js). Os planos atuais
                // vendem checklists ilimitados; o teto comercial é de colaboradores.
                const limitMap = {
                  checklists10_mensal: 999999, checklists10_anual: 999999,
                  checklists_mensal: 999999, checklists_anual: 999999,
                  combo_mensal: 999999, combo_anual: 999999,
                  ponto_mensal: 999999, ponto_anual: 999999,
                  enterprise: 999999,
                  starter: 300, pro: 600, business: 1500, mensal: 600, anual: 1500,
                };
                // O teto de colaboradores é o que os planos de fato vendem, e
                // ficava para trás: trocar alguém de Starter para Combo mudava a
                // cota de checklists (que nem existe mais) e deixava o limite de
                // pessoas no valor antigo.
                const colabMap = {
                  combo_mensal: 50, combo_anual: 50,
                  checklists10_mensal: 10, checklists10_anual: 10,
                  checklists_mensal: 30, checklists_anual: 30,
                  ponto_mensal: 30, ponto_anual: 30,
                  enterprise: 999999,
                  starter: 5, pro: 15, business: 50, mensal: 15, anual: 50,
                };
                setEditingPlan({
                  ...editingPlan,
                  plan: newPlan,
                  checklist_limit: limitMap[newPlan] || 300,
                  ponto_limit: colabMap[newPlan] ?? editingPlan.ponto_limit,
                });
              }}>
                {/* Conta cujo plano não está na lista (ex.: 'trial') mostraria a
                    primeira opção por padrão, e um Salvar sem querer trocaria o
                    plano dela. Esta opção preserva o valor atual até haver escolha. */}
                {!['checklists10_mensal','checklists10_anual','checklists_mensal','checklists_anual','combo_mensal','combo_anual','ponto_mensal','ponto_anual','enterprise','starter','pro','business','mensal','anual'].includes(editingPlan.plan) && (
                  <option value={editingPlan.plan || ''}>
                    {editingPlan.plan === 'trial' || !editingPlan.plan ? 'Em teste — sem plano contratado' : `Plano atual: ${editingPlan.plan}`}
                  </option>
                )}
                <optgroup label="Planos atuais">
                  <option value="checklists10_mensal">Só Checklists — até 10 pessoas, mensal (R$ 67/mês · até 10 colaboradores)</option>
                  <option value="checklists10_anual">Só Checklists — até 10 pessoas, anual (12x R$ 47 · até 10 colaboradores)</option>
                  <option value="checklists_mensal">Só Checklists — mensal (R$ 149/mês · até 30 colaboradores)</option>
                  <option value="checklists_anual">Só Checklists — anual (12x R$ 97 · até 30 colaboradores)</option>
                  <option value="combo_mensal">Combo Tudo em 1 — mensal (R$ 197/mês · até 50 colaboradores)</option>
                  <option value="combo_anual">Combo Tudo em 1 — anual (12x R$ 167 · até 50 colaboradores)</option>
                  <option value="ponto_mensal">Só Ponto Eletrônico — mensal (R$ 149/mês · até 30 colaboradores)</option>
                  <option value="ponto_anual">Só Ponto Eletrônico — anual (12x R$ 97 · até 30 colaboradores)</option>
                  <option value="enterprise">Enterprise — acima de 50 colaboradores (a combinar)</option>
                </optgroup>
                <optgroup label="Legado (contas antigas)">
                  <option value="starter">Starter — 300 checklists/mês</option>
                  <option value="pro">Pro — 600 checklists/mês</option>
                  <option value="business">Business — 1.500 checklists/mês</option>
                  <option value="mensal">Mensal — 600 checklists/mês</option>
                  <option value="anual">Anual — 1.500 checklists/mês</option>
                </optgroup>
              </select>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Teto desta conta: {Number(editingPlan.ponto_limit || 0) >= 999999 ? 'colaboradores ilimitados' : `${Number(editingPlan.ponto_limit || 30)} colaboradores`}
                {' · '}
                {Number(editingPlan.checklist_limit || 0) >= 999999 ? 'checklists ilimitados' : `${Number(editingPlan.checklist_limit || 0).toLocaleString('pt-BR')} checklists/mês (plano legado)`}
                {editingPlan.checklists_used !== undefined && ` · usados neste ciclo: ${editingPlan.checklists_used}`}
              </p>

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
                const corpo = { plan: editingPlan.plan, status: editingPlan.status, ponto_active: editingPlan.ponto_active, ponto_limit: editingPlan.ponto_limit, checklist_limit: editingPlan.checklist_limit, phone: editingPlan.phone };
                // Só envia quando o admin escolheu estender: o backend ignora o campo ausente.
                if (trialDays !== null) corpo.trialDays = trialDays;

                const res = await fetch(`${API_URL}/api/users/${editingPlan.id}`, {
                  method: 'PUT',
                  headers: getAuthHeaders(),
                  body: JSON.stringify(corpo)
                });
                // Antes a resposta era ignorada: uma falha fechava o modal como se
                // tivesse salvo, e o admin só descobria ao ver que nada mudou.
                if (!res.ok) {
                  const erro = await res.json().catch(() => null);
                  alert(erro?.error || erro?.message || `Não foi possível salvar (erro ${res.status}).`);
                  return;
                }
                if (trialDays !== null) alert(`Teste liberado por mais ${trialDays} dias para ${editingPlan.name}.`);
                setEditingPlan(null);
                setTrialDays(null);
                fetchData();
              } catch (e) { alert('Erro de conexão ao salvar plano.'); }
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
          <div className="card animate-scale modal-janela" style={{ maxWidth: '400px', width: '100%', position: 'relative', border: '1px solid var(--primary)', padding: '24px' }}>
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
                <select className="input-field" style={{ padding: '10px' }} value={editingUser.role} onChange={e => {
                  const role = e.target.value;
                  setEditingUser({
                    ...editingUser, 
                    role,
                    permissions: role === 'gestor' ? getSafeGestorPermissions(editingUser.permissions) : permissoesParaSalvar(role, editingUser.permissions)
                  });
                }}>
                  {isMaster && <option value="admin">Dono (Cliente)</option>}
                  {(isAdminOrGestor || isMaster) && (
                    <>
                      <option value="funcionario">Funcionário</option>
                      {(isAdmin || isMaster) && <option value="gestor">Gestor / Gerente</option>}
                    </>
                  )}
                  {isMaster && <option value="master">Gestor Master</option>}
                </select>
              </div>

              {editingUser.role === 'funcionario' && (
                <TelaDoFuncionario
                  perms={editingUser.permissions}
                  onChange={perms => setEditingUser({ ...editingUser, permissions: perms })}
                />
              )}

              {editingUser.role === 'gestor' && (
                <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '12px' }}>
                  <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', marginBottom: '12px', fontWeight: 'bold' }}>
                    Permissões do Gestor
                  </label>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Marque as funções que este gestor poderá acessar:</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', backgroundColor: (editingUser.permissions || DEFAULT_GESTOR_PERMISSIONS)[key] ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-color)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                        <input type="checkbox" checked={(editingUser.permissions || DEFAULT_GESTOR_PERMISSIONS)[key] || false} onChange={e => setEditingUser({...editingUser, permissions: {...(editingUser.permissions || DEFAULT_GESTOR_PERMISSIONS), [key]: e.target.checked}})} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Escala de Trabalho Individual */}
              <div style={{ marginBottom: '24px', backgroundColor: 'rgb(var(--info-rgb) / 0.06)', borderRadius: '10px', padding: '16px', border: '1px solid rgb(var(--info-rgb) / 0.15)' }}>
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: 'var(--info)', fontWeight: 'bold' }}>
                  Escala de Trabalho
                </label>
                <div style={{ marginBottom: '12px' }}>
                  <label className="input-label" style={{ fontSize: '0.75rem' }}>Selecione uma Escala</label>
                  <select className="input-field" style={{ padding: '8px' }} value={editingUser.schedule_id || ''} onChange={e => setEditingUser({...editingUser, schedule_id: e.target.value})}>
                    <option value="">Sem escala (usar padrão da loja)</option>
                    {schedules.map(sch => (
                      <option key={sch.id} value={sch.id}>{sch.name}</option>
                    ))}
                  </select>
                </div>
                
                {editingUser.schedule_id ? (() => {
                  const sch = schedules.find(s => String(s.id) === String(editingUser.schedule_id));
                  if (!sch) return null;
                  return (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)', padding: '10px', borderRadius: '8px' }}>
                      <strong>{sch.name}</strong><br/>
                      Entrada: {sch.hora_entrada} | Saída: {sch.hora_saida}<br/>
                      Tolerância: {sch.tolerancia} min
                    </div>
                  );
                })() : (
                  <>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      Ou defina horários individuais se não houver escala.
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
                  </>
                )}
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
          <div className="card animate-scale modal-janela" style={{ width: '100%', maxWidth: '800px', height: '90vh', maxHeight: '800px', display: 'flex', flexDirection: 'column', position: 'relative', pointerEvents: 'auto', padding: '0', overflow: 'hidden', border: '1px solid var(--primary)', backgroundColor: 'var(--bg-inset)' }}>
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
                  <label className="input-label">O que você comprou?</label>
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
          <div className="card animate-scale modal-janela" style={{ maxWidth: '600px', width: '100%', padding: '20px', textAlign: 'center', position: 'relative', border: '1px solid var(--primary)', backgroundColor: 'var(--bg-inset)' }}>
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

            <div style={{ width: '64px', height: '64px', borderRadius: '16px', backgroundColor: 'rgb(var(--primary-rgb) / 0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 0 20px rgb(var(--primary-rgb) / 0.3)' }}>
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
                style={{ padding: '12px 28px', borderRadius: '10px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 0 20px rgb(var(--primary-rgb) / 0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                Escolher um Tutorial!
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
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px', backgroundColor: 'rgb(var(--primary-rgb) / 0.1)', padding: '4px 12px', borderRadius: '20px' }}>
                Central de Ajuda Interativa
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
                    backgroundColor: 'var(--bg-inset)',
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
                <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: 'rgb(var(--primary-rgb) / 0.12)' }}>
                  {activeTopicObj.steps[tourStep].icon}
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '1px', backgroundColor: 'rgb(var(--primary-rgb) / 0.1)', padding: '4px 10px', borderRadius: '20px' }}>
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
                Voltar ao Menu
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
                Anterior
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
                  boxShadow: '0 0 15px rgb(var(--primary-rgb) / 0.4)',
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

      {showScheduleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px', backdropFilter: 'blur(5px)' }}>
          <div className="card animate-scale modal-janela" style={{ maxWidth: '600px', width: '100%', position: 'relative', border: '1px solid var(--primary)', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setShowScheduleModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
            <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Calendar color="var(--primary)" /> {editingSchedule ? 'Editar Escala' : 'Nova Escala'}
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label className="input-label">Nome da Escala</label>
                <input type="text" className="input-field" value={scheduleForm.name} onChange={e => setScheduleForm({...scheduleForm, name: e.target.value})} placeholder="Ex: Comercial, Produção, Madrugada" />
              </div>
              <div>
                <label className="input-label">Cor de Identificação</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'].map(color => (
                    <div key={color} onClick={() => setScheduleForm({...scheduleForm, color})} style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: color, cursor: 'pointer', border: scheduleForm.color === color ? '3px solid #fff' : 'none', outline: scheduleForm.color === color ? `2px solid ${color}` : 'none' }} />
                  ))}
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>Horário Padrão</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label className="input-label" style={{ fontSize: '0.8rem' }}>Entrada</label>
                  <input type="time" className="input-field" value={scheduleForm.hora_entrada} onChange={e => setScheduleForm({...scheduleForm, hora_entrada: e.target.value})} />
                </div>
                <div>
                  <label className="input-label" style={{ fontSize: '0.8rem' }}>Saída</label>
                  <input type="time" className="input-field" value={scheduleForm.hora_saida} onChange={e => setScheduleForm({...scheduleForm, hora_saida: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label className="input-label" style={{ fontSize: '0.8rem' }}>Início Intervalo (Opcional)</label>
                  <input type="time" className="input-field" value={scheduleForm.intervalo_inicio || ''} onChange={e => setScheduleForm({...scheduleForm, intervalo_inicio: e.target.value})} />
                </div>
                <div>
                  <label className="input-label" style={{ fontSize: '0.8rem' }}>Fim Intervalo (Opcional)</label>
                  <input type="time" className="input-field" value={scheduleForm.intervalo_fim || ''} onChange={e => setScheduleForm({...scheduleForm, intervalo_fim: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="input-label" style={{ fontSize: '0.8rem' }}>Tolerância (Minutos)</label>
                <select className="input-field" value={scheduleForm.tolerancia} onChange={e => setScheduleForm({...scheduleForm, tolerancia: Number(e.target.value)})}>
                  <option value={0}>Sem tolerância</option>
                  <option value={5}>5 minutos</option>
                  <option value={10}>10 minutos</option>
                  <option value={15}>15 minutos</option>
                  <option value={20}>20 minutos</option>
                  <option value={30}>30 minutos</option>
                </select>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>Dias da Semana (Personalizar Horários)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dayName, idx) => {
                  const wd = scheduleForm.weekdays.find(w => w.weekday === idx) || { weekday: idx, is_workday: false, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' };
                  return (
                    <div key={idx} style={{ padding: '12px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: wd.is_workday ? '12px' : '0' }}>
                        <span style={{ fontWeight: 'bold' }}>{dayName}</span>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <div style={{ position: 'relative', width: '40px', height: '22px', backgroundColor: wd.is_workday ? 'var(--primary)' : 'var(--border-color)', borderRadius: '11px', transition: '0.3s' }}>
                            <div style={{ position: 'absolute', top: '3px', left: wd.is_workday ? '21px' : '3px', width: '16px', height: '16px', backgroundColor: '#fff', borderRadius: '50%', transition: '0.3s' }}></div>
                          </div>
                          <input type="checkbox" style={{ display: 'none' }} checked={wd.is_workday} onChange={e => {
                            const newWd = [...scheduleForm.weekdays];
                            const i = newWd.findIndex(w => w.weekday === idx);
                            if (i >= 0) newWd[i].is_workday = e.target.checked;
                            setScheduleForm({...scheduleForm, weekdays: newWd});
                          }} />
                        </label>
                      </div>
                      {wd.is_workday && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <input type="time" className="input-field" style={{ padding: '6px', fontSize: '0.8rem' }} placeholder="Entrada" title="Entrada (deixe em branco para usar o padrão)" value={wd.hora_entrada || ''} onChange={e => {
                            const newWd = [...scheduleForm.weekdays];
                            const i = newWd.findIndex(w => w.weekday === idx);
                            if (i >= 0) newWd[i].hora_entrada = e.target.value;
                            setScheduleForm({...scheduleForm, weekdays: newWd});
                          }} />
                          <input type="time" className="input-field" style={{ padding: '6px', fontSize: '0.8rem' }} placeholder="Saída" title="Saída (deixe em branco para usar o padrão)" value={wd.hora_saida || ''} onChange={e => {
                            const newWd = [...scheduleForm.weekdays];
                            const i = newWd.findIndex(w => w.weekday === idx);
                            if (i >= 0) newWd[i].hora_saida = e.target.value;
                            setScheduleForm({...scheduleForm, weekdays: newWd});
                          }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowScheduleModal(false)} style={{ flex: 1 }}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={handleSaveSchedule} style={{ flex: 1 }}>{editingSchedule ? 'Salvar Alterações' : 'Criar Escala'}</button>
            </div>
          </div>
        </div>
      )}

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

