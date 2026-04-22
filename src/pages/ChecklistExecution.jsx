import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CheckCircle, AlertTriangle, Send, X, AlertCircle, Star, PenLine, FileText, Trophy, LogOut, Flame } from 'lucide-react';
import API_URL from '../api';

export default function ChecklistExecution() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('Carregando...');
  
  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const [activeCameraTaskId, setActiveCameraTaskId] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiFeedback, setAIFeedback] = useState({});
  const [userProfile, setUserProfile] = useState(null);

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

  // Carregar checklists da loja
  useEffect(() => {
    setTasks([]);
    const profile = JSON.parse(localStorage.getItem('user') || '{}');
    const storeParam = profile.store ? `?store=${encodeURIComponent(profile.store)}` : '';

    fetch(`${API_URL}/api/checklists${storeParam}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const cl = data[0];
          setCurrentChecklistId(cl.id);
          setTitle(cl.title);
          
          if (cl.completedToday) {
            setCompletedTodayInfo(cl.completedBy);
            setSubmitted(true);
          }

          setTasks(cl.tasks.map((t, idx) => ({ 
            ...t, 
            id: t.id || `task-${idx}`, 
            done: null, 
            photo: null, 
            forceOverride: false 
          })));
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erro ao buscar checklists:', err);
        setLoading(false);
      });
  }, []);

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
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const photoUrl = canvas.toDataURL('image/jpeg', 0.7);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, photo: photoUrl, forceOverride: false } : t));
    stopCamera();
    setAIFeedback(prev => ({ ...prev, [taskId]: { status: 'loading' } }));
    try {
      const res = await fetch(`${API_URL}/api/audit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, taskText, photoBase64: photoUrl })
      });
      const data = await res.json();
      setAIFeedback(prev => ({ ...prev, [taskId]: { status: data.approved ? 'success' : 'warning', message: data.message } }));
    } catch {
      setAIFeedback(prev => ({ ...prev, [taskId]: { status: 'error', message: 'Erro ao conectar com IA.' } }));
    }
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

  const handleToggle = (id) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));

  // ─── Selfie de Conclusão ──────────────────────────────
  const takeSelfie = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current, canvas = canvasRef.current;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const photoUrl = canvas.toDataURL('image/jpeg', 0.7);
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

  const handleFinish = async () => {
    const pendingPhoto = tasks.filter(t => t.requirePhoto && !t.photo);
    if (pendingPhoto.length > 0) {
      alert('Envie a foto de todas as tarefas obrigatórias antes de finalizar.'); return;
    }
    if (!selfie) {
      startSelfieCamera(); return;
    }
    try {
      const res = await fetch(`${API_URL}/api/finalize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          employeeName: EMPLOYEE.name, 
          store: EMPLOYEE.store, 
          tasks, 
          feedbackInfo: aiFeedback, 
          selfie,
          checklistId: currentChecklistId
        })
      });
      if (res.ok) setSubmitted(true);
      else {
        const errData = await res.json();
        alert(errData.message || 'Erro ao enviar.');
      }
    } catch { alert('Erro ao conectar com o servidor.'); }
  };

  const completedCount = tasks.filter(t => t.done !== null && t.done !== false && t.done !== '').length;
  const progress = Math.round((completedCount / (tasks.length || 1)) * 100);

  // Redirecionamento automático após sucesso
  useEffect(() => {
    if (submitted && !completedTodayInfo) {
      const timer = setTimeout(() => {
        window.location.reload();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [submitted, completedTodayInfo]);

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
      <div style={{ padding: '16px', backgroundColor: '#121318', borderRadius: '12px' }}>
        <p style={{ color: 'var(--success)', fontWeight: 'bold' }}>✅ Tarefas encerradas para este turno.</p>
        {!completedTodayInfo && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>Retornando em 5 segundos...</p>}
      </div>
      <button className="btn" style={{ marginTop: '24px', width: '100%', padding: '16px' }} onClick={() => window.location.reload()}>
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
        <div style={{ backgroundColor: '#1A1C23', borderRadius: '100px', height: '8px', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', backgroundColor: progress === 100 ? 'var(--success)' : 'var(--primary)', transition: 'width 0.4s ease' }} />
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>{completedCount}/{tasks.length} tarefas concluídas ({progress}%)</p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {tasks.map((task, index) => {
          const isDone = task.done !== null && task.done !== false && task.done !== '';
          return (
            <div key={task.id} className="card" style={{ padding: '20px', borderLeft: isDone ? '4px solid var(--success)' : '4px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{index + 1}. {task.text}</span>
                {isDone && <CheckCircle size={20} color="var(--success)" />}
              </h3>

              {task.type === 'boolean' && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <button className="btn" style={{ flex: 1, backgroundColor: task.done === true ? 'var(--success)' : 'transparent', border: '1px solid var(--success)', color: task.done === true ? 'white' : 'var(--success)', boxShadow: 'none' }} onClick={() => handleBoolean(task.id, true)}>Sim</button>
                  <button className="btn" style={{ flex: 1, backgroundColor: task.done === false ? 'var(--error)' : 'transparent', border: '1px solid var(--error)', color: task.done === false ? 'white' : 'var(--error)', boxShadow: 'none' }} onClick={() => handleBoolean(task.id, false)}>Não</button>
                </div>
              )}

              {task.requirePhoto && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '12px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                    <AlertTriangle size={16} /> Obrigatório: Foto ao vivo
                  </div>
                  {task.photo ? (
                    <div style={{ position: 'relative' }}>
                      <img src={task.photo} alt="Foto" style={{ width: '100%', borderRadius: '8px', maxHeight: '300px', objectFit: 'cover' }} />
                      <button style={{ position: 'absolute', top: 10, right: 10, padding: '8px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.7)', border: 'none', color: 'white' }}
                        onClick={() => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, photo: null } : t))}>
                        <X size={16} />
                      </button>

                      {/* Feedback da Auditoria (IA) */}
                      {aiFeedback[task.id] && !task.forceOverride && (
                        <div style={{ 
                          marginTop: '12px', 
                          padding: '16px', 
                          borderRadius: '8px', 
                          backgroundColor: aiFeedback[task.id].status === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          border: `1px solid ${aiFeedback[task.id].status === 'success' ? 'var(--success)' : 'var(--warning)'}`
                        }}>
                          <p style={{ 
                            fontSize: '0.9rem', 
                            color: aiFeedback[task.id].status === 'success' ? 'var(--success)' : 'var(--warning)',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginBottom: '4px'
                          }}>
                            {aiFeedback[task.id].status === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                            {aiFeedback[task.id].status === 'success' ? 'Auditado com Sucesso' : 'Atenção na Auditoria'}
                          </p>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                            {aiFeedback[task.id].message || 'Análise concluída.'}
                          </p>
                          
                          {aiFeedback[task.id].status !== 'success' && (
                            <button 
                              className="btn" 
                              style={{ width: '100%', backgroundColor: 'var(--warning)', color: 'black', fontSize: '0.8rem', padding: '10px' }}
                              onClick={() => forceAcceptPhoto(task.id)}
                            >
                              Desejo Enviar Assim Mesmo
                            </button>
                          )}
                        </div>
                      )}

                      {task.forceOverride && (
                        <div style={{ marginTop: '12px', padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px dashed var(--text-muted)' }}>
                           <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>✓ Foto enviada com justificativa de override.</p>
                        </div>
                      )}
                    </div>
                  ) : activeCameraTaskId === task.id ? (
                    <div style={{ width: '100%', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                      <video ref={videoRef} style={{ width: '100%', maxHeight: '400px', objectFit: 'cover' }} autoPlay playsInline></video>
                      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                      <div style={{ display: 'flex', gap: '8px', padding: '16px', position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
                        <button className="btn" style={{ flex: 2, backgroundColor: 'white', color: 'black' }} onClick={() => takePhoto(task.id, task.text)}>
                          <Camera size={20} /> Capturar
                        </button>
                        <button className="btn-secondary" style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', color: 'white' }} onClick={stopCamera}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button className="btn" style={{ width: '100%', backgroundColor: '#1A1C23', border: '1px dashed var(--primary)', color: 'var(--primary)', boxShadow: 'none' }} onClick={() => startCamera(task.id)}>
                      <Camera size={20} /> Ligar Câmera para Comprovar
                    </button>
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

      <button className="btn" style={{ width: '100%', marginTop: '32px', padding: '16px' }} onClick={handleFinish}>
        {selfie ? <><CheckCircle size={20} /> Finalizar e Enviar</> : <><Camera size={20} /> Tirar Selfie e Finalizar</>}
      </button>

    </div>
  );
}
