import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, UserCircle, MapPin, Calendar as CalendarIcon, Clock, CheckCircle, AlertTriangle, Filter, CalendarDays, List, Plus, X, Camera, MoreVertical, Building2, ShieldAlert } from 'lucide-react';
import API_URL from '../../api';

export default function EmployeeProfile({ employee, onBack, schedules, userProfile, pontoRecords, onUpdateEmployee, mesSelecionado, onMesChange }) {
  const [viewMode, setViewMode] = useState('list');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
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
  const [savingNewSchedule, setSavingNewSchedule] = useState(false);
  const [newScheduleError, setNewScheduleError] = useState(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  // O mês vem do módulo pai quando ele o controla: assim, trocar o período aqui
  // recarrega os registros daquele mês em vez de filtrar dados que nunca foram
  // buscados — antes, só o mês corrente tinha conteúdo e os demais saíam vazios.
  const filterMonth = mesSelecionado || `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const setFilterMonth = (m) => { if (onMesChange) onMesChange(m); };

  const [selectedSchedule, setSelectedSchedule] = useState(employee.schedule_id || '');
  const [lastWorkedDay, setLastWorkedDay] = useState(employee.ponto_last_worked_day ? employee.ponto_last_worked_day.split('T')[0] : '');

  const scheduleObj = Array.isArray(schedules) ? schedules.find(s => s.id === (selectedSchedule ? Number(selectedSchedule) : null)) : null;
  const is12x36 = scheduleObj?.type === '12x36';

  const handleSaveScheduleConfig = async () => {
    setSavingSchedule(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${employee.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '')
        },
        body: JSON.stringify({
          schedule_id: selectedSchedule || null,
          ponto_last_worked_day: is12x36 && lastWorkedDay ? lastWorkedDay : null
        })
      });
      if (res.ok) {
        alert('Configuração de escala salva com sucesso!');
        onUpdateEmployee();
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar configuração.');
    }
    setSavingSchedule(false);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Photo = event.target.result;
      try {
        const res = await fetch(`${API_URL}/api/users/${employee.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '')
          },
          body: JSON.stringify({
            photo: base64Photo
          })
        });
        if (res.ok) {
          onUpdateEmployee();
        } else {
          alert('Erro ao atualizar foto');
        }
      } catch (err) {
        console.error(err);
        alert('Erro ao conectar ao servidor');
      } finally {
        setIsUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveNewSchedule = async () => {
    if (!scheduleForm.name) {
      setNewScheduleError('O nome da escala é obrigatório');
      return;
    }
    setSavingNewSchedule(true);
    setNewScheduleError(null);
    try {
      const res = await fetch(`${API_URL}/api/schedules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '')
        },
        body: JSON.stringify({ ...scheduleForm, store: userProfile.store })
      });
      if (res.ok) {
        setShowScheduleModal(false);
        onUpdateEmployee();
      } else {
        const data = await res.json();
        setNewScheduleError(data.error || 'Erro ao salvar escala');
      }
    } catch (err) {
      setNewScheduleError('Erro de conexão');
    }
    setSavingNewSchedule(false);
  };

  const filteredRecords = pontoRecords.filter(r => {
    const rDate = new Date(r.timestamp);
    const rMonthStr = `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}`;
    return rMonthStr === filterMonth;
  });

  const totalRegistros = filteredRecords.length;
  const workedDaysSet = new Set(filteredRecords.map(r => r.timestamp.split('T')[0]));
  const workedDays = workedDaysSet.size;

  let faltasProjetadas = 0;
  let atrasos = 0;
  
  if (scheduleObj) {
    const [year, month] = filterMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    
    // Parse weekdays if fixed
    let wds = [];
    if (scheduleObj && scheduleObj.type === 'fixed') {
      try { 
        const parsed = typeof scheduleObj.weekdays === 'string' ? JSON.parse(scheduleObj.weekdays) : scheduleObj.weekdays;
        wds = Array.isArray(parsed) ? parsed : [];
      } catch(e){}
    }
    
    let lastWorkedDateObj = null;
    if (is12x36 && lastWorkedDay) {
      const [wYear, wMonth, wDay] = lastWorkedDay.split('-').map(Number);
      lastWorkedDateObj = new Date(wYear, wMonth - 1, wDay);
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
      const currentDate = new Date(year, month - 1, d);
      if (currentDate > today) continue; 
      
      const currentDateStr = currentDate.toISOString().split('T')[0];
      const workedThatDay = workedDaysSet.has(currentDateStr);
      
      let isProjectedWorkday = true;
      if (is12x36 && lastWorkedDateObj) {
        const diffTime = Math.abs(currentDate - lastWorkedDateObj);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isProjectedWorkday = diffDays % 2 === 0;
      } else if (scheduleObj && scheduleObj.type === 'fixed') {
        const wdInfo = Array.isArray(wds) ? wds.find(w => w.weekday === currentDate.getDay()) : null;
        if (wdInfo) isProjectedWorkday = wdInfo.is_workday;
      }
      
      if (isProjectedWorkday && !workedThatDay) {
        faltasProjetadas++;
      }
      
      if (isProjectedWorkday && workedThatDay && scheduleObj && scheduleObj.type === 'fixed') {
        const wdInfo = Array.isArray(wds) ? wds.find(w => w.weekday === currentDate.getDay()) : null;
        if (wdInfo && wdInfo.hora_entrada) {
           const dayRecords = filteredRecords.filter(r => r.timestamp.split('T')[0] === currentDateStr);
           const entrada = Array.isArray(dayRecords) ? dayRecords.find(r => r.type === 'entrada') : null;
           if (entrada) {
             const entDate = new Date(entrada.timestamp);
             const [h, m] = wdInfo.hora_entrada.split(':').map(Number);
             const expectedDate = new Date(currentDate);
             expectedDate.setHours(h, m, 0, 0);
             const diffMins = (entDate - expectedDate) / 60000;
             if (diffMins > (scheduleObj.tolerancia || 15)) {
               atrasos++;
             }
           }
        }
      }
    }
  }

  const renderCalendar = () => {
    const [year, month] = filterMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDay = new Date(year, month - 1, 1).getDay();
    
    let days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} style={{ padding: '10px' }}></div>);
    }

    let lastWorkedDateObj = null;
    if (is12x36 && lastWorkedDay) {
      const [wYear, wMonth, wDay] = lastWorkedDay.split('-').map(Number);
      lastWorkedDateObj = new Date(wYear, wMonth - 1, wDay);
    }

    let wds = [];
    if (scheduleObj && scheduleObj.type === 'fixed') {
      try { wds = typeof scheduleObj.weekdays === 'string' ? JSON.parse(scheduleObj.weekdays) : scheduleObj.weekdays; } catch(e){}
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const currentDate = new Date(year, month - 1, d);
      const currentDateStr = currentDate.toISOString().split('T')[0];
      
      const dayRecords = filteredRecords.filter(r => r.timestamp.split('T')[0] === currentDateStr);
      const hasRecords = dayRecords.length > 0;

      let isProjectedWorkday = true;
      if (is12x36 && lastWorkedDateObj) {
        const diffTime = Math.abs(currentDate - lastWorkedDateObj);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isProjectedWorkday = diffDays % 2 === 0;
      } else if (scheduleObj && scheduleObj.type === 'fixed') {
        const wdInfo = wds.find(w => w.weekday === currentDate.getDay());
        if (wdInfo) isProjectedWorkday = wdInfo.is_workday;
      } else if (!scheduleObj) {
        isProjectedWorkday = currentDate.getDay() !== 0 && currentDate.getDay() !== 6;
      }

      let bgColor = 'var(--bg-main)';
      let color = 'var(--text-main)';
      let border = '1px solid var(--border-color)';

      if (hasRecords) {
        bgColor = 'rgba(16, 185, 129, 0.08)';
        border = '1px solid rgba(16, 185, 129, 0.2)';
        color = '#10B981';
      } else if (!isProjectedWorkday) {
        bgColor = 'rgba(59, 130, 246, 0.03)';
        color = 'var(--text-muted)';
        border = '1px dashed var(--border-color)';
      } else if (currentDate < new Date() && !hasRecords && isProjectedWorkday) {
        bgColor = 'rgba(239, 68, 68, 0.05)';
        border = '1px solid rgba(239, 68, 68, 0.3)';
        color = '#EF4444';
      }

      days.push(
        <div key={d} style={{ 
          backgroundColor: bgColor, border, color,
          height: '85px', borderRadius: '12px', padding: '8px',
          display: 'flex', flexDirection: 'column', transition: 'all 0.2s', cursor: 'pointer'
        }} className="hover-lift">
          <span style={{ fontWeight: '600', fontSize: '1rem', alignSelf: 'flex-start' }}>{d}</span>
          <div style={{ flex: 1 }}></div>
          {hasRecords && <span style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}><CheckCircle size={12}/> Presente</span>}
          {(!hasRecords && !isProjectedWorkday) && <span style={{ fontSize: '0.7rem', color: '#3B82F6' }}>Folga</span>}
          {(currentDate < new Date() && !hasRecords && isProjectedWorkday) && <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>Falta</span>}
        </div>
      );
    }

    return (
      <div className="animate-fade" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px' }}>
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontWeight: '600', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>{d}</div>
        ))}
        {days}
      </div>
    );
  };

  return (
    <div className="animate-fade-up" style={{ paddingBottom: '40px' }}>
      {/* Premium Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(59, 130, 246, 0.05) 100%)',
        border: '1px solid var(--border-color)',
        borderRadius: '20px',
        padding: '30px',
        marginBottom: '24px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.04)'
      }}>
        {/* Background decorative elements */}
        <div style={{ position: 'absolute', top: -50, right: -50, width: '200px', height: '200px', borderRadius: '50%', background: 'var(--primary)', opacity: 0.05, filter: 'blur(30px)' }}></div>
        <div style={{ position: 'absolute', bottom: -50, left: 200, width: '150px', height: '150px', borderRadius: '50%', background: '#10B981', opacity: 0.05, filter: 'blur(30px)' }}></div>

        <button onClick={onBack} className="hover-lift" style={{ position: 'absolute', top: '24px', left: '24px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px', cursor: 'pointer', display: 'flex', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <ArrowLeft size={20} color="var(--text-main)" />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '30px', marginTop: '40px', position: 'relative', zIndex: 1 }}>
          <div style={{ position: 'relative' }}>
            <div style={{ 
              width: '120px', height: '120px', borderRadius: '50%', 
              backgroundColor: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(0,0,0,0.1)', border: '4px solid var(--bg-card)', overflow: 'hidden'
            }}>
              {employee.photo ? (
                <img src={employee.photo} alt={employee.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '3rem', color: 'var(--primary)', fontWeight: 'bold' }}>{employee.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingPhoto}
              className="hover-lift"
              style={{
                position: 'absolute', bottom: '0', right: '0',
                background: 'var(--primary)', border: 'none', borderRadius: '50%',
                width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: isUploadingPhoto ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)', color: 'white'
              }}
            >
              {isUploadingPhoto ? <div className="animate-spin" style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }}></div> : <Camera size={18} />}
            </button>
            <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handlePhotoUpload} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '2.2rem', color: 'var(--text-main)', fontWeight: '800', letterSpacing: '-0.5px' }}>{employee.name}</h2>
              <span style={{ fontSize: '0.85rem', color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle size={14} /> Ativo
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginTop: '12px' }}>
              <span style={{ fontSize: '1rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserCircle size={18} color="var(--primary)"/> {employee.email}
              </span>
              <span style={{ fontSize: '1rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 size={18} color="var(--primary)"/> {employee.role === 'gestor' ? 'Gestor' : 'Funcionário'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Sidebar: Configurações da Escala */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card hover-lift" style={{ padding: '24px', borderTop: '4px solid var(--primary)', borderRadius: '20px' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CalendarIcon size={22} color="var(--primary)" /> Regra de Ponto
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="input-label" style={{ fontSize: '0.9rem' }}>Escala Vinculada</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select className="input-field" style={{ flex: 1, backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '12px' }} value={selectedSchedule || ''} onChange={e => setSelectedSchedule(e.target.value)}>
                    <option value="">Nenhuma (Horário Livre)</option>
                    {schedules.map(sch => (
                      <option key={sch.id} value={sch.id}>{sch.name} ({sch.type === '12x36' ? '12x36' : 'Fixa'})</option>
                    ))}
                  </select>
                </div>
                <button className="btn-secondary" onClick={() => setShowScheduleModal(true)} style={{ marginTop: '12px', width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.9rem', borderRadius: '10px' }}>
                  <Plus size={16} /> Nova Escala
                </button>
              </div>

              {is12x36 && (
                <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }} className="animate-fade">
                  <label className="input-label" style={{ color: '#3B82F6', fontSize: '0.9rem' }}>Último dia trabalhado</label>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
                    Base para cálculo automático das folgas intercaladas.
                  </p>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={lastWorkedDay} 
                    onChange={e => setLastWorkedDay(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-main)', border: 'none', padding: '12px', borderRadius: '10px' }} 
                  />
                </div>
              )}

              <button className="btn-primary hover-lift" onClick={handleSaveScheduleConfig} disabled={savingSchedule} style={{ marginTop: '8px', width: '100%', padding: '14px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold', fontSize: '1.05rem', boxShadow: '0 8px 24px rgba(255, 136, 0, 0.3)' }}>
                {savingSchedule ? <div className="animate-spin" style={{ width: '20px', height: '20px', border: '3px solid white', borderTopColor: 'transparent', borderRadius: '50%' }}></div> : <CheckCircle size={20} />}
                {savingSchedule ? 'Salvando...' : 'Salvar Regras'}
              </button>
            </div>
          </div>
        </div>

        {/* Main Area: Relatórios e Filtros */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Stats Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <div className="card hover-lift" style={{ padding: '24px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '20px', background: 'linear-gradient(to right, var(--bg-card), rgba(16, 185, 129, 0.05))' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CalendarDays size={28} color="#10B981" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dias Trabalhados</p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '2.2rem', color: 'var(--text-main)' }}>{workedDays}</h3>
              </div>
            </div>
            
            <div className="card hover-lift" style={{ padding: '24px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '20px', background: 'linear-gradient(to right, var(--bg-card), rgba(245, 158, 11, 0.05))' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={28} color="#F59E0B" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Atrasos (Mês)</p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '2.2rem', color: '#F59E0B' }}>{atrasos}</h3>
              </div>
            </div>

            <div className="card hover-lift" style={{ padding: '24px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '20px', background: 'linear-gradient(to right, var(--bg-card), rgba(239, 68, 68, 0.05))' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldAlert size={28} color="#EF4444" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Faltas Projetadas</p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '2.2rem', color: '#EF4444' }}>{faltasProjetadas}</h3>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '0', borderRadius: '20px', overflow: 'hidden' }}>
            {/* Header da Tabela/Calendário */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
              <div style={{ display: 'flex', gap: '12px', backgroundColor: 'var(--bg-card)', padding: '6px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                <button 
                  onClick={() => setViewMode('list')}
                  style={{ 
                    background: viewMode === 'list' ? 'var(--primary)' : 'transparent',
                    border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px', fontWeight: viewMode === 'list' ? '600' : '500',
                    boxShadow: viewMode === 'list' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
                    color: viewMode === 'list' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s'
                  }}
                ><List size={18}/> Extrato de Pontos</button>
                <button 
                  onClick={() => setViewMode('calendar')}
                  style={{ 
                    background: viewMode === 'calendar' ? 'var(--primary)' : 'transparent',
                    border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px', fontWeight: viewMode === 'calendar' ? '600' : '500',
                    boxShadow: viewMode === 'calendar' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
                    color: viewMode === 'calendar' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s'
                  }}
                ><CalendarDays size={18}/> Visão Mensal</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--bg-card)', padding: '6px 16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <Filter size={18} color="var(--primary)" />
                <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted)' }}>Período:</span>
                <input 
                  type="month" 
                  value={filterMonth}
                  onChange={e => setFilterMonth(e.target.value)}
                  style={{ padding: '6px 8px', border: 'none', background: 'transparent', color: 'var(--text-main)', fontWeight: 'bold', fontSize: '1rem', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ padding: '30px' }}>
              {/* View Mode: Calendário */}
              {viewMode === 'calendar' && renderCalendar()}

              {/* View Mode: Lista de Logs */}
              {viewMode === 'list' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {filteredRecords.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
                      <Clock size={48} color="var(--border-color)" style={{ marginBottom: '16px' }} />
                      <h3 style={{ margin: '0 0 8px 0' }}>Nenhum ponto batido</h3>
                      <p style={{ margin: 0 }}>O funcionário não registrou presença neste mês.</p>
                    </div>
                  ) : (
                    filteredRecords.map((rec) => {
                      // A API entrega data_local e hora_local já no fuso da loja.
                      // Reconverter aqui com new Date() deslocava o extrato em 3
                      // horas, porque o timestamp guardado não carrega fuso.
                      const dt = new Date(rec.timestamp);
                      const dataStr = rec.data_local || dt.toLocaleDateString('pt-BR');
                      const horaStr = rec.hora_local
                        || (String(rec.timestamp || '').match(/^\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2})/)?.[1])
                        || dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                      const isEntrada = rec.type === 'entrada';
                      
                      return (
                        <div key={rec.id} className="hover-lift" style={{ 
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '20px', border: '1px solid var(--border-color)', borderRadius: '16px',
                          backgroundColor: 'var(--bg-card)', position: 'relative', overflow: 'hidden'
                        }}>
                          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', backgroundColor: isEntrada ? '#10B981' : '#F59E0B' }}></div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', paddingLeft: '8px' }}>
                            <div style={{ position: 'relative' }}>
                              {/* A coluna no banco é selfie_url; rec.selfie era sempre
                                  indefinido e TODA selfie do extrato aparecia quebrada. */}
                              <img
                                src={rec.selfie_url || rec.selfie}
                                alt="Selfie"
                                style={{ width: '70px', height: '70px', borderRadius: '16px', objectFit: 'cover', border: '2px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} 
                              />
                              <div style={{ 
                                position: 'absolute', bottom: '-8px', right: '-8px', width: '28px', height: '28px', 
                                backgroundColor: isEntrada ? '#10B981' : '#F59E0B', borderRadius: '50%', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid var(--bg-card)' 
                              }}>
                                {isEntrada ? <ArrowLeft size={14} color="white" style={{ transform: 'rotate(-45deg)' }} /> : <ArrowLeft size={14} color="white" style={{ transform: 'rotate(135deg)' }} />}
                              </div>
                            </div>
                            
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>{isEntrada ? 'Entrada Registrada' : 'Saída Registrada'}</h4>
                                <span style={{ fontSize: '0.9rem', backgroundColor: isEntrada ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: isEntrada ? '#10B981' : '#F59E0B', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold' }}>
                                  {horaStr}
                                </span>
                              </div>
                              <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <CalendarIcon size={16} color="var(--primary)" /> {dataStr}
                              </p>
                            </div>
                          </div>
                          
                          <div style={{ maxWidth: '350px', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', justifyContent: 'flex-end', backgroundColor: 'var(--bg-main)', padding: '10px 14px', borderRadius: '12px' }}>
                              <MapPin size={16} style={{ marginTop: '2px', flexShrink: 0, color: 'var(--primary)' }} />
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textAlign: 'left' }}>
                                {rec.address}
                              </span>
                            </div>
                            {rec.accuracy && (
                              <span style={{ fontSize: '0.8rem', color: rec.accuracy > 100 ? '#F59E0B' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', paddingRight: '4px' }}>
                                <CheckCircle size={12} color={rec.accuracy > 100 ? '#F59E0B' : '#10B981'} />
                                Precisão de {Math.round(rec.accuracy)} metros
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Modal de Nova Escala */}
      {showScheduleModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <div className="card animate-fade-up modal-janela" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', borderRadius: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700' }}>
                <CalendarIcon color="var(--primary)" size={24} /> Criar Nova Escala
              </h3>
              <button onClick={() => setShowScheduleModal(false)} style={{ background: 'var(--bg-main)', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex' }}>
                <X size={20} color="var(--text-muted)" />
              </button>
            </div>
            {newScheduleError && <div style={{ color: 'var(--error)', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '12px', marginBottom: '20px', fontSize: '0.95rem', fontWeight: '500' }}>{newScheduleError}</div>}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label className="input-label">Nome da Escala (Para identificação)</label>
                <input type="text" className="input-field" placeholder="Ex: Comercial Seg a Sex" value={scheduleForm.name} onChange={e => setScheduleForm({...scheduleForm, name: e.target.value})} style={{ padding: '14px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="input-label">Modelo Operacional</label>
                  <select className="input-field" value={scheduleForm.type} onChange={e => setScheduleForm({...scheduleForm, type: e.target.value})} style={{ padding: '14px' }}>
                    <option value="fixed">Jornada Semanal Fixa</option>
                    <option value="12x36">Plantão 12x36</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Cor de Identificação</label>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', padding: '8px 0' }}>
                    {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'].map(color => (
                      <button key={color} onClick={() => setScheduleForm({...scheduleForm, color})} style={{
                        width: '32px', height: '32px', borderRadius: '50%', backgroundColor: color, border: 'none', cursor: 'pointer',
                        boxShadow: scheduleForm.color === color ? '0 0 0 4px var(--bg-card), 0 0 0 6px var(--text-main)' : 'none', transition: 'all 0.2s'
                      }} />
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: 'var(--bg-main)', padding: '20px', borderRadius: '16px' }}>
                <div>
                  <label className="input-label" style={{ fontSize: '0.9rem' }}>Horário Entrada Padrão</label>
                  <input type="time" className="input-field" value={scheduleForm.hora_entrada} onChange={e => setScheduleForm({...scheduleForm, hora_entrada: e.target.value})} />
                </div>
                <div>
                  <label className="input-label" style={{ fontSize: '0.9rem' }}>Horário Saída Padrão</label>
                  <input type="time" className="input-field" value={scheduleForm.hora_saida} onChange={e => setScheduleForm({...scheduleForm, hora_saida: e.target.value})} />
                </div>
              </div>
              {scheduleForm.type === 'fixed' && (
                <div>
                  <label className="input-label" style={{ marginBottom: '12px', display: 'block' }}>Dias de Trabalho da Semana</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((dayName, idx) => {
                      const wd = scheduleForm.weekdays.find(w => w.weekday === idx) || { is_workday: false };
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', backgroundColor: wd.is_workday ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-main)', borderRadius: '12px', border: wd.is_workday ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid var(--border-color)', transition: 'all 0.2s' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <input type="checkbox" checked={wd.is_workday} onChange={e => {
                              const newWds = [...scheduleForm.weekdays];
                              const i = newWds.findIndex(w => w.weekday === idx);
                              if (i >= 0) newWds[i].is_workday = e.target.checked;
                              setScheduleForm({...scheduleForm, weekdays: newWds});
                            }} style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--primary)' }} />
                            <span style={{ fontWeight: '600', color: wd.is_workday ? 'var(--primary)' : 'var(--text-main)' }}>{dayName}</span>
                          </div>
                          <span style={{ fontSize: '0.85rem', color: wd.is_workday ? 'var(--text-main)' : 'var(--text-muted)' }}>
                            {wd.is_workday ? `${scheduleForm.hora_entrada} - ${scheduleForm.hora_saida}` : 'Folga'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                <button className="btn-secondary" style={{ flex: 1, padding: '16px', borderRadius: '14px', fontSize: '1.05rem', fontWeight: '600' }} onClick={() => setShowScheduleModal(false)}>Cancelar</button>
                <button className="btn-primary hover-lift" style={{ flex: 1, padding: '16px', borderRadius: '14px', fontSize: '1.05rem', fontWeight: '600', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }} onClick={handleSaveNewSchedule} disabled={savingNewSchedule}>
                  {savingNewSchedule ? <div className="animate-spin" style={{ width: '20px', height: '20px', border: '3px solid white', borderTopColor: 'transparent', borderRadius: '50%' }}></div> : <CheckCircle size={20} />}
                  {savingNewSchedule ? 'Criando Escala...' : 'Criar Escala e Vincular'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}