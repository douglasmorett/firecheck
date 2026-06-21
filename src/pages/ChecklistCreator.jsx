import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Save, Trash2, Camera, ShieldCheck, Clock, CalendarClock, Users, Bot, Sparkles, X, Copy, ClipboardList, Mic, MicOff, Send, MessageCircle, ArrowRight, CheckCircle, RefreshCw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
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

const RESPONSE_TYPES = [
  { value: 'check',    label: '☑️  Checkbox (Feito)' },
  { value: 'boolean',  label: '✅  Sim / Não' },
  { value: 'rating',   label: '⭐  Avaliação (1 a 5 estrelas)' },
  { value: 'numeric',  label: '🔢  Número (quantidade, temperatura…)' },
  { value: 'multiple', label: '📋  Múltipla Escolha' },
  { value: 'itemlist', label: '🗳️  Lista de Itens (conferir um por um)' },
  { value: 'text',     label: '✏️  Texto Livre' },
];

const RECURRENCE_OPTIONS = [
  { value: '',         label: 'Sem recorrência (único)' },
  { value: 'daily',    label: 'Diário — repete todo dia' },
  { value: 'weekdays', label: 'Dias Alternados — escolha os dias' },
  { value: 'weekly',   label: 'Semanal — repete toda semana' },
  { value: 'monthly',  label: 'Mensal — repete todo mês' },
];

const WEEKDAY_OPTIONS = [
  { value: 'seg', label: 'Seg' },
  { value: 'ter', label: 'Ter' },
  { value: 'qua', label: 'Qua' },
  { value: 'qui', label: 'Qui' },
  { value: 'sex', label: 'Sex' },
  { value: 'sab', label: 'Sáb' },
  { value: 'dom', label: 'Dom' },
];

const newTask = () => ({
  id: Date.now(),
  text: '',
  type: 'boolean',
  requirePhoto: false,
  timeLimit: '',
  notifyDelay: true,
  options: ['', ''],
  assignee: '', // Novo campo para funcionário específico (e-mail)
});

// Dados simulados (futuramente virão do backend/banco de dados)
const EXISTING_CHECKLISTS = {
  1: { title: 'Abertura da Loja', store: 'Centro', recurrence: 'daily', tasks: [
    { id: 1, text: 'Organizar gôndola de bebidas', type: 'check', requirePhoto: true, timeLimit: '08:00', notifyDelay: true, options: [] },
    { id: 2, text: 'Limpar chão do corredor 3', type: 'boolean', requirePhoto: false, timeLimit: '', notifyDelay: true, options: [] },
    { id: 3, text: 'Situação do refrigerador', type: 'multiple', requirePhoto: false, timeLimit: '', notifyDelay: false, options: ['Funcionando normal', 'Com problema', 'Desligado'] },
  ]},
  2: { title: 'Limpeza de Gôndolas', store: 'Centro', recurrence: 'daily', tasks: [
    { id: 1, text: 'Limpar gôndola de frios', type: 'boolean', requirePhoto: true, timeLimit: '10:00', notifyDelay: true, options: [] },
    { id: 2, text: 'Avalie a limpeza geral', type: 'rating', requirePhoto: false, timeLimit: '', notifyDelay: false, options: [] },
  ]},
  3: { title: 'Fechamento de Caixa', store: 'Centro', recurrence: 'daily', tasks: [
    { id: 1, text: 'Conferir total de caixa', type: 'numeric', requirePhoto: false, timeLimit: '22:00', notifyDelay: true, options: [] },
    { id: 2, text: 'Caixa confere?', type: 'boolean', requirePhoto: true, timeLimit: '22:30', notifyDelay: true, options: [] },
  ]},
};

export default function ChecklistCreator() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  
  const [userPlan, setUserPlan] = useState('pro');
  const [title, setTitle] = useState('');
  const [store, setStore] = useState('Centro');
  const [recurrence, setRecurrence] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [tasks, setTasks] = useState([newTask()]);
  const [requireSelfie, setRequireSelfie] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [team, setTeam] = useState([]);
  const [weekdays, setWeekdays] = useState([]);

  // States for AI Generator (Multi-step)
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiMode, setAiMode] = useState('choose'); // choose | text | audio | transcription | chat
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [aiSteps, setAiSteps] = useState('');

  // States for Copy Checklist Modal
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [availableChecklists, setAvailableChecklists] = useState([]);
  const [isLoadingChecklists, setIsLoadingChecklists] = useState(false);
  const [copySearch, setCopySearch] = useState('');

  const openCopyModal = async () => {
    setShowCopyModal(true);
    setCopySearch('');
    setIsLoadingChecklists(true);
    try {
      const res = await fetch(`${API_URL}/api/checklists`, {
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
      });
      handle401(res, navigate);
      const data = await res.json();
      if (Array.isArray(data)) {
        // Exclui o próprio checklist sendo editado da lista
        setAvailableChecklists(data.filter(c => String(c.id) !== String(id)));
      }
    } catch (e) {
      console.error('Erro ao buscar checklists:', e);
    } finally {
      setIsLoadingChecklists(false);
    }
  };

  const handleCopyChecklist = (source) => {
    const copiedTasks = (source.tasks || []).map((t, i) => ({
      ...t,
      id: Date.now() + i,
    }));
    setTasks(copiedTasks);
    setShowCopyModal(false);
  };

  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  // Conversational AI states
  const [aiConversation, setAiConversation] = useState([]);
  const [aiChatInput, setAiChatInput] = useState('');
  const chatEndRef = useRef(null);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiConversation]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const formatRecordingTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm' });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = handleRecordingStop;
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
      alert('❌ Não foi possível acessar o microfone. Verifique as permissões do navegador.');
      console.error('Mic error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setIsRecording(false);
  };

  const handleRecordingStop = async () => {
    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    setIsTranscribing(true);
    setAiMode('transcription');

    try {
      // Convert to base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
      const audioBase64 = await base64Promise;

      const res = await fetch(`${API_URL}/api/transcribe-audio`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ audio: audioBase64, mimeType: 'audio/webm' }),
      });
      const data = await res.json();
      setTranscription(data.text || '');
      if (!data.text) alert('⚠️ Não foi possível identificar fala no áudio. Tente novamente.');
    } catch (err) {
      console.error('Transcription error:', err);
      alert('❌ Erro na transcrição. Tente novamente.');
      setAiMode('audio');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSendToAI = async (inputText, existingConversation = []) => {
    if (!inputText?.trim()) return;

    const description = existingConversation.length === 0 ? inputText : existingConversation[0]?.content || inputText;
    const newConv = [...existingConversation, { role: 'user', content: inputText }];
    setAiConversation(newConv);
    setAiMode('chat');
    setIsAIGenerating(true);
    setAiChatInput('');

    try {
      const res = await fetch(`${API_URL}/api/generate-checklist-ai-v2`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ description, conversation: newConv }),
      });
      const data = await res.json();

      if (data.needsMoreInfo) {
        // Bill needs more info — show questions
        let billMessage = data.message || 'Preciso de mais alguns detalhes para montar o melhor checklist possível:';
        if (data.questions?.length > 0) {
          billMessage += '\n\n' + data.questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
        }
        setAiConversation(prev => [...prev, { role: 'bill', content: billMessage }]);
      } else if (data.title && data.tasks?.length > 0) {
        // Got the checklist!
        setAiConversation(prev => [...prev, { role: 'bill', content: `✅ Checklist "${data.title}" criado com ${data.tasks.length} tarefas! Aplicando no formulário...` }]);
        setTimeout(() => {
          setTitle(data.title);
          setTasks(data.tasks.map((t, i) => ({
            id: Date.now() + i,
            text: t.text || t,
            type: t.type || 'boolean',
            requirePhoto: t.requirePhoto !== undefined ? t.requirePhoto : false,
            timeLimit: t.timeLimit || '',
            notifyDelay: true,
            options: t.options || [],
            assignee: '',
          })));
          setShowAIModal(false);
          resetAIModal();
        }, 1500);
      } else {
        setAiConversation(prev => [...prev, { role: 'bill', content: '⚠️ Não consegui gerar o checklist. Tente descrever com mais detalhes.' }]);
      }
    } catch (err) {
      console.error('AI v2 error:', err);
      setAiConversation(prev => [...prev, { role: 'bill', content: '❌ Erro ao conectar com a IA. Tente novamente.' }]);
    } finally {
      setIsAIGenerating(false);
    }
  };

  // Legacy handler for text-only mode (uses old endpoint as fallback)
  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) {
      alert("⚠️ Descreva qual processo deseja auditar.");
      return;
    }
    handleSendToAI(aiPrompt, []);
  };

  const resetAIModal = () => {
    setAiMode('choose');
    setAiPrompt('');
    setTranscription('');
    setAiConversation([]);
    setAiChatInput('');
    setRecordingTime(0);
    setIsAIGenerating(false);
    setAiSteps('');
  };

  useEffect(() => {
    // Tenta carregar a loja do perfil do usuário logado
    try {
      const profile = JSON.parse(localStorage.getItem('user') || '{}');
      if (profile.plan) setUserPlan(profile.plan);
      if (profile.store && !isEditing) {
        setStore(profile.store);
      }
      if (profile.store) {
        fetch(`${API_URL}/api/users?store=${encodeURIComponent(profile.store)}`, {
            headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
          })
          .then(r => { handle401(r, navigate); return r.json(); })
          .then(data => {
             if (Array.isArray(data)) setTeam(data.filter(u => u.role === 'funcionario' || u.role === 'employee'));
          })
          .catch(() => {});
      }
    } catch (e) { console.error('Erro ao ler perfil para loja'); }

    if (isEditing) {
      fetch(`${API_URL}/api/checklists`, {
          headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
        })
        .then(res => { handle401(res, navigate); return res.json(); })
        .then(data => {
          const cl = data.find(c => String(c.id) === String(id));
          if (cl) {
            setTitle(cl.title);
            setStore(cl.store);
            setRecurrence(cl.recurrence);
            setScheduledDate(cl.scheduledDate);
            setRequireSelfie(cl.require_selfie || false);
            setTasks(cl.tasks);
          }
        });
    }
  }, [id]);

  const addTask = () => setTasks([...tasks, newTask()]);
  const removeTask = (tid) => setTasks(tasks.filter(t => t.id !== tid));
  const updateTask = (tid, field, value) =>
    setTasks(tasks.map(t => t.id === tid ? { ...t, [field]: value } : t));
  const addOption = (tid) =>
    setTasks(tasks.map(t => t.id === tid ? { ...t, options: [...(t.options || []), ''] } : t));
  const updateOption = (taskId, idx, value) =>
    setTasks(tasks.map(t => {
      if (t.id !== taskId) return t;
      const opts = [...(t.options || [])]; opts[idx] = value;
      return { ...t, options: opts };
    }));
  const removeOption = (taskId, idx) =>
    setTasks(tasks.map(t => t.id !== taskId ? t :
      { ...t, options: (t.options || []).filter((_, i) => i !== idx) }));

  const handleSave = async () => {
    // Validação de Título
    if (!title.trim()) { 
      alert('⚠️ Falta o nome do checklist. Por favor, dê um título a ele.'); 
      return; 
    }
    
    // Validação de Data para checklists sem recorrência
    if (recurrence === '' && !scheduledDate) {
      alert('⚠️ Você escolheu um checklist único, mas não selecionou a Data de Execução no calendário.');
      return;
    }

    // Validação de Tarefas
    if (tasks.length === 0) {
      alert('⚠️ O checklist precisa de pelo menos uma tarefa.');
      return;
    }

    const taskIncompleta = tasks.find((t, idx) => !t.text.trim());
    if (taskIncompleta) {
      const idx = tasks.indexOf(taskIncompleta) + 1;
      alert(`⚠️ A Tarefa ${idx} está sem descrição. Escreva o que deve ser feito ou remova a tarefa.`);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/checklists`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: id || null,
          title, store, recurrence, scheduledDate, tasks, requireSelfie, weekdays: recurrence === 'weekdays' ? weekdays : null
        })
      });

      if (response.ok) {
        alert(isEditing ? '✅ Checklist atualizado com sucesso!' : '✅ Checklist criado e salvo!');
        navigate('/admin');
      } else {
        const errorData = await response.json();
        alert(`❌ Erro do servidor: ${errorData.message || 'Erro desconhecido'}`);
      }
    } catch (e) { 
      alert('❌ Erro de conexão. O servidor pode estar fora do ar ou a URL da API está incorreta.'); 
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-container animate-fade">
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn-secondary" style={{ padding: '8px', borderRadius: '50%' }} onClick={() => navigate('/admin')}>
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="page-title" style={{ marginBottom: '4px' }}>
              {isEditing ? `Editando: ${title || '...'}` : 'Criar Novo Checklist'}
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              {isEditing ? 'Altere as tarefas e salve para atualizar.' : 'Configure regras, tipos de resposta e auditoria por IA.'}
            </p>
          </div>
        </div>

        {!isEditing && (
          <button 
            className="btn btn-pulse" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: '#06b6d4', color: 'var(--text-main)', boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)' }}
            onClick={() => {
              setShowAIModal(true);
              setTimeout(() => {
                const el = document.getElementById('ai-prompt-input');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.focus();
                }
              }, 100);
            }}
          >
            <Sparkles size={20} /> Gerar com Inteligência Artificial
          </button>
        )}
      </header>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>

        {/* Painel Esquerdo */}
        <div className="card" style={{ flex: '1', minWidth: '280px', alignSelf: 'flex-start' }}>
          <h3 style={{ marginBottom: '20px' }}>Configurações Gerais</h3>

          <div style={{ marginBottom: '16px' }}>
            <label className="input-label">Nome do Checklist</label>
            <input type="text" className="input-field" placeholder="Ex: Abertura da Loja"
              value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="input-label">Loja de Destino</label>
            {userPlan === 'custom' ? (
              <>
                <select className="input-field" value={store} onChange={e => setStore(e.target.value)}>
                  <option value="Centro">Filial Centro</option>
                  <option value="Sul">Filial Sul</option>
                  <option value="Norte">Filial Norte</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '4px', display: 'block' }}>
                  ✅ Seu plano Custom permite múltiplas filiais.
                </span>
              </>
            ) : (
              <>
                <input 
                  type="text" 
                  className="input-field" 
                  value={store} 
                  readOnly
                  style={{ backgroundColor: 'var(--bg-card)', cursor: 'not-allowed', color: 'var(--text-muted)' }}
                  placeholder="Nome da sua loja"
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  🔒 Loja vinculada ao seu plano. Para gerenciar redes, assine o <strong>Plano Custom</strong>.
                </span>
              </>
            )}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CalendarClock size={14} color="var(--primary)" /> Recorrência
            </label>
            <select className="input-field" value={recurrence} onChange={e => { setRecurrence(e.target.value); setScheduledDate(''); }}>
              {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {recurrence === '' && (
              <div style={{ marginTop: '10px' }}>
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📅 Data de Execução
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={scheduledDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setScheduledDate(e.target.value)}
                  onClick={(e) => e.target.showPicker?.()}
                  style={{ cursor: 'pointer' }}
                />
                {scheduledDate && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '4px', display: 'block' }}>
                    📌 Checklist agendado para {new Date(scheduledDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                )}
              </div>
            )}
            {recurrence === 'weekdays' && (
              <div style={{ marginTop: '12px' }}>
                <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>📅 Selecione os dias da semana:</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {WEEKDAY_OPTIONS.map(d => (
                    <button key={d.value} type="button" onClick={() => setWeekdays(prev => prev.includes(d.value) ? prev.filter(x => x !== d.value) : [...prev, d.value])}
                      style={{ padding: '8px 14px', borderRadius: '8px', border: weekdays.includes(d.value) ? '2px solid var(--primary)' : '1px solid var(--border-color)', backgroundColor: weekdays.includes(d.value) ? 'rgba(255, 69, 0, 0.15)' : 'var(--bg-card)', color: weekdays.includes(d.value) ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: weekdays.includes(d.value) ? 'bold' : 'normal', fontSize: '0.9rem', transition: 'all 0.2s' }}>
                      {d.label}
                    </button>
                  ))}
                </div>
                {weekdays.length > 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '8px', display: 'block' }}>
                    ✅ Checklist será executado: {weekdays.map(w => WEEKDAY_OPTIONS.find(o => o.value === w)?.label).join(', ')}
                  </span>
                )}
              </div>
            )}
            {recurrence !== '' && recurrence !== 'weekdays' && (
              <span style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '4px', display: 'block' }}>
                ✅ O sistema vai distribuir automaticamente para os funcionários.
              </span>
            )}
          </div>

          <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: 'var(--bg-color)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Camera size={16} color="var(--primary)" /> Exigir Selfie na Finalização
            </label>
            <label className="custom-checkbox" style={{ padding: '4px 0', marginBottom: 0 }}>
              <input type="checkbox" checked={requireSelfie} onChange={e => setRequireSelfie(e.target.checked)} />
              <span className="checkmark"></span>
              <span style={{ color: requireSelfie ? 'var(--primary)' : 'var(--text-muted)', fontSize: '0.9rem' }}>
                {requireSelfie ? 'Sim, obrigatório' : 'Não exigir'}
              </span>
            </label>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', display: 'block', lineHeight: '1.4' }}>
              O colaborador terá que tirar uma foto do próprio rosto antes de concluir o checklist.
            </span>
          </div>
        </div>

        {/* Painel Direito */}
        <div style={{ flex: '2', minWidth: '350px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h3>Tarefas ({tasks.length})</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                className="btn-secondary"
                onClick={openCopyModal}
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderColor: 'var(--primary)', color: 'var(--primary)', fontWeight: '600' }}
                title="Copiar tarefas de outro checklist existente"
              >
                <Copy size={16} /> Copiar de outro Checklist
              </button>
              <button className="btn btn-secondary" onClick={addTask} style={{ padding: '8px 16px' }}>
                <Plus size={16} /> Adicionar Tarefa
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {tasks.map((task, index) => (
              <div key={task.id} className="card" style={{ padding: '20px', backgroundColor: 'var(--bg-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span className="badge" style={{ backgroundColor: 'var(--bg-card)' }}>Tarefa {index + 1}</span>
                  <button onClick={() => removeTask(task.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                    <Trash2 size={20} />
                  </button>
                </div>

                <input type="text" className="input-field" style={{ marginBottom: '12px' }}
                  placeholder="Descreva o que deve ser feito"
                  value={task.text} onChange={e => updateTask(task.id, 'text', e.target.value)} />

                <div style={{ marginBottom: '12px' }}>
                  <label className="input-label">Tipo de Resposta</label>
                  <select className="input-field" value={task.type}
                    onChange={e => updateTask(task.id, 'type', e.target.value)}>
                    {RESPONSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                {task.type === 'multiple' && (
                  <div style={{ marginBottom: '12px', paddingLeft: '12px', borderLeft: '2px solid var(--primary)' }}>
                    <label className="input-label">Opções de escolha</label>
                    {(task.options || []).map((opt, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                        <input type="text" className="input-field" style={{ flex: 1 }}
                          placeholder={`Opção ${idx + 1}`} value={opt}
                          onChange={e => updateOption(task.id, idx, e.target.value)} />
                        <button onClick={() => removeOption(task.id, idx)}
                          style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px', marginTop: '4px' }}
                      onClick={() => addOption(task.id)}>
                      <Plus size={14} /> Adicionar opção
                    </button>
                  </div>
                )}

                {task.type === 'itemlist' && (
                  <div style={{ marginBottom: '12px', paddingLeft: '12px', borderLeft: '2px solid #7c3aed' }}>
                    <label className="input-label" style={{ color: '#7c3aed' }}>
                      🗳️ Itens da lista (o funcionário vai conferir cada um)
                    </label>
                    {(task.options || []).map((opt, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: '20px' }}>{idx + 1}.</span>
                        <input type="text" className="input-field" style={{ flex: 1 }}
                          placeholder={`Ex: Coca-Cola, Sprite, Fanta...`} value={opt}
                          onChange={e => updateOption(task.id, idx, e.target.value)} />
                        <button onClick={() => removeOption(task.id, idx)}
                          style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px', marginTop: '4px', borderColor: '#7c3aed', color: '#7c3aed' }}
                      onClick={() => addOption(task.id)}>
                      <Plus size={14} /> Adicionar item
                    </button>
                    {(task.options || []).length > 0 && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                        ℹ️ O funcionário verá {task.options.length} {task.options.length === 1 ? 'item' : 'itens'} com uma caixinha para marcar cada um.
                      </p>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1', minWidth: '180px' }}>
                    <label className="input-label">Fiscalização por Foto (IA)</label>
                    <label className="custom-checkbox" style={{ padding: '10px 0' }}>
                      <input type="checkbox" checked={task.requirePhoto}
                        onChange={e => updateTask(task.id, 'requirePhoto', e.target.checked)} />
                      <span className="checkmark"></span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px',
                        color: task.requirePhoto ? 'var(--primary)' : 'var(--text-muted)' }}>
                        <Camera size={18} /> Exigir Foto Real
                        {task.requirePhoto && <ShieldCheck size={18} color="var(--primary)" />}
                      </span>
                    </label>
                  </div>

                  <div style={{ flex: '1', minWidth: '150px' }}>
                    <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} /> Hora Limite (Opcional)
                    </label>
                    <input type="time" className="input-field" value={task.timeLimit || ''}
                      onChange={e => updateTask(task.id, 'timeLimit', e.target.value)} />
                  </div>
                </div>

                {/* Atribuição de Funcionário Específico */}
                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                   <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                     <Users size={14} color="var(--primary)" /> Responsável pela Tarefa
                   </label>
                   
                   <div style={{ marginTop: '8px' }}>
                     <select className="input-field" value={task.assignee || ''} onChange={e => updateTask(task.id, 'assignee', e.target.value)}>
                       <option value="">Equipe Toda (Visível para todos)</option>
                       {team.map(m => (
                         <option key={m.email} value={m.email}>{m.name} ({m.email})</option>
                       ))}
                     </select>
                     {team.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '4px', display: 'block' }}>Nenhum funcionário cadastrado nesta loja. Adicione colaboradores no painel de equipe.</span>}
                   </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button className="btn-secondary" style={{ padding: '12px 24px' }} onClick={() => navigate('/admin')}>
              Cancelar
            </button>
            <button className="btn" style={{ padding: '12px 32px', fontSize: '1rem', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1 }} 
              onClick={handleSave} disabled={isSaving}>
              <Save size={20} /> {isSaving ? 'Salvando...' : 'Salvar Checklist'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Copiar Checklist */}
      {showCopyModal && (
        <div className="modal-overlay animate-fade">
          <div className="modal-content" style={{ maxWidth: '560px', width: '90%', padding: '32px', position: 'relative', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <button
              className="btn-secondary"
              style={{ position: 'absolute', top: '16px', right: '16px', padding: '8px', borderRadius: '50%', background: 'transparent', border: 'none' }}
              onClick={() => setShowCopyModal(false)}
            >
              <X size={20} color="var(--text-muted)" />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
              <div style={{ backgroundColor: 'rgba(255, 69, 0, 0.12)', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ClipboardList size={24} color="var(--primary)" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '4px' }}>Copiar de outro Checklist</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: '1.4' }}>
                  Selecione um checklist existente para copiar todas as suas tarefas para este novo checklist.
                </p>
              </div>
            </div>

            {/* Aviso de substituição */}
            {tasks.length > 0 && (
              <div style={{ backgroundColor: 'rgba(255, 165, 0, 0.1)', border: '1px solid rgba(255, 165, 0, 0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.82rem', color: 'var(--warning)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                ⚠️ As {tasks.length} tarefa{tasks.length > 1 ? 's' : ''} atuais serão substituídas pelas do checklist selecionado.
              </div>
            )}

            {/* Campo de busca */}
            <input
              type="text"
              className="input-field"
              placeholder="🔍 Buscar checklist..."
              value={copySearch}
              onChange={e => setCopySearch(e.target.value)}
              style={{ marginBottom: '12px' }}
              autoFocus
            />

            {/* Lista de checklists */}
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
              {isLoadingChecklists ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  <div style={{ width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px auto' }} />
                  Carregando checklists...
                </div>
              ) : availableChecklists.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  <ClipboardList size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                  <p>Nenhum checklist encontrado.</p>
                  <p style={{ fontSize: '0.82rem' }}>Crie e salve outro checklist primeiro.</p>
                </div>
              ) : (
                availableChecklists
                  .filter(c => c.title?.toLowerCase().includes(copySearch.toLowerCase()))
                  .map(cl => (
                    <button
                      key={cl.id}
                      onClick={() => handleCopyChecklist(cl)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '14px 16px', borderRadius: '10px',
                        border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)',
                        cursor: 'pointer', transition: 'all 0.15s', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'rgba(255,69,0,0.05)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.backgroundColor = 'var(--bg-color)'; }}
                    >
                      <div>
                        <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: '4px' }}>{cl.title}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '12px' }}>
                          <span>🏪 {cl.store || 'Sem loja'}</span>
                          <span>📋 {(cl.tasks || []).length} tarefa{(cl.tasks || []).length !== 1 ? 's' : ''}</span>
                          {cl.recurrence && <span>🔄 {cl.recurrence === 'daily' ? 'Diário' : cl.recurrence === 'weekly' ? 'Semanal' : cl.recurrence === 'weekdays' ? 'Dias alternados' : cl.recurrence}</span>}
                        </div>
                      </div>
                      <Copy size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginLeft: '12px' }} />
                    </button>
                  ))
              )}
              {!isLoadingChecklists && availableChecklists.length > 0 &&
                availableChecklists.filter(c => c.title?.toLowerCase().includes(copySearch.toLowerCase())).length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    Nenhum resultado para "{copySearch}"
                  </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação por IA — Multi-step com Áudio */}
      {showAIModal && (
        <div className="modal-overlay animate-fade">
          <div className="modal-content" style={{ maxWidth: '560px', width: '92%', padding: '32px', textAlign: 'center', position: 'relative', maxHeight: '85vh', overflowY: 'auto' }}>
            {/* Botão fechar */}
            <button
              style={{ position: 'absolute', top: '16px', right: '16px', padding: '8px', borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onClick={() => { if (!isAIGenerating && !isRecording && !isTranscribing) { setShowAIModal(false); resetAIModal(); } }}
              disabled={isAIGenerating || isRecording || isTranscribing}
            >
              <X size={20} color="var(--text-muted)" />
            </button>

            {/* Step indicators */}
            <div className="ai-steps-indicator">
              {['choose', 'input', 'transcription', 'chat'].map((step, i) => {
                const steps = aiMode === 'choose' ? 0 : aiMode === 'text' || aiMode === 'audio' ? 1 : aiMode === 'transcription' ? 2 : 3;
                return <div key={step} className={`ai-step-dot ${i < steps ? 'done' : i === steps ? 'active' : ''}`} />;
              })}
            </div>

            {/* ═══ STEP: Choose Mode ═══ */}
            {aiMode === 'choose' && (
              <>
                <div style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto', color: '#06b6d4', boxShadow: '0 0 20px rgba(6, 182, 212, 0.2)' }}>
                  <Bot size={32} />
                </div>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', fontWeight: 'bold' }}>Criação com IA</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: '1.5' }}>
                  Como você prefere descrever o processo?
                </p>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button className="ai-mode-card" onClick={() => setAiMode('audio')}>
                    <Mic size={36} color="var(--primary)" style={{ marginBottom: '12px' }} />
                    <div style={{ fontWeight: '600', fontSize: '1.05rem', marginBottom: '6px' }}>🎤 Explicar por Áudio</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.4' }}>Grave sua voz explicando o processo. A IA transcreve e monta o checklist.</div>
                  </button>
                  <button className="ai-mode-card" onClick={() => setAiMode('text')}>
                    <MessageCircle size={36} color="#06b6d4" style={{ marginBottom: '12px' }} />
                    <div style={{ fontWeight: '600', fontSize: '1.05rem', marginBottom: '6px' }}>📝 Descrever por Texto</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.4' }}>Digite a descrição do processo que quer auditar.</div>
                  </button>
                </div>
              </>
            )}

            {/* ═══ STEP: Text Input ═══ */}
            {aiMode === 'text' && (
              <>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '8px', fontWeight: 'bold' }}>📝 Descreva o Processo</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
                  Quanto mais detalhes, melhor o checklist. O Bill pode fazer perguntas se precisar.
                </p>
                <textarea
                  id="ai-prompt-input"
                  className="ai-transcription-area"
                  style={{ marginBottom: '20px' }}
                  placeholder="Ex: Quero um checklist para o fechamento do caixa. O operador precisa contar o dinheiro, conferir a maquininha, tirar foto do caixa..."
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  disabled={isAIGenerating}
                />
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn-secondary" style={{ flex: 1, padding: '14px' }} onClick={() => { setAiMode('choose'); setAiPrompt(''); }}>
                    <ArrowLeft size={16} /> Voltar
                  </button>
                  <button
                    className="btn btn-pulse"
                    style={{ flex: 2, padding: '14px', backgroundColor: '#06b6d4', opacity: isAIGenerating ? 0.7 : 1 }}
                    onClick={handleGenerateAI}
                    disabled={isAIGenerating || !aiPrompt.trim()}
                  >
                    {isAIGenerating ? (
                      <><div style={{ width: '18px', height: '18px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Gerando...</>
                    ) : (
                      <><Sparkles size={18} /> Gerar Checklist</>
                    )}
                  </button>
                </div>
              </>
            )}

            {/* ═══ STEP: Audio Recording ═══ */}
            {aiMode === 'audio' && (
              <>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '8px', fontWeight: 'bold' }}>
                  {isRecording ? '🔴 Gravando...' : '🎤 Gravar Áudio'}
                </h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '28px', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  {isRecording
                    ? 'Explique detalhadamente o processo. Fale sobre tarefas, quantidades, horários e tudo que for importante.'
                    : 'Clique no microfone e explique o processo que quer transformar em checklist.'}
                </p>

                {/* Timer */}
                <div className="ai-timer" style={{ marginBottom: '16px' }}>
                  {formatRecordingTime(recordingTime)}
                </div>

                {/* Waveform */}
                {isRecording && (
                  <div className="ai-waveform">
                    {Array.from({ length: 9 }).map((_, i) => <span key={i} />)}
                  </div>
                )}

                {/* Mic button */}
                <div style={{ margin: '24px 0' }}>
                  <button
                    className={`ai-mic-btn ${isRecording ? 'recording' : ''}`}
                    onClick={isRecording ? stopRecording : startRecording}
                  >
                    {isRecording ? <MicOff size={40} /> : <Mic size={40} />}
                  </button>
                </div>

                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '20px' }}>
                  {isRecording ? 'Clique para parar a gravação' : 'Clique para começar a gravar'}
                </p>

                <button className="btn-secondary" style={{ padding: '10px 24px' }} onClick={() => { if (!isRecording) { setAiMode('choose'); setRecordingTime(0); } }}>
                  <ArrowLeft size={16} /> Voltar
                </button>
              </>
            )}

            {/* ═══ STEP: Transcription Review ═══ */}
            {aiMode === 'transcription' && (
              <>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '8px', fontWeight: 'bold' }}>
                  {isTranscribing ? '🤖 Transcrevendo...' : '📝 Confira a Transcrição'}
                </h2>

                {isTranscribing ? (
                  <div style={{ padding: '48px 0' }}>
                    <div style={{ width: '48px', height: '48px', border: '4px solid rgba(6,182,212,0.2)', borderTopColor: '#06b6d4', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>O Bill está ouvindo seu áudio...</p>
                  </div>
                ) : (
                  <>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>
                      Revise o texto e corrija se necessário. Depois, envie para a IA gerar o checklist.
                    </p>
                    <textarea
                      className="ai-transcription-area"
                      style={{ marginBottom: '20px' }}
                      value={transcription}
                      onChange={e => setTranscription(e.target.value)}
                      placeholder="Texto transcrito do áudio..."
                    />
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button className="btn-secondary" style={{ flex: 1, padding: '12px', minWidth: '120px' }} onClick={() => { setAiMode('audio'); setTranscription(''); setRecordingTime(0); }}>
                        <RefreshCw size={16} /> Regravar
                      </button>
                      <button
                        className="btn btn-pulse"
                        style={{ flex: 2, padding: '12px', backgroundColor: '#06b6d4', minWidth: '160px' }}
                        onClick={() => handleSendToAI(transcription, [])}
                        disabled={!transcription.trim() || isAIGenerating}
                      >
                        <Sparkles size={18} /> Gerar Checklist
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ═══ STEP: Chat with Bill ═══ */}
            {aiMode === 'chat' && (
              <>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Bot size={22} color="#06b6d4" /> Conversa com o Bill
                </h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.85rem' }}>
                  O Bill está analisando e pode pedir mais detalhes para criar o checklist perfeito.
                </p>

                {/* Chat messages */}
                <div className="ai-chat-container">
                  {aiConversation.map((msg, i) => (
                    <div key={i} className={`ai-chat-bubble ${msg.role === 'bill' ? 'bill' : 'user'}`}>
                      {msg.role === 'bill' && <strong style={{ color: '#06b6d4', fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>🤖 Bill</strong>}
                      {msg.content.split('\n').map((line, j) => <span key={j}>{line}<br/></span>)}
                    </div>
                  ))}
                  {isAIGenerating && (
                    <div className="ai-chat-bubble bill">
                      <strong style={{ color: '#06b6d4', fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>🤖 Bill</strong>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#06b6d4', animation: 'mic-glow 1s infinite' }} />
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#06b6d4', animation: 'mic-glow 1s infinite 0.2s' }} />
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#06b6d4', animation: 'mic-glow 1s infinite 0.4s' }} />
                        <span style={{ marginLeft: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Analisando...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Reply input */}
                {!isAIGenerating && aiConversation.length > 0 && aiConversation[aiConversation.length - 1].role === 'bill' && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <input
                      type="text"
                      className="input-field"
                      style={{ flex: 1 }}
                      placeholder="Responda ao Bill..."
                      value={aiChatInput}
                      onChange={e => setAiChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && aiChatInput.trim()) handleSendToAI(aiChatInput, aiConversation); }}
                    />
                    <button
                      className="btn"
                      style={{ padding: '12px 16px', backgroundColor: '#06b6d4' }}
                      onClick={() => aiChatInput.trim() && handleSendToAI(aiChatInput, aiConversation)}
                      disabled={!aiChatInput.trim()}
                    >
                      <Send size={18} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
