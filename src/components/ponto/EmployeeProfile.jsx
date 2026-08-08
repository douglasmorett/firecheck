import React, { useState, useEffect } from 'react';
import { ArrowLeft, UserCircle, MapPin, Calendar as CalendarIcon, Clock, CheckCircle, AlertTriangle, Filter, CalendarDays, List, ShieldAlert } from 'lucide-react';
import API_URL from '../../api';

export default function EmployeeProfile({ employee, onBack, schedules, userProfile, pontoRecords, onUpdateEmployee }) {
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
  const [savingSchedule, setSavingSchedule] = useState(false);
  
  // Date filtering (defaults to current month)
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const [filterMonth, setFilterMonth] = useState(`${currentYear}-${String(currentMonth).padStart(2, '0')}`);

  // Schedule setup
  const [selectedSchedule, setSelectedSchedule] = useState(employee.schedule_id || '');
  const [lastWorkedDay, setLastWorkedDay] = useState(employee.ponto_last_worked_day ? employee.ponto_last_worked_day.split('T')[0] : '');

  const scheduleObj = schedules.find(s => s.id === (selectedSchedule ? Number(selectedSchedule) : null));
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

  // Filter records by the selected month
  const filteredRecords = pontoRecords.filter(r => {
    const rDate = new Date(r.timestamp);
    const rMonthStr = `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}`;
    return rMonthStr === filterMonth;
  });

  // Calculate stats for the selected month
  const totalRegistros = filteredRecords.length;
  const atrasos = filteredRecords.filter(r => {
    if (r.type !== 'entrada') return false;
    // VERY BASIC calculation for now, just checking if it exists
    // Advanced calculation would compare r.timestamp with sch.hora_entrada + tolerancia
    return false; // Implement advanced logic if needed
  }).length;

  // Calendar logic
  const renderCalendar = () => {
    const [year, month] = filterMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDay = new Date(year, month - 1, 1).getDay(); // 0 (Sun) to 6 (Sat)
    
    let days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} style={{ padding: '10px' }}></div>);
    }

    // 12x36 logic parsing
    let lastWorkedDateObj = null;
    if (is12x36 && lastWorkedDay) {
      const [wYear, wMonth, wDay] = lastWorkedDay.split('-').map(Number);
      lastWorkedDateObj = new Date(wYear, wMonth - 1, wDay);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const currentDate = new Date(year, month - 1, d);
      const currentDateStr = currentDate.toISOString().split('T')[0];
      
      // Check if worked this day
      const dayRecords = filteredRecords.filter(r => {
        const rDate = new Date(r.timestamp);
        return rDate.getDate() === d;
      });
      const hasRecords = dayRecords.length > 0;

      // Project if it's a workday
      let isProjectedWorkday = true;
      if (is12x36 && lastWorkedDateObj) {
        const diffTime = Math.abs(currentDate - lastWorkedDateObj);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (currentDate < lastWorkedDateObj) {
          isProjectedWorkday = diffDays % 2 === 0; // If before, even diff means worked
        } else {
          isProjectedWorkday = diffDays % 2 === 0; // If after, even diff means worked
        }
      } else if (scheduleObj && scheduleObj.type === 'fixed') {
        let wds = [];
        try { wds = typeof scheduleObj.weekdays === 'string' ? JSON.parse(scheduleObj.weekdays) : scheduleObj.weekdays; } catch(e){}
        const wdInfo = wds.find(w => w.weekday === currentDate.getDay());
        if (wdInfo) isProjectedWorkday = wdInfo.is_workday;
      } else if (!scheduleObj) {
        isProjectedWorkday = currentDate.getDay() !== 0 && currentDate.getDay() !== 6; // Default to Mon-Fri if no schedule
      }

      let bgColor = 'var(--bg-main)';
      let color = 'var(--text-main)';
      let border = '1px solid var(--border-color)';

      if (hasRecords) {
        bgColor = 'rgba(16, 185, 129, 0.1)';
        border = '1px solid rgba(16, 185, 129, 0.3)';
        color = '#10B981';
      } else if (!isProjectedWorkday) {
        bgColor = 'rgba(59, 130, 246, 0.05)';
        color = 'var(--text-muted)';
      } else if (currentDate < new Date() && !hasRecords && isProjectedWorkday) {
        bgColor = 'rgba(239, 68, 68, 0.05)';
        border = '1px solid rgba(239, 68, 68, 0.3)';
        color = '#EF4444';
      }

      days.push(
        <div key={d} style={{ 
          backgroundColor: bgColor, border, color,
          height: '80px', borderRadius: '8px', padding: '8px',
          display: 'flex', flexDirection: 'column'
        }}>
          <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{d}</span>
          <div style={{ flex: 1 }}></div>
          {hasRecords && <span style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={10}/> Presença</span>}
          {(!hasRecords && !isProjectedWorkday) && <span style={{ fontSize: '0.7rem', color: '#3B82F6' }}>Folga</span>}
          {(currentDate < new Date() && !hasRecords && isProjectedWorkday) && <span style={{ fontSize: '0.7rem' }}>Falta</span>}
        </div>
      );
    }

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>{d}</div>
        ))}
        {days}
      </div>
    );
  };

  return (
    <div className="animate-fade-up">
      {/* Voltar e Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={onBack} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '8px', cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={20} color="var(--text-main)" />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.5rem', color: '#fff', fontWeight: 'bold' }}>{employee.name.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-main)' }}>{employee.name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <UserCircle size={14}/> {employee.email}
              </span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-main)', padding: '2px 8px', borderRadius: '12px' }}>
                {employee.role === 'gestor' ? 'Gestor' : 'Funcionário'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Sidebar: Configurações da Escala */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarIcon size={18} color="var(--primary)" /> Vínculo de Escala
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="input-label">Selecione a Escala</label>
              <select className="input-field" value={selectedSchedule || ''} onChange={e => setSelectedSchedule(e.target.value)}>
                <option value="">Sem escala definida (Usa regras gerais)</option>
                {schedules.map(sch => (
                  <option key={sch.id} value={sch.id}>{sch.name} ({sch.type === '12x36' ? '12x36' : 'Fixa'})</option>
                ))}
              </select>
            </div>

            {is12x36 && (
              <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }} className="animate-fade">
                <label className="input-label" style={{ color: '#3B82F6' }}>Último dia trabalhado</label>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
                  Para calcular as folgas da escala 12x36, informe qual foi o último dia em que ele trabalhou (ou o primeiro dia que ele irá trabalhar).
                </p>
                <input 
                  type="date" 
                  className="input-field" 
                  value={lastWorkedDay} 
                  onChange={e => setLastWorkedDay(e.target.value)} 
                />
              </div>
            )}

            <button className="btn-primary" onClick={handleSaveScheduleConfig} disabled={savingSchedule} style={{ marginTop: '8px', padding: '12px' }}>
              {savingSchedule ? 'Salvando...' : 'Salvar Regras'}
            </button>
          </div>
        </div>

        {/* Main Area: Relatórios e Filtros */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Stats Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--primary)' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Registros (Mês)</p>
              <h3 style={{ margin: '8px 0 0 0', fontSize: '2rem' }}>{totalRegistros}</h3>
            </div>
            <div className="card" style={{ padding: '20px', borderLeft: '4px solid #10B981' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dias Trabalhados</p>
              <h3 style={{ margin: '8px 0 0 0', fontSize: '2rem' }}>{new Set(filteredRecords.map(r => r.timestamp.split('T')[0])).size}</h3>
            </div>
            <div className="card" style={{ padding: '20px', borderLeft: '4px solid #F59E0B' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Possíveis Atrasos</p>
              <h3 style={{ margin: '8px 0 0 0', fontSize: '2rem', color: '#F59E0B' }}>{atrasos}</h3>
            </div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', backgroundColor: 'var(--bg-main)', padding: '6px', borderRadius: '12px' }}>
                <button 
                  onClick={() => setViewMode('list')}
                  style={{ 
                    background: viewMode === 'list' ? 'var(--bg-card)' : 'transparent',
                    border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px', fontWeight: viewMode === 'list' ? 'bold' : 'normal',
                    boxShadow: viewMode === 'list' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                    color: viewMode === 'list' ? 'var(--text-main)' : 'var(--text-muted)'
                  }}
                ><List size={16}/> Logs</button>
                <button 
                  onClick={() => setViewMode('calendar')}
                  style={{ 
                    background: viewMode === 'calendar' ? 'var(--bg-card)' : 'transparent',
                    border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px', fontWeight: viewMode === 'calendar' ? 'bold' : 'normal',
                    boxShadow: viewMode === 'calendar' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                    color: viewMode === 'calendar' ? 'var(--text-main)' : 'var(--text-muted)'
                  }}
                ><CalendarDays size={16}/> Calendário</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={16} color="var(--text-muted)" />
                <input 
                  type="month" 
                  className="input-field" 
                  value={filterMonth}
                  onChange={e => setFilterMonth(e.target.value)}
                  style={{ padding: '8px 12px' }}
                />
              </div>
            </div>

            {/* View Mode: Calendário */}
            {viewMode === 'calendar' && renderCalendar()}

            {/* View Mode: Lista de Logs */}
            {viewMode === 'list' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredRecords.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Nenhum registro de ponto encontrado para este mês.
                  </div>
                ) : (
                  filteredRecords.map((rec) => {
                    const dt = new Date(rec.timestamp);
                    const dataStr = dt.toLocaleDateString('pt-BR');
                    const horaStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={rec.id} style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '16px', border: '1px solid var(--border-color)', borderRadius: '12px',
                        backgroundColor: 'var(--bg-card)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <img 
                            src={rec.selfie} 
                            alt="Selfie" 
                            style={{ width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover', border: '2px solid var(--border-color)' }} 
                          />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{rec.type === 'entrada' ? 'Entrada' : 'Saída'}</h4>
                              <span style={{ fontSize: '0.8rem', backgroundColor: rec.type === 'entrada' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: rec.type === 'entrada' ? '#10B981' : '#F59E0B', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                                {horaStr}
                              </span>
                            </div>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <CalendarIcon size={14} /> {dataStr}
                            </p>
                          </div>
                        </div>
                        
                        <div style={{ maxWidth: '300px', textAlign: 'right' }}>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-main)', display: 'flex', alignItems: 'flex-start', gap: '4px', justifyContent: 'flex-end' }}>
                            <MapPin size={12} style={{ marginTop: '2px', flexShrink: 0, color: 'var(--primary)' }} />
                            <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {rec.address}
                            </span>
                          </p>
                          {rec.accuracy && (
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: rec.accuracy > 100 ? '#F59E0B' : 'var(--text-muted)' }}>
                              Precisão GPS: {Math.round(rec.accuracy)}m
                            </p>
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
  );
}
