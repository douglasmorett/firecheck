import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, LogOut, CheckCircle, Clock, ArrowRight, ClipboardList, User, RefreshCw, Smartphone, ShieldCheck, Car, Folder, MapPin, Play, ShoppingCart, AlertCircle, Package, ShieldAlert, X, Download, Settings, ArrowDownAZ } from 'lucide-react';
import { PushNotifications } from '@capacitor/push-notifications';
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

const setupPushNotifications = async (email) => {
  try {
    if (Capacitor.isNativePlatform()) {
      console.log('[Push] App nativo detectado, solicitando permissão...');
      PushNotifications.addListener('registration', async (token) => {
        console.log('[Push] Token recebido:', token.value?.substring(0, 30) + '...');
        try {
          await fetch(`${API_URL}/api/register-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '')
            },
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
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        console.log('[Push] Permissão web:', permission);
      }
    }
  } catch (e) {
    console.warn('[Push] Erro no setup:', e);
  }
};


export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [checklists, setChecklists] = useState([]);
  const [shoppingLists, setShoppingLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasPonto, setHasPonto] = useState(false);
  const [pontoData, setPontoData] = useState({ entrada: null, saida: null });
  const [mySchedule, setMySchedule] = useState(null);
  const [myVehicles, setMyVehicles] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isImpersonating] = useState(() => Boolean(localStorage.getItem('firecheck_admin_backup')));
  const [bannerWebAppDismissed, setBannerWebAppDismissed] = useState(() => localStorage.getItem('firecheck_webapp_banner_dismissed') === 'true');

  const handleReturnToAdmin = () => {
    const backup = localStorage.getItem('firecheck_admin_backup');
    if (backup) {
      localStorage.setItem('user', backup);
      localStorage.removeItem('firecheck_admin_backup');
      localStorage.removeItem('firecheck_impersonated');
      navigate('/admin');
    } else {
      navigate('/admin');
    }
  };

  const fetchShoppingLists = useCallback(async (profile) => {
    try {
      const storeParam = profile.store ? `?store=${encodeURIComponent(profile.store)}` : '';
      const res = await fetch(`${API_URL}/api/shopping${storeParam}`, {
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setShoppingLists(data);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar listas de compras:', err);
    }
  }, []);

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
    let profile = null;
    try {
      profile = JSON.parse(savedUser);
    } catch (e) {
      console.error('Erro ao ler usuário:', e);
      localStorage.removeItem('user');
      localStorage.removeItem('firecheck_token');
      navigate('/login');
      return;
    }
    if (!profile) {
      navigate('/login');
      return;
    }
    setUserProfile(profile);
    
    // Configura Push Notifications para o Funcionário
    setupPushNotifications(profile.email);
    
    // Busca se a loja tem o módulo de ponto ativado
    if (profile.store) {
      fetch(`${API_URL}/api/users?store=${encodeURIComponent(profile.store)}`, {
          headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
        })
        .then(r => { handle401(r, navigate); return r.json(); })
        .then(users => {
          const admin = Array.isArray(users) ? users.find(u => u.role === 'admin' || u.role === 'master') : null;
          if (admin && (admin.ponto_active || admin.status === 'trial')) {
             setHasPonto(true);
             // Busca dados reais do ponto de hoje
             fetch(`${API_URL}/api/ponto/today?userId=${profile.id}&store=${encodeURIComponent(profile.store)}`, {
                 headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
               })
               .then(r => { handle401(r, navigate); return r.json(); })
               .then(data => setPontoData(data || { entrada: null, saida: null }))
               .catch(console.error);

             if (profile.schedule_id) {
               fetch(`${API_URL}/api/schedules?store=${encodeURIComponent(profile.store)}`, {
                   headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
                 })
                 .then(r => { handle401(r, navigate); return r.json(); })
                 .then(schedules => {
                   const sch = Array.isArray(schedules) ? schedules.find(s => String(s.id) === String(profile.schedule_id)) : null;
                   if (sch) setMySchedule(sch);
                 })
                 .catch(console.error);
             }
          }
        })
        .catch(console.error);
    }
    
    // Busca inicial
    fetchChecklists(profile);
    fetchMyVehicles(profile);
    fetchShoppingLists(profile);

    // Auto-refresh a cada 10 segundos (Quase Tempo Real)
    const interval = setInterval(() => {
      fetchChecklists(profile);
      fetchMyVehicles(profile);
      fetchShoppingLists(profile);
    }, 10000);

    return () => clearInterval(interval);
  }, [navigate, fetchChecklists, fetchMyVehicles, fetchShoppingLists]);

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

  const getDraftProgress = (type, id) => {
    if (!userProfile?.id || !id) return { percent: 0, doneCount: 0, totalCount: 0, isStarted: false };
    const today = new Date().toISOString().split('T')[0];
    const draftKey = `firecheck_draft_${type}_${userProfile.id}_${id}_${today}`;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return { percent: 0, doneCount: 0, totalCount: 0, isStarted: false };
      const parsed = JSON.parse(raw);
      const tasks = parsed.tasks;
      if (!Array.isArray(tasks) || tasks.length === 0) return { percent: 0, doneCount: 0, totalCount: 0, isStarted: false };

      let doneCount = 0;
      tasks.forEach(t => {
        if (t.type === 'itemlist') {
          if (Array.isArray(t.done) && t.done.length > 0) doneCount++;
        } else if (t.type === 'stock') {
          if (t.done !== '' && t.done !== null && t.done !== undefined) doneCount++;
        } else {
          if (t.done !== null && t.done !== undefined && t.done !== '' && t.done !== false) doneCount++;
          else if (t.photo || (Array.isArray(t.photos) && t.photos.length > 0)) doneCount++;
        }
      });

      const percent = Math.min(100, Math.round((doneCount / tasks.length) * 100));
      return { percent, doneCount, totalCount: tasks.length, isStarted: doneCount > 0 };
    } catch(e) {
      return { percent: 0, doneCount: 0, totalCount: 0, isStarted: false };
    }
  };

  const [sortAlphabetical, setSortAlphabetical] = useState(() => {
    try {
      return localStorage.getItem('firecheck_sort_alphabetical') === 'true';
    } catch (e) {
      return false;
    }
  });

  const sortFn = (a, b) => {
    return (a.title || '').localeCompare(b.title || '', 'pt-BR', { numeric: true, sensitivity: 'base' });
  };

  const pendingChecklists = useMemo(() => {
    const list = checklists.filter(c => !c.completedToday);
    return sortAlphabetical ? [...list].sort(sortFn) : list;
  }, [checklists, sortAlphabetical]);

  const completedChecklists = useMemo(() => {
    const list = checklists.filter(c => c.completedToday);
    return sortAlphabetical ? [...list].sort(sortFn) : list;
  }, [checklists, sortAlphabetical]);

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '600px' }}>
      {isImpersonating && (
        <div style={{
          backgroundColor: '#fef3c7',
          border: '2px solid #f59e0b',
          color: '#78350f',
          padding: '16px 20px',
          borderRadius: '16px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 'bold',
          fontSize: '0.9rem',
          boxShadow: '0 4px 14px rgba(245, 158, 11, 0.15)',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: '260px' }}>
            <span style={{ fontSize: '1.8rem', lineHeight: '1' }}>🧪</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: '800', color: '#92400e' }}>Modo Simulação & Testes</span>
                <span style={{ backgroundColor: '#f59e0b', color: 'white', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>Simulação Ativa</span>
              </div>
              <span style={{ fontWeight: 'normal', fontSize: '0.84rem', color: '#78350f', lineHeight: '1.4', display: 'block' }}>
                Você está visualizando a plataforma como um funcionário. <strong>Você pode iniciar, preencher e testar o passo a passo de qualquer checklist livremente!</strong>
              </span>
              <span style={{ fontWeight: '700', fontSize: '0.8rem', color: '#92400e', marginTop: '8px', display: 'block', lineHeight: '1.45', backgroundColor: 'rgba(146, 64, 14, 0.09)', padding: '8px 10px', borderRadius: '6px' }}>
                ⚠️ Esta tela mostra <u>todos</u> os checklists da loja, porque seu acesso é de administração.
                Ela <strong>não</strong> reflete o que cada funcionário enxerga: cada um vê apenas os checklists
                atribuídos a ele. Para conferir as permissões, use "Funcionários Responsáveis" na edição do
                checklist, ou entre com o login do próprio colaborador.
              </span>
              <span style={{ fontWeight: '600', fontSize: '0.78rem', color: '#b45309', marginTop: '6px', display: 'block' }}>
                ℹ️ <em>Nenhum teste feito aqui entra para as estatísticas oficiais nem consome cotas. Para auditorias e execuções oficiais diárias válidas, cada colaborador deve fazer login com seu próprio usuário e senha.</em>
              </span>
            </div>
          </div>
          <button
            onClick={handleReturnToAdmin}
            style={{
              backgroundColor: '#b45309',
              color: '#ffffff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '10px',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              flexShrink: 0
            }}
          >
            <ShieldAlert size={18} color="#ffffff" /> Voltar ao Painel do Administrador
          </button>
        </div>
      )}

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
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
           {(userProfile?.role === 'admin' || userProfile?.role === 'gestor' || userProfile?.role === 'master' || isImpersonating) && (
             <button 
               onClick={() => navigate('/admin')} 
               className="btn animate-scale"
               style={{ 
                 backgroundColor: '#2563eb', 
                 padding: '8px 16px', 
                 borderRadius: '20px', 
                 border: 'none', 
                 color: '#ffffff', 
                 cursor: 'pointer', 
                 display: 'flex', 
                 alignItems: 'center', 
                 gap: '6px', 
                 fontSize: '0.85rem', 
                 fontWeight: 'bold',
                 boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
               }}
             >
               <Settings size={16} /> Painel de Gestão
             </button>
           )}
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

      {/* BANNER WEBAPP + WHATSAPP — esconde se já está no app nativo ou se o usuário dispensou */}
      {!Capacitor.isNativePlatform() && !bannerWebAppDismissed && (
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '16px 20px',
        marginBottom: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        position: 'relative'
      }}>
        <button 
          onClick={() => { setBannerWebAppDismissed(true); localStorage.setItem('firecheck_webapp_banner_dismissed', 'true'); }}
          style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Fechar"
        >
          <X size={16} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <div style={{ backgroundColor: '#25D366', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Smartphone size={20} color="#fff" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'bold' }}>Acesse pelo celular!</h4>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Notificações via WhatsApp. Instale o webapp para acesso rápido.</p>
          </div>
        </div>
        <button 
          onClick={() => { const pwaBtn = document.querySelector('[data-pwa-install]'); if (pwaBtn) pwaBtn.click(); }}
          className="btn" 
          style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--primary)', padding: '10px 14px', fontSize: '0.82rem', flexShrink: 0 }}
        >
          <Download size={16} /> WebApp
        </button>
      </div>
      )}

      {hasPonto && (
        <section style={{ marginBottom: '32px' }}>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} /> Meu Ponto (Hoje)
          </h4>
          <div className="card" style={{ padding: '24px', textAlign: 'center', border: '1px solid #3b82f6' }}>
            {mySchedule && (() => {
              let wd = null;
              try {
                const wds = typeof mySchedule.weekdays === 'string' ? JSON.parse(mySchedule.weekdays) : mySchedule.weekdays;
                wd = wds.find(w => w.weekday === new Date().getDay());
              } catch(e) {}
              const isFolga = wd && !wd.is_workday;
              const ent = (wd && wd.hora_entrada) || mySchedule.hora_entrada;
              const sai = (wd && wd.hora_saida) || mySchedule.hora_saida;

              return (
                <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px' }}>
                  <h5 style={{ margin: '0 0 4px 0', color: mySchedule.color || 'var(--primary)' }}>{mySchedule.name}</h5>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {isFolga ? '📅 Folga' : `⏰ ${ent} às ${sai}`}
                  </p>
                </div>
              );
            })()}
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
              onClick={() => { if(!isImpersonating) navigate('/ponto'); }} 
              disabled={isImpersonating}
              className="btn" 
              style={{ width: '100%', padding: '16px', fontSize: '1.1rem', backgroundColor: '#3b82f6', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: isImpersonating ? 0.5 : 1, cursor: isImpersonating ? 'not-allowed' : 'pointer' }}
            >
              <Smartphone size={20} /> Registrar Ponto com IA
            </button>
            {isImpersonating && (
              <p style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.8rem', color: '#f59e0b', fontWeight: 'bold' }}>🔒 Somente visualização</p>
            )}
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
              const { percent, isStarted } = getDraftProgress('vehicle', vehicle.id);
              
              return (
                <div key={vehicle.id} className="card animate-scale" style={{ padding: '16px 20px', borderLeft: completed ? '4px solid var(--success)' : (isStarted ? '4px solid #3b82f6' : (pending ? '4px solid var(--primary)' : '4px solid var(--border-color)')) }}>
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
                          ) : isStarted ? (
                            <span style={{ fontSize: '0.78rem', color: '#3b82f6', fontWeight: 'bold' }}>
                              🕒 Vistoria em andamento ({percent}%)
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
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <button className="btn" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: isStarted ? '#3b82f6' : (isImpersonating ? '#f59e0b' : 'var(--primary)'), cursor: 'pointer' }} onClick={() => navigate(`/execucao/veiculo/${vehicle.id}`)}>
                          {isStarted ? 'Continuar Vistoria' : (isImpersonating ? '🧪 Testar Vistoria' : 'Iniciar Vistoria')} <ArrowRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 🛒 LISTAS DE COMPRAS PENDENTES */}
      {(() => {
        const pendingShopping = shoppingLists.filter(s => {
          if (s.completed_today) return false;
          if (!s.assigned_to || s.assigned_to === 'todos' || s.assigned_to === 'pendente') return true;

          const userEmail = (userProfile?.email || '').toLowerCase().trim();
          const userName = (userProfile?.name || '').toLowerCase().trim();
          const userId = String(userProfile?.id || '');

          const matchesUser = (target) => {
            if (!target) return false;
            const str = String(target).toLowerCase().trim();
            return (userEmail && str === userEmail) || (userName && str === userName) || (userId && str === userId);
          };

          if (Array.isArray(s.assigned_to)) {
            return s.assigned_to.some(matchesUser);
          }
          return matchesUser(s.assigned_to);
        });

        if (pendingShopping.length === 0) return null;

        return (
          <section style={{ marginBottom: '32px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
              <ShoppingCart size={18} color="var(--primary)" /> Listas de Compras ({pendingShopping.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingShopping.map(list => {
                const { percent, doneCount, totalCount, isStarted } = getDraftProgress('shopping', list.id);
                return (
                  <div
                    key={`shopping-${list.id}`}
                    className="card animate-scale"
                    style={{
                      padding: '18px 20px',
                      cursor: 'pointer',
                      borderLeft: isStarted ? '4px solid #3b82f6' : '4px solid #06b6d4',
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      boxShadow: '0 4px 12px rgba(6, 182, 212, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                    onClick={() => navigate(`/execucao/compras/${list.id}`)}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '60px', paddingRight: '12px', borderRight: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: isStarted ? '#3b82f6' : '#0891b2' }}>
                        {isStarted ? `${percent}%` : 'COMPRA'}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>
                        {list.recurrence === 'daily' ? 'Diária' : list.recurrence === 'weekly' ? 'Semanal' : 'Mensal'}
                      </span>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: '700', color: '#0f172a' }}>
                          {list.title}
                        </h3>
                        {isStarted && (
                          <span style={{ fontSize: '0.7rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                            🕒 Em andamento
                          </span>
                        )}
                        {isImpersonating && (
                          <span style={{ fontSize: '0.7rem', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', padding: '1px 6px', borderRadius: '6px', fontWeight: 'bold' }}>
                            🧪 Simulação
                          </span>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          <Package size={14} color="#0891b2" />
                          {isStarted ? `${doneCount} de ${totalCount} conferidos` : `${list.item_count || 0} itens para conferir estoque`}
                        </span>
                        {parseInt(list.below_min_count) > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#ef4444', fontWeight: 'bold' }}>
                            <AlertCircle size={14} />
                            {list.below_min_count} abaixo do mínimo
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <button className="btn" style={{ padding: '8px 16px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: isStarted ? '#3b82f6' : (isImpersonating ? '#f59e0b' : '#0891b2'), border: 'none', color: 'white', borderRadius: '20px', cursor: 'pointer' }}>
                        <Play size={12} fill="white" /> {isStarted ? 'Continuar' : (isImpersonating ? 'Testar' : 'Preencher')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      <section style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList size={16} /> Checklists Pendentes ({pendingChecklists.length})
          </h4>
          {checklists.length > 1 && (
            <button
              type="button"
              onClick={() => {
                const nextVal = !sortAlphabetical;
                setSortAlphabetical(nextVal);
                try {
                  localStorage.setItem('firecheck_sort_alphabetical', String(nextVal));
                } catch (e) {}
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: '600',
                borderRadius: '8px',
                border: sortAlphabetical ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                backgroundColor: sortAlphabetical ? 'rgba(255, 69, 0, 0.08)' : 'var(--bg-card)',
                color: sortAlphabetical ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title={sortAlphabetical ? "Ordenação alfabética ativa (clique para voltar à ordem padrão)" : "Ordenar checklists por ordem alfabética (A-Z)"}
            >
              <ArrowDownAZ size={14} />
              {sortAlphabetical ? 'Ordem Alfabética (A-Z)' : 'Ordem alfabética'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pendingChecklists.length > 0 ? pendingChecklists.map(checklist => {
            const { percent, doneCount, totalCount, isStarted } = getDraftProgress('checklist', checklist.id);
            return (
              <div 
                key={checklist.id} 
                className="card animate-scale" 
                style={{ 
                  padding: '16px 20px', 
                  cursor: 'pointer', 
                  borderLeft: isStarted ? '4px solid #3b82f6' : (isImpersonating ? '4px solid #f59e0b' : '4px solid #f97316'), 
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
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
              >
                {/* Left Indicator - Recurrence/Time */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '60px', paddingRight: '12px', borderRight: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: isStarted ? '#3b82f6' : (isImpersonating ? '#d97706' : '#0f172a') }}>
                    {isStarted ? `${percent}%` : 'HOJE'}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                    {checklist.recurrence === 'weekdays' ? 'Semanal' : (checklist.recurrence === 'unico' ? 'Único' : 'Diário')}
                  </span>
                </div>

                {/* Middle Info */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: '700', color: '#0f172a' }}>
                      {checklist.title}
                    </h3>
                    {isStarted && (
                      <span style={{ fontSize: '0.7rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                        🕒 Em andamento
                      </span>
                    )}
                    {isImpersonating && (
                      <span style={{ fontSize: '0.7rem', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', padding: '1px 6px', borderRadius: '6px', fontWeight: 'bold' }}>
                        🧪 Simulação
                      </span>
                    )}
                  </div>
                  
                  {/* Progress Bar (Dynamic %) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${percent}%`, height: '100%', backgroundColor: isStarted ? '#3b82f6' : (isImpersonating ? '#f59e0b' : '#f97316'), transition: 'width 0.3s ease' }}></div>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: isStarted ? '#3b82f6' : 'var(--text-muted)' }}>
                      {isStarted ? `${percent}% (${doneCount}/${totalCount})` : '0%'}
                    </span>
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <Folder size={12} />
                      {checklist.category === 'veiculo' ? 'Frota / Veículo' : (checklist.category === 'compras' ? '🛒 Lista de Compras' : (checklist.category === 'cozinha' ? 'Cozinha' : (checklist.category === 'limpeza' ? 'Limpeza' : 'Operacional')))}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <MapPin size={12} />
                      {checklist.store || userProfile?.store || 'Matriz'}
                    </span>
                  </div>
                </div>

                {/* Right Action */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <button className="btn" style={{ padding: '8px 16px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: isStarted ? '#3b82f6' : (isImpersonating ? '#f59e0b' : '#0f172a'), border: 'none', color: 'white', borderRadius: '20px', cursor: 'pointer' }}>
                    <Play size={12} fill="white" /> {isStarted ? 'Continuar' : (isImpersonating ? 'Testar' : 'Iniciar')}
                  </button>
                </div>
              </div>
            );
          }) : (
            <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
              <CheckCircle size={32} color="var(--success)" style={{ marginBottom: '12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Tudo em dia! Nenhuma tarefa pendente.</p>
            </div>
          )}
        </div>
      </section>

      {completedChecklists.length > 0 && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={16} /> Concluídos Hoje ({completedChecklists.length})
            </h4>
            {pendingChecklists.length === 0 && checklists.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const nextVal = !sortAlphabetical;
                  setSortAlphabetical(nextVal);
                  try {
                    localStorage.setItem('firecheck_sort_alphabetical', String(nextVal));
                  } catch (e) {}
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  borderRadius: '8px',
                  border: sortAlphabetical ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  backgroundColor: sortAlphabetical ? 'rgba(255, 69, 0, 0.08)' : 'var(--bg-card)',
                  color: sortAlphabetical ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title={sortAlphabetical ? "Ordenação alfabética ativa (clique para voltar à ordem padrão)" : "Ordenar checklists por ordem alfabética (A-Z)"}
              >
                <ArrowDownAZ size={14} />
                {sortAlphabetical ? 'Ordem Alfabética (A-Z)' : 'Ordem alfabética'}
              </button>
            )}
          </div>
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
                      {checklist.category === 'veiculo' ? 'Frota / Veículo' : (checklist.category === 'compras' ? '🛒 Lista de Compras' : (checklist.category === 'cozinha' ? 'Cozinha' : (checklist.category === 'limpeza' ? 'Limpeza' : 'Operacional')))}
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
