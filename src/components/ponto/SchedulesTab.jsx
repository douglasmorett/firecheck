import React, { useState } from 'react';
import { Calendar, Plus, Edit2, Trash2, Clock, X } from 'lucide-react';
import API_URL from '../../api';

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
      intervalo_inicio: sch.intervalo_inicio || '12:00',
      intervalo_fim: sch.intervalo_fim || '13:00',
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-color)' }}>
          Tipos de Escalas e Jornadas
        </h3>
        <button className="btn-primary" onClick={() => {
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
        }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px' }}>
          <Plus size={18} /> Nova Escala
        </button>
      </div>

      {schedules.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed var(--border-color)', borderRadius: '16px' }}>
          <Calendar size={48} color="var(--text-muted)" style={{ marginBottom: '16px', opacity: 0.5 }} />
          <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-main)' }}>Nenhuma escala cadastrada</h3>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Crie escalas como "Comercial 5x2", "Segurança 12x36" ou "Revezamento 6x1" para organizar sua equipe.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {schedules.map(sch => (
            <div key={sch.id} style={{ 
              backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', 
              border: '1px solid var(--border-color)', position: 'relative',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)', transition: 'transform 0.2s, box-shadow 0.2s'
            }} className="hover-lift">
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    width: '40px', height: '40px', borderRadius: '10px', 
                    backgroundColor: `${sch.color || '#3B82F6'}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: sch.color || '#3B82F6' }}></div>
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)' }}>{sch.name}</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {sch.type === '12x36' ? 'Escala 12x36' : (sch.type === 'fixed' ? 'Horário Fixo Semanal' : 'Revezamento')}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleEditSchedule(sch)} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><Edit2 size={14} /></button>
                  <button onClick={() => handleDeleteSchedule(sch.id)} style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#EF4444', display: 'flex' }}><Trash2 size={14} /></button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: '500' }}>
                <Clock size={16} color="var(--primary)" /> {sch.hora_entrada} às {sch.hora_saida}
              </div>

              {sch.type === '12x36' ? (
                <div style={{ backgroundColor: 'var(--bg-main)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                  Trabalha 12 horas seguidas e folga 36 horas. A folga é dinâmica e se auto-calcula por funcionário.
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
                  {['D','S','T','Q','Q','S','S'].map((day, idx) => {
                    let isActive = true;
                    try {
                      const wds = typeof sch.weekdays === 'string' ? JSON.parse(sch.weekdays) : sch.weekdays;
                      const wd = wds.find(w => w.weekday === idx);
                      if (wd) isActive = wd.is_workday;
                    } catch(e) {}
                    return (
                      <span key={idx} style={{ 
                        flex: 1, height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', 
                        backgroundColor: isActive ? (sch.color || '#3B82F6') : 'var(--bg-main)', 
                        color: isActive ? '#fff' : 'var(--text-muted)',
                        border: isActive ? 'none' : '1px solid var(--border-color)'
                      }}>
                        {day}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de Escala (mesmo do AdminDashboard, mas aqui) */}
      {showScheduleModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card animate-fade-up" style={{ width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar color="var(--primary)" /> {editingSchedule ? 'Editar Escala' : 'Nova Escala'}
              </h3>
              <button onClick={() => setShowScheduleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                <X size={20} color="var(--text-muted)" />
              </button>
            </div>

            {error && <div style={{ color: 'var(--error)', marginBottom: '16px', fontSize: '0.9rem' }}>{error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="input-label">Nome da Escala</label>
                <input type="text" className="input-field" placeholder="Ex: Comercial 5x2, Portaria 12x36" value={scheduleForm.name} onChange={e => setScheduleForm({...scheduleForm, name: e.target.value})} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="input-label">Tipo de Escala</label>
                  <select className="input-field" value={scheduleForm.type} onChange={e => setScheduleForm({...scheduleForm, type: e.target.value})}>
                    <option value="fixed">Semanal Fixa (ex: 5x2, 6x1)</option>
                    <option value="12x36">Plantão 12x36</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Cor de Identificação</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'].map(color => (
                      <button key={color} onClick={() => setScheduleForm({...scheduleForm, color})} style={{
                        width: '24px', height: '24px', borderRadius: '50%', backgroundColor: color, border: 'none', cursor: 'pointer',
                        boxShadow: scheduleForm.color === color ? '0 0 0 3px var(--bg-card), 0 0 0 5px var(--text-color)' : 'none'
                      }} />
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="input-label">Horário de Entrada (Padrão)</label>
                  <input type="time" className="input-field" value={scheduleForm.hora_entrada} onChange={e => setScheduleForm({...scheduleForm, hora_entrada: e.target.value})} />
                </div>
                <div>
                  <label className="input-label">Horário de Saída (Padrão)</label>
                  <input type="time" className="input-field" value={scheduleForm.hora_saida} onChange={e => setScheduleForm({...scheduleForm, hora_saida: e.target.value})} />
                </div>
              </div>

              {scheduleForm.type === 'fixed' && (
                <div>
                  <label className="input-label">Dias de Trabalho da Semana</label>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>Selecione os dias em que o funcionário deve trabalhar.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((dayName, idx) => {
                      const wd = scheduleForm.weekdays.find(w => w.weekday === idx) || { is_workday: false };
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <input type="checkbox" checked={wd.is_workday} onChange={e => {
                              const newWds = [...scheduleForm.weekdays];
                              const i = newWds.findIndex(w => w.weekday === idx);
                              if (i >= 0) newWds[i].is_workday = e.target.checked;
                              else newWds.push({ weekday: idx, is_workday: e.target.checked });
                              setScheduleForm({...scheduleForm, weekdays: newWds});
                            }} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                            <span style={{ fontWeight: '500' }}>{dayName}</span>
                          </div>
                          <span style={{ fontSize: '0.8rem', color: wd.is_workday ? 'var(--success)' : 'var(--text-muted)' }}>
                            {wd.is_workday ? 'Trabalha' : 'Folga'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {scheduleForm.type === '12x36' && (
                <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    <strong>ℹ️ Informação sobre 12x36:</strong> Na escala 12x36, os dias de folga são calculados automaticamente para cada funcionário com base no "último dia trabalhado". Você poderá definir isso na ficha individual de cada funcionário.
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button className="btn-secondary" style={{ flex: 1, padding: '12px' }} onClick={() => setShowScheduleModal(false)}>Cancelar</button>
                <button className="btn-primary" style={{ flex: 1, padding: '12px' }} onClick={handleSaveSchedule} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar Escala'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
