import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Save, Trash2, Camera, ShieldCheck, Clock, CalendarClock, Users, Bot, Sparkles, X, Copy, ClipboardList, Mic, MicOff, Send, MessageCircle, ArrowRight, CheckCircle, RefreshCw, ArrowUp, ArrowDown } from 'lucide-react';
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
  { value: 'stock',    label: '📦  Estoque / Quantidade Mínima de Compra' },
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
  section: '',
  maxPhotos: 1,
  minQuantity: '',
  unit: 'un',
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
  const [category, setCategory] = useState('geral');
  const [requireSignature, setRequireSignature] = useState(false);
  const [assetLinkType, setAssetLinkType] = useState('');
  const [assignedTo, setAssignedTo] = useState([]); // Array de emails dos funcionários atribuídos (vazio = todos)


  // States for AI Generator (Chat-style)
  const [showAIModal, setShowAIModal] = useState(false);
  const [isAIGenerating, setIsAIGenerating] = useState(false);

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

    try {
      const reader = new FileReader();
      const base64Promise = new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
      const audioBase64 = await base64Promise;

      // Adiciona mensagem do usuário mostrando que enviou áudio
      const newConv = [...aiConversation, { role: 'user', content: '🎤 [Áudio enviado]' }];
      setAiConversation(newConv);
      setIsTranscribing(false);
      setIsAIGenerating(true);

      // Envia áudio direto para o Gemini que escuta + entende + responde
      const res = await fetch(`${API_URL}/api/generate-checklist-ai-audio`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ audio: audioBase64, mimeType: 'audio/webm', conversation: newConv }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Erro no processamento do áudio');
      }

      if (res.status === 403 || data.quota_exceeded) {
        setAiConversation(prev => [
          ...prev,
          {
            role: 'bill',
            type: 'upgrade_offer',
            content: `⚠️ ${data.error || 'Limite de criação por IA atingido.'}\n\nPara continuar criando checklists inteligentes e ter um limite maior, assine um plano maior:`
          }
        ]);
        setIsAIGenerating(false);
        return;
      }

      // Mostra a transcrição do que o Bill entendeu
      if (data.transcription) {
        setAiConversation(prev => {
          // Substitui o "[Áudio enviado]" pela transcrição real
          const updated = [...prev];
          const audioMsgIdx = updated.findLastIndex(m => m.role === 'user' && m.content === '🎤 [Áudio enviado]');
          if (audioMsgIdx !== -1) {
            updated[audioMsgIdx] = { role: 'user', content: `🎤 "${data.transcription}"` };
          }
          return updated;
        });
      }

      if (data.needsMoreInfo) {
        let billMessage = data.message || 'Preciso de mais alguns detalhes para montar o melhor checklist possível:';
        if (data.questions?.length > 0) {
          billMessage += '\n\n' + data.questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
        }
        setAiConversation(prev => [...prev, { role: 'bill', content: billMessage }]);
      } else if (data.title && data.tasks?.length > 0) {
        setAiConversation(prev => [...prev, { role: 'bill', content: `✅ Checklist "${data.title}" criado com ${data.tasks.length} tarefas! Aplicando no formulário...` }]);
        setTimeout(() => {
          if (!title) {
            setTitle(data.title);
          }
          setTasks(prevTasks => {
            const isEmpty = prevTasks.length === 1 && prevTasks[0].text.trim() === '';
            const newTasks = data.tasks.map((t, i) => ({
              id: Date.now() + i,
              text: t.text || t,
              type: t.type || 'boolean',
              requirePhoto: t.requirePhoto !== undefined ? t.requirePhoto : false,
              timeLimit: t.timeLimit || '',
              notifyDelay: true,
              options: t.options || [],
              assignee: '',
            }));
            return isEmpty ? newTasks : [...prevTasks, ...newTasks];
          });
          setShowAIModal(false);
          resetAIModal();
        }, 1500);
      } else {
        setAiConversation(prev => [...prev, { role: 'bill', content: '⚠️ Não consegui entender o áudio. Tente gravar novamente com mais detalhes, ou digite o que precisa.' }]);
      }
    } catch (err) {
      console.error('Audio AI error:', err);
      setAiConversation(prev => [...prev, { role: 'bill', content: `❌ Erro ao processar o áudio: ${err.message}` }]);
    } finally {
      setIsTranscribing(false);
      setIsAIGenerating(false);
    }
  };

  const handleSendToAI = async (inputText, existingConversation = []) => {
    if (!inputText?.trim()) return;

    const description = inputText;
    const newConv = [...existingConversation, { role: 'user', content: inputText }];
    setAiConversation(newConv);
    setIsAIGenerating(true);
    setAiChatInput('');

    try {
      const res = await fetch(`${API_URL}/api/generate-checklist-ai-v2`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ description, conversation: newConv }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro na criação do checklist');
      }

      if (res.status === 403 || data.quota_exceeded) {
        setAiConversation(prev => [
          ...prev,
          {
            role: 'bill',
            type: 'upgrade_offer',
            content: `⚠️ ${data.error || 'Limite de criação por IA atingido.'}\n\nPara continuar criando checklists inteligentes e ter um limite maior, assine um plano maior:`
          }
        ]);
        return;
      }

      if (data.needsMoreInfo) {
        let billMessage = data.message || 'Preciso de mais alguns detalhes para montar o melhor checklist possível:';
        if (data.questions?.length > 0) {
          billMessage += '\n\n' + data.questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
        }
        setAiConversation(prev => [...prev, { role: 'bill', content: billMessage }]);
      } else if (data.title && data.tasks?.length > 0) {
        setAiConversation(prev => [...prev, { role: 'bill', content: `✅ Checklist "${data.title}" criado com ${data.tasks.length} tarefas! Aplicando no formulário...` }]);
        setTimeout(() => {
          if (!title) {
            setTitle(data.title);
          }
          setTasks(prevTasks => {
            const isEmpty = prevTasks.length === 1 && prevTasks[0].text.trim() === '';
            const newTasks = data.tasks.map((t, i) => ({
              id: Date.now() + i,
              text: t.text || t,
              type: t.type || 'boolean',
              requirePhoto: t.requirePhoto !== undefined ? t.requirePhoto : false,
              timeLimit: t.timeLimit || '',
              notifyDelay: true,
              options: t.options || [],
              assignee: '',
            }));
            return isEmpty ? newTasks : [...prevTasks, ...newTasks];
          });
          setShowAIModal(false);
          resetAIModal();
        }, 1500);
      } else {
        setAiConversation(prev => [...prev, { role: 'bill', content: '⚠️ Não consegui gerar o checklist. Tente descrever com mais detalhes.' }]);
      }
    } catch (err) {
      console.error('AI v2 error:', err);
      setAiConversation(prev => [...prev, { role: 'bill', content: `❌ Erro ao conectar com a IA: ${err.message}` }]);
    } finally {
      setIsAIGenerating(false);
    }
  };

  const resetAIModal = () => {
    setAiConversation([]);
    setAiChatInput('');
    setRecordingTime(0);
    setIsAIGenerating(false);
    setIsTranscribing(false);
    setTranscription('');
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
             if (Array.isArray(data)) setTeam(data.filter(u => u.role === 'funcionario' || u.role === 'employee' || u.role === 'gestor' || u.role === 'admin' || u.role === 'master'));
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
          const cl = Array.isArray(data) ? data.find(c => c && String(c.id) === String(id)) : null;
          if (cl) {
            setTitle(cl.title);
            setStore(cl.store);
            setRecurrence(cl.recurrence);
            setScheduledDate(cl.scheduled_date || cl.scheduledDate || '');
            setRequireSelfie(cl.require_selfie || false);
            setCategory(cl.category || 'geral');
            setRequireSignature(cl.require_signature || false);
            setAssetLinkType(cl.asset_link_type || '');
            setTasks(cl.tasks || []);
            setWeekdays(cl.weekdays || []);
            setAssignedTo(cl.assigned_to || []);
          }
        });
    }
  }, [id, isEditing, navigate]);

  const addTask = () => setTasks([...tasks, newTask()]);
  const removeTask = (tid) => setTasks(tasks.filter(t => t.id !== tid));

  const moveTaskUp = (index) => {
    if (index === 0) return;
    const newTasks = [...tasks];
    const temp = newTasks[index - 1];
    newTasks[index - 1] = newTasks[index];
    newTasks[index] = temp;
    setTasks(newTasks);
  };

  const moveTaskDown = (index) => {
    if (index === tasks.length - 1) return;
    const newTasks = [...tasks];
    const temp = newTasks[index + 1];
    newTasks[index + 1] = newTasks[index];
    newTasks[index] = temp;
    setTasks(newTasks);
  };

  const insertTaskAfter = (index) => {
    const newTasks = [...tasks];
    const freshTask = { ...newTask(), id: Date.now() + Math.floor(Math.random() * 1000) };
    if (newTasks[index]?.section) {
      freshTask.section = newTasks[index].section;
    }
    newTasks.splice(index + 1, 0, freshTask);
    setTasks(newTasks);
  };

  const duplicateTask = (index) => {
    const newTasks = [...tasks];
    const taskToDup = newTasks[index];
    const duplicated = {
      ...JSON.parse(JSON.stringify(taskToDup)),
      id: Date.now() + Math.floor(Math.random() * 1000),
      text: `${taskToDup.text} (Cópia)`
    };
    newTasks.splice(index + 1, 0, duplicated);
    setTasks(newTasks);
  };
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
          title, store, recurrence, scheduledDate, tasks, requireSelfie, weekdays: recurrence === 'weekdays' ? weekdays : null,
          category, requireSignature, assetLinkType,
          assignedTo: assignedTo.length > 0 ? assignedTo : null
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
                const modal = document.querySelector('.modal-overlay');
                if (modal) modal.scrollIntoView({ behavior: 'smooth', block: 'start' });
                const textarea = document.getElementById('ai-chat-textarea');
                if (textarea) textarea.focus();
              }, 150);
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

          <div style={{ marginBottom: '16px' }}>
            <label className="input-label">Categoria do Checklist</label>
            <select className="input-field" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="geral">📦 Geral / Operação</option>
              <option value="compras">🛒 Lista de Compras / Estoque</option>
              <option value="loja">🏪 Loja (Limpeza, Abertura...)</option>
              <option value="restaurante">🍽️ Cozinha / Alimentos</option>
              <option value="consultorio">🏥 Clínicas e Consultórios</option>
              <option value="veiculo">🚗 Frota e Veículos</option>
            </select>
          </div>

          {/* Funcionários Responsáveis pelo Checklist */}
          <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: 'var(--bg-color)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Users size={16} color="var(--primary)" /> Funcionários Responsáveis
            </label>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px', display: 'block', lineHeight: '1.4' }}>
              Selecione quais funcionários devem executar este checklist. Se nenhum for selecionado, todos da loja terão acesso.
            </span>
            
            {/* Botão Todos */}
            <div 
              onClick={() => setAssignedTo([])} 
              style={{ 
                padding: '10px 14px', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer',
                border: assignedTo.length === 0 ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                backgroundColor: assignedTo.length === 0 ? 'rgba(255, 69, 0, 0.1)' : 'var(--bg-card)',
                color: assignedTo.length === 0 ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: assignedTo.length === 0 ? 'bold' : 'normal', fontSize: '0.9rem',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              ✅ Todos os Funcionários
            </div>

            {/* Lista de funcionários com checkbox */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
              {team.filter(m => m.email).map(m => {
                const isSelected = assignedTo.includes(m.email);
                return (
                  <div key={m.email}
                    onClick={() => {
                      setAssignedTo(prev => 
                        prev.includes(m.email) 
                          ? prev.filter(e => e !== m.email) 
                          : [...prev, m.email]
                      );
                    }}
                    style={{
                      padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: isSelected ? 'rgba(255, 69, 0, 0.08)' : 'var(--bg-card)',
                      color: isSelected ? 'var(--text-color)' : 'var(--text-muted)',
                      fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span style={{ width: '18px', height: '18px', borderRadius: '4px', border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)', backgroundColor: isSelected ? 'var(--primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'white', flexShrink: 0 }}>
                      {isSelected ? '✓' : ''}
                    </span>
                    <div>
                      <div style={{ fontWeight: isSelected ? '600' : 'normal' }}>{m.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.email}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {assignedTo.length > 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '8px', display: 'block', fontWeight: 'bold' }}>
                📌 {assignedTo.length} funcionário(s) selecionado(s)
              </span>
            )}
            
            {team.length === 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '4px', display: 'block' }}>
                Nenhum funcionário cadastrado. Adicione colaboradores no painel de equipe.
              </span>
            )}
          </div>

          <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: 'var(--bg-color)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              🖋️ Exigir Assinatura Digital
            </label>
            <label className="custom-checkbox" style={{ padding: '4px 0', marginBottom: 0 }}>
              <input type="checkbox" checked={requireSignature} onChange={e => setRequireSignature(e.target.checked)} />
              <span className="checkmark"></span>
              <span style={{ color: requireSignature ? 'var(--primary)' : 'var(--text-muted)', fontSize: '0.9rem' }}>
                {requireSignature ? 'Sim, obrigatória' : 'Não exigir'}
              </span>
            </label>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', display: 'block', lineHeight: '1.4' }}>
              O colaborador precisará assinar digitalmente com o dedo na tela do celular para concluir o checklist.
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
              <div key={task.id} className="card" style={{ padding: '20px', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge" style={{ backgroundColor: 'var(--bg-card)', padding: '4px 10px', fontSize: '0.85rem' }}>Tarefa {index + 1} de {tasks.length}</span>
                    {task.section && (
                      <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'rgba(255, 69, 0, 0.1)', color: 'var(--primary)', fontWeight: 'bold' }}>
                        📁 {task.section}
                      </span>
                    )}
                  </div>

                  {/* Controles de Reordenação e Ações da Tarefa */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveTaskUp(index)}
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', opacity: index === 0 ? 0.3 : 1, cursor: index === 0 ? 'not-allowed' : 'pointer' }}
                      title="Mover tarefa para cima"
                    >
                      <ArrowUp size={14} /> Subir
                    </button>

                    <button
                      type="button"
                      disabled={index === tasks.length - 1}
                      onClick={() => moveTaskDown(index)}
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', opacity: index === tasks.length - 1 ? 0.3 : 1, cursor: index === tasks.length - 1 ? 'not-allowed' : 'pointer' }}
                      title="Mover tarefa para baixo"
                    >
                      <ArrowDown size={14} /> Descer
                    </button>

                    <button
                      type="button"
                      onClick={() => insertTaskAfter(index)}
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', borderColor: 'rgba(255, 69, 0, 0.3)' }}
                      title="Inserir nova tarefa logo abaixo desta"
                    >
                      <Plus size={14} /> Inserir Abaixo
                    </button>

                    <button
                      type="button"
                      onClick={() => duplicateTask(index)}
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      title="Duplicar esta tarefa"
                    >
                      <Copy size={14} /> Duplicar
                    </button>

                    <button
                      type="button"
                      onClick={() => removeTask(task.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}
                      title="Excluir tarefa"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                 <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '12px' }}>
                   <div>
                     <label className="input-label">Descrição da Tarefa</label>
                     <input type="text" className="input-field"
                       placeholder="Descreva o que deve ser feito"
                       value={task.text} onChange={e => updateTask(task.id, 'text', e.target.value)} />
                   </div>
                   <div>
                     <label className="input-label">Seção / Agrupador</label>
                     <input type="text" className="input-field"
                       placeholder="Ex: Motor, Pneus, Cozinha..."
                       value={task.section || ''} onChange={e => updateTask(task.id, 'section', e.target.value)} />
                   </div>
                 </div>

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

                {(task.type === 'stock' || task.type === 'numeric') && (
                  <div style={{ marginBottom: '16px', padding: '14px', backgroundColor: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', marginBottom: '10px', fontWeight: 'bold' }}>
                      📦 Limites de Quantidade (Estoque / Medição)
                    </label>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                      <div>
                        <label className="input-label" style={{ fontSize: '0.8rem' }}>Mínimo Exigido (MIN)</label>
                        <input 
                          type="number" 
                          step="any"
                          className="input-field" 
                          placeholder="Ex: 10" 
                          value={task.minQuantity !== undefined && task.minQuantity !== null ? task.minQuantity : (task.minStock !== undefined ? task.minStock : '')} 
                          onChange={e => {
                            const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                            updateTask(task.id, 'minQuantity', val);
                            updateTask(task.id, 'minStock', val);
                          }} 
                        />
                      </div>

                      <div>
                        <label className="input-label" style={{ fontSize: '0.8rem' }}>Máximo Limite (MAX)</label>
                        <input 
                          type="number" 
                          step="any"
                          className="input-field" 
                          placeholder="Ex: 20" 
                          value={task.maxQuantity !== undefined && task.maxQuantity !== null ? task.maxQuantity : ''} 
                          onChange={e => updateTask(task.id, 'maxQuantity', e.target.value === '' ? '' : parseFloat(e.target.value))} 
                        />
                      </div>

                      <div>
                        <label className="input-label" style={{ fontSize: '0.8rem' }}>Unidade de Medida</label>
                        <select 
                          className="input-field" 
                          value={task.unit || 'un'} 
                          onChange={e => updateTask(task.id, 'unit', e.target.value)}
                        >
                          <option value="un">un (Unidades)</option>
                          <option value="kg">kg (Quilos)</option>
                          <option value="g">g (Gramas)</option>
                          <option value="L">L (Litros)</option>
                          <option value="ml">ml (Mililitros)</option>
                          <option value="cx">cx (Caixas)</option>
                          <option value="pct">pct (Pacotes)</option>
                          <option value="°C">°C (Graus Celsius)</option>
                        </select>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', display: 'block' }}>
                      💡 O funcionário verá esses limites durante a execução e será alertado se estiver abaixo do mínimo ou acima do máximo.
                    </span>
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

                   {task.requirePhoto && (
                     <div style={{ flex: '1', minWidth: '130px' }}>
                       <label className="input-label">Máx. de Fotos</label>
                       <select className="input-field" value={task.maxPhotos || 1}
                         onChange={e => updateTask(task.id, 'maxPhotos', parseInt(e.target.value))}>
                         <option value={1}>1 foto</option>
                         <option value={2}>2 fotos</option>
                         <option value={3}>3 fotos</option>
                         <option value={4}>4 fotos</option>
                       </select>
                     </div>
                   )}
 
                   <div style={{ flex: '1', minWidth: '150px' }}>
                     <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                       <Clock size={14} /> Hora Limite (Opcional)
                     </label>
                     <input type="time" className="input-field" value={task.timeLimit || ''}
                       onChange={e => updateTask(task.id, 'timeLimit', e.target.value)} />
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

      {/* Modal de Criação por IA — Chat Unificado */}
      {showAIModal && (
        <div className="modal-overlay animate-fade">
          <div className="modal-content" style={{ maxWidth: '580px', width: '94%', padding: '0', position: 'relative', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(6,182,212,0.3)' }}>
                  <Bot size={22} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>Bill IA</div>
                  <div style={{ fontSize: '0.75rem', color: isAIGenerating ? '#06b6d4' : 'var(--success)' }}>
                      {isAIGenerating ? 'escutando e analisando...' : isTranscribing ? 'processando áudio...' : 'online'}
                  </div>
                </div>
              </div>
              <button
                style={{ padding: '8px', borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onClick={() => { if (!isAIGenerating && !isRecording && !isTranscribing) { setShowAIModal(false); resetAIModal(); } }}
                disabled={isAIGenerating || isRecording || isTranscribing}
              >
                <X size={20} color="var(--text-muted)" />
              </button>
            </div>

            {/* Chat area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '280px' }}>
              {/* Welcome message (always shown) */}
              {aiConversation.length === 0 && (
                <div className="ai-chat-bubble bill">
                  <strong style={{ color: '#06b6d4', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>🤖 Bill</strong>
                  <span>Olá! Eu sou o Bill, seu consultor para criar checklists sob medida.</span><br/>
                  <span style={{ marginTop: '4px', display: 'inline-block' }}>Me explique o processo que você quer transformar em checklist — pode <strong>gravar um áudio</strong> 🎤 ou <strong>digitar</strong>. Fale naturalmente, como se estivesse explicando para um colega!</span><br/>
                  <span style={{ marginTop: '6px', display: 'inline-block', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Eu vou escutar com atenção, confirmar que entendi, e te fazer perguntas antes de montar o checklist perfeito. 💡</span>
                </div>
              )}

              {/* Chat messages */}
              {aiConversation.map((msg, i) => (
                <div key={i} className={`ai-chat-bubble ${msg.role === 'bill' ? 'bill' : 'user'}`}>
                  {msg.role === 'bill' && <strong style={{ color: '#06b6d4', fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>🤖 Bill</strong>}
                  {msg.content.split('\n').map((line, j) => <span key={j}>{line}<br/></span>)}

                  {msg.type === 'upgrade_offer' && (
                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {(!userPlan || userPlan === 'starter' || userPlan === 'start') && (
                        <button
                          className="btn"
                          style={{
                            padding: '12px', fontSize: '0.85rem', width: '100%',
                            background: 'linear-gradient(135deg, var(--primary), #FF6622)',
                            color: 'white', border: 'none', borderRadius: '8px',
                            cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(255, 77, 0, 0.2)'
                          }}
                          onClick={() => {
                            const profile = JSON.parse(localStorage.getItem('user') || '{}');
                            window.open(`https://pay.cakto.com.br/e7c88df?email=${encodeURIComponent(profile?.email || '')}`, '_blank');
                          }}
                        >
                          Upgrade Pro — R$97/mês (100 criações por IA)
                        </button>
                      )}
                      {(userPlan === 'pro' || userPlan === 'mensal' || userPlan === 'starter' || userPlan === 'start') && (
                        <button
                          className="btn"
                          style={{
                            padding: '12px', fontSize: '0.85rem', width: '100%',
                            background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                            color: 'white', border: 'none', borderRadius: '8px',
                            cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(6, 182, 212, 0.2)'
                          }}
                          onClick={() => {
                            const profile = JSON.parse(localStorage.getItem('user') || '{}');
                            window.open(`https://pay.cakto.com.br/iy4399h?email=${encodeURIComponent(profile?.email || '')}`, '_blank');
                          }}
                        >
                          Upgrade Business — R$197/mês (250 criações por IA)
                        </button>
                      )}
                      <button
                        className="btn-secondary"
                        style={{
                          padding: '12px', fontSize: '0.85rem', width: '100%',
                          border: '1px solid var(--border-color)', borderRadius: '8px',
                          cursor: 'pointer', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)'
                        }}
                        onClick={() => window.open('https://wa.me/5522998851680?text=Olá,%20preciso%20de%20um%20plano%20Custom%20com%20mais%20checklists%20no%20FireCheck.', '_blank')}
                      >
                        💬 Falar no WhatsApp (Plano Custom)
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {isAIGenerating && (
                <div className="ai-chat-bubble bill">
                  <strong style={{ color: '#06b6d4', fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>🤖 Bill</strong>
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#06b6d4', animation: 'mic-glow 1s infinite' }} />
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#06b6d4', animation: 'mic-glow 1s infinite 0.2s' }} />
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#06b6d4', animation: 'mic-glow 1s infinite 0.4s' }} />
                    <span style={{ marginLeft: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Escutando e analisando o que você disse...</span>
                  </div>
                </div>
              )}

              {/* Transcribing indicator */}
              {isTranscribing && (
                <div className="ai-chat-bubble bill" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '20px', height: '20px', border: '3px solid rgba(6,182,212,0.2)', borderTopColor: '#06b6d4', borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Ouvindo seu áudio...</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Recording bar (shown when recording) */}
            {isRecording && (
              <div style={{ padding: '12px 24px', background: 'rgba(239, 68, 68, 0.08)', borderTop: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', animation: 'mic-glow 1s infinite' }} />
                  <span style={{ color: '#ef4444', fontWeight: '600', fontSize: '0.9rem' }}>🎤 Gravando {formatRecordingTime(recordingTime)}</span>
                </div>
                <div className="ai-waveform" style={{ margin: 0, flex: 1, maxWidth: '120px' }}>
                  {Array.from({ length: 7 }).map((_, i) => <span key={i} style={{ background: '#ef4444' }} />)}
                </div>
                <button
                  onClick={stopRecording}
                  style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <MicOff size={16} /> Parar
                </button>
              </div>
            )}

            {/* Input bar (always shown when not recording) */}
            {!isRecording && (
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px', alignItems: 'flex-end', flexShrink: 0, background: 'var(--bg-card)' }}>
                <textarea
                  id="ai-chat-textarea"
                  className="input-field"
                  style={{ flex: 1, resize: 'none', minHeight: '44px', maxHeight: '120px', padding: '12px 14px', fontSize: '0.9rem', lineHeight: '1.4', borderRadius: '12px' }}
                  placeholder={isTranscribing ? 'Transcrevendo seu áudio...' : 'Descreva o checklist ou grave um áudio...'}
                  value={aiChatInput}
                  onChange={e => setAiChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && aiChatInput.trim() && !isAIGenerating && !isTranscribing) { e.preventDefault(); handleSendToAI(aiChatInput, aiConversation); } }}
                  disabled={isAIGenerating || isTranscribing}
                  rows={1}
                  onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
                />

                {/* Mic button */}
                <button
                  onClick={startRecording}
                  disabled={isAIGenerating || isTranscribing}
                  title="Gravar áudio"
                  style={{
                    width: '44px', height: '44px', borderRadius: '50%', border: 'none', cursor: isAIGenerating || isTranscribing ? 'not-allowed' : 'pointer',
                    background: isTranscribing ? 'var(--border-color)' : 'linear-gradient(135deg, var(--primary), #FF6622)',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    opacity: isAIGenerating || isTranscribing ? 0.5 : 1, transition: 'all 0.2s',
                    boxShadow: isAIGenerating || isTranscribing ? 'none' : '0 4px 12px rgba(255, 77, 0, 0.25)'
                  }}
                >
                  <Mic size={20} />
                </button>

                {/* Send button */}
                <button
                  onClick={() => aiChatInput.trim() && handleSendToAI(aiChatInput, aiConversation)}
                  disabled={!aiChatInput.trim() || isAIGenerating || isTranscribing}
                  title="Enviar"
                  style={{
                    width: '44px', height: '44px', borderRadius: '50%', border: 'none', cursor: !aiChatInput.trim() || isAIGenerating || isTranscribing ? 'not-allowed' : 'pointer',
                    background: aiChatInput.trim() && !isAIGenerating && !isTranscribing ? 'linear-gradient(135deg, #06b6d4, #0891b2)' : 'var(--border-color)',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    transition: 'all 0.2s',
                    boxShadow: aiChatInput.trim() && !isAIGenerating && !isTranscribing ? '0 4px 12px rgba(6, 182, 212, 0.3)' : 'none'
                  }}
                >
                  <Send size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
