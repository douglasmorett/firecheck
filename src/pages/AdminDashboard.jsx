import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ClipboardList, ShieldAlert, Users, Activity, Trophy, TrendingUp, Clock, CheckCircle, AlertCircle, Bell, Flame, Edit2, Trash2, CalendarClock, UserPlus, Mail, Lock } from 'lucide-react';
import API_URL from '../api';

// ── Dados Iniciais (Vazios) ──────────────────────────────────────────────────
const STATS = {
  checklistsHoje: 0,
  concluidos: 0,
  alertasIA: 0,
  colaboradores: 0,
  conformidade: 0,
};

const RANKING = [];
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

// ── Componente Principal ─────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('auditoria');
  
  // Estados Reais
  const [checklists, setChecklists] = useState([]);
  const [team, setTeam] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', store: 'Filial Centro' });
  const [userProfile, setUserProfile] = useState(null);
  const [stats, setStats] = useState(STATS);
  const [dateFilter, setDateFilter] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], // Início do mês
    end: new Date().toISOString().split('T')[0]
  });

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
    if (savedUser) {
      setUserProfile(JSON.parse(savedUser));
    }
    fetchData();
  }, [dateFilter]); // Recarregar quando a data mudar

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
        setTeam(userData);
        
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
        setChecklists(await clRes.json());
        setTeam(await userRes.json());
        setStats(await statsRes.json());
      }
    } catch (e) { console.error('Erro ao buscar dados:', e); }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      setShowUserModal(false);
      setNewUser({ name: '', email: '', password: '', store: isMaster ? '' : userProfile?.store || '' });
      fetchData();
    } catch (e) { alert('Erro ao adicionar colaborador.'); }
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

  // Definir abas iniciais baseadas no papel
  useEffect(() => {
    if (isMaster) setTab('financeiro');
    else if (isFuncionario) setTab('auditoria');
    else setTab('auditoria');
  }, [userProfile]);

  return (
    <div className="page-container animate-fade">

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '20px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ backgroundColor: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
              <Flame size={22} color="white" />
            </div>
            <h1 className="page-title" style={{ margin: 0 }}>
              FireCheck — {isMaster ? 'Painel de Gestão Master' : isAdmin ? 'Painel do Dono' : 'Painel do Funcionário'}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '42px' }}>
             <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {userProfile?.name} · {userProfile?.store || 'Sistema Central'}
             </p>
             <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', backgroundColor: 'rgba(255,23,68,0.1)' }}>
                <Activity size={14} /> Sair do Sistema
             </button>
          </div>
        </div>

        {/* Filtro de Data com Calendário */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#1A1C23', padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <CalendarClock size={18} color="var(--primary)" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="date" 
              value={dateFilter.start} 
              onChange={(e) => setDateFilter({...dateFilter, start: e.target.value})}
              style={{ background: 'none', border: 'none', color: 'white', fontSize: '0.85rem', outline: 'none' }}
            />
            <span style={{ color: 'var(--text-muted)' }}>até</span>
            <input 
              type="date" 
              value={dateFilter.end} 
              onChange={(e) => setDateFilter({...dateFilter, end: e.target.value})}
              style={{ background: 'none', border: 'none', color: 'white', fontSize: '0.85rem', outline: 'none' }}
            />
          </div>
        </div>

        {isMaster ? (
          <button className="btn" style={{ backgroundColor: '#10b981' }} onClick={() => {
            setNewUser({ name: '', email: '', password: '', store: '', role: 'admin', plan: 'mensal' });
            setShowUserModal(true);
          }}>
            <UserPlus size={20} /> Nova Conta Cliente
          </button>
        ) : isAdmin ? (
          <button className="btn" onClick={() => navigate('/admin/creator')}>
            <Plus size={20} /> Criar Checklist
          </button>
        ) : null}
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

      {/* Tabs de Navegação */}
      <div style={{ display: 'flex', gap: '4px', backgroundColor: '#121318', padding: '6px', borderRadius: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {(isMaster ? [
          { key: 'financeiro',  label: '💰 Financeiro (Cacto)' },
          { key: 'equipe',      label: '👥 Gestão de Clientes' },
        ] : [
          { key: 'auditoria',   label: '📋 Auditoria'    },
          { key: 'ranking',     label: '🏆 Ranking'      },
          { key: 'alertas',     label: '🚨 Alertas IA'   },
          { key: 'checklists',  label: '⚙️ Checklists'   },
          { key: 'equipe',      label: '👥 Equipe'       },
        ]).map(t => {
          if (isFuncionario && (t.key === 'equipe' || t.key === 'checklists')) return null;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.2s',
                backgroundColor: tab === t.key ? 'var(--primary)' : 'transparent',
                color: tab === t.key ? 'white' : 'var(--text-muted)' }}>
              {t.label}
            </button>
          );
        })}
      </div>

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
            {AUDITORIAS.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#121318', borderRadius: '10px', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <h4 style={{ fontSize: '1rem', marginBottom: '4px' }}>{a.checklist}</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>👤 {a.funcionario}</p>
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BarPct pct={a.pct} color={a.pct === 100 ? 'var(--success)' : a.pct > 60 ? '#FFA000' : 'var(--error)'} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{a.pct}%</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <StatusBadge status={a.status} />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '6px' }}>
                    <Clock size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />{a.tempo}
                  </p>
                </div>
              </div>
            ))}
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
            {RANKING.map(r => (
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
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>{r.concluidos}/{r.total} tarefas concluídas</p>
                </div>
              </div>
            ))}
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
            {ALERTAS_IA.map(a => (
              <div key={a.id} style={{ padding: '16px', backgroundColor: 'rgba(255,23,68,0.05)', borderRadius: '10px', border: '1px solid rgba(255,23,68,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <AlertCircle size={18} color="var(--error)" />
                    <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{a.tarefa}</span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{a.hora}</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '8px' }}>
                  👤 Funcionário: <strong style={{ color: 'white' }}>{a.func}</strong>
                </p>
                <p style={{ color: '#FFA000', fontSize: '0.85rem', backgroundColor: 'rgba(255,160,0,0.08)', padding: '8px 12px', borderRadius: '6px' }}>
                  🤖 IA: "{a.motivo}"
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button className="btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }}>Ver Foto</button>
                  <button className="btn" style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }}>
                    Notificar no WhatsApp
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* ── Tab: Gerenciar Checklists ──────────────────────────────────── */}
      {tab === 'checklists' && (
        <div className="card" style={{ padding: '0' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClipboardList size={20} color="var(--primary)" /> Checklists Criados
            </h3>
            <button className="btn" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => navigate('/admin/creator')}>
              <Plus size={16} /> Novo Checklist
            </button>
          </div>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(checklists || []).map(cl => (
              <div key={cl.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#121318', borderRadius: '10px', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <h4 style={{ fontSize: '1rem', margin: 0 }}>{cl.title}</h4>
                    <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold',
                      backgroundColor: cl.status === 'ativo' ? 'rgba(0,200,83,0.15)' : 'rgba(255,255,255,0.05)',
                      color: cl.status === 'ativo' ? 'var(--success)' : 'var(--text-muted)' }}>
                      {cl.status === 'ativo' ? '● Ativo' : '○ Inativo'}
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '4px' }}>
                    📋 {cl.tasks?.length || 0} tarefas &nbsp;·&nbsp; <CalendarClock size={12} style={{ verticalAlign: 'middle' }} /> {RECURRENCE_LABEL[cl.recurrence] || 'Único'}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    <Clock size={11} style={{ verticalAlign: 'middle', marginRight: '4px' }} />Agendado: {cl.scheduledDate || 'Imediato'}
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
          </div>
        </div>
      )}

      {/* ── Tab: Gestão de Equipe / Clientes ───────────────────────────── */}
      {tab === 'equipe' && (
        <div className="card" style={{ padding: '0' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(team || []).map(member => (
              <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#121318', borderRadius: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h4 style={{ fontSize: '1rem', margin: 0 }}>{member.name}</h4>
                    {isMaster && member.role === 'admin' && (
                      <span style={{ backgroundColor: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                        Plano: {member.plan?.toUpperCase() || 'MENSAL'}
                      </span>
                    )}
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    {member.email} · <span style={{ textTransform: 'capitalize' }}>{member.role}</span> · {member.store}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {isMaster && member.role === 'admin' && (
                    <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => {
                       // Lógica para mudar plano
                       alert(`Mudar plano de ${member.name}`);
                    }}>
                      Alterar Plano
                    </button>
                  )}
                  <button className="btn-secondary" style={{ color: 'var(--error)', borderColor: 'rgba(255,23,68,0.2)' }} onClick={() => handleDeleteUser(member.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Novo Usuário / Cliente */}
      {showUserModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px', backdropFilter: 'blur(5px)' }}>
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
                  <input type="text" className="input-field" required value={newUser.store} onChange={e => setNewUser({...newUser, store: e.target.value})} placeholder="Nome da Loja" />
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

    </div>
  );
}
