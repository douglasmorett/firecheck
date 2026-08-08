import React, { useState } from 'react';
import { Search, Plus, UserCircle, Briefcase, Calendar, ChevronRight, X } from 'lucide-react';
import API_URL from '../../api';

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '350px' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Buscar por nome ou e-mail..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '38px', width: '100%' }}
          />
        </div>
        <button className="btn-primary" onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px' }}>
          <Plus size={18} /> Novo Funcionário
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {filteredEmployees.map(emp => {
          const empSchedule = schedules.find(s => s.id === emp.schedule_id);
          return (
            <div 
              key={emp.id} 
              className="card hover-lift"
              onClick={() => onSelectEmployee(emp)}
              style={{ 
                padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px',
                border: '1px solid var(--border-color)', transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                  <UserCircle size={28} color="var(--text-muted)" />
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{emp.email}</p>
                </div>
                <ChevronRight size={20} color="var(--text-muted)" />
              </div>
              
              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  <Briefcase size={14} color="var(--primary)" /> 
                  {emp.role === 'admin' ? 'Administrador' : (emp.role === 'gestor' ? 'Gestor' : 'Funcionário')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  <Calendar size={14} color={empSchedule ? (empSchedule.color || 'var(--success)') : 'var(--text-muted)'} /> 
                  {empSchedule ? empSchedule.name : <span style={{ color: 'var(--text-muted)' }}>Sem escala definida</span>}
                </div>
              </div>
            </div>
          );
        })}
        {filteredEmployees.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Nenhum funcionário encontrado.
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card animate-fade-up" style={{ width: '90%', maxWidth: '400px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCircle color="var(--primary)" /> Novo Funcionário
              </h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                <X size={20} color="var(--text-muted)" />
              </button>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              O funcionário receberá acesso padrão ao App para registrar pontos e acessar checklists.
            </p>

            {addError && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
                {addError}
              </div>
            )}

            <form onSubmit={handleAddEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
              
              <button type="submit" className="btn-primary" disabled={adding} style={{ padding: '12px', marginTop: '8px' }}>
                {adding ? 'Cadastrando...' : 'Cadastrar Funcionário'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
