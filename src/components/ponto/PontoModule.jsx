import React, { useState, useEffect } from 'react';
import { Users, Calendar, Settings, Clock, UserCheck } from 'lucide-react';
import API_URL from '../../api';

// Sub-components
import EmployeesTab from './EmployeesTab';
import EmployeeProfile from './EmployeeProfile';
import SchedulesTab from './SchedulesTab';
import SettingsTab from './SettingsTab';

export default function PontoModule({ userProfile }) {
  const [activeTab, setActiveTab] = useState('employees'); // 'employees', 'schedules', 'settings'
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Data states
  const [employees, setEmployees] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [pontoRecords, setPontoRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  // Mês no dia de SÃO PAULO: com toISOString() (UTC), aberto depois das 21h
  // do último dia do mês, o espelho vinha pré-selecionado no mês SEGUINTE —
  // vazio, bem na hora do fechamento da folha.
  const [pontoMonth, setPontoMonth] = useState(
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).substring(0, 7)
  );

  const fetchEmployees = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users?store=${encodeURIComponent(userProfile.store)}`, {
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
      });
      if (res.ok) {
        const data = await res.json();
        // Filter out admins/masters if you only want regular employees, but usually we show all or just 'funcionario'/'gestor'
        // Let's show all that are not master
        const teamArray = Array.isArray(data) ? data : (data.users || []);
        setEmployees(teamArray.filter(u => u.role !== 'master'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSchedules = async () => {
    try {
      const res = await fetch(`${API_URL}/api/schedules?store=${encodeURIComponent(userProfile.store)}`, {
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
      });
      if (res.ok) {
        setSchedules(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPontoRecords = async () => {
    try {
      const res = await fetch(`${API_URL}/api/ponto/records?store=${encodeURIComponent(userProfile.store)}&month=${pontoMonth}`, {
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setPontoRecords(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const refreshAll = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    await Promise.all([fetchEmployees(), fetchSchedules(), fetchPontoRecords()]);
    if (showLoading) setLoading(false);
  };

  useEffect(() => {
    if (userProfile?.store) {
      refreshAll(employees.length === 0);
    }
  }, [userProfile?.store, pontoMonth]);

  if (selectedEmployee) {
    return (
      <EmployeeProfile 
        employee={selectedEmployee} 
        onBack={() => { setSelectedEmployee(null); refreshAll(); }} 
        schedules={schedules}
        userProfile={userProfile}
        pontoRecords={pontoRecords.filter(r => r.user_id === selectedEmployee.id)}
        onUpdateEmployee={refreshAll}
        /* O filtro "Período" da ficha filtrava dados que nunca eram buscados: este
           módulo só carregava o mês corrente. Trocar o mês lá agora recarrega aqui. */
        mesSelecionado={pontoMonth}
        onMesChange={setPontoMonth}
      />
    );
  }

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header do Módulo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
         <div>
           <h2 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
             <Clock color="var(--primary)" size={32} />
             Controle de Ponto IA
           </h2>
           <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Gestão profissional de presença, escalas e folgas.</p>
         </div>
      </div>

      {/* Navegação de Abas Internas */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '24px' }}>
        <button 
          onClick={() => setActiveTab('employees')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.05rem', fontWeight: '500',
            padding: '12px 4px', borderBottom: activeTab === 'employees' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'employees' ? 'var(--primary)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
          }}
        >
          <Users size={18} /> Funcionários
        </button>
        <button 
          onClick={() => setActiveTab('schedules')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.05rem', fontWeight: '500',
            padding: '12px 4px', borderBottom: activeTab === 'schedules' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'schedules' ? 'var(--primary)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
          }}
        >
          <Calendar size={18} /> Escalas de Trabalho
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.05rem', fontWeight: '500',
            padding: '12px 4px', borderBottom: activeTab === 'settings' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'settings' ? 'var(--primary)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
          }}
        >
          <Settings size={18} /> Configurações Gerais
        </button>
      </div>

      {/* Renderização do Conteúdo da Aba */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
           <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }}></div>
           <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Carregando dados do ponto...</p>
        </div>
      ) : (
        <div style={{ marginTop: '8px' }}>
          {activeTab === 'employees' && (
            <EmployeesTab 
              employees={employees} 
              onSelectEmployee={setSelectedEmployee} 
              userProfile={userProfile}
              onEmployeeCreated={refreshAll}
              schedules={schedules}
            />
          )}
          {activeTab === 'schedules' && (
            <SchedulesTab 
              schedules={schedules} 
              userProfile={userProfile} 
              onSchedulesChanged={refreshAll} 
            />
          )}
          {activeTab === 'settings' && (
            <SettingsTab 
              userProfile={userProfile} 
            />
          )}
        </div>
      )}
    </div>
  );
}
