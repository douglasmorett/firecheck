import React, { useState } from 'react';
import { Search, Plus, ChevronRight } from 'lucide-react';
import API_URL from '../../api';
import { iniciais } from '../painel/Painel';
import Janela from './Janela';

export default function EmployeesTab({ employees, onSelectEmployee, userProfile, onEmployeeCreated, schedules }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Add Employee Form (Forced to 'funcionario')
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '' });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '')
        },
        body: JSON.stringify({
          ...addForm,
          role: 'funcionario',
          store: userProfile.store,
          plan: userProfile.plan
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setShowAddModal(false);
        setAddForm({ name: '', email: '', password: '' });
        onEmployeeCreated();
      } else {
        setAddError(data.error || 'Erro ao criar funcionário.');
      }
    } catch (err) {
      console.error(err);
      setAddError('Erro de conexão.');
    }
    setAdding(false);
  };


  const papel = (role) => (role === 'admin' ? 'Administrador' : role === 'gestor' ? 'Gestor' : 'Funcionário');

  return (
    <div className="pt-campos" style={{ gap: '18px' }}>
      <div className="pt-ferr">
        <div className="pt-busca">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button type="button" className="fc-pilula" onClick={() => setShowAddModal(true)}>
          Novo Funcionário <i><Plus size={15} /></i>
        </button>
      </div>

      {/* Lista em linhas (padrão .fc-lin do painel): iniciais, nome, escala e papel. */}
      <div className="card pt-lista">
        <div className="pt-card-cab" style={{ padding: '12px 14px 6px' }}>
          <span className="fc-olho-rot">Equipe · <span className="mono" style={{ letterSpacing: 0 }}>{filteredEmployees.length}</span></span>
        </div>
        {filteredEmployees.map(emp => {
          const empSchedule = schedules.find(s => s.id === emp.schedule_id);
          return (
            <div key={emp.id} className="fc-lin pt-func" onClick={() => onSelectEmployee(emp)}>
              <div className="fc-av">
                {emp.photo ? <img src={emp.photo} alt="" /> : <span className="pt-av-ini">{iniciais(emp.name)}</span>}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="fc-t">{emp.name}</div>
                <div className="fc-m" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.email}</div>
              </div>
              <div className="pt-func-esc">
                {empSchedule
                  ? <span className="fc-dado" style={{ '--c': empSchedule.color || 'var(--ok)' }}>{empSchedule.name}</span>
                  : <span className="pt-sem">Sem escala definida</span>}
              </div>
              <div className="pt-func-papel"><span className="fc-tag-p">{papel(emp.role)}</span></div>
              <ChevronRight size={18} className="fc-chev" />
            </div>
          );
        })}
        {filteredEmployees.length === 0 && (
          <div className="fc-vazio">Nenhum funcionário encontrado.</div>
        )}
      </div>

      {/* Novo funcionário */}
      {showAddModal && (
        <Janela rotulo="Equipe" titulo="Novo Funcionário" onFechar={() => setShowAddModal(false)}>
          <p className="pt-nota" style={{ marginBottom: '18px' }}>
            O funcionário receberá acesso padrão ao App para registrar pontos e acessar checklists.
          </p>

          {addError && <p className="pt-erro" style={{ marginBottom: '14px' }}>{addError}</p>}

          <form onSubmit={handleAddEmployee} className="pt-campos">
            <div>
              <label className="input-label">Nome Completo</label>
              <input
                type="text"
                className="input-field"
                required
                value={addForm.name}
                onChange={e => setAddForm({...addForm, name: e.target.value})}
              />
            </div>
            <div>
              <label className="input-label">E-mail de Acesso</label>
              <input
                type="email"
                className="input-field"
                required
                value={addForm.email}
                onChange={e => setAddForm({...addForm, email: e.target.value})}
              />
            </div>
            <div>
              <label className="input-label">Senha Padrão (ele poderá mudar depois)</label>
              <input
                type="password"
                className="input-field"
                required
                minLength="6"
                value={addForm.password}
                onChange={e => setAddForm({...addForm, password: e.target.value})}
              />
            </div>

            <div className="pt-acoes" style={{ marginTop: '6px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={adding}>
                {adding ? 'Cadastrando...' : 'Cadastrar Funcionário'}
              </button>
            </div>
          </form>
        </Janela>
      )}
    </div>
  );
}
