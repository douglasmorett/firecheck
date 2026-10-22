import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, UserCircle, MapPin, Calendar as CalendarIcon, Clock, CheckCircle, AlertTriangle, Filter, CalendarDays, List, Plus, X, Camera, MoreVertical, Building2, ShieldAlert, Edit2, Trash2, Repeat, Scale, CalendarCheck } from 'lucide-react';
import API_URL from '../../api';
import AbonoForm from './AbonoForm';
import { rotulosDoDia, minutosTrabalhados, formatarMinutos } from '../../utils/pontoBatidas';

const cabecalhos = (json) => ({
  ...(json ? { 'Content-Type': 'application/json' } : {}),
  'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '')
});
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '');
const comSinal = (min) => (min > 0 ? '+' : '') + formatarMinutos(min);

// Janela por cima da ficha. .modal-overlay não tem CSS no app: o estilo vai aqui.
function Janela({ titulo, onFechar, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', padding: '16px' }}>
      <div className="card animate-fade-up modal-janela" style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', borderRadius: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{titulo}</h3>
          <button onClick={onFechar} style={{ background: 'var(--bg-main)', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex' }}>
            <X size={18} color="var(--text-muted)" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

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

  // ── Banco de horas do mês (servidor) e correção de batidas pelo gestor ──
  // Antes, batida errada (saída batida como entrada) só se corrigia pelo
  // suporte: a API tinha PUT/DELETE em /api/ponto/record, mas nenhum botão.
  const hojeLoja = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const comAlmoco = !!(scheduleObj?.intervalo_inicio && scheduleObj?.intervalo_fim);
  const [saldoFunc, setSaldoFunc] = useState(null);
  const [batidaEmEdicao, setBatidaEmEdicao] = useState(null);
  const [salvandoBatida, setSalvandoBatida] = useState(false);
  const [erroBatida, setErroBatida] = useState('');
  const [abonoDia, setAbonoDia] = useState(null);

  const carregarSaldo = useCallback(async () => {
    const [a, m] = filterMonth.split('-').map(Number);
    const fimMes = `${filterMonth}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`;
    try {
      const res = await fetch(`${API_URL}/api/ponto/saldo?userId=${employee.id}&inicio=${filterMonth}-01&fim=${fimMes}`, { headers: cabecalhos() });
      if (!res.ok) { setSaldoFunc(null); return; }
      const d = await res.json();
      setSaldoFunc(d.funcionarios?.[0] || null);
    } catch {
      setSaldoFunc(null);
    }
  }, [filterMonth, employee.id]);

  useEffect(() => { carregarSaldo(); }, [carregarSaldo, pontoRecords.length]);

  const depoisDeAlterar = () => { onUpdateEmployee(); carregarSaldo(); };

  const abrirNovaBatida = () => {
    setErroBatida('');
    setBatidaEmEdicao({ modo: 'nova', type: 'entrada', date: hojeLoja.startsWith(filterMonth) ? hojeLoja : `${filterMonth}-01`, time: '', notes: '' });
  };

  const abrirEdicao = (rec) => {
    const m = String(rec.timestamp || '').match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
    setErroBatida('');
    setBatidaEmEdicao({ modo: 'editar', id: rec.id, type: rec.type, date: m ? m[1] : '', time: rec.hora_local || (m ? m[2] : ''), notes: '' });
  };

  const salvarBatida = async () => {
    const b = batidaEmEdicao;
    if (!b.date || !b.time) { setErroBatida('Informe a data e a hora.'); return; }
    setSalvandoBatida(true);
    setErroBatida('');
    // Hora de parede da loja, sem fuso — é como o ponto grava.
    const timestamp = `${b.date}T${b.time}:00`;
    try {
      const res = b.modo === 'nova'
        ? await fetch(`${API_URL}/api/ponto/manual`, {
            method: 'POST', headers: cabecalhos(true),
            body: JSON.stringify({ userId: employee.id, userName: employee.name, store: userProfile.store, type: b.type, timestamp, notes: b.notes || 'Batida lançada pelo gestor' })
          })
        : await fetch(`${API_URL}/api/ponto/record`, {
            method: 'PUT', headers: cabecalhos(true),
            body: JSON.stringify({ id: b.id, type: b.type, timestamp, notes: b.notes || 'Corrigida pelo gestor' })
          });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErroBatida(d.error || 'Não foi possível salvar.'); setSalvandoBatida(false); return; }
      setBatidaEmEdicao(null);
      depoisDeAlterar();
    } catch {
      setErroBatida('Erro de conexão.');
    }
    setSalvandoBatida(false);
  };

  const trocarTipo = async (rec) => {
    const novo = rec.type === 'entrada' ? 'saida' : 'entrada';
    const res = await fetch(`${API_URL}/api/ponto/record`, {
      method: 'PUT', headers: cabecalhos(true),
      body: JSON.stringify({ id: rec.id, type: novo, notes: `Tipo corrigido pelo gestor (era ${rec.type === 'entrada' ? 'entrada' : 'saída'})` })
    });
    if (res.ok) depoisDeAlterar();
    else alert((await res.json().catch(() => ({}))).error || 'Não foi possível corrigir a batida.');
  };

  const excluirBatida = async (rec, nome, hora) => {
    if (!window.confirm(`Excluir a batida "${nome}" das ${hora}? Isso não pode ser desfeito.`)) return;
    const res = await fetch(`${API_URL}/api/ponto/record?id=${rec.id}`, { method: 'DELETE', headers: cabecalhos() });
    if (res.ok) depoisDeAlterar();
    else alert((await res.json().catch(() => ({}))).error || 'Não foi possível excluir a batida.');
  };

  const filteredRecords = pontoRecords.filter(r => {
    // O mês sai do texto do timestamp (hora de parede da loja): passar por
    // new Date() deslocava -3h e a batida da madrugada do dia 1 caía no mês
    // anterior — o registro sumia dos dois meses do espelho.
    return String(r.timestamp || '').slice(0, 7) === filterMonth;
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
        // O dia da semana costuma vir sem horário próprio (a tela não o pede):
        // vale o da escala. Sem isso o atraso nunca era contado.
        const horaEntradaDoDia = (wdInfo && wdInfo.hora_entrada) || scheduleObj.hora_entrada;
        if (wdInfo && horaEntradaDoDia) {
           // A 1ª entrada do dia. Os registros vêm do mais novo para o mais
           // antigo: o find() pegava a VOLTA DO ALMOÇO e todo dia com almoço
           // virava atraso.
           const dayRecords = filteredRecords
             .filter(r => r.timestamp.split('T')[0] === currentDateStr)
             .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
           const entrada = dayRecords.find(r => r.type === 'entrada');
           if (entrada) {
             // O timestamp guarda a hora de parede da loja com um 'Z' postiço:
             // new Date() deslocava a batida ~3h para trás e nenhum atraso real
             // passava da tolerância (o card vivia em 0). Comparamos minuto de
             // parede com minuto de parede, como o extrato já faz para exibir.
             const horaBatida = entrada.hora_local
               || String(entrada.timestamp || '').match(/^\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2})/)?.[1];
             if (horaBatida) {
               const [bh, bm] = horaBatida.split(':').map(Number);
               const [h, m] = horaEntradaDoDia.split(':').map(Number);
               const diffMins = (bh * 60 + bm) - (h * 60 + m);
               if (diffMins > (scheduleObj.tolerancia || 15)) {
                 atrasos++;
               }
             }
           }
        }
      }
    }
  }

  // Faltas do servidor quando há escala salva: ele já desconta atestado,
  // falta justificada e feriado. A conta acima fica para a escala ainda não salva.
  const faltasDoMes = saldoFunc && !saldoFunc.sem_escala ? saldoFunc.totais.faltas : faltasProjetadas;

  // O dia como o servidor o vê (horas, abono, falta), por data.
  const infoDoDia = {};
  (saldoFunc?.dias || []).forEach(d => { infoDoDia[d.data] = d; });

  // Extrato agrupado por dia, batidas em ordem de horário — é o que dá nome a
  // cada uma (Entrada, Saída almoço, Volta do almoço, Saída). Dias sem batida
  // entram quando há falta ou abono, para o gestor abonar dali mesmo.
  const registrosPorDia = {};
  filteredRecords.forEach(r => {
    const dia = String(r.timestamp || '').slice(0, 10);
    if (!registrosPorDia[dia]) registrosPorDia[dia] = [];
    registrosPorDia[dia].push(r);
  });
  Object.values(registrosPorDia).forEach(l => l.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp))));
  const diasDoExtrato = [...new Set([
    ...Object.keys(registrosPorDia),
    ...Object.values(infoDoDia).filter(d => d.abono || d.falta).map(d => d.data),
  ])].sort().reverse();

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
      // Atestado/feriado lançado: o dia sai marcado, não como falta.
      const abonoDoDia = infoDoDia[currentDateStr]?.abono || null;

      if (abonoDoDia && !hasRecords) {
        bgColor = 'rgba(59, 130, 246, 0.08)';
        border = '1px solid rgba(59, 130, 246, 0.3)';
        color = '#3B82F6';
      } else if (hasRecords) {
        bgColor = 'rgba(16, 185, 129, 0.08)';
        border = '1px solid rgba(16, 185, 129, 0.2)';
        color = '#10B981';
      } else if (!isProjectedWorkday) {
        bgColor = 'rgba(59, 130, 246, 0.03)';
        color = 'var(--text-muted)';
        border = '1px dashed var(--border-color)';
      } else if (currentDate < new Date() && !hasRecords && isProjectedWorkday && !abonoDoDia) {
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
          {abonoDoDia && <span style={{ fontSize: '0.7rem', fontWeight: '600', color: '#3B82F6' }}>{abonoDoDia.rotulo}</span>}
          {(!hasRecords && !isProjectedWorkday && !abonoDoDia) && <span style={{ fontSize: '0.7rem', color: '#3B82F6' }}>Folga</span>}
          {(currentDate < new Date() && !hasRecords && isProjectedWorkday && !abonoDoDia) && <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>Falta</span>}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
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
                <h3 style={{ margin: '4px 0 0 0', fontSize: '2.2rem', color: '#EF4444' }}>{faltasDoMes}</h3>
              </div>
            </div>

            {/* Banco de horas do mês: trabalhado (sem o almoço) menos o esperado da escala. */}
            <div className="card hover-lift" style={{ padding: '24px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '20px', background: 'linear-gradient(to right, var(--bg-card), rgba(59, 130, 246, 0.05))' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Scale size={28} color="#3B82F6" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Banco de Horas</p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '2.2rem', color: !saldoFunc || saldoFunc.totais.saldo_min === null ? 'var(--text-muted)' : saldoFunc.totais.saldo_min < 0 ? '#EF4444' : '#10B981' }}>
                  {!saldoFunc ? '—' : saldoFunc.totais.saldo_min === null ? 'Sem escala' : comSinal(saldoFunc.totais.saldo_min)}
                </h3>
                {saldoFunc && <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Trabalhado: {formatarMinutos(saldoFunc.totais.trabalhado_min)}</p>}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '0', borderRadius: '20px', overflow: 'hidden' }}>
            {/* Header da Tabela/Calendário */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
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

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="btn-secondary" onClick={abrirNovaBatida} style={{ padding: '10px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={16} /> Adicionar batida
                </button>
                <button className="btn-secondary" onClick={() => setAbonoDia(hojeLoja)} style={{ padding: '10px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CalendarCheck size={16} /> Lançar atestado/abono
                </button>
              </div>
            </div>

            <div style={{ padding: '30px' }}>
              {/* View Mode: Calendário */}
              {viewMode === 'calendar' && renderCalendar()}

              {/* View Mode: Lista de Logs (agrupada por dia) */}
              {viewMode === 'list' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {diasDoExtrato.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
                      <Clock size={48} color="var(--border-color)" style={{ marginBottom: '16px' }} />
                      <h3 style={{ margin: '0 0 8px 0' }}>Nenhum ponto batido</h3>
                      <p style={{ margin: 0 }}>O funcionário não registrou presença neste mês.</p>
                    </div>
                  ) : (
                    diasDoExtrato.map((dia) => {
                      const registros = registrosPorDia[dia] || [];
                      const info = infoDoDia[dia] || null;
                      const emAndamento = dia === hojeLoja;
                      const rotulos = rotulosDoDia(registros, { comAlmoco, emAndamento });
                      const trabalhado = info ? info.trabalhado_min : minutosTrabalhados(registros);
                      const mostraSaldo = info && info.saldo_min !== null && !info.em_andamento && (info.saldo_min !== 0 || registros.length > 0);
                      const selo = (texto, cor) => (
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', padding: '3px 10px', borderRadius: '20px', backgroundColor: `${cor}1A`, color: cor }}>{texto}</span>
                      );
                      return (
                        <div key={dia}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
                            <h4 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <CalendarIcon size={16} color="var(--primary)" /> {dataBR(dia)}
                            </h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '0.9rem' }}>
                              {info?.abono && selo(info.abono.rotulo + (info.abono.observacao ? ` · ${info.abono.observacao}` : ''), '#3B82F6')}
                              {info?.falta && selo('Falta', '#EF4444')}
                              {info?.falta && (
                                <button className="btn-secondary" onClick={() => setAbonoDia(dia)} style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem' }}>Abonar</button>
                              )}
                              {info?.incompleto && selo('Batida faltando', '#F59E0B')}
                              {registros.length > 0 && <span style={{ color: 'var(--text-muted)' }}>Trabalhado: <strong style={{ color: 'var(--text-main)' }}>{formatarMinutos(trabalhado)}</strong></span>}
                              {mostraSaldo && <strong style={{ color: info.saldo_min < 0 ? '#EF4444' : '#10B981' }}>{comSinal(info.saldo_min)}</strong>}
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {registros.map((rec, i) => {
                              // A API entrega hora_local já no fuso da loja.
                              // Reconverter com new Date() deslocava o extrato em 3 horas.
                              const horaStr = rec.hora_local
                                || (String(rec.timestamp || '').match(/^\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2})/)?.[1])
                                || '--:--';
                              const isEntrada = rec.type === 'entrada';
                              const cor = isEntrada ? '#10B981' : '#F59E0B';
                              const foto = rec.selfie_url || rec.selfie;
                              const botao = { background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' };
                              return (
                                <div key={rec.id} style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
                                  padding: '14px 16px', border: '1px solid var(--border-color)', borderRadius: '14px',
                                  backgroundColor: 'var(--bg-card)', position: 'relative', overflow: 'hidden'
                                }}>
                                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', backgroundColor: cor }}></div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingLeft: '8px', minWidth: 0 }}>
                                    {/* A coluna no banco é selfie_url. Batida lançada pelo gestor não tem foto. */}
                                    {foto ? (
                                      <img src={foto} alt="Selfie" style={{ width: '52px', height: '52px', borderRadius: '12px', objectFit: 'cover', border: '2px solid var(--border-color)', flexShrink: 0 }} />
                                    ) : (
                                      <div style={{ width: '52px', height: '52px', borderRadius: '12px', backgroundColor: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Clock size={22} color="var(--text-muted)" />
                                      </div>
                                    )}
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700' }}>{rotulos[i]}</h4>
                                        <span style={{ fontSize: '0.9rem', backgroundColor: `${cor}1A`, color: cor, padding: '3px 10px', borderRadius: '20px', fontWeight: 'bold' }}>{horaStr}</span>
                                      </div>
                                      {rec.is_manual && (
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#F59E0B' }}>
                                          Ajustada{rec.edited_by ? ` por ${rec.edited_by}` : ''}{rec.notes ? ` · ${rec.notes}` : ''}
                                        </p>
                                      )}
                                      {rec.address && (
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '360px' }}>
                                          <MapPin size={12} style={{ flexShrink: 0 }} /> {rec.address}{rec.accuracy ? ` · ±${Math.round(rec.accuracy)} m` : ''}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    <button style={botao} title={`Trocar para ${isEntrada ? 'saída' : 'entrada'}`} onClick={() => trocarTipo(rec)}>
                                      <Repeat size={14} /> Virar {isEntrada ? 'saída' : 'entrada'}
                                    </button>
                                    <button style={botao} title="Corrigir horário" onClick={() => abrirEdicao(rec)}>
                                      <Edit2 size={14} /> Horário
                                    </button>
                                    <button style={{ ...botao, background: '#FEF2F2', border: '1px solid #FECACA', color: '#EF4444' }} title="Excluir batida" onClick={() => excluirBatida(rec, rotulos[i], horaStr)}>
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
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

      {/* Corrigir ou lançar batida (gestor) */}
      {batidaEmEdicao && (
        <Janela titulo={batidaEmEdicao.modo === 'nova' ? 'Adicionar batida esquecida' : 'Corrigir batida'} onFechar={() => setBatidaEmEdicao(null)}>
          {erroBatida && <div style={{ color: 'var(--error)', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '10px 12px', borderRadius: '10px', marginBottom: '14px', fontSize: '0.9rem' }}>{erroBatida}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="input-label">Tipo</label>
              <select className="input-field" value={batidaEmEdicao.type} onChange={e => setBatidaEmEdicao({ ...batidaEmEdicao, type: e.target.value })}>
                <option value="entrada">Entrada (início do turno ou volta do almoço)</option>
                <option value="saida">Saída (almoço ou fim do turno)</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="input-label">Data</label>
                <input type="date" className="input-field" value={batidaEmEdicao.date} onChange={e => setBatidaEmEdicao({ ...batidaEmEdicao, date: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Hora</label>
                <input type="time" className="input-field" value={batidaEmEdicao.time} onChange={e => setBatidaEmEdicao({ ...batidaEmEdicao, time: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="input-label">Motivo (fica registrado no espelho)</label>
              <input type="text" className="input-field" placeholder="Ex.: esqueceu de bater a volta do almoço" value={batidaEmEdicao.notes} onChange={e => setBatidaEmEdicao({ ...batidaEmEdicao, notes: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" className="btn-secondary" style={{ flex: 1, padding: '12px' }} onClick={() => setBatidaEmEdicao(null)}>Cancelar</button>
              <button type="button" className="btn-primary" style={{ flex: 1, padding: '12px' }} onClick={salvarBatida} disabled={salvandoBatida}>
                {salvandoBatida ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </Janela>
      )}

      {/* Atestado/abono deste funcionário */}
      {abonoDia && (
        <Janela titulo="Lançar atestado ou abono" onFechar={() => setAbonoDia(null)}>
          <AbonoForm
            funcionarioFixo={employee}
            dataInicial={abonoDia}
            onSalvo={() => { setAbonoDia(null); carregarSaldo(); }}
            onCancelar={() => setAbonoDia(null)}
          />
        </Janela>
      )}

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
                {/* Almoço visível também aqui (era gravado 12:00–13:00 sem aparecer). */}
                <div>
                  <label className="input-label" style={{ fontSize: '0.9rem' }}>Saída para Almoço</label>
                  <input type="time" className="input-field" value={scheduleForm.intervalo_inicio || ''} onChange={e => setScheduleForm({...scheduleForm, intervalo_inicio: e.target.value})} />
                </div>
                <div>
                  <label className="input-label" style={{ fontSize: '0.9rem' }}>Volta do Almoço</label>
                  <input type="time" className="input-field" value={scheduleForm.intervalo_fim || ''} onChange={e => setScheduleForm({...scheduleForm, intervalo_fim: e.target.value})} />
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