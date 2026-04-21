import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Save, Trash2, Camera, ShieldCheck, Clock, CalendarClock } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import API_URL from '../api';

const RESPONSE_TYPES = [
  { value: 'check',    label: '☑️  Checkbox (Feito)' },
  { value: 'boolean',  label: '✅  Sim / Não' },
  { value: 'rating',   label: '⭐  Avaliação (1 a 5 estrelas)' },
  { value: 'numeric',  label: '🔢  Número (quantidade, temperatura…)' },
  { value: 'multiple', label: '📋  Múltipla Escolha' },
  { value: 'text',     label: '✏️  Texto Livre' },
];

const RECURRENCE_OPTIONS = [
  { value: '',        label: 'Sem recorrência (único)' },
  { value: 'daily',   label: 'Diário — repete todo dia' },
  { value: 'weekly',  label: 'Semanal — repete toda semana' },
  { value: 'monthly', label: 'Mensal — repete todo mês' },
];

const newTask = () => ({
  id: Date.now(),
  text: '',
  type: 'boolean',
  requirePhoto: false,
  timeLimit: '',
  notifyDelay: true,
  options: ['', ''],
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
  
  const [userPlan] = useState('pro');
  const [title, setTitle] = useState('');
  const [store, setStore] = useState('Centro');
  const [recurrence, setRecurrence] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [tasks, setTasks] = useState([newTask()]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Tenta carregar a loja do perfil do usuário logado
    try {
      const profile = JSON.parse(localStorage.getItem('user') || '{}');
      if (profile.store && !isEditing) {
        setStore(profile.store);
      }
    } catch (e) { console.error('Erro ao ler perfil para loja'); }

    if (isEditing) {
      fetch(`${API_URL}/api/checklists`)
        .then(res => res.json())
        .then(data => {
          const cl = data.find(c => String(c.id) === String(id));
          if (cl) {
            setTitle(cl.title);
            setStore(cl.store);
            setRecurrence(cl.recurrence);
            setScheduledDate(cl.scheduledDate);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: id || null,
          title, store, recurrence, scheduledDate, tasks
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
      <header style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
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
                  onChange={e => setStore(e.target.value)} 
                  placeholder="Nome da sua loja"
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Seu plano permite 1 loja ativa. Para gerenciar redes, assine o <strong>Plano Custom</strong>.
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
            {recurrence !== '' && (
              <span style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '4px', display: 'block' }}>
                ✅ O sistema vai distribuir automaticamente para os funcionários.
              </span>
            )}
          </div>
        </div>

        {/* Painel Direito */}
        <div style={{ flex: '2', minWidth: '350px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3>Tarefas ({tasks.length})</h3>
            <button className="btn btn-secondary" onClick={addTask} style={{ padding: '8px 16px' }}>
              <Plus size={16} /> Adicionar Tarefa
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {tasks.map((task, index) => (
              <div key={task.id} className="card" style={{ padding: '20px', backgroundColor: '#121318' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>Tarefa {index + 1}</span>
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
                    <input type="time" className="input-field" value={task.timeLimit}
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
    </div>
  );
}
