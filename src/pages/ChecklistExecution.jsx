import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Camera, CheckCircle, AlertTriangle, Send, X, AlertCircle, Star, PenLine, FileText, Trophy, ArrowLeft, Flame, ShieldAlert, Image } from 'lucide-react';
import API_URL from '../api';

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '')
});

const handle401 = (res, navigate) => {
  if (res.status === 401) {
    localStorage.removeItem('user');
    localStorage.removeItem('firecheck_token');
    navigate('/login');
  }
  return res;
};

export default function ChecklistExecution() {
  const navigate = useNavigate();
  const { id, vehicleId, shoppingListId } = useParams();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === 'true';
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('Carregando...');
  const [isShoppingMode, setIsShoppingMode] = useState(false);
  
  const [isImpersonating] = useState(() => Boolean(localStorage.getItem('firecheck_admin_backup')));
  const isReadOnly = isPreview || isImpersonating;

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

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('firecheck_token');
    navigate('/login');
  };

  const [activeCameraTaskId, setActiveCameraTaskId] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiFeedback, setAIFeedback] = useState({});
  const [userProfile, setUserProfile] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [startedAt] = useState(() => new Date().toISOString());

  // Estados novos: Assinatura e Veículos
  const [category, setCategory] = useState('geral');
  const [requireSignature, setRequireSignature] = useState(false);
  const [signature, setSignature] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const sigCanvasRef = useRef(null);

  // Carregar usuário logado
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (!savedUser) {
      navigate('/login');
      return;
    }
    setUserProfile(JSON.parse(savedUser));
  }, [navigate]);

  const EMPLOYEE = {
    name: userProfile?.name || 'Colaborador',
    store: userProfile?.store || 'Loja Exemplo'
  };

  const [currentChecklistId, setCurrentChecklistId] = useState(null);
  const [completedTodayInfo, setCompletedTodayInfo] = useState(null);
  const [requireSelfie, setRequireSelfie] = useState(false);

  // Carregar checklists ou listas de compras da loja
  useEffect(() => {
    setTasks([]);
    const profile = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (shoppingListId) {
      setIsShoppingMode(true);
      const storeParam = profile.store ? `?store=${encodeURIComponent(profile.store)}` : '';
      
      // Buscar título da lista de compras
      fetch(`${API_URL}/api/shopping${storeParam}`, {
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
      })
      .then(res => res.json())
      .then(lists => {
        if (Array.isArray(lists)) {
          const list = lists.find(l => String(l.id) === String(shoppingListId));
          if (list) {
            setTitle(`Checklist de Compras — ${list.title}`);
            if (list.completed_today) {
              setCompletedTodayInfo(list.completed_by);
              setSubmitted(true);
            }
          }
        }
      })
      .catch(() => {});

      // Buscar itens da lista de compras
      fetch(`${API_URL}/api/shopping/items?listId=${shoppingListId}`, {
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
      })
      .then(res => { handle401(res, navigate); return res.json(); })
      .then(items => {
        if (Array.isArray(items)) {
          setCategory('compras');
          setRequireSelfie(false);
          setRequireSignature(false);
          setTasks(items.map(item => ({
            id: item.id,
            text: item.name,
            unit: item.unit || 'un',
            minStock: parseFloat(item.min_stock || 0),
            done: item.current_stock !== null && item.current_stock !== undefined ? parseFloat(item.current_stock) : '',
            type: 'stock',
            category: item.category || 'geral'
          })));
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Erro ao buscar itens de compras:', err);
        setLoading(false);
      });
      return;
    }

    if (vehicleId) {
      // Carregar vistorias específicas de veículo
      fetch(`${API_URL}/api/vehicles?employeeId=${profile.id}`, {
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
      })
      .then(res => { handle401(res, navigate); return res.json(); })
      .then(vData => {
        if (Array.isArray(vData)) {
          const vehicle = vData.find(v => String(v.id) === String(vehicleId));
          if (vehicle) {
            setTitle(`Vistoria - ${vehicle.brand} ${vehicle.model} (${vehicle.plate})`);
            setCategory('veiculo');
            setRequireSignature(true); // Exigir assinatura por padrão nas vistorias de veículos
            setRequireSelfie(false);
            
            if (vehicle.completed_today) {
              setCompletedTodayInfo(vehicle.completed_by);
              setSubmitted(true);
            }
            
            const myTasks = vehicle.tasks || [];
            setTasks(myTasks.map((t, idx) => ({
              ...t,
              id: t.id || `vtask-${idx}`,
              done: null,
              photo: null,
              photos: [],
              forceOverride: false
            })));
            
            // Buscar os detalhes da submissão se já estiver concluído
            if (vehicle.completed_today) {
              fetch(`${API_URL}/api/submissions?store=${encodeURIComponent(profile.store)}`, {
                headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
              })
              .then(res => res.json())
              .then(subs => {
                const today = new Date().toISOString().split('T')[0];
                const mySub = subs.find(s => s.vehicle_id === vehicle.id && s.created_at.startsWith(today));
                if (mySub) {
                  setTasks(mySub.tasks);
                  setAIFeedback(mySub.feedback_info || {});
                  setSelfie(mySub.selfie);
                  setSignature(mySub.signature);
                }
              });
            }
          }
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Erro ao buscar veículo:', err);
        setLoading(false);
      });
      return;
    }

    const storeParam = profile.store ? `?store=${encodeURIComponent(profile.store)}` : '';

    fetch(`${API_URL}/api/checklists${storeParam}`, {
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
      })
      .then(res => { handle401(res, navigate); return res.json(); })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          // Se houver um ID na URL, busca esse específico. Senão pega o primeiro.
          const cl = id ? data.find(c => String(c.id) === String(id)) : data[0];
          
          if (cl) {
            setCurrentChecklistId(cl.id);
            setTitle(cl.title);
            setRequireSelfie(cl.require_selfie || false);
            setCategory(cl.category || 'geral');
            setRequireSignature(cl.require_signature || false);
            
            if (cl.category === 'veiculo') {
              fetch(`${API_URL}/api/vehicles?store=${encodeURIComponent(profile.store)}`, {
                headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
              })
              .then(res => res.json())
              .then(vData => {
                if (Array.isArray(vData)) setVehicles(vData.filter(v => v.status === 'ativo'));
              })
              .catch(() => {});
            }
            
            if (cl.completedToday) {
              setCompletedTodayInfo(cl.completedBy);
              setSubmitted(true);
            }

            // Filtrar tarefas: se for admin/preview/impersonating, mostra todas. Se for funcionário, compara por e-mail ou nome (case-insensitive)
            const userEmail = (profile.email || '').toLowerCase();
            const userName = (profile.name || '').toLowerCase();
            const isAdminView = isPreview || isImpersonating || profile.role === 'admin' || profile.role === 'master';

            const myTasks = (cl.tasks || []).filter(t => {
              if (isAdminView) return true;
              if (!t.assignee || t.assignee === 'pendente' || t.assignee === 'todos' || t.assignee === '') return true;
              const assign = String(t.assignee).toLowerCase();
              return assign === userEmail || assign === userName;
            });

            setTasks(myTasks.map((t, idx) => ({ 
              ...t, 
              id: t.id || `task-${idx}`, 
              done: null, 
              photo: null, 
              photos: [],
              forceOverride: false 
            })));

            // Buscar os detalhes da submissão se já estiver concluído
            if (cl.completedToday) {
              fetch(`${API_URL}/api/submissions?store=${encodeURIComponent(profile.store)}`, {
                  headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
                })
                .then(res => { handle401(res, navigate); return res.json(); })
                .then(subs => {
                  const today = new Date().toISOString().split('T')[0];
                  const mySub = subs.find(s => s.checklist_id === cl.id && s.created_at.startsWith(today));
                  if (mySub) {
                    setTasks(mySub.tasks);
                    setAIFeedback(mySub.feedback_info || {});
                    setSelfie(mySub.selfie);
                  }
                });
            }
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erro ao buscar checklists:', err);
        setLoading(false);
      });
  }, [id, navigate]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // ─── Câmera ───────────────────────────────────────────
  const startCamera = async (taskId) => {
    try {
      setActiveCameraTaskId(taskId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      const constraintsList = [
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        { video: { facingMode: 'environment' } },
        { video: { facingMode: { ideal: 'user' } } },
        { video: true }
      ];

      let stream = null;
      for (const constraints of constraintsList) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stream) break;
        } catch (e) {
          continue;
        }
      }

      if (!stream) {
        throw new Error('Não foi possível obter a transmissão da câmera');
      }

      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err) {
      console.warn('Câmera WebRTC indisponível. Abrindo seletor nativo de arquivo/câmera:', err);
      setActiveCameraTaskId(null);
      const fileInput = document.getElementById(`file-input-${taskId}`);
      if (fileInput) {
        fileInput.click();
      } else {
        alert('Erro ao acessar a câmera ao vivo. Por favor, utilize o botão de selecionar foto.');
      }
    }
  };

  const handleFileUpload = (taskId, e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        const maxWidth = 800;
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((maxWidth / width) * height);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const photoUrl = canvas.toDataURL('image/jpeg', 0.6);
        setTasks(prev => prev.map(t => {
          if (t.id === taskId) {
            const currentPhotos = Array.isArray(t.photos) ? [...t.photos] : [];
            currentPhotos.push(photoUrl);
            return { ...t, photos: currentPhotos, photo: photoUrl, forceOverride: false };
          }
          return t;
        }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setActiveCameraTaskId(null);
  }, []);

  const takePhoto = async (taskId, taskText) => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current, canvas = canvasRef.current;
    const maxWidth = 800;
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (width > maxWidth) {
      height = Math.round((maxWidth / width) * height);
      width = maxWidth;
    }
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(video, 0, 0, width, height);
    const photoUrl = canvas.toDataURL('image/jpeg', 0.6);
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const currentPhotos = Array.isArray(t.photos) ? [...t.photos] : [];
        currentPhotos.push(photoUrl);
        return { ...t, photos: currentPhotos, photo: photoUrl, forceOverride: false };
      }
      return t;
    }));
    stopCamera();
  };

  const forceAcceptPhoto = (taskId) =>
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, forceOverride: true } : t));

  const handleBoolean = (id, value) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: value } : t));

  const handleRating = (id, stars) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: stars } : t));

  const handleNumeric = (id, value) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: value } : t));

  const handleMultiple = (id, option) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: option } : t));

  const handleText = (id, value) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: value } : t));

  const handleItemList = (taskId, itemIndex, checked) =>
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const checkedItems = Array.isArray(t.done) ? [...t.done] : [];
      if (checked) {
        if (!checkedItems.includes(itemIndex)) checkedItems.push(itemIndex);
      } else {
        const pos = checkedItems.indexOf(itemIndex);
        if (pos !== -1) checkedItems.splice(pos, 1);
      }
      return { ...t, done: checkedItems.length === (t.options || []).length && checkedItems.length > 0 ? checkedItems : checkedItems };
    }));

  const handleToggle = (id) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));

  // ─── Selfie de Conclusão ──────────────────────────────
  const takeSelfie = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current, canvas = canvasRef.current;
    const maxWidth = 600;
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (width > maxWidth) {
      height = Math.round((maxWidth / width) * height);
      width = maxWidth;
    }
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(video, 0, 0, width, height);
    const photoUrl = canvas.toDataURL('image/jpeg', 0.6);
    setSelfie(photoUrl);
    setShowSelfieModal(false);
    stopCamera();
  };

  const startSelfieCamera = async () => {
    try {
      setShowSelfieModal(true);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      const constraintsList = [
        { video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 } } },
        { video: { facingMode: 'user' } },
        { video: true }
      ];

      let stream = null;
      for (const constraints of constraintsList) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stream) break;
        } catch (e) {
          continue;
        }
      }

      if (stream) {
        streamRef.current = stream;
        setTimeout(() => {
          if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
        }, 100);
      }
    } catch {
      console.warn('Câmera frontal WebRTC indisponível. Utilize o envio por arquivo.');
    }
  };

  const handleSelfieFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        const maxWidth = 600;
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((maxWidth / width) * height);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const photoUrl = canvas.toDataURL('image/jpeg', 0.6);
        setSelfie(photoUrl);
        setShowSelfieModal(false);
        stopCamera();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ─── Funções de Desenho / Assinatura Canvas ───────────────────
  const startDrawing = (e) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';
    
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
    e.preventDefault();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature(null);
  };

  const saveSignature = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSignature(dataUrl);
    alert('🖋️ Assinatura capturada com sucesso!');
  };

  const handleFinish = async () => {
    if (isReadOnly) {
      alert('Modo de visualização. Não é possível submeter.');
      return;
    }
    if (shoppingListId) {
      const items = tasks.map(t => ({
        id: t.id,
        name: t.text,
        unit: t.unit || 'un',
        minStock: t.minStock !== undefined ? t.minStock : (t.minQuantity || 0),
        currentStock: t.done !== '' && t.done !== null && t.done !== undefined ? parseFloat(t.done) : 0
      }));
      const belowMinimum = items.filter(i => parseFloat(i.currentStock) < parseFloat(i.minStock));

      try {
        const res = await fetch(`${API_URL}/api/shopping/submit`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            shoppingListId: parseInt(shoppingListId),
            store: EMPLOYEE.store,
            employeeName: EMPLOYEE.name,
            items,
            belowMinimum
          })
        });
        if (res.ok) {
          setSubmitted(true);
        } else {
          alert('Erro ao enviar o checklist de compras.');
        }
      } catch (err) {
        console.error('Erro ao enviar checklist de compras:', err);
        alert('Erro de conexão ao enviar checklist de compras.');
      }
      return;
    }

    const pendingPhoto = tasks.filter(t => t.requirePhoto && (!t.photo && (!t.photos || t.photos.length === 0)));
    if (pendingPhoto.length > 0) {
      alert('Envie a foto de todas as tarefas obrigatórias antes de finalizar.'); return;
    }
    if (category === 'veiculo' && !selectedVehicleId) {
      alert('Selecione o veículo inspecionado antes de finalizar.'); return;
    }
    if (requireSignature && !signature) {
      alert('Por favor, assine digitalmente e confirme antes de finalizar.'); return;
    }
    if (requireSelfie && !selfie) {
      startSelfieCamera(); return;
    }
    
    const payload = { 
      employeeName: EMPLOYEE.name, 
      store: EMPLOYEE.store, 
      tasks, 
      feedbackInfo: aiFeedback, 
      selfie,
      checklistId: currentChecklistId,
      vehicleId: vehicleId ? parseInt(vehicleId) : (selectedVehicleId ? parseInt(selectedVehicleId) : null),
      signature,
      startedAt
    };

    try {
      const res = await fetch(`${API_URL}/api/finalize`, {
        method: 'POST', 
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setSubmitted(true);
        // Dispara a IA em background com retry resiliente (fire and forget)
        if (data.id) {
          const auditWithRetry = async (attempt = 1) => {
            try {
              const res2 = await fetch(`${API_URL}/api/process-audit-background`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ submissionId: data.id })
              });
              const result = await res2.json();
              if (!result.success && attempt < 3) {
                console.log(`[Audit] Tentativa ${attempt} falhou, retentando em 5s...`);
                setTimeout(() => auditWithRetry(attempt + 1), 5000);
              }
            } catch (e) {
              console.error(`[Audit] Erro tentativa ${attempt}:`, e);
              if (attempt < 3) setTimeout(() => auditWithRetry(attempt + 1), 5000);
            }
          };
          auditWithRetry();
          // Safety net: aciona auto-processador após 30s como garantia final
          setTimeout(() => {
            fetch(`${API_URL}/api/auto-process-pending`, {
              headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
            }).catch(() => {});
          }, 30000);
        }
      } else {
        const errData = await res.json();
        if (errData.quota_exceeded) {
          alert('⚠️ Sua empresa atingiu o limite de checklists do plano deste mês. Fale com o seu gerente para fazer upgrade.');
        } else {
          alert(errData.message || errData.error || 'Erro ao enviar.');
        }
      }
    } catch (e) { 
      // MODO OFFLINE
      const offlineQueue = JSON.parse(localStorage.getItem('firecheck_offline_queue') || '[]');
      offlineQueue.push({
        ...payload,
        offline: true,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('firecheck_offline_queue', JSON.stringify(offlineQueue));
      setSubmitted(true);
      alert('📡 Checklist salvo localmente! Você está sem internet. Os dados serão enviados automaticamente assim que você se reconectar.');
    }
  };

  const completedCount = tasks.filter(t => {
    if (t.type === 'itemlist') return Array.isArray(t.done) && t.done.length > 0;
    return t.done !== null && t.done !== false && t.done !== '';
  }).length;
  const progress = Math.round((completedCount / (tasks.length || 1)) * 100);

  // Redirecionamento automático após sucesso
  useEffect(() => {
    if (submitted && !completedTodayInfo) {
      const timer = setTimeout(() => {
        navigate('/funcionario');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [submitted, completedTodayInfo, navigate]);

  if (submitted) return (
    <div className="page-container" style={{ maxWidth: '600px', textAlign: 'center', paddingTop: '80px' }}>
      <Trophy size={80} color="var(--primary)" style={{ marginBottom: '24px' }} />
      <h1 style={{ fontSize: '2rem', marginBottom: '12px' }}>
        {completedTodayInfo ? 'Checklist Concluído!' : 'Checklist Enviado!'}
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
        {completedTodayInfo 
          ? `Este checklist já foi realizado hoje por ${completedTodayInfo}.` 
          : `Parabéns, ${EMPLOYEE.name}! O seu checklist foi registrado com sucesso.`
        }
      </p>
      {selfie && <img src={selfie} alt="Selfie de Conclusão" style={{ border: '4px solid var(--primary)', borderRadius: '12px', maxWidth: '300px', marginBottom: '24px', boxShadow: '0 8px 32px rgba(255, 69, 0, 0.2)' }} />}
      
      <div style={{ marginBottom: '24px' }}>
        <button 
          className="btn-secondary" 
          style={{ width: '100%', marginBottom: '12px', padding: '12px' }}
          onClick={() => setShowSummary(!showSummary)}
        >
          {showSummary ? 'Ocultar Detalhes' : 'Ver Detalhes do Envio'}
        </button>

        {showSummary && (
          <div className="animate-fade" style={{ textAlign: 'left', backgroundColor: 'var(--bg-color)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)', maxHeight: '400px', overflowY: 'auto' }}>
            {tasks.map((task, idx) => (
              <div key={idx} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '8px', fontWeight: 'bold' }}>{idx + 1}. {task.text}</p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', backgroundColor: task.done === true ? 'var(--success)' : 'var(--error)', color: 'var(--text-main)', padding: '2px 8px', borderRadius: '4px' }}>
                    {task.done === true ? 'Sim' : task.done === false ? 'Não' : task.done || 'Não respondido'}
                  </span>
                  {aiFeedback[task.id] && (
                    <span style={{ fontSize: '0.75rem', color: aiFeedback[task.id].status === 'success' ? 'var(--success)' : 'var(--warning)' }}>
                      {aiFeedback[task.id].status === 'success' ? '✓ Auditado' : '⚠ Atenção'}
                    </span>
                  )}
                </div>
                {task.photo && <img src={task.photo} alt="Evidência" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '6px', marginTop: '8px', border: '1px solid var(--border-color)' }} />}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '16px', backgroundColor: 'var(--bg-color)', borderRadius: '12px' }}>
        <p style={{ color: 'var(--success)', fontWeight: 'bold' }}>✅ Tarefas encerradas para este turno.</p>
        {!completedTodayInfo && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>Retornando em 5 segundos...</p>}
      </div>
      <button className="btn" style={{ marginTop: '24px', width: '100%', padding: '16px' }} onClick={() => navigate('/funcionario')}>
         Voltar para a Lista
      </button>
    </div>
  );

  return (
    <div className="page-container" style={{ maxWidth: '600px' }}>
      {isPreview && (
        <div style={{
          backgroundColor: '#2563eb',
          color: 'white',
          padding: '12px 18px',
          borderRadius: '12px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          fontWeight: 'bold',
          fontSize: '0.88rem',
          boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>👁️</span>
            <span>Modo Preview — Visualizando como o funcionário vê este checklist</span>
          </div>
          <button
            onClick={() => navigate('/admin')}
            style={{
              backgroundColor: '#ffffff',
              color: '#2563eb',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
            }}
          >
            <ArrowLeft size={16} color="#2563eb" /> Voltar ao Painel
          </button>
        </div>
      )}

      {isImpersonating && (
        <div style={{
          backgroundColor: '#2563eb',
          color: 'white',
          padding: '12px 18px',
          borderRadius: '12px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          fontWeight: 'bold',
          fontSize: '0.88rem',
          boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>👁️</span>
            <span>Acessando como: <strong>{EMPLOYEE.name}</strong></span>
          </div>
          <button
            onClick={handleReturnToAdmin}
            style={{
              backgroundColor: '#ffffff',
              color: '#2563eb',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
            }}
          >
            <ShieldAlert size={16} color="#2563eb" /> Voltar ao Painel do Administrador
          </button>
        </div>
      )}

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
           <div style={{ backgroundColor: 'var(--primary)', padding: '6px', borderRadius: '6px' }}>
              <Flame size={18} color="white" />
           </div>
           <h2 style={{ fontSize: '1.2rem', margin: 0 }}>FireCheck Pro</h2>
        </div>
        <button onClick={() => navigate('/funcionario')} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 'bold' }}>
           <ArrowLeft size={16} /> Voltar
        </button>
      </header>

      <header style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 className="page-title" style={{ marginBottom: '4px', fontSize: '1.5rem' }}>{title}</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Responsável: {EMPLOYEE.name}</p>
        
        {category === 'veiculo' && !completedTodayInfo && !vehicleId && (
          <div className="card" style={{ padding: '16px', marginBottom: '20px', border: '1px solid var(--primary)' }}>
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 'bold' }}>
              🚗 Veículo Inspecionado
            </label>
            <select 
              className="input-field" 
              value={selectedVehicleId} 
              onChange={e => setSelectedVehicleId(e.target.value)}
              disabled={isReadOnly}
              style={{ marginTop: '8px' }}
            >
              <option value="">-- Selecione o Veículo (Placa) --</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.model} ({v.plate})</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ backgroundColor: '#1A1C23', borderRadius: '100px', height: '8px', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', backgroundColor: progress === 100 ? 'var(--success)' : 'var(--primary)', transition: 'width 0.4s ease' }} />
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>{completedCount}/{tasks.length} tarefas concluídas ({progress}%)</p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {tasks.map((task, index) => {
          const isDone = task.done !== null && task.done !== false && task.done !== '';
          const prevTask = index > 0 ? tasks[index - 1] : null;
          const showSectionHeader = task.section && (!prevTask || prevTask.section !== task.section);
          
          return (
            <div key={task.id}>
              {showSectionHeader && (
                <div style={{ margin: '24px 0 12px 0', padding: '10px 14px', backgroundColor: 'rgba(59, 130, 246, 0.08)', borderLeft: '3px solid var(--primary)', borderRadius: '0 8px 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1rem' }}>📁</span>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 'bold' }}>
                    Seção: {task.section}
                  </h4>
                </div>
              )}
              <div className="card" style={{ padding: '20px', borderLeft: isDone ? '4px solid var(--success)' : '4px solid var(--border-color)', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{index + 1}. {task.text}</span>
                  {isDone && <CheckCircle size={20} color="var(--success)" />}
                </h3>

              {task.type === 'boolean' && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <button className="btn" style={{ flex: 1, backgroundColor: task.done === true ? 'var(--success)' : 'transparent', border: '1px solid var(--success)', color: task.done === true ? 'white' : 'var(--success)', boxShadow: 'none' }} onClick={() => handleBoolean(task.id, true)} disabled={isReadOnly}>Sim</button>
                  <button className="btn" style={{ flex: 1, backgroundColor: task.done === false ? 'var(--error)' : 'transparent', border: '1px solid var(--error)', color: task.done === false ? 'white' : 'var(--error)', boxShadow: 'none' }} onClick={() => handleBoolean(task.id, false)} disabled={isReadOnly}>Não</button>
                </div>
              )}

              {(task.type === 'check' || task.type === 'toggle') && (
                <button
                  className="btn animate-scale"
                  style={{
                    width: '100%',
                    backgroundColor: task.done === true ? 'var(--success)' : 'transparent',
                    border: '1px solid var(--border-color)',
                    color: task.done === true ? 'white' : 'var(--text-muted)',
                    boxShadow: 'none',
                    padding: '12px',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onClick={() => handleToggle(task.id)}
                  disabled={isReadOnly}
                >
                  <CheckCircle size={18} /> {task.done === true ? 'Feito' : 'Marcar como Feito'}
                </button>
              )}

              {task.type === 'rating' && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', justifyContent: 'center', backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  {[1, 2, 3, 4, 5].map(stars => (
                    <button
                      key={stars}
                      type="button"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                      onClick={() => handleRating(task.id, stars)}
                      disabled={isReadOnly}
                    >
                      <Star
                        size={32}
                        fill={stars <= (task.done || 0) ? 'var(--primary)' : 'none'}
                        color={stars <= (task.done || 0) ? 'var(--primary)' : 'var(--text-muted)'}
                      />
                    </button>
                  ))}
                </div>
              )}

              {(task.type === 'stock' || task.type === 'numeric' || task.minStock !== undefined || task.minQuantity !== undefined || task.maxQuantity !== undefined) && (
                <div style={{ marginBottom: '12px' }}>
                  {/* Banner de Limites Mínimo/Máximo TRAVADOS */}
                  {(task.minStock !== undefined || task.minQuantity !== undefined || task.maxQuantity !== undefined) && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'rgba(15, 23, 42, 0.05)',
                      border: '1px solid var(--border-color)',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      marginBottom: '10px',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '1rem' }}>🔒</span> Limites Configurados:
                      </span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {(task.minStock !== undefined && task.minStock !== '' || task.minQuantity !== undefined && task.minQuantity !== '') && (
                          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary)', backgroundColor: 'var(--bg-card)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                            Min: {task.minStock !== undefined && task.minStock !== '' ? task.minStock : task.minQuantity} {task.unit || 'un'}
                          </span>
                        )}
                        {task.maxQuantity !== undefined && task.maxQuantity !== '' && (
                          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#7c3aed', backgroundColor: 'var(--bg-card)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                            Max: {task.maxQuantity} {task.unit || 'un'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Input do valor/quantidade */}
                  <label className="input-label" style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600' }}>
                    {task.type === 'stock' ? 'Informe a Quantidade Apurada:' : 'Informe o Valor Numérico:'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="input-field"
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold' }}
                    value={task.done !== null && task.done !== undefined ? task.done : ''}
                    onChange={e => handleNumeric(task.id, e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder={`Digite a quantidade em ${task.unit || 'un'}...`}
                    disabled={isReadOnly}
                  />

                  {/* Feedback dinâmico de Validação */}
                  {task.done !== '' && task.done !== null && task.done !== undefined && (() => {
                    const current = parseFloat(task.done);
                    const hasMin = (task.minStock !== undefined && task.minStock !== '') || (task.minQuantity !== undefined && task.minQuantity !== '');
                    const minVal = parseFloat(task.minStock !== undefined && task.minStock !== '' ? task.minStock : (task.minQuantity || 0));
                    const hasMax = task.maxQuantity !== undefined && task.maxQuantity !== '';
                    const maxVal = parseFloat(task.maxQuantity || 0);

                    if (hasMin && current < minVal) {
                      const diff = (minVal - current).toFixed(1);
                      return (
                        <div style={{ marginTop: '8px', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                          <AlertCircle size={16} />
                          <span>⚠️ Abaixo do Mínimo! Faltam <strong>{diff} {task.unit || 'un'}</strong> para o estoque/quantidade ideal.</span>
                        </div>
                      );
                    } else if (hasMax && current > maxVal) {
                      const excess = (current - maxVal).toFixed(1);
                      return (
                        <div style={{ marginTop: '8px', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', color: '#b45309', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                          <AlertCircle size={16} />
                          <span>⚠️ Acima do Máximo! Excesso de <strong>{excess} {task.unit || 'un'}</strong> em relação ao limite.</span>
                        </div>
                      );
                    } else if (hasMin || hasMax) {
                      return (
                        <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22c55e', color: '#22c55e', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle size={14} />
                          <span>Quantidade em conformidade (OK).</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              {task.type === 'multiple' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                  {(task.options || []).map((opt, idx) => {
                    const isSelected = task.done === opt;
                    return (
                      <button
                        key={idx}
                        className="btn-secondary"
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '12px 16px',
                          borderRadius: '8px',
                          border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: isSelected ? 'rgba(255, 69, 0, 0.1)' : 'transparent',
                          color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                          fontWeight: isSelected ? 'bold' : 'normal',
                          boxShadow: 'none'
                        }}
                        onClick={() => handleMultiple(task.id, opt)}
                        disabled={isReadOnly}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {task.type === 'text' && (
                <div style={{ marginBottom: '8px' }}>
                  <textarea
                    className="input-field"
                    style={{ width: '100%', minHeight: '80px', padding: '12px', borderRadius: '8px', resize: 'vertical' }}
                    value={task.done !== null && task.done !== undefined ? task.done : ''}
                    onChange={e => handleText(task.id, e.target.value)}
                    placeholder="Escreva sua resposta..."
                    disabled={isReadOnly}
                  />
                </div>
              )}

              {task.type === 'itemlist' && (
                <div style={{ marginBottom: '8px' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    Marque cada item que foi conferido:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(task.options || []).map((item, idx) => {
                      const checkedItems = Array.isArray(task.done) ? task.done : [];
                      const isChecked = checkedItems.includes(idx);
                      return (
                        <label
                          key={idx}
                          onClick={() => !isReadOnly && handleItemList(task.id, idx, !isChecked)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 14px',
                            borderRadius: '8px',
                            border: isChecked ? '1.5px solid var(--success)' : '1px solid var(--border-color)',
                            backgroundColor: isChecked ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-color)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            userSelect: 'none',
                          }}
                        >
                          <div style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '6px',
                            border: isChecked ? '2px solid var(--success)' : '2px solid var(--border-color)',
                            backgroundColor: isChecked ? 'var(--success)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            transition: 'all 0.15s ease',
                          }}>
                            {isChecked && (
                              <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                                <path d="M1 4.5L4.5 8.5L12 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                          <span style={{
                            fontSize: '0.95rem',
                            color: isChecked ? 'var(--text-main)' : 'var(--text-muted)',
                            fontWeight: isChecked ? '600' : 'normal',
                            textDecoration: isChecked ? 'none' : 'none',
                            flex: 1,
                          }}>
                            {item}
                          </span>
                          {isChecked && (
                            <CheckCircle size={16} color="var(--success)" style={{ flexShrink: 0 }} />
                          )}
                        </label>
                      );
                    })}
                  </div>
                  {(task.options || []).length > 0 && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '10px', textAlign: 'right' }}>
                      {Array.isArray(task.done) ? task.done.length : 0}/{task.options.length} itens conferidos
                    </p>
                  )}
                </div>
              )}

              {task.requirePhoto && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontSize: '0.9rem', fontWeight: 'bold' }}>
                      <AlertTriangle size={16} /> Obrigatório: Foto ao vivo ({Array.isArray(task.photos) ? task.photos.length : (task.photo ? 1 : 0)}/{task.maxPhotos || 1})
                    </div>
                  </div>

                  {/* Grid de Fotos Existentes */}
                  {((task.photos && task.photos.length > 0) || task.photo) && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                      {(task.photos || (task.photo ? [task.photo] : [])).map((pic, pIdx) => (
                        <div key={pIdx} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                          <img src={pic} alt={`Foto ${pIdx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          {!completedTodayInfo && (
                            <button
                              style={{ position: 'absolute', top: 5, right: 5, padding: '4px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.7)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={() => {
                                setTasks(prev => prev.map(t => {
                                  if (t.id === task.id) {
                                    const nextPhotos = (t.photos || []).filter((_, i) => i !== pIdx);
                                    return { ...t, photos: nextPhotos, photo: nextPhotos[nextPhotos.length - 1] || null };
                                  }
                                  return t;
                                }));
                              }}
                              disabled={isReadOnly}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Câmera Ativa */}
                  {activeCameraTaskId === task.id ? (
                    <div style={{ width: '100%', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                      <video ref={videoRef} style={{ width: '100%', maxHeight: '400px', objectFit: 'cover' }} autoPlay playsInline></video>
                      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                      <div style={{ display: 'flex', gap: '8px', padding: '16px', position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
                        <button className="btn" style={{ flex: 2, backgroundColor: '#ffffff', color: '#18181B', fontWeight: 'bold', boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }} onClick={() => takePhoto(task.id, task.text)}>
                          <Camera size={20} /> Capturar Foto {(task.photos || []).length + 1}
                        </button>
                        <button className="btn-secondary" style={{ flex: 1, backgroundColor: 'var(--bg-card)', border: 'none', color: 'var(--text-main)' }} onClick={stopCamera}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Botão para Tirar Foto (só se não atingiu o limite de maxPhotos)
                    (!task.photos || task.photos.length < (task.maxPhotos || 1)) && !completedTodayInfo && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                        <input 
                          type="file" 
                          id={`file-input-${task.id}`} 
                          accept="image/*" 
                          capture="environment" 
                          onChange={(e) => handleFileUpload(task.id, e)} 
                          style={{ display: 'none' }} 
                          disabled={isReadOnly}
                        />
                        
                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                          <button 
                            className="btn btn-pulse animate-fade" 
                            style={{ flex: 2, backgroundColor: 'rgba(255, 69, 0, 0.1)', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '14px', fontSize: '0.95rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', borderRadius: '12px', transition: 'all 0.2s ease', fontWeight: '600' }} 
                            onClick={() => startCamera(task.id)}
                            disabled={isReadOnly}
                          >
                            <Camera size={20} /> Câmera ao Vivo
                          </button>

                          <button 
                            className="btn-secondary" 
                            style={{ flex: 1, padding: '14px', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', borderRadius: '12px' }} 
                            onClick={() => document.getElementById(`file-input-${task.id}`)?.click()}
                            disabled={isReadOnly}
                          >
                            <Camera size={16} /> Câmera Nativa
                          </button>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                          Foto {(task.photos || []).length + 1} de {task.maxPhotos || 1}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
      </div>

      {showSelfieModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Camera size={20} color="var(--primary)" /> Selfie de Conclusão
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Sorria! Precisamos de uma foto sua para finalizar.</p>
            </div>
            
            <input 
              type="file" 
              id="selfie-file-input" 
              accept="image/*" 
              capture="user" 
              onChange={handleSelfieFileUpload} 
              style={{ display: 'none' }} 
            />

            <div style={{ width: '100%', backgroundColor: '#000', position: 'relative', aspectRatio: '3/4' }}>
              <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} autoPlay playsInline></video>
              <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
            </div>

            <div style={{ padding: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { stopCamera(); setShowSelfieModal(false); }}>Cancelar</button>
              <button className="btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }} onClick={() => document.getElementById('selfie-file-input')?.click()}>
                <Camera size={16} /> Câmera Nativa
              </button>
              <button className="btn" style={{ flex: 2 }} onClick={takeSelfie}>Capturar e Finalizar</button>
            </div>
          </div>
        </div>
      )}

      {requireSignature && !completedTodayInfo && (
        <div className="card" style={{ padding: '20px', marginTop: '24px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
            🖋️ Assinatura Digital Obrigatória
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Assine no quadro abaixo usando o seu dedo ou caneta:
          </p>
          <div style={{ position: 'relative', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#FFFFFF', height: '150px' }}>
            <canvas
              ref={sigCanvasRef}
              width="500"
              height="150"
              style={{ width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none' }}
              onMouseDown={!isReadOnly ? startDrawing : undefined}
              onMouseMove={!isReadOnly ? draw : undefined}
              onMouseUp={!isReadOnly ? stopDrawing : undefined}
              onMouseLeave={!isReadOnly ? stopDrawing : undefined}
              onTouchStart={!isReadOnly ? startDrawing : undefined}
              onTouchMove={!isReadOnly ? draw : undefined}
              onTouchEnd={!isReadOnly ? stopDrawing : undefined}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
            <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={clearSignature} disabled={isReadOnly}>
              Limpar
            </button>
            <button className="btn" style={{ padding: '6px 12px', fontSize: '0.85rem', backgroundColor: signature ? 'var(--success)' : 'var(--primary)', color: 'white', border: 'none' }} onClick={saveSignature} disabled={isReadOnly}>
              {signature ? '✓ Assinatura Confirmada' : 'Confirmar Assinatura'}
            </button>
          </div>
        </div>
      )}

      <button className="btn" style={{ width: '100%', marginTop: '32px', padding: '16px' }} onClick={handleFinish} disabled={isReadOnly}>
        {isReadOnly ? '🔒 Somente visualização' : (requireSelfie && !selfie ? <><Camera size={20} /> Tirar Selfie e Finalizar</> : <><CheckCircle size={20} /> Finalizar e Enviar</>)}
      </button>

    </div>
  );
}
