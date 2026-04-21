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

  // Carregar dados iniciais
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUserProfile(JSON.parse(savedUser));
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [clRes, userRes] = await Promise.all([
        fetch(`${API_URL}/api/checklists`),
        fetch(`${API_URL}/api/users`)
      ]);
      setChecklists(await clRes.json());
      setTeam(await userRes.json());
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
      setNewUser({ name: '', email: '', password: '', store: 'Filial Centro' });
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

  const isGestor = userProfile?.role === 'gestor';

  return (
    <div className="page-container animate-fade">

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ backgroundColor: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
              <Flame size={22} color="white" />
            </div>
            <h1 className="page-title" style={{ margin: 0 }}>
              FireCheck — {isGestor ? 'Painel de Gestor' : 'Painel do Dono'}
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', paddingLeft: '42px' }}>
            Loja: {userProfile?.store || 'Filial Centro'} · Hoje, {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
        {!isGestor && (
          <button className="btn" onClick={() => navigate('/admin/creator')}>
            <Plus size={20} /> Criar Checklist
          </button>
        )}
      </header>

      {/* Cards de KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>

        <div className="card" style={{ borderTop: '3px solid var(--primary)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Checklists Hoje</p>
              <h2 style={{ fontSize: '2.5rem', fontWeight: '800', margin: '8px 0', lineHeight: 1 }}>{STATS.checklistsHoje}</h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>✅ {STATS.concluidos} concluídos</span>
            </div>
            <ClipboardList color="var(--primary)" size={36} />
          </div>
        </div>

        <div className="card" style={{ borderTop: '3px solid #3b82f6', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Conformidade Geral</p>
              <h2 style={{ fontSize: '2.5rem', fontWeight: '800', margin: '8px 0', lineHeight: 1 }}>{STATS.conformidade}%</h2>
              <BarPct pct={STATS.conformidade} color="#3b82f6" />
            </div>
            <TrendingUp color="#3b82f6" size={36} />
          </div>
        </div>

        <div className="card" style={{ borderTop: '3px solid var(--error)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Alertas IA (Falhas)</p>
              <h2 style={{ fontSize: '2.5rem', fontWeight: '800', margin: '8px 0', lineHeight: 1 }}>{STATS.alertasIA}</h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--error)' }}>⚠️ Ação necessária</span>
            </div>
            <ShieldAlert color="var(--error)" size={36} />
          </div>
        </div>

        <div className="card" style={{ borderTop: '3px solid var(--success)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Colaboradores</p>
              <h2 style={{ fontSize: '2.5rem', fontWeight: '800', margin: '8px 0', lineHeight: 1 }}>{STATS.colaboradores}</h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>🏬 Filial Centro</span>
            </div>
            <Users color="var(--success)" size={36} />
          </div>
        </div>

      </div>

      {/* Tabs de Navegação */}
      <div style={{ display: 'flex', gap: '4px', backgroundColor: '#121318', padding: '6px', borderRadius: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { key: 'auditoria',   label: '📋 Auditoria'    },
          { key: 'ranking',     label: '🏆 Ranking'      },
          { key: 'alertas',     label: '🚨 Alertas IA'   },
          { key: 'checklists',  label: '⚙️ Checklists'   },
          { key: 'equipe',      label: '👥 Equipe'       },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.2s',
              backgroundColor: tab === t.key ? 'var(--primary)' : 'transparent',
              color: tab === t.key ? 'white' : 'var(--text-muted)' }}>
            {t.label}
          </button>
        ))}
      </div>

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
            {checklists.map(cl => (
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

      {/* ── Tab: Gestão de Equipe ────────────────────────────────────────── */}
      {tab === 'equipe' && (
        <div className="card" style={{ padding: '0' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} color="var(--primary)" /> Equipe da Loja
            </h3>
            <button className="btn" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => setShowUserModal(true)}>
              <UserPlus size={16} /> Adicionar Colaborador
            </button>
          </div>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {team.map(member => (
              <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#121318', borderRadius: '10px' }}>
                <div>
                  <h4 style={{ fontSize: '1rem', margin: 0 }}>{member.name}</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{member.email} · <span style={{ textTransform: 'capitalize' }}>{member.role}</span></p>
                </div>
                <button className="btn-secondary" style={{ color: 'var(--error)', borderColor: 'rgba(255,23,68,0.2)' }} onClick={() => handleDeleteUser(member.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Novo Usuário */}
      {showUserModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="card animate-scale" style={{ maxWidth: '450px', width: '100%', position: 'relative' }}>
            <button onClick={() => setShowUserModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Fechar</button>
            <h3 style={{ marginBottom: '24px' }}>Cadastrar Colaborador</h3>
            <form onSubmit={handleAddUser}>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Nome Completo</label>
                <input type="text" className="input-field" required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">E-mail (Login)</label>
                <input type="email" className="input-field" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label className="input-label">Senha Inicial</label>
                <input type="text" className="input-field" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
              </div>
              <button type="submit" className="btn" style={{ width: '100%', padding: '14px' }}>Salvar Colaborador</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
