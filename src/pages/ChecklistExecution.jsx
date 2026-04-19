import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, CheckCircle, AlertTriangle, Send, X, AlertCircle, Star, PenLine, FileText, Trophy } from 'lucide-react';
import API_URL from '../api';

// Dados simulados do checklist com todos os tipos de resposta
export default function ChecklistExecution() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('Carregando...');
  const [loading, setLoading] = useState(true);
  const [aiFeedback, setAIFeedback] = useState({});
  const [activeCameraTaskId, setActiveCameraTaskId] = useState(null);
  const [signature, setSignature] = useState(null);
  const [showSignature, setShowSignature] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Carregar exemplos profissionais instantaneamente para o simulador
  useEffect(() => {
    // Simulador começa com exemplos reais de varejo
    setTitle('Checklist de Abertura - Loja Modelo');
    setTasks([
      { id: 1, text: 'Limpeza do Salão: O chão está brilhando e sem resíduos?', type: 'camera', required: true },
      { id: 2, text: 'Reposição: Gôndolas de bebidas estão com frentes preenchidas?', type: 'boolean', required: true },
      { id: 3, text: 'Segurança Alimentar: Temperatura do freezer de carnes (Ideal: -18°C)', type: 'numeric', required: true },
      { id: 4, text: 'Exposição: Avalie a organização das frutas na banca central', type: 'rating', required: true },
      { id: 5, text: 'Higiene: Funcionário está com uniforme e rede de cabelo?', type: 'camera', required: true }
    ].map(t => ({ ...t, done: null, photo: null, forceOverride: false })));
    setLoading(false);

    // Tenta buscar atualizações do servidor em segundo plano, mas sem travar
    fetch(`${API_URL}/api/checklists`)
      .then(res => res.json())
      .then(data => {
        if (data.length > 0) {
          const cl = data[0];
          setTitle(cl.title);
          setTasks(cl.tasks.map(t => ({ ...t, done: null, photo: null, forceOverride: false })));
        }
      })
      .catch(() => {
        console.log('Usando modo simulador offline');
      });
  }, []);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const sigCanvasRef = useRef(null);
  const sigDrawing = useRef(false);

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

  // ─── Tipos de resposta ────────────────────────────────
  const handleToggle = (id) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));

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

  // ─── Assinatura Digital ───────────────────────────────
  const startDraw = (e) => {
    sigDrawing.current = true;
    const ctx = sigCanvasRef.current.getContext('2d');
    const rect = sigCanvasRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.beginPath(); ctx.moveTo(x, y);
  };
  const draw = (e) => {
    if (!sigDrawing.current) return;
    e.preventDefault();
    const ctx = sigCanvasRef.current.getContext('2d');
    const rect = sigCanvasRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.lineTo(x, y); ctx.strokeStyle = '#FF4500'; ctx.lineWidth = 2; ctx.stroke();
  };
  const endDraw = () => { sigDrawing.current = false; };
  const clearSignature = () => {
    const ctx = sigCanvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, sigCanvasRef.current.width, sigCanvasRef.current.height);
    setSignature(null);
  };
  const saveSignature = () => {
    const dataUrl = sigCanvasRef.current.toDataURL('image/png');
    setSignature(dataUrl);
    setShowSignature(false);
  };

  // ─── Finalizar ────────────────────────────────────────
  const handleFinish = async () => {
    const pendingPhoto = tasks.filter(t => t.requirePhoto && !t.photo);
    if (pendingPhoto.length > 0) {
      alert('Envie a foto de todas as tarefas obrigatórias antes de finalizar.'); return;
    }
    if (!signature) {
      setShowSignature(true); return;
    }
    try {
      const res = await fetch(`${API_URL}/api/finalize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeName: EMPLOYEE.name, store: EMPLOYEE.store, tasks, feedbackInfo: aiFeedback })
      });
      if (res.ok) setSubmitted(true);
    } catch { alert('Erro ao enviar checklist.'); }
  };

  // ─── Progresso ────────────────────────────────────────
  const completedCount = tasks.filter(t => t.done !== null && t.done !== false && t.done !== '').length;
  const progress = Math.round((completedCount / tasks.length) * 100);

  // ─── Tela de Sucesso ──────────────────────────────────
  if (submitted) return (
    <div className="page-container animate-fade" style={{ maxWidth: '600px', textAlign: 'center', paddingTop: '80px' }}>
      <Trophy size={80} color="var(--primary)" style={{ marginBottom: '24px' }} />
      <h1 style={{ fontSize: '2rem', marginBottom: '12px' }}>Checklist Enviado!</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
        Parabéns, {EMPLOYEE.name}! O seu checklist foi registrado com sucesso e o dono já foi notificado.
      </p>
      {signature && <img src={signature} alt="Assinatura" style={{ border: '1px solid var(--border-color)', borderRadius: '8px', maxWidth: '300px', marginBottom: '24px' }} />}
      <div style={{ padding: '16px', backgroundColor: '#121318', borderRadius: '12px' }}>
        <p style={{ color: 'var(--success)', fontWeight: 'bold' }}>✅ {completedCount}/{tasks.length} tarefas concluídas ({progress}%)</p>
      </div>
    </div>
  );

  return (
    <div className="page-container animate-fade" style={{ maxWidth: '600px' }}>

      {/* Header com progresso */}
      <header style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 className="page-title" style={{ marginBottom: '4px', fontSize: '1.5rem' }}>{title}</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Responsável: Colaborador</p>
        <div style={{ backgroundColor: '#1A1C23', borderRadius: '100px', height: '8px', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', backgroundColor: progress === 100 ? 'var(--success)' : 'var(--primary)', transition: 'width 0.4s ease' }} />
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>{completedCount}/{tasks.length} tarefas concluídas ({progress}%)</p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {tasks.map((task, index) => {
          const isDone = task.done !== null && task.done !== false && task.done !== '';
          return (
            <div key={task.id} className="card" style={{ padding: '20px', borderLeft: isDone ? '4px solid var(--success)' : '4px solid var(--border-color)', transition: 'border-color 0.3s' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{index + 1}. {task.text}</span>
                {isDone && <CheckCircle size={20} color="var(--success)" />}
              </h3>

              {/* CHECKBOX */}
              {task.type === 'check' && (
                <label className="custom-checkbox" style={{ marginBottom: '8px' }}>
                  <input type="checkbox" checked={task.done === true} onChange={() => handleToggle(task.id)} />
                  <span className="checkmark"></span>
                  <span style={{ fontSize: '1rem' }}>Marcar como concluído</span>
                </label>
              )}

              {/* SIM / NÃO */}
              {task.type === 'boolean' && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <button className="btn" style={{ flex: 1, backgroundColor: task.done === true ? 'var(--success)' : 'transparent', border: '1px solid var(--success)', color: task.done === true ? 'white' : 'var(--success)', boxShadow: 'none' }} onClick={() => handleBoolean(task.id, true)}>Sim</button>
                  <button className="btn" style={{ flex: 1, backgroundColor: task.done === false ? 'var(--error)' : 'transparent', border: '1px solid var(--error)', color: task.done === false ? 'white' : 'var(--error)', boxShadow: 'none' }} onClick={() => handleBoolean(task.id, false)}>Não</button>
                </div>
              )}

              {/* AVALIAÇÃO POR ESTRELAS */}
              {task.type === 'rating' && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  {[1,2,3,4,5].map(star => (
                    <button key={star} onClick={() => handleRating(task.id, star)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                      <Star size={32} fill={task.done >= star ? '#FFA000' : 'none'} color={task.done >= star ? '#FFA000' : 'var(--text-muted)'} />
                    </button>
                  ))}
                  {task.done && <span style={{ color: 'var(--text-muted)', alignSelf: 'center', fontSize: '0.9rem' }}>{task.done}/5</span>}
                </div>
              )}

              {/* NUMÉRICO */}
              {task.type === 'numeric' && (
                <input type="number" className="input-field" style={{ marginBottom: '8px' }}
                  placeholder="Digite o número..." min="0"
                  value={task.done || ''} onChange={e => handleNumeric(task.id, e.target.value)} />
              )}

              {/* MÚLTIPLA ESCOLHA */}
              {task.type === 'multiple' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                  {(task.options || []).map((opt, i) => (
                    <button key={i} onClick={() => handleMultiple(task.id, opt)}
                      style={{ padding: '10px 16px', borderRadius: '8px', border: `1px solid ${task.done === opt ? 'var(--primary)' : 'var(--border-color)'}`, backgroundColor: task.done === opt ? 'rgba(255,77,0,0.15)' : 'transparent', color: task.done === opt ? 'var(--primary)' : 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* TEXTO LIVRE */}
              {task.type === 'text' && (
                <textarea className="input-field" style={{ marginBottom: '8px', minHeight: '80px', resize: 'vertical' }}
                  placeholder="Digite sua observação..."
                  value={task.done || ''} onChange={e => handleText(task.id, e.target.value)} />
              )}

              {/* FOTO + IA */}
              {task.requirePhoto && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '12px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                    <AlertTriangle size={16} /> Obrigatório: Foto ao vivo
                  </div>
                  {task.photo ? (
                    <div style={{ position: 'relative' }}>
                      <img src={task.photo} alt="Foto" style={{ width: '100%', borderRadius: '8px', maxHeight: '300px', objectFit: 'cover' }} />
                      <button style={{ position: 'absolute', top: 10, right: 10, padding: '8px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.7)', border: 'none', color: 'white', cursor: 'pointer' }}
                        onClick={() => { setTasks(prev => prev.map(t => t.id === task.id ? { ...t, photo: null, forceOverride: false } : t)); setAIFeedback(prev => ({ ...prev, [task.id]: null })); }}>
                        <X size={16} />
                      </button>
                      {aiFeedback[task.id]?.status === 'loading' && <div style={{ marginTop: '8px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>🤖 Analisando imagem com IA...</div>}
                      {aiFeedback[task.id]?.status === 'success' && (
                        <div style={{ marginTop: '8px', padding: '12px', backgroundColor: 'rgba(0,200,83,0.1)', borderRadius: '8px', border: '1px solid var(--success)', color: 'var(--success)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <CheckCircle size={18} /> <span style={{ fontSize: '0.875rem' }}>Aprovado pela IA. Perfeito!</span>
                        </div>
                      )}
                      {aiFeedback[task.id]?.status === 'warning' && !task.forceOverride && (
                        <div style={{ marginTop: '8px', padding: '12px', backgroundColor: 'rgba(255,160,0,0.1)', borderRadius: '8px', border: '1px solid #FFA000', color: '#FFA000', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                            <AlertCircle size={20} style={{ minWidth: '20px' }} />
                            <span style={{ fontSize: '0.875rem' }}><strong>Atenção:</strong> Não acreditamos que o solicitado foi feito corretamente. ({aiFeedback[task.id].message})</span>
                          </div>
                          <button className="btn" style={{ padding: '8px', fontSize: '0.8rem', backgroundColor: '#FFA000' }} onClick={() => forceAcceptPhoto(task.id)}>
                            Desejo Enviar Assim Mesmo
                          </button>
                        </div>
                      )}
                      {task.forceOverride && (
                        <div style={{ marginTop: '8px', padding: '12px', backgroundColor: 'rgba(255,77,0,0.1)', borderRadius: '8px', border: '1px solid var(--primary)', color: 'var(--primary)' }}>
                          <span style={{ fontSize: '0.875rem' }}>⚠️ Você ignorou o alerta. O dono será notificado pelo WhatsApp.</span>
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

      {/* Modal de Assinatura Digital */}
      {showSignature && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '24px' }}>
            <h3 style={{ marginBottom: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <PenLine size={20} color="var(--primary)" /> Assinatura Digital
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
              Assine abaixo para confirmar que você executou este checklist.
            </p>
            <canvas ref={sigCanvasRef} width={460} height={180}
              style={{ width: '100%', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: '#0D0E12', cursor: 'crosshair', touchAction: 'none' }}
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px' }}>Desenhe sua assinatura acima</p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={clearSignature}>Limpar</button>
              <button className="btn" style={{ flex: 2 }} onClick={saveSignature}>Confirmar e Enviar</button>
            </div>
          </div>
        </div>
      )}

      <button className="btn" style={{ width: '100%', marginTop: '32px', padding: '16px' }} onClick={handleFinish}>
        {signature ? <><FileText size={20} /> Finalizar e Enviar</> : <><PenLine size={20} /> Assinar e Finalizar</>}
      </button>

    </div>
  );
}
