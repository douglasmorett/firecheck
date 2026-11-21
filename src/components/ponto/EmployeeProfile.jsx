import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, MapPin, Clock, Plus, Camera, Edit2, Trash2, Repeat, CalendarCheck } from 'lucide-react';
import API_URL from '../../api';
import { iniciais } from '../painel/Painel';
import Janela from './Janela';
import './ponto.css';
import AbonoForm from './AbonoForm';
import RostoDoFuncionario from './RostoDoFuncionario';
import { rotulosDoDia, minutosTrabalhados, formatarMinutos } from '../../utils/pontoBatidas';

const cabecalhos = (json) => ({
  ...(json ? { 'Content-Type': 'application/json' } : {}),
  'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '')
});
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '');
const comSinal = (min) => (min > 0 ? '+' : '') + formatarMinutos(min);

export default function EmployeeProfile({ employee, onBack, schedules, userProfile, pontoRecords, onUpdateEmployee, mesSelecionado, onMesChange }) {
  const [viewMode, setViewMode] = useState('list');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    name: '', type: 'fixed', hora_entrada: '08:00', hora_saida: '18:00', intervalo_inicio: '12:00', intervalo_fim: '13:00', tolerancia: 15, color: '#EA580C',
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
        // O botão diz "Criar Escala e Vincular", mas só criava: a escala nova
        // não ficava ligada ao funcionário, e quem confiava no botão saía da
        // ficha com ele sem escala (sem atraso, falta nem banco de horas).
        const nova = await res.json().catch(() => null);
        if (nova?.id) {
          setSelectedSchedule(String(nova.id));
          await fetch(`${API_URL}/api/users/${employee.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') },
            body: JSON.stringify({ schedule_id: nova.id })
          }).catch(() => {});
        }
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
      days.push(<div key={`empty-${i}`} className="pt-cal-dia vazio"></div>);
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

      // Atestado/feriado lançado: o dia sai marcado, não como falta.
      const abonoDoDia = infoDoDia[currentDateStr]?.abono || null;
      const falta = currentDate < new Date() && !hasRecords && isProjectedWorkday && !abonoDoDia;
      const folga = !hasRecords && !isProjectedWorkday && !abonoDoDia;

      days.push(
        <div key={d} className={`pt-cal-dia${folga ? ' folga' : ''}`}>
          <b>{d}</b>
          <div>
            {hasRecords && <span className="fc-selo" style={{ '--c': 'var(--ok)' }}><i /><span>Presente</span></span>}
            {abonoDoDia && <span className="fc-selo" style={{ '--c': 'var(--info)' }}><i /><span>{abonoDoDia.rotulo}</span></span>}
            {folga && <span className="fc-selo" style={{ '--c': 'var(--text-muted)' }}><i /><span>Folga</span></span>}
            {falta && <span className="fc-selo" style={{ '--c': 'var(--bad)' }}><i /><span>Falta</span></span>}
          </div>
        </div>
      );
    }

    return (
      <div className="pt-cal animate-fade">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
          <div key={d} className="pt-cal-dow">{d}</div>
        ))}
        {days}
      </div>
    );
  };

  const saldoMin = saldoFunc?.totais?.saldo_min;

  return (
    <div className="pt animate-fade-up" style={{ paddingBottom: '40px' }}>
      {/* Cabeçalho da ficha: voltar, foto, nome. O título da aba fica no painel. */}
      <div className="pt-ferr">
        <div className="pt-ficha-cab">
          <button type="button" className="pt-voltar" onClick={onBack} aria-label="Voltar para a equipe" title="Voltar">
            <ArrowLeft size={18} />
          </button>
          <div className="pt-foto">
            <div className="fc-av">
              {employee.photo
                ? <img src={employee.photo} alt={employee.name} />
                : <span className="pt-av-ini">{iniciais(employee.name)}</span>}
            </div>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploadingPhoto} aria-label="Trocar foto" title="Trocar foto">
              <Camera size={13} />
            </button>
            <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handlePhotoUpload} />
          </div>
          <div className="pt-ficha-nome">
            <h2>{employee.name}</h2>
            <p>
              <span className="fc-selo" style={{ '--c': 'var(--ok)' }}><i /><span>Ativo</span></span>
              <span>{employee.email}</span>
              <span className="fc-tag-p">{employee.role === 'gestor' ? 'Gestor' : 'Funcionário'}</span>
              {isUploadingPhoto && <span>Enviando foto…</span>}
            </p>
          </div>
        </div>
        <label className="pt-periodo">
          Período
          <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
        </label>
      </div>

      {/* Números do mês */}
      <div className="pt-kpis">
        <div className="card pt-kpi">
          <span className="fc-olho-rot">Dias trabalhados</span>
          <strong>{workedDays}</strong>
        </div>
        <div className="card pt-kpi">
          <span className="fc-olho-rot">Atrasos (mês)</span>
          <strong style={{ color: atrasos ? 'var(--warning)' : 'var(--text-main)' }}>{atrasos}</strong>
        </div>
        <div className="card pt-kpi">
          <span className="fc-olho-rot">Faltas projetadas</span>
          <strong style={{ color: faltasDoMes ? 'var(--bad)' : 'var(--text-main)' }}>{faltasDoMes}</strong>
        </div>
        {/* Banco de horas do mês: trabalhado (sem o almoço) menos o esperado da escala. */}
        <div className="card pt-kpi">
          <span className="fc-olho-rot">Banco de horas</span>
          <strong style={{ color: !saldoFunc || saldoMin === null ? 'var(--text-muted)' : saldoMin < 0 ? 'var(--bad)' : 'var(--ok)', fontSize: !saldoFunc || saldoMin === null ? '22px' : undefined }}>
            {!saldoFunc ? '—' : saldoMin === null ? 'Sem escala' : comSinal(saldoMin)}
          </strong>
          {saldoFunc && <small>Trabalhado: <span className="mono">{formatarMinutos(saldoFunc.totais.trabalhado_min)}</span></small>}
        </div>
      </div>

      <div className="pt-ficha-corpo">
        {/* Coluna: regra de ponto e rosto */}
        <div className="pt-coluna">
          <div className="card pt-card">
            <div className="pt-card-cab">
              <div>
                <span className="fc-olho-rot">Escala</span>
                <h3>Regra de Ponto</h3>
              </div>
            </div>
            <div className="pt-campos">
              <div>
                <label className="input-label">Escala Vinculada</label>
                <select className="input-field" value={selectedSchedule || ''} onChange={e => setSelectedSchedule(e.target.value)}>
                  <option value="">Nenhuma (Horário Livre)</option>
                  {schedules.map(sch => (
                    <option key={sch.id} value={sch.id}>{sch.name} ({sch.type === '12x36' ? '12x36' : 'Fixa'})</option>
                  ))}
                </select>
                <button type="button" className="fc-mini-btn info" onClick={() => setShowScheduleModal(true)} style={{ marginTop: '10px' }}>
                  <Plus size={13} /> Nova Escala
                </button>
              </div>

              {is12x36 && (
                <div className="animate-fade">
                  <label className="input-label">Último dia trabalhado</label>
                  <input
                    type="date"
                    className="input-field mono"
                    value={lastWorkedDay}
                    onChange={e => setLastWorkedDay(e.target.value)}
                  />
                  <p className="pt-dica">Base para cálculo automático das folgas intercaladas.</p>
                </div>
              )}

              <button type="button" className="btn-primary" onClick={handleSaveScheduleConfig} disabled={savingSchedule} style={{ width: '100%', padding: '12px', fontSize: '0.92rem' }}>
                {savingSchedule ? 'Salvando...' : 'Salvar Regras'}
              </button>
            </div>
          </div>

          {/* Rosto para o ponto da loja (tablet com reconhecimento facial) e como ele bate ponto. */}
          <RostoDoFuncionario employee={employee} />
        </div>

        {/* Extrato e visão mensal */}
        <div className="card pt-lista" style={{ minWidth: 0 }}>
          <div className="pt-extrato-cab">
            <div className="pt-seg peq">
              <button type="button" className={viewMode === 'list' ? 'on' : ''} onClick={() => setViewMode('list')}>Extrato de Pontos</button>
              <button type="button" className={viewMode === 'calendar' ? 'on' : ''} onClick={() => setViewMode('calendar')}>Visão Mensal</button>
            </div>
            <div className="pt-mini-acoes">
              <button type="button" className="fc-mini-btn info" onClick={abrirNovaBatida}>
                <Plus size={13} /> Adicionar batida
              </button>
              <button type="button" className="fc-mini-btn info" onClick={() => setAbonoDia(hojeLoja)}>
                <CalendarCheck size={13} /> Lançar atestado/abono
              </button>
            </div>
          </div>

          {/* Visão mensal */}
          {viewMode === 'calendar' && renderCalendar()}

          {/* Extrato agrupado por dia */}
          {viewMode === 'list' && (
            diasDoExtrato.length === 0 ? (
              <div className="fc-vazio">
                <strong style={{ display: 'block', color: 'var(--text-main)', fontWeight: 600, marginBottom: '6px' }}>Nenhum ponto batido</strong>
                O funcionário não registrou presença neste mês.
              </div>
            ) : (
              <div>
                {diasDoExtrato.map((dia) => {
                  const registros = registrosPorDia[dia] || [];
                  const info = infoDoDia[dia] || null;
                  const emAndamento = dia === hojeLoja;
                  const rotulos = rotulosDoDia(registros, { comAlmoco, emAndamento });
                  const trabalhado = info ? info.trabalhado_min : minutosTrabalhados(registros);
                  const mostraSaldo = info && info.saldo_min !== null && !info.em_andamento && (info.saldo_min !== 0 || registros.length > 0);
                  const diaSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(dia + 'T12:00:00').getDay()];
                  return (
                    <div key={dia} className="pt-dia">
                      <div className="pt-dia-cab">
                        <h4>{dataBR(dia)}<span>{diaSemana}</span></h4>
                        <div className="pt-dia-info">
                          {info?.abono && <span className="fc-selo" style={{ '--c': 'var(--info)' }}><i /><span>{info.abono.rotulo + (info.abono.observacao ? ` · ${info.abono.observacao}` : '')}</span></span>}
                          {info?.falta && <span className="fc-selo" style={{ '--c': 'var(--bad)' }}><i /><span>Falta</span></span>}
                          {info?.falta && (
                            <button type="button" className="fc-mini-btn" onClick={() => setAbonoDia(dia)}>Abonar</button>
                          )}
                          {info?.incompleto && <span className="fc-selo" style={{ '--c': 'var(--warning)' }}><i /><span>Batida faltando</span></span>}
                          {registros.length > 0 && <span>Trabalhado <b>{formatarMinutos(trabalhado)}</b></span>}
                          {mostraSaldo && <b style={{ color: info.saldo_min < 0 ? 'var(--bad)' : 'var(--ok)' }}>{comSinal(info.saldo_min)}</b>}
                        </div>
                      </div>

                      {registros.map((rec, i) => {
                        // A API entrega hora_local já no fuso da loja.
                        // Reconverter com new Date() deslocava o extrato em 3 horas.
                        const horaStr = rec.hora_local
                          || (String(rec.timestamp || '').match(/^\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2})/)?.[1])
                          || '--:--';
                        const isEntrada = rec.type === 'entrada';
                        const foto = rec.selfie_url || rec.selfie;
                        return (
                          <div key={rec.id} className="fc-lin pt-batida">
                            {/* A coluna no banco é selfie_url. Batida lançada pelo gestor não tem foto. */}
                            <div className="fc-av">
                              {foto ? <img src={foto} alt="Selfie" /> : <Clock size={16} />}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div className="fc-t">
                                <i className="pt-ponto" style={{ '--c': isEntrada ? 'var(--ok)' : 'var(--ink)' }} />
                                {rotulos[i]}
                                <span className="mono">{horaStr}</span>
                              </div>
                              <div className="fc-m">
                                {/* Batida do tablet da loja (reconhecimento facial), não do celular dele. */}
                                {rec.origem === 'quiosque' && <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>Ponto da loja (rosto)</span>}
                                {rec.is_manual && (
                                  <span style={{ color: 'var(--warning)' }}>
                                    Ajustada{rec.edited_by ? ` por ${rec.edited_by}` : ''}{rec.notes ? ` · ${rec.notes}` : ''}
                                  </span>
                                )}
                                {rec.address && (
                                  <span className="pt-end" title={rec.address}>
                                    <MapPin size={11} style={{ verticalAlign: '-1px', marginRight: '4px' }} />{rec.address}{rec.accuracy ? ` · ±${Math.round(rec.accuracy)} m` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="pt-mini-acoes">
                              <button type="button" className="fc-mini-btn info" title={`Trocar para ${isEntrada ? 'saída' : 'entrada'}`} onClick={() => trocarTipo(rec)}>
                                <Repeat size={12} /> Virar {isEntrada ? 'saída' : 'entrada'}
                              </button>
                              <button type="button" className="fc-mini-btn info" title="Corrigir horário" onClick={() => abrirEdicao(rec)}>
                                <Edit2 size={12} /> Horário
                              </button>
                              <button type="button" className="fc-mini-btn perigo" title="Excluir batida" aria-label="Excluir batida" onClick={() => excluirBatida(rec, rotulos[i], horaStr)}>
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>

      {/* Corrigir ou lançar batida (gestor) */}
      {batidaEmEdicao && (
        <Janela rotulo={employee.name} titulo={batidaEmEdicao.modo === 'nova' ? 'Adicionar batida esquecida' : 'Corrigir batida'} onFechar={() => setBatidaEmEdicao(null)}>
          {erroBatida && <p className="pt-erro" style={{ marginBottom: '14px' }}>{erroBatida}</p>}
          <div className="pt-campos">
            <div>
              <label className="input-label">Tipo</label>
              <select className="input-field" value={batidaEmEdicao.type} onChange={e => setBatidaEmEdicao({ ...batidaEmEdicao, type: e.target.value })}>
                <option value="entrada">Entrada (início do turno ou volta do almoço)</option>
                <option value="saida">Saída (almoço ou fim do turno)</option>
              </select>
            </div>
            <div className="pt-2col">
              <div>
                <label className="input-label">Data</label>
                <input type="date" className="input-field mono" value={batidaEmEdicao.date} onChange={e => setBatidaEmEdicao({ ...batidaEmEdicao, date: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Hora</label>
                <input type="time" className="input-field mono" value={batidaEmEdicao.time} onChange={e => setBatidaEmEdicao({ ...batidaEmEdicao, time: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="input-label">Motivo (fica registrado no espelho)</label>
              <input type="text" className="input-field" placeholder="Ex.: esqueceu de bater a volta do almoço" value={batidaEmEdicao.notes} onChange={e => setBatidaEmEdicao({ ...batidaEmEdicao, notes: e.target.value })} />
            </div>
            <div className="pt-acoes" style={{ marginTop: '4px' }}>
              <button type="button" className="btn-secondary" onClick={() => setBatidaEmEdicao(null)}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={salvarBatida} disabled={salvandoBatida}>
                {salvandoBatida ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </Janela>
      )}

      {/* Atestado/abono deste funcionário */}
      {abonoDia && (
        <Janela rotulo="Atestados e Feriados" titulo="Lançar atestado ou abono" onFechar={() => setAbonoDia(null)}>
          <AbonoForm
            funcionarioFixo={employee}
            dataInicial={abonoDia}
            onSalvo={() => { setAbonoDia(null); carregarSaldo(); }}
            onCancelar={() => setAbonoDia(null)}
          />
        </Janela>
      )}

      {/* Nova escala, já vinculada a este funcionário */}
      {showScheduleModal && (
        <Janela rotulo={employee.name} titulo="Criar Nova Escala" onFechar={() => setShowScheduleModal(false)} larga>
          {newScheduleError && <p className="pt-erro" style={{ marginBottom: '14px' }}>{newScheduleError}</p>}

          <div className="pt-campos" style={{ gap: '16px' }}>
            <div>
              <label className="input-label">Nome da Escala (Para identificação)</label>
              <input type="text" className="input-field" placeholder="Ex: Comercial Seg a Sex" value={scheduleForm.name} onChange={e => setScheduleForm({...scheduleForm, name: e.target.value})} />
            </div>
            <div className="pt-2col">
              <div>
                <label className="input-label">Modelo Operacional</label>
                <select className="input-field" value={scheduleForm.type} onChange={e => setScheduleForm({...scheduleForm, type: e.target.value})}>
                  <option value="fixed">Jornada Semanal Fixa</option>
                  <option value="12x36">Plantão 12x36</option>
                </select>
              </div>
              <div>
                <label className="input-label">Cor de Identificação</label>
                <div className="pt-cores">
                  {['#EA580C', '#16161A', '#0E9F6E', '#D97706', '#475569', '#9F1239', '#A8A29E'].map(color => (
                    <button key={color} type="button" aria-label={`Cor ${color}`} className={scheduleForm.color === color ? 'on' : ''} onClick={() => setScheduleForm({...scheduleForm, color})} style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="pt-2col">
              <div>
                <label className="input-label">Horário Entrada Padrão</label>
                <input type="time" className="input-field mono" value={scheduleForm.hora_entrada} onChange={e => setScheduleForm({...scheduleForm, hora_entrada: e.target.value})} />
              </div>
              <div>
                <label className="input-label">Horário Saída Padrão</label>
                <input type="time" className="input-field mono" value={scheduleForm.hora_saida} onChange={e => setScheduleForm({...scheduleForm, hora_saida: e.target.value})} />
              </div>
              {/* Almoço visível também aqui (era gravado 12:00–13:00 sem aparecer). */}
              <div>
                <label className="input-label">Saída para Almoço</label>
                <input type="time" className="input-field mono" value={scheduleForm.intervalo_inicio || ''} onChange={e => setScheduleForm({...scheduleForm, intervalo_inicio: e.target.value})} />
              </div>
              <div>
                <label className="input-label">Volta do Almoço</label>
                <input type="time" className="input-field mono" value={scheduleForm.intervalo_fim || ''} onChange={e => setScheduleForm({...scheduleForm, intervalo_fim: e.target.value})} />
              </div>
            </div>
            {scheduleForm.type === 'fixed' && (
              <div>
                <label className="input-label">Dias de Trabalho da Semana</label>
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
                            setScheduleForm({...scheduleForm, weekdays: newWds});
                          }} />
                          {dayName}
                        </span>
                        <span className={wd.is_workday ? 'mono' : ''} style={{ fontSize: '12.5px', color: wd.is_workday ? 'var(--text-main)' : 'var(--text-muted)' }}>
                          {wd.is_workday ? `${scheduleForm.hora_entrada} - ${scheduleForm.hora_saida}` : 'Folga'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="pt-acoes" style={{ marginTop: '8px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowScheduleModal(false)}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={handleSaveNewSchedule} disabled={savingNewSchedule}>
                {savingNewSchedule ? 'Criando Escala...' : 'Criar Escala e Vincular'}
              </button>
            </div>
          </div>
        </Janela>
      )}
    </div>
  );
}
