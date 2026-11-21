import React, { useState, useEffect } from 'react';
import API_URL from '../../api';
import '../painel/painel.css';
import './ponto.css';

// Sub-components
import EmployeesTab from './EmployeesTab';
import EmployeeProfile from './EmployeeProfile';
import SchedulesTab from './SchedulesTab';
import SettingsTab from './SettingsTab';
import BancoHorasTab from './BancoHorasTab';
import AbonosTab from './AbonosTab';
import PontoDaLojaTab from './PontoDaLojaTab';

const ABAS = [
  ['employees', 'Funcionários'],
  ['schedules', 'Escalas de Trabalho'],
  ['banco', 'Banco de Horas'],
  ['abonos', 'Atestados e Feriados'],
  ['loja', 'Ponto da Loja'],
  ['settings', 'Configurações Gerais'],
];

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
    <div className="pt animate-fade">
      {/* O título "Controle de Ponto" já está no cabeçalho do painel (visual de 21/11/2026). */}
      <p className="pt-sub">Presença, escalas e folgas da equipe.</p>

      {/* Abas internas em pílulas (seletor segmentado). Banco de horas e
          atestados/feriados foram pedidos da Pet Nature para implantar o ponto. */}
      <nav className="pt-seg" aria-label="Seções do ponto">
        {ABAS.map(([chave, nome]) => (
          <button key={chave} type="button" className={activeTab === chave ? 'on' : ''} aria-pressed={activeTab === chave} onClick={() => setActiveTab(chave)}>
            {nome}
          </button>
        ))}
      </nav>

      {/* Renderização do Conteúdo da Aba */}
      {loading ? (
        <div className="fc-vazio">Carregando dados do ponto...</div>
      ) : (
        <div>
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
          {activeTab === 'banco' && (
            <BancoHorasTab employees={employees} userProfile={userProfile} />
          )}
          {activeTab === 'abonos' && (
            <AbonosTab employees={employees} />
          )}
          {/* Tablet da loja como relógio de ponto, com reconhecimento facial. */}
          {activeTab === 'loja' && <PontoDaLojaTab />}
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
