import React, { useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import API_URL from '../../api';
import Janela from './Janela';

const LETRAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const CORES = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

// Dias da escala como vêm do banco (texto JSON ou lista).
const diasDaEscala = (sch) => {
  try {
    const wds = typeof sch.weekdays === 'string' ? JSON.parse(sch.weekdays) : sch.weekdays;
    return Array.isArray(wds) ? wds : [];
  } catch (e) { return []; }
};

export default function SchedulesTab({ schedules, userProfile, onSchedulesChanged }) {
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  
  const [scheduleForm, setScheduleForm] = useState({
    name: '', type: 'fixed', hora_entrada: '08:00', hora_saida: '18:00', intervalo_inicio: '12:00', intervalo_fim: '13:00', tolerancia: 15, color: '#3B82F6',
    weekdays: [
      { weekday: 0, is_workday: false, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' },
      { weekday: 1, is_workday: true, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' },
      { weekday: 2, is_workday: true, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' },
      { weekday: 3, is_workday: true, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' },
      { weekday: 4, is_workday: true, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' },
      { weekday: 5, is_workday: true, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' },
      { weekday: 6, is_workday: false, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' }
    ]
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleEditSchedule = (sch) => {
    let parsedWd = scheduleForm.weekdays;
    try {
      if (typeof sch.weekdays === 'string') parsedWd = JSON.parse(sch.weekdays);
      else if (Array.isArray(sch.weekdays)) parsedWd = sch.weekdays;
    } catch(e) {}

    setScheduleForm({
      name: sch.name || '',
      type: sch.type || 'fixed',
      hora_entrada: sch.hora_entrada || '08:00',
      hora_saida: sch.hora_saida || '18:00',
      // O que está gravado: com '12:00' de reserva, quem tirou o almoço da
      // escala o via voltar sozinho na próxima edição.
      intervalo_inicio: sch.intervalo_inicio || '',
      intervalo_fim: sch.intervalo_fim || '',
      tolerancia: sch.tolerancia ?? 15,
      color: sch.color || '#3B82F6',
      weekdays: parsedWd
    });
    setEditingSchedule(sch);
    setShowScheduleModal(true);
  };

  const handleDeleteSchedule = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta escala? Funcionários vinculados a ela ficarão sem escala.')) return;
    try {
      const res = await fetch(`${API_URL}/api/schedules/${id}?store=${encodeURIComponent(userProfile.store)}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
      });
      if (res.ok) {
        onSchedulesChanged();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSchedule = async () => {
    if (!scheduleForm.name) {
      setError('O nome da escala é obrigatório');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = editingSchedule ? `${API_URL}/api/schedules/${editingSchedule.id}` : `${API_URL}/api/schedules`;
      const method = editingSchedule ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '')
        },
        body: JSON.stringify({
          ...scheduleForm,
          store: userProfile.store
        })
      });
      
      if (res.ok) {
        setShowScheduleModal(false);
        onSchedulesChanged();
      } else {
        const data = await res.json();
        setError(data.error || 'Erro ao salvar escala');
      }
    } catch (err) {
      console.error(err);
      setError('Erro de conexão');
    }
    setSaving(false);
  };

  const novaEscala = () => {
    setEditingSchedule(null);
    setScheduleForm({
      name: '', type: 'fixed', hora_entrada: '08:00', hora_saida: '18:00', intervalo_inicio: '12:00', intervalo_fim: '13:00', tolerancia: 15, color: '#3B82F6',
      weekdays: [
        { weekday: 0, is_workday: false, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' },
        { weekday: 1, is_workday: true, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' },
        { weekday: 2, is_workday: true, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' },
        { weekday: 3, is_workday: true, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' },
        { weekday: 4, is_workday: true, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' },
        { weekday: 5, is_workday: true, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' },
        { weekday: 6, is_workday: false, hora_entrada: '', hora_saida: '', intervalo_inicio: '', intervalo_fim: '' }
      ]
    });
    setShowScheduleModal(true);
  };

  return (
    <div className="pt-campos" style={{ gap: '18px' }}>
      <div className="pt-ferr">
        <div>
          <span className="fc-olho-rot">Jornadas</span>
          <h3 style={{ marginTop: '4px' }}>Tipos de Escalas e Jornadas</h3>
        </div>
        <button type="button" className="fc-pilula" onClick={novaEscala}>
          Nova Escala <i><Plus size={15} /></i>
        </button>
      </div>

      {schedules.length === 0 ? (
        <div className="card fc-vazio">
          <strong style={{ display: 'block', color: 'var(--text-main)', fontWeight: 600, marginBottom: '6px' }}>Nenhuma escala cadastrada</strong>
          Crie escalas como "Comercial 5x2", "Segurança 12x36" ou "Revezamento 6x1" para organizar sua equipe.
        </div>
      ) : (
        <div className="pt-grade" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {schedules.map(sch => {
            const wds = diasDaEscala(sch);
            return (
              <div key={sch.id} className="card pt-card pt-escala">
                <div className="pt-escala-t">
                  <div style={{ minWidth: 0 }}>
                    <span className="fc-dado" style={{ '--c': sch.color || '#3B82F6' }}>
                      {sch.type === '12x36' ? 'Escala 12x36' : (sch.type === 'fixed' ? 'Horário Fixo Semanal' : 'Revezamento')}
                    </span>
                    <h4>{sch.name}</h4>
                  </div>
                  <div className="pt-mini-acoes">
                    <button type="button" className="fc-mini-btn info" title="Editar escala" onClick={() => handleEditSchedule(sch)}><Edit2 size={13} /> Editar</button>
                    <button type="button" className="fc-mini-btn perigo" title="Excluir escala" aria-label="Excluir escala" onClick={() => handleDeleteSchedule(sch.id)}><Trash2 size={13} /></button>
                  </div>
                </div>

                <div className="pt-hora">
                  {sch.hora_entrada}–{sch.hora_saida}
                  {sch.intervalo_inicio && sch.intervalo_fim && (
                    <small>almoço <span className="mono">{sch.intervalo_inicio}–{sch.intervalo_fim}</span></small>
                  )}
                </div>

                {sch.type === '12x36' ? (
                  <p className="pt-nota">Trabalha 12 horas seguidas e folga 36 horas. A folga é dinâmica e se auto-calcula por funcionário.</p>
                ) : (
                  <div className="pt-semana" aria-label="Dias de trabalho">
                    {LETRAS.map((dia, idx) => {
                      const wd = wds.find(w => w.weekday === idx);
                      const trabalha = wd ? wd.is_workday : true;
                      return <span key={idx} className={trabalha ? 'on' : ''}><i />{dia}</span>;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Janela de escala (criar ou editar) */}
      {showScheduleModal && (
        <Janela rotulo="Escalas de Trabalho" titulo={editingSchedule ? 'Editar Escala' : 'Nova Escala'} onFechar={() => setShowScheduleModal(false)} larga>
          {error && <p className="pt-erro" style={{ marginBottom: '14px' }}>{error}</p>}

          <div className="pt-campos" style={{ gap: '16px' }}>
            <div>
              <label className="input-label">Nome da Escala</label>
              <input type="text" className="input-field" placeholder="Ex: Comercial 5x2, Portaria 12x36" value={scheduleForm.name} onChange={e => setScheduleForm({...scheduleForm, name: e.target.value})} />
            </div>

            <div className="pt-2col">
              <div>
                <label className="input-label">Tipo de Escala</label>
                <select className="input-field" value={scheduleForm.type} onChange={e => setScheduleForm({...scheduleForm, type: e.target.value})}>
                  <option value="fixed">Semanal Fixa (ex: 5x2, 6x1)</option>
                  <option value="12x36">Plantão 12x36</option>
                </select>
              </div>
              <div>
                <label className="input-label">Cor de Identificação</label>
                <div className="pt-cores">
                  {CORES.map(color => (
                    <button key={color} type="button" aria-label={`Cor ${color}`} className={scheduleForm.color === color ? 'on' : ''} onClick={() => setScheduleForm({...scheduleForm, color})} style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2col">
              <div>
                <label className="input-label">Horário de Entrada (Padrão)</label>
                <input type="time" className="input-field mono" value={scheduleForm.hora_entrada} onChange={e => setScheduleForm({...scheduleForm, hora_entrada: e.target.value})} />
              </div>
              <div>
                <label className="input-label">Horário de Saída (Padrão)</label>
                <input type="time" className="input-field mono" value={scheduleForm.hora_saida} onChange={e => setScheduleForm({...scheduleForm, hora_saida: e.target.value})} />
              </div>
            </div>

            {/* O intervalo já era gravado (12:00–13:00 fixo, escondido) mas não
                aparecia na tela: o gestor não tinha onde dizer o horário de
                almoço. Ele desconta das horas esperadas no banco de horas e faz
                a 2ª batida do dia aparecer como "Saída almoço". */}
            <div>
              <label className="input-label">Horário de Almoço / Intervalo</label>
              <div className="pt-2col">
                <input type="time" className="input-field mono" aria-label="Início do almoço" value={scheduleForm.intervalo_inicio || ''} onChange={e => setScheduleForm({...scheduleForm, intervalo_inicio: e.target.value})} />
                <input type="time" className="input-field mono" aria-label="Fim do almoço" value={scheduleForm.intervalo_fim || ''} onChange={e => setScheduleForm({...scheduleForm, intervalo_fim: e.target.value})} />
              </div>
              <p className="pt-dica">Saída e volta do almoço. Deixe em branco se a jornada não tem intervalo.</p>
            </div>

            {scheduleForm.type === 'fixed' && (
              <div>
                <label className="input-label">Dias de Trabalho da Semana</label>
                <p className="pt-dica" style={{ margin: '0 0 4px' }}>Selecione os dias em que o funcionário deve trabalhar.</p>
                <div className="pt-dias-form">
                  {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((dayName, idx) => {
                    const wd = scheduleForm.weekdays.find(w => w.weekday === idx) || { is_workday: false };
                    return (
                      <label key={idx}>
                        <span>
                          <input type="checkbox" checked={wd.is_workday} onChange={e => {
                            const newWds = [...scheduleForm.weekdays];
                            const i = newWds.findIndex(w => w.weekday === idx);
                            if (i >= 0) newWds[i].is_workday = e.target.checked;
                            else newWds.push({ weekday: idx, is_workday: e.target.checked });
                            setScheduleForm({...scheduleForm, weekdays: newWds});
                          }} />
                          {dayName}
                        </span>
                        <span className="fc-selo" style={{ '--c': wd.is_workday ? 'var(--ok)' : 'var(--text-muted)' }}><i /><span>{wd.is_workday ? 'Trabalha' : 'Folga'}</span></span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {scheduleForm.type === '12x36' && (
              <p className="pt-aviso" style={{ '--c': 'var(--ink)' }}>
                <strong>Sobre a 12x36:</strong> os dias de folga são calculados automaticamente para cada funcionário com base no "último dia trabalhado". Você poderá definir isso na ficha individual de cada funcionário.
              </p>
            )}

            <div className="pt-acoes" style={{ marginTop: '8px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowScheduleModal(false)}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={handleSaveSchedule} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Escala'}
              </button>
            </div>
          </div>
        </Janela>
      )}
    </div>
  );
}
