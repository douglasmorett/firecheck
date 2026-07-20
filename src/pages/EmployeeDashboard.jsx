import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, LogOut, CheckCircle, Clock, ArrowRight, ClipboardList, User, RefreshCw, Smartphone, ShieldCheck, Car, Folder, MapPin, Play } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import API_URL from '../api';


const handle401 = (res, navigate) => {
  if (res.status === 401) {
    localStorage.removeItem('user');
    localStorage.removeItem('firecheck_token');
    navigate('/login');
  }
  return res;
};

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasPonto, setHasPonto] = useState(false);
  const [pontoData, setPontoData] = useState({ entrada: null, saida: null });
  const [myVehicles, setMyVehicles] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const fetchMyVehicles = useCallback(async (profile) => {
    try {
      const res = await fetch(`${API_URL}/api/vehicles?employeeId=${profile.id}`, {
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setMyVehicles(data);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar veículos vinculados:', err);
    }
  }, []);

  const fetchChecklists = useCallback(async (profile, isManual = false) => {
    if (isManual) setIsRefreshing(true);
    const storeParam = profile.store ? `?store=${encodeURIComponent(profile.store)}` : '';
    try {
      const res = await fetch(`${API_URL}/api/checklists${storeParam}`, {
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
      });
      handle401(res, navigate);
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
  }, [navigate]);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (!savedUser) {
      navigate('/login');
      return;
    }
    const profile = JSON.parse(savedUser);
    setUserProfile(profile);
    
    // Busca se a loja tem o módulo de ponto ativado
    if (profile.store) {
      fetch(`${API_URL}/api/users?store=${encodeURIComponent(profile.store)}`, {
          headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
        })
        .then(r => { handle401(r, navigate); return r.json(); })
        .then(users => {
          const admin = users.find(u => u.role === 'admin' || u.role === 'master');
          if (admin && admin.ponto_active) {
             setHasPonto(true);
             // Busca dados reais do ponto de hoje
             fetch(`${API_URL}/api/ponto/today?userId=${profile.id}&store=${encodeURIComponent(profile.store)}`, {
                 headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
               })
               .then(r => { handle401(r, navigate); return r.json(); })
               .then(data => setPontoData(data))
               .catch(console.error);
          }
        })
        .catch(console.error);
    }
    
    // Busca inicial
    fetchChecklists(profile);
    fetchMyVehicles(profile);

    // Auto-refresh a cada 10 segundos (Quase Tempo Real)
    const interval = setInterval(() => {
      fetchChecklists(profile);
    fetchMyVehicles(profile);
    }, 10000);

    return () => clearInterval(interval);
  }, [navigate, fetchChecklists]);

  // Lógica de monitoramento de conectividade e sincronização automática
  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    const syncOfflineQueue = async () => {
      if (!navigator.onLine) return;
      const queue = JSON.parse(localStorage.getItem('firecheck_offline_queue') || '[]');
      if (queue.length === 0) return;
      
      console.log(`[Offline Sync] Sincronizando ${queue.length} checklists pendentes...`);
      const newQueue = [];
      
      for (const item of queue) {
        try {
          const res = await fetch(`${API_URL}/api/finalize`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '')
            },
            body: JSON.stringify(item)
          });
          if (res.ok) {
            const data = await res.json();
            if (data.id) {
              fetch(`${API_URL}/api/process-audit-background`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '')
                },
                body: JSON.stringify({ submissionId: data.id })
              }).catch(() => {});
            }
          } else {
            newQueue.push(item);
          }
        } catch (err) {
          newQueue.push(item);
        }
      }
      
      localStorage.setItem('firecheck_offline_queue', JSON.stringify(newQueue));
      if (newQueue.length < queue.length && userProfile) {
        fetchChecklists(userProfile);
      }
    };

    window.addEventListener('online', syncOfflineQueue);
    syncOfflineQueue(); // Executa ao conectar

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('online', syncOfflineQueue);
    };
  }, [userProfile, fetchChecklists]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('firecheck_token');
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
      {!isOnline && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
          <span>📡</span>
          <div>
            <strong>Você está offline.</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', opacity: 0.9 }}>Os checklists preenchidos serão salvos localmente e enviados automaticamente quando houver conexão.</p>
          </div>
        </div>
      )}
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
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
           <button onClick={() => fetchChecklists(userProfile, true)} style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '8px 12px', borderRadius: '8px', border: '1px solid #3b82f6', color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 'bold' }}>
              {isRefreshing ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Atualizar
           </button>
           <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Sair <LogOut size={16} />
           </button>
        </div>
      </header>

      <div style={{ backgroundColor: 'var(--bg-color)', padding: '24px', borderRadius: '16px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid var(--border-color)' }}>
         <div style={{ backgroundColor: 'rgba(255, 69, 0, 0.1)', padding: '12px', borderRadius: '12px' }}>
            <User size={24} color="var(--primary)" />
         </div>
         <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Olá, {userProfile?.name}!</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Você tem {pendingChecklists.length} tarefas pendentes para hoje.</p>
         </div>
      </div>

      {/* BANNER APLICATIVO NATIVO — esconde se já está no app nativo */}
      {!Capacitor.isNativePlatform() && (
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '16px 20px',
        marginBottom: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: 'rgba(255, 77, 0, 0.1)', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Smartphone size={20} color="var(--primary)" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'bold' }}>Use o Aplicativo Oficial</h4>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Tenha mais velocidade nas vistorias e fotos.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <a href="https://storage.googleapis.com/fire-check-storage.firebasestorage.app/downloads/firecheck.apk" download className="btn" style={{ flex: 1, padding: '10px 14px', fontSize: '0.82rem', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: '#10b981' }}>
            📥 Android (.APK)
          </a>
          <a href="https://testflight.apple.com/join/5K9U9AF5" target="_blank" rel="noopener noreferrer" className="btn" style={{ flex: 1, padding: '10px 14px', fontSize: '0.82rem', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: '#3b82f6' }}>
            🍎 iPhone (iOS)
          </a>
        </div>
      </div>
      )}

      {hasPonto && (
        <section style={{ marginBottom: '32px' }}>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} /> Meu Ponto (Hoje)
          </h4>
          <div className="card" style={{ padding: '24px', textAlign: 'center', border: '1px solid #3b82f6' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginBottom: '24px' }}>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>Entrada</p>
                <h3 style={{ fontSize: '1.5rem', margin: 0, color: pontoData.entrada ? 'var(--success)' : 'var(--text-muted)' }}>{pontoData.entrada || '--:--'}</h3>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-color)' }}></div>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>Saída</p>
                <h3 style={{ fontSize: '1.5rem', margin: 0, color: pontoData.saida ? 'var(--success)' : 'var(--text-muted)' }}>{pontoData.saida || '--:--'}</h3>
              </div>
            </div>
            
            <button 
              onClick={() => navigate('/ponto')} 
              className="btn" 
              style={{ width: '100%', padding: '16px', fontSize: '1.1rem', backgroundColor: '#3b82f6', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
            >
              <Smartphone size={20} /> Registrar Ponto com IA
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <ShieldCheck size={12} color="#3b82f6" /> GPS e Câmera obrigatórios
            </p>
          </div>
        </section>
      )}

      {myVehicles.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Car size={16} color="var(--primary)" /> Meus Veículos Vinculados ({myVehicles.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {myVehicles.map(vehicle => {
              const completed = vehicle.completed_today;
              
              const isPending = () => {
                if (completed) return false;
                
                const todayDate = new Date();
                const dayOfWeek = todayDate.getDay();
                const dateString = todayDate.toISOString().split('T')[0];
                
                if (vehicle.schedule_type === 'daily') return true;
                if (vehicle.schedule_type === 'weekdays') {
                  const days = Array.isArray(vehicle.schedule_data) ? vehicle.schedule_data : [];
                  return days.includes(dayOfWeek);
                }
                if (vehicle.schedule_type === 'specific_dates') {
                  const dates = Array.isArray(vehicle.schedule_data) ? vehicle.schedule_data : [];
                  return dates.includes(dateString);
                }
                if (vehicle.schedule_type === 'manual') {
                  if (vehicle.last_requested_at) {
                    const reqDate = new Date(vehicle.last_requested_at);
                    const diffMs = todayDate - reqDate;
                    const diffHours = diffMs / (1000 * 60 * 60);
                    return diffHours <= 24;
                  }
                }
                return false;
              };
              
              const pending = isPending();
              
              return (
                <div key={vehicle.id} className="card animate-scale" style={{ padding: '16px 20px', borderLeft: completed ? '4px solid var(--success)' : (pending ? '4px solid var(--primary)' : '4px solid var(--border-color)') }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'rgba(255, 77, 0, 0.05)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {vehicle.photo_url ? (
                          <img src={vehicle.photo_url} alt={vehicle.model} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Car size={24} color="var(--text-muted)" />
                        )}
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1rem', margin: '0 0 4px 0' }}>{vehicle.brand} {vehicle.model}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span className="badge" style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                            {vehicle.plate}
                          </span>
                          {completed ? (
                            <span style={{ fontSize: '0.78rem', color: 'var(--success)', fontWeight: 'bold' }}>
                              ✓ Concluído hoje por {vehicle.completed_by || 'você'}
                            </span>
                          ) : pending ? (
                            <span style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                              ⚠️ Vistoria Pendente
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              Em dia
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {!completed && (
                      <button className="btn" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => navigate(`/execucao/veiculo/${vehicle.id}`)}>
                        Iniciar Vistoria <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section style={{ marginBottom: '32px' }}>
        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClipboardList size={16} /> Checklists Pendentes ({pendingChecklists.length})
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pendingChecklists.length > 0 ? pendingChecklists.map(checklist => (
            <div 
              key={checklist.id} 
              className="card animate-scale" 
              style={{ 
                padding: '16px 20px', 
                cursor: 'pointer', 
                borderLeft: '4px solid #f97316', 
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
              onClick={() => navigate(`/execucao/${checklist.id}`)}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {/* Left Indicator - Recurrence/Time */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '60px', paddingRight: '12px', borderRight: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0f172a' }}>HOJE</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                  {checklist.recurrence === 'weekdays' ? 'Semanal' : (checklist.recurrence === 'unico' ? 'Único' : 'Diário')}
                </span>
              </div>

              {/* Middle Info */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: '700', color: '#0f172a' }}>
                  {checklist.title}
                </h3>
                
                {/* Progress Bar (0% for pending) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: '0%', height: '100%', backgroundColor: '#f97316' }}></div>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>0%</span>
                </div>

                {/* Badges */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <Folder size={12} />
                    {checklist.category === 'veiculo' ? 'Frota / Veículo' : (checklist.category === 'cozinha' ? 'Cozinha' : (checklist.category === 'limpeza' ? 'Limpeza' : 'Operacional'))}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <MapPin size={12} />
                    {checklist.store || userProfile?.store || 'Matriz'}
                  </span>
                </div>
              </div>

              {/* Right Action */}
              <div>
                <button className="btn" style={{ padding: '8px 16px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#0f172a', border: 'none', color: 'white', borderRadius: '20px' }}>
                  <Play size={12} fill="white" /> Iniciar
                </button>
              </div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
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
                style={{ 
                  padding: '16px 20px', 
                  borderLeft: '4px solid #10b981', 
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  opacity: 0.9,
                  position: 'relative'
                }}
              >
                {/* Left Indicator - Recurrence/Time */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '60px', paddingRight: '12px', borderRight: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#10b981' }}>FIM</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                    {checklist.recurrence === 'weekdays' ? 'Semanal' : (checklist.recurrence === 'unico' ? 'Único' : 'Diário')}
                  </span>
                </div>

                {/* Middle Info */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: '700', color: '#94a3b8', textDecoration: 'line-through' }}>
                    {checklist.title}
                  </h3>
                  
                  {/* Progress Bar (100% for completed) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: '100%', backgroundColor: '#10b981' }}></div>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#10b981' }}>100%</span>
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <Folder size={12} />
                      {checklist.category === 'veiculo' ? 'Frota / Veículo' : (checklist.category === 'cozinha' ? 'Cozinha' : (checklist.category === 'limpeza' ? 'Limpeza' : 'Operacional'))}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <MapPin size={12} />
                      {checklist.store || userProfile?.store || 'Matriz'}
                    </span>
                  </div>
                </div>

                {/* Right Action */}
                <div>
                  <span style={{ 
                    backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                    color: '#10b981', 
                    padding: '6px 14px', 
                    borderRadius: '20px', 
                    fontSize: '0.75rem', 
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <CheckCircle size={12} /> Finalizado
                  </span>
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
