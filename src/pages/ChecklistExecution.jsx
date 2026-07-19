import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera, CheckCircle, AlertTriangle, Send, X, AlertCircle, Star, PenLine, FileText, Trophy, LogOut, Flame } from 'lucide-react';
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
  const { id } = useParams();
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('Carregando...');
  
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

  // Carregar checklists da loja
  useEffect(() => {
    setTasks([]);
    const profile = JSON.parse(localStorage.getItem('user') || '{}');
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

            // Filtrar apenas tarefas para "equipe toda" ou para este usuário específico
            const myTasks = cl.tasks.filter(t => !t.assignee || t.assignee === 'pendente' || t.assignee === profile.email);

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
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
    } catch {
      alert('Erro ao acessar a câmera.');
      setActiveCameraTaskId(null);
    }
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
    
    // A auditoria em tempo real foi removida daqui para não bloquear o funcionário.
    // A foto é apenas salva e o checklist pode ser enviado instantaneamente.
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
      // done = array de índices marcados; se todos marcados, também deixa verdadeiro para contar progresso
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
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      }, 100);
    } catch {
      alert('Erro ao acessar a câmera frontal.');
      setShowSelfieModal(false);
    }
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
      vehicleId: selectedVehicleId ? parseInt(selectedVehicleId) : null,
      signature
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
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
           <div style={{ backgroundColor: 'var(--primary)', padding: '6px', borderRadius: '6px' }}>
              <Flame size={18} color="white" />
           </div>
           <h2 style={{ fontSize: '1.2rem', margin: 0 }}>FireCheck Pro</h2>
        </div>
        <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 'bold' }}>
           Sair <LogOut size={16} />
        </button>
      </header>

      <header style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 className="page-title" style={{ marginBottom: '4px', fontSize: '1.5rem' }}>{title}</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Responsável: {EMPLOYEE.name}</p>
        
        {category === 'veiculo' && !completedTodayInfo && (
          <div className="card" style={{ padding: '16px', marginBottom: '20px', border: '1px solid var(--primary)' }}>
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 'bold' }}>
              🚗 Veículo Inspecionado
            </label>
            <select 
              className="input-field" 
              value={selectedVehicleId} 
              onChange={e => setSelectedVehicleId(e.target.value)}
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
                </h3>e: '1rem', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{index + 1}. {task.text}</span>
                {isDone && <CheckCircle size={20} color="var(--success)" />}
              </h3>

              {task.type === 'boolean' && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <button className="btn" style={{ flex: 1, backgroundColor: task.done === true ? 'var(--success)' : 'transparent', border: '1px solid var(--success)', color: task.done === true ? 'white' : 'var(--success)', boxShadow: 'none' }} onClick={() => handleBoolean(task.id, true)}>Sim</button>
                  <button className="btn" style={{ flex: 1, backgroundColor: task.done === false ? 'var(--error)' : 'transparent', border: '1px solid var(--error)', color: task.done === false ? 'white' : 'var(--error)', boxShadow: 'none' }} onClick={() => handleBoolean(task.id, false)}>Não</button>
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

              {task.type === 'numeric' && (
                <div style={{ marginBottom: '8px' }}>
                  <input
                    type="number"
                    className="input-field"
                    style={{ width: '100%', padding: '12px', borderRadius: '8px' }}
                    value={task.done !== null && task.done !== undefined ? task.done : ''}
                    onChange={e => handleNumeric(task.id, e.target.value === '' ? null : parseFloat(e.target.value))}
                    placeholder="Insira o valor numérico..."
                  />
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
                          onClick={() => handleItemList(task.id, idx, !isChecked)}
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
                      <button 
                        className="btn btn-pulse animate-fade" 
                        style={{ width: '100%', backgroundColor: 'rgba(255, 69, 0, 0.1)', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '16px', fontSize: '1.05rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', borderRadius: '12px', transition: 'all 0.2s ease' }} 
                        onClick={(e) => {
                           startCamera(task.id);
                        }}
                      >
                        <Camera size={22} /> Tirar Foto {(task.photos || []).length + 1} de {task.maxPhotos || 1}
                      </button>
                    )
                  )}
                </div>
              )}
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
            
            <div style={{ width: '100%', backgroundColor: '#000', position: 'relative', aspectRatio: '3/4' }}>
              <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} autoPlay playsInline></video>
              <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
            </div>

            <div style={{ padding: '20px', display: 'flex', gap: '12px' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { stopCamera(); setShowSelfieModal(false); }}>Cancelar</button>
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
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
            <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={clearSignature}>
              Limpar
            </button>
            <button className="btn" style={{ padding: '6px 12px', fontSize: '0.85rem', backgroundColor: signature ? 'var(--success)' : 'var(--primary)', color: 'white', border: 'none' }} onClick={saveSignature}>
              {signature ? '✓ Assinatura Confirmada' : 'Confirmar Assinatura'}
            </button>
          </div>
        </div>
      )}

      <button className="btn" style={{ width: '100%', marginTop: '32px', padding: '16px' }} onClick={handleFinish}>
        {requireSelfie && !selfie ? <><Camera size={20} /> Tirar Selfie e Finalizar</> : <><CheckCircle size={20} /> Finalizar e Enviar</>}
      </button>

    </div>
  );
}
