import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, LogOut, CheckCircle, Clock, ArrowRight, ClipboardList, User, RefreshCw } from 'lucide-react';
import API_URL from '../api';

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchChecklists = useCallback(async (profile, isManual = false) => {
    if (isManual) setIsRefreshing(true);
    const storeParam = profile.store ? `?store=${encodeURIComponent(profile.store)}` : '';
    try {
      const res = await fetch(`${API_URL}/api/checklists${storeParam}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setChecklists(data);
      }
    } catch (err) {
      console.error('Erro ao buscar checklists:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (!savedUser) {
      navigate('/login');
      return;
    }
    const profile = JSON.parse(savedUser);
    setUserProfile(profile);
    
    // Busca inicial
    fetchChecklists(profile);

    // Auto-refresh a cada 30 segundos
    const interval = setInterval(() => {
      fetchChecklists(profile);
    }, 30000);

    return () => clearInterval(interval);
  }, [navigate, fetchChecklists]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const pendingChecklists = checklists.filter(c => !c.completedToday);
  const completedChecklists = checklists.filter(c => c.completedToday);

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '600px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
           <div style={{ backgroundColor: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
              <Flame size={20} color="white" />
           </div>
           <div>
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>FireCheck</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{userProfile?.store}</p>
           </div>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
           <button onClick={() => fetchChecklists(userProfile, true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 'bold' }}>
              {isRefreshing ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
           </button>
           <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Sair <LogOut size={16} />
           </button>
        </div>
      </header>

      <div style={{ backgroundColor: '#121318', padding: '24px', borderRadius: '16px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid var(--border-color)' }}>
         <div style={{ backgroundColor: 'rgba(255, 69, 0, 0.1)', padding: '12px', borderRadius: '12px' }}>
            <User size={24} color="var(--primary)" />
         </div>
         <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Olá, {userProfile?.name}!</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Você tem {pendingChecklists.length} tarefas pendentes para hoje.</p>
         </div>
      </div>

      <section style={{ marginBottom: '32px' }}>
        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={16} /> Pendentes ({pendingChecklists.length})
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pendingChecklists.length > 0 ? pendingChecklists.map(checklist => (
            <div 
              key={checklist.id} 
              className="card" 
              style={{ padding: '20px', cursor: 'pointer', borderLeft: '4px solid var(--primary)', transition: 'transform 0.2s ease' }}
              onClick={() => navigate(`/execucao/${checklist.id}`)}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(4px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', margin: '0 0 4px 0' }}>{checklist.title}</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                    {checklist.tasks.length} tarefas • {checklist.recurrence || 'Diário'}
                  </p>
                </div>
                <ArrowRight size={20} color="var(--primary)" />
              </div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
              <CheckCircle size={32} color="var(--success)" style={{ marginBottom: '12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Tudo em dia! Nenhuma tarefa pendente.</p>
            </div>
          )}
        </div>
      </section>

      {completedChecklists.length > 0 && (
        <section>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={16} /> Concluídos Hoje ({completedChecklists.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {completedChecklists.map(checklist => (
              <div 
                key={checklist.id} 
                className="card" 
                style={{ padding: '20px', opacity: 0.7, borderLeft: '4px solid var(--success)', cursor: 'pointer' }}
                onClick={() => navigate(`/execucao/${checklist.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', margin: '0 0 4px 0', textDecoration: 'line-through' }}>{checklist.title}</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--success)', margin: 0, fontWeight: 'bold' }}>
                      ✓ Concluído por {checklist.completedBy || 'você'}
                    </p>
                  </div>
                  <ClipboardList size={20} color="var(--text-muted)" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer style={{ marginTop: '48px', textAlign: 'center', padding: '24px', borderTop: '1px solid var(--border-color)' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>FireCheck v1.0 • Sistema de Auditoria em Tempo Real</p>
      </footer>
    </div>
  );
}
