import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, LogOut, CheckCircle, Clock, ArrowRight, ClipboardList, User, RefreshCw, Smartphone, ShieldCheck, Car, Folder, MapPin, Play, ShoppingCart, AlertCircle, Package, ShieldAlert, X, Download, Settings, ArrowDownAZ } from 'lucide-react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import API_URL from '../api';

// O dia operacional é o de SÃO PAULO — a MESMA régua do ChecklistExecution,
// que grava o rascunho sob esta chave. Com toISOString() (UTC), das 21h à
// meia-noite o escritor salvava sob um dia e este painel procurava no outro:
// o selo "Em andamento X%" sumia bem na hora do fechamento.
const diaDeSaoPaulo = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });


const handle401 = (res, navigate) => {
  if (res.status === 401) {
    localStorage.removeItem('user');
    localStorage.removeItem('firecheck_token');
    navigate('/login');
  }
  return res;
};

// O navegador dispara 'beforeinstallprompt' UMA única vez, logo após o
// carregamento — em geral com a pessoa ainda no /login. Um listener registrado
// só quando alguma tela monta chega tarde demais, e o botão "WebApp" caía
// sempre nas instruções manuais mesmo onde o prompt nativo existia. Este
// módulo é importado estaticamente pelo App, então este código roda no boot,
// antes do primeiro render — a tempo de capturar o evento para qualquer tela.
if (typeof window !== 'undefined' && !window.__firecheckPwaListenerRegistrado) {
  window.__firecheckPwaListenerRegistrado = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    // Sem o preventDefault o Chrome consome o evento na mini-barra dele e
    // .prompt() deixa de funcionar depois.
    e.preventDefault();
    window.__firecheckPwaPrompt = e;
  });
}

const setupPushNotifications = async (email) => {
  try {
    // Em simulação, o aparelho é o do administrador. Registrá-lo aqui gravava o
    // token dele no cadastro do funcionário simulado, e as notificações daquele
    // colaborador passavam a chegar no celular do administrador — o funcionário
    // deixava de receber os próprios alertas sem nunca saber por quê.
    if (localStorage.getItem('firecheck_admin_backup')) {
      console.log('[Push] Modo simulação: registro de notificações ignorado.');
      return;
    }
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
  // Impede duas sincronizações da fila offline ao mesmo tempo (ver syncOfflineQueue).
  const syncingRef = useRef(false);
  const [isImpersonating] = useState(() => Boolean(localStorage.getItem('firecheck_admin_backup')));
  // Registro de ocorrência / descarte. `tipoRegistro` nulo = modal fechado.
  const [tipoRegistro, setTipoRegistro] = useState(null);
  const [registroDescricao, setRegistroDescricao] = useState('');
  const [registroFoto, setRegistroFoto] = useState(null);
  const [registroItem, setRegistroItem] = useState('');
  const [registroQtd, setRegistroQtd] = useState('');
  const [registroUnidade, setRegistroUnidade] = useState('un');
  const [registroValor, setRegistroValor] = useState('');
  const [registroMotivo, setRegistroMotivo] = useState('');
  const [registroEnviando, setRegistroEnviando] = useState(false);
  const [registroOk, setRegistroOk] = useState(false);
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
    const params = new URLSearchParams();
    if (profile.store) params.set('store', profile.store);
    // Em simulação a requisição leva o token de quem administra, então sem este
    // parâmetro a API devolveria a loja inteira e a tela mostraria todos os
    // checklists — e não a visão real do colaborador que se quer conferir.
    if (localStorage.getItem('firecheck_admin_backup') && profile.email) {
      params.set('verComo', profile.email);
    }
    const storeParam = params.toString() ? `?${params.toString()}` : '';
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
      // Trava de concorrência. Este efeito depende de userProfile: ele roda uma vez
      // na montagem (userProfile ainda null) e de novo quando o perfil carrega. Sem
      // a trava, as duas execuções liam a MESMA fila do localStorage e enviavam os
      // mesmos checklists em paralelo, gravando cada um duas vezes.
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
      const queue = JSON.parse(localStorage.getItem('firecheck_offline_queue') || '[]');
      if (queue.length === 0) return;
      
      console.log(`[Offline Sync] Sincronizando ${queue.length} checklists pendentes...`);
      const newQueue = [];
      const recusados = [];
      let resposta401 = null;

      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
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
          } else if (res.status === 401) {
            // Sessão vencida (o JWT dura 7 dias) NÃO é recusa do checklist:
            // o trabalho preenchido offline, com fotos, tem que sobreviver ao
            // relogin. Este item e os ainda não tentados voltam para a fila —
            // insistir agora só renderia mais 401 com o mesmo token morto.
            newQueue.push(...queue.slice(i));
            resposta401 = res;
            break;
          } else if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
            // Recusa definitiva do servidor (checklist já enviado hoje, cota
            // estourada, dados inválidos). Reenviar isso para sempre nunca daria
            // certo, e o funcionário nunca ficava sabendo — o item apenas voltava
            // à fila em silêncio, a cada abertura da tela.
            const corpo = await res.json().catch(() => null);
            recusados.push({ item, motivo: corpo?.message || corpo?.error || `erro ${res.status}` });
          } else {
            // 5xx ou limite temporário: vale tentar de novo mais tarde.
            newQueue.push(item);
          }
        } catch (err) {
          newQueue.push(item);
        }
      }

      if (recusados.length > 0) {
        const lista = recusados.map(r => `• ${r.motivo}`).join('\n');
        alert(`⚠️ ${recusados.length} checklist(s) offline não puderam ser enviados e foram descartados da fila:\n\n${lista}\n\nSe algum deles ainda precisa ser feito, preencha novamente.`);
      }

      localStorage.setItem('firecheck_offline_queue', JSON.stringify(newQueue));
      if (resposta401) {
        // Leva ao login sem descartar nada: a fila fica no localStorage, e
        // quando o funcionário relogar e voltar a esta tela o efeito remonta
        // e reenviará tudo com o token novo (chamada na montagem, logo abaixo).
        handle401(resposta401, navigate);
        return;
      }
      if (newQueue.length < queue.length && userProfile) {
        fetchChecklists(userProfile);
      }
      } finally {
        syncingRef.current = false;
      }
    };

    window.addEventListener('online', syncOfflineQueue);
    syncOfflineQueue(); // Executa ao conectar

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('online', syncOfflineQueue);
    };
  }, [userProfile, fetchChecklists, navigate]);

  // A foto é opcional e some se der errado: o relato é que não pode se perder.
  // Comprime como o checklist já faz — foto de celular em base64 estoura o
  // limite do corpo da requisição.
  const escolherFotoRegistro = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 800;
        let { width, height } = img;
        if (width > maxWidth) { height = Math.round((maxWidth / width) * height); width = maxWidth; }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        setRegistroFoto(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const enviarRegistro = async () => {
    const ehDescarte = tipoRegistro === 'descarte';
    if (ehDescarte && !registroItem.trim()) { alert('Diga qual item foi descartado.'); return; }
    if (!ehDescarte && !registroDescricao.trim()) { alert('Escreva o que aconteceu.'); return; }

    // Em simulação a tela funciona inteira, mas nada é gravado nem avisa
    // ninguém — a mesma regra dos checklists de teste. Quem está conhecendo o
    // sistema precisa ver o formulário; o dono não precisa receber o WhatsApp.
    if (isImpersonating) {
      setTipoRegistro(null);
      alert('É assim que o colaborador registra. Como você está em Modo Simulação, este registro não foi gravado e ninguém foi avisado.');
      return;
    }

    setRegistroEnviando(true);
    try {
      const res = await fetch(`${API_URL}/api/ocorrencias`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || ''),
        },
        body: JSON.stringify({
          tipo: tipoRegistro,
          descricao: registroDescricao,
          photo: registroFoto,
          item: registroItem,
          quantidade: registroQtd,
          unidade: registroUnidade,
          valorEstimado: registroValor,
          motivo: registroMotivo,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error || 'Não foi possível registrar agora. Tente de novo.');
        return;
      }
      setTipoRegistro(null);
      setRegistroOk(true);
      setTimeout(() => setRegistroOk(false), 4000);
    } catch {
      alert('Sem conexão para registrar agora. Tente de novo quando o sinal voltar.');
    } finally {
      setRegistroEnviando(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('firecheck_token');
    // Sem isto, o modo simulação sobrevive ao logout: o próximo a entrar neste
    // aparelho é tratado como administrador testando, e os checklists dele não
    // são gravados — em silêncio, sem nenhum aviso na tela.
    localStorage.removeItem('firecheck_admin_backup');
    localStorage.removeItem('firecheck_impersonated');
    navigate('/login');
  };

  const getDraftProgress = (type, id) => {
    if (!userProfile?.id || !id) return { percent: 0, doneCount: 0, totalCount: 0, isStarted: false };
    const today = diaDeSaoPaulo();
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
          // 'false' É resposta: quem respondeu "Não" respondeu — descontar o
          // false travava a barra e o selo abaixo de 100% num checklist completo.
          if (t.done !== null && t.done !== undefined && t.done !== '') doneCount++;
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
                👁️ Você está vendo <u>exatamente</u> os checklists deste colaborador — os atribuídos a ele e os
                de toda a equipe. É a mesma lista que ele vê ao entrar com o próprio login.
                Nada preenchido aqui entra para o histórico oficial.
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
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{userProfile?.store_name || userProfile?.store}</p>
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
          // Antes procurava [data-pwa-install] e chamava .click() nele — mas o
          // atributo está numa <div>, não num botão, e o componente nem renderiza
          // quando o banner foi dispensado. O clique não fazia absolutamente nada.
          onClick={async () => {
            const prompt = window.__firecheckPwaPrompt;
            if (prompt) {
              prompt.prompt();
              const { outcome } = await prompt.userChoice;
              if (outcome === 'accepted') window.__firecheckPwaPrompt = null;
              return;
            }
            const ehIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            alert(ehIOS
              ? 'Para instalar no iPhone: toque no botão Compartilhar do Safari e escolha "Adicionar à Tela de Início".'
              : 'Abra o menu do navegador e escolha "Instalar aplicativo" ou "Adicionar à tela inicial". Se a opção não aparecer, o app já está instalado neste aparelho.');
          }}
          className="btn" 
          style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--primary)', padding: '10px 14px', fontSize: '0.82rem', flexShrink: 0 }}
        >
          <Download size={16} /> WebApp
        </button>
      </div>
      )}

      {/* ── Registrar o que fugiu da rotina ──────────────────────────────────
          O checklist só pergunta o que já se sabe perguntar. O freezer que
          descongelou de madrugada, a caixa de tomate que veio estragada — isso
          não tinha onde ser dito e virava conversa de corredor que nunca chegava
          ao dono. Fica no topo porque quem precisa registrar está no meio do
          serviço e não vai procurar. */}
      {/* Todo colaborador registra: um freezer que descongelou não espera o
          gerente chegar, e o registro sempre carrega o nome de quem enviou.
          Antes a seção sumia em Modo Simulação, então o lojista que entrava para
          conhecer "a tela do funcionário" via exatamente o contrário do que
          existe de verdade. */}
      <section style={{ marginBottom: '32px' }}>
        {isImpersonating && (
          <p style={{ margin: '0 0 8px 0', fontSize: '0.78rem', color: '#b45309', fontWeight: 'bold' }}>
            🧪 Em simulação: abra para ver o formulário. Nada aqui é gravado.
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <button
            className="btn"
            onClick={() => { setTipoRegistro('ocorrencia'); setRegistroDescricao(''); setRegistroFoto(null); setRegistroItem(''); setRegistroQtd(''); setRegistroUnidade('un'); setRegistroValor(''); setRegistroMotivo(''); }}
            style={{ padding: '16px', backgroundColor: '#f59e0b', border: 'none', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.9rem' }}
          >
            <AlertCircle size={20} /> Registrar Ocorrência
          </button>
          <button
            className="btn"
            onClick={() => { setTipoRegistro('descarte'); setRegistroDescricao(''); setRegistroFoto(null); setRegistroItem(''); setRegistroQtd(''); setRegistroUnidade('un'); setRegistroValor(''); setRegistroMotivo(''); }}
            style={{ padding: '16px', backgroundColor: '#0f766e', border: 'none', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.9rem' }}
          >
            <Package size={20} /> Registrar Descarte
          </button>
        </div>
      </section>

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
                // Data no dia de SP: com toISOString() (UTC), a vistoria com
                // data marcada aparecia/sumia 3 horas antes da virada real.
                const dateString = diaDeSaoPaulo();
                
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

      {/* Confirmação discreta: quem registrou precisa saber que chegou, sem um
          alert que obriga a tirar a mão do serviço para clicar em OK. */}
      {registroOk && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 10001, backgroundColor: 'var(--success, #16a34a)', color: '#fff', padding: '14px 20px', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.9rem', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={18} /> Registrado. Seu gestor foi avisado.
        </div>
      )}

      {tipoRegistro && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
          <div className="card animate-scale" style={{ width: '100%', maxWidth: '460px', padding: '24px', borderRadius: '16px', borderTop: `6px solid ${tipoRegistro === 'descarte' ? '#0f766e' : '#f59e0b'}`, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
              <h2 style={{ fontSize: '1.15rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {tipoRegistro === 'descarte' ? <><Package size={20} color="#0f766e" /> Registrar Descarte</> : <><AlertCircle size={20} color="#f59e0b" /> Registrar Ocorrência</>}
              </h2>
              <button onClick={() => setTipoRegistro(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 18px 0' }}>
              {tipoRegistro === 'descarte'
                ? 'O que precisou ser jogado fora, e por quê. Seu gestor recebe na hora.'
                : 'Algo fora da rotina? Conte aqui. Seu gestor recebe na hora.'}
            </p>

            {tipoRegistro === 'descarte' && (
              <>
                <label className="input-label">O que foi descartado *</label>
                <input className="input-field" value={registroItem} onChange={e => setRegistroItem(e.target.value)}
                  placeholder="Ex.: caixa de tomate" maxLength={120} style={{ marginBottom: '12px' }} />

                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ flex: 2 }}>
                    <label className="input-label">Quantidade</label>
                    <input className="input-field" value={registroQtd} onChange={e => setRegistroQtd(e.target.value)}
                      placeholder="Ex.: 3" inputMode="decimal" maxLength={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="input-label">Unidade</label>
                    <select className="input-field" value={registroUnidade} onChange={e => setRegistroUnidade(e.target.value)}>
                      <option value="un">un</option>
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="L">L</option>
                      <option value="ml">ml</option>
                      <option value="cx">cx</option>
                      <option value="pct">pct</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label className="input-label">Valor estimado (R$)</label>
                    <input className="input-field" value={registroValor} onChange={e => setRegistroValor(e.target.value.replace(',', '.'))}
                      placeholder="Ex.: 45.00" inputMode="decimal" maxLength={12} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="input-label">Motivo</label>
                    <select className="input-field" value={registroMotivo} onChange={e => setRegistroMotivo(e.target.value)}>
                      <option value="">Selecione…</option>
                      <option value="Vencido">Vencido</option>
                      <option value="Estragado">Estragado</option>
                      <option value="Quebrado / danificado">Quebrado / danificado</option>
                      <option value="Erro de preparo">Erro de preparo</option>
                      <option value="Sobra do dia">Sobra do dia</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <label className="input-label">
              {tipoRegistro === 'descarte' ? 'Quer detalhar? (opcional)' : 'O que aconteceu? *'}
            </label>
            <textarea className="input-field" rows={4} maxLength={1000}
              value={registroDescricao} onChange={e => setRegistroDescricao(e.target.value)}
              placeholder={tipoRegistro === 'descarte'
                ? 'Ex.: chegou já murcho do fornecedor'
                : 'Ex.: o freezer da cozinha amanheceu desligado e a carne descongelou'}
              style={{ resize: 'vertical', marginBottom: '14px' }} />

            <label className="input-label">Foto (opcional)</label>
            {registroFoto ? (
              <div style={{ position: 'relative', marginBottom: '16px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <img src={registroFoto} alt="Foto do registro" style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', display: 'block' }} />
                <button onClick={() => setRegistroFoto(null)}
                  style={{ position: 'absolute', top: 8, right: 8, padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', marginBottom: '16px', cursor: 'pointer', fontSize: '0.85rem' }}>
                <Smartphone size={16} /> Anexar foto
                <input type="file" accept="image/*" capture="environment" onChange={escolherFotoRegistro} style={{ display: 'none' }} />
              </label>
            )}

            <button className="btn" onClick={enviarRegistro} disabled={registroEnviando}
              style={{ width: '100%', padding: '14px', fontWeight: 'bold', backgroundColor: tipoRegistro === 'descarte' ? '#0f766e' : '#f59e0b', border: 'none', color: '#fff' }}>
              {registroEnviando ? 'Enviando…' : 'Enviar para o gestor'}
            </button>
          </div>
        </div>
      )}

      <footer style={{ marginTop: '48px', textAlign: 'center', padding: '24px', borderTop: '1px solid var(--border-color)' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>FireCheck v1.0 • Sistema de Auditoria em Tempo Real</p>
      </footer>
    </div>
  );
}
