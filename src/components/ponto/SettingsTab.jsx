import React, { useState, useEffect } from 'react';
import { Mail, Clock, CheckCircle } from 'lucide-react';
import API_URL from '../../api';

export default function SettingsTab({ userProfile }) {
  const [pontoHoraEntrada, setPontoHoraEntrada] = useState('08:00');
  const [pontoHoraSaida, setPontoHoraSaida] = useState('18:00');
  const [pontoTolerancia, setPontoTolerancia] = useState(15);
  const [contadorEmail, setContadorEmail] = useState('');
  const [fechamentoDia, setFechamentoDia] = useState('ultimo_dia');
  const [pontoTimezone, setPontoTimezone] = useState('America/Sao_Paulo');
  
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (userProfile) {
      setPontoHoraEntrada(userProfile.ponto_hora_entrada || '08:00');
      setPontoHoraSaida(userProfile.ponto_hora_saida || '18:00');
      setPontoTolerancia(userProfile.ponto_tolerancia ?? 15);
      setContadorEmail(userProfile.contador_email || '');
      setFechamentoDia(userProfile.fechamento_dia || 'ultimo_dia');
      setPontoTimezone(userProfile.timezone || 'America/Sao_Paulo');
    }
  }, [userProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${userProfile.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '')
        },
        body: JSON.stringify({
          ponto_hora_entrada: pontoHoraEntrada,
          ponto_hora_saida: pontoHoraSaida,
          ponto_tolerancia: pontoTolerancia,
          contador_email: contadorEmail,
          fechamento_dia: fechamentoDia,
          timezone: pontoTimezone
        })
      });
      if (res.ok) {
        setToast('Configurações salvas com sucesso!');
        setTimeout(() => setToast(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
       {toast && (
         <div style={{ position: 'fixed', bottom: '20px', right: '20px', backgroundColor: 'var(--success)', color: 'white', padding: '12px 24px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
           <CheckCircle size={18} /> {toast}
         </div>
       )}

       {/* Horários e Tolerância do Ponto */}
       <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6' }}>
             <Clock size={20} /> Horários Padrão e Tolerância
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
             Defina o horário base da loja e a tolerância de atraso. Isso será usado caso o funcionário não tenha uma escala específica vinculada.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                   <label className="input-label">Entrada Padrão</label>
                   <input type="time" className="input-field" value={pontoHoraEntrada} onChange={e => setPontoHoraEntrada(e.target.value)} />
                </div>
                <div>
                   <label className="input-label">Saída Padrão</label>
                   <input type="time" className="input-field" value={pontoHoraSaida} onChange={e => setPontoHoraSaida(e.target.value)} />
                </div>
             </div>
             <div>
                <label className="input-label">Tolerância de Atraso</label>
                <select className="input-field" value={pontoTolerancia} onChange={e => setPontoTolerancia(Number(e.target.value))}>
                   <option value={0}>Sem tolerância</option>
                   <option value={5}>5 minutos</option>
                   <option value={10}>10 minutos</option>
                   <option value={15}>15 minutos</option>
                   <option value={20}>20 minutos</option>
                   <option value={30}>30 minutos</option>
                   <option value={60}>1 hora</option>
                </select>
             </div>
             <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.06)', borderRadius: '10px', padding: '12px 16px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                   📲 Se o funcionário bater ponto após <strong>{pontoHoraEntrada}</strong> + <strong>{pontoTolerancia}min</strong>, você receberá uma notificação push.
                </p>
             </div>
             <button className="btn-primary hover-lift" onClick={handleSave} disabled={saving} style={{ marginTop: '16px', width: '100%', padding: '14px', fontSize: '1.05rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(255, 136, 0, 0.25)', fontWeight: 'bold' }}>
                <CheckCircle size={20} />
                {saving ? 'Salvando Alterações...' : 'Salvar Regras'}
             </button>
          </div>
       </div>

       {/* Automação Contábil + Timezone */}
       <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
             <Mail size={20} /> Automação Contábil e Região
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
             Configure o fuso horário da sua loja e automatize o envio da folha de ponto para o contador.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
             <div>
                <label className="input-label">Fuso Horário Local</label>
                <select className="input-field" value={pontoTimezone} onChange={e => setPontoTimezone(e.target.value)}>
                   <option value="America/Sao_Paulo">Brasília, SP, RJ, MG, Sul (BRT)</option>
                   <option value="America/Manaus">Manaus, MT, MS (AMT)</option>
                   <option value="America/Rio_Branco">Acre (ACT)</option>
                   <option value="America/Noronha">Fernando de Noronha (FNT)</option>
                </select>
             </div>
             <div>
                <label className="input-label">E-mail do Contador</label>
                <input type="email" className="input-field" placeholder="contabilidade@empresa.com.br" value={contadorEmail} onChange={e => setContadorEmail(e.target.value)} />
             </div>
             <div>
                <label className="input-label">Fechamento e Envio Automático</label>
                <select className="input-field" value={fechamentoDia} onChange={e => setFechamentoDia(e.target.value)}>
                   <option value="ultimo_dia">Último dia do Mês</option>
                   <option value="dia_1">Todo Dia 1</option>
                   <option value="dia_5">Todo Dia 5</option>
                   <option value="dia_10">Todo Dia 10</option>
                </select>
             </div>
             <button className="btn-secondary" onClick={handleSave} disabled={saving} style={{ marginTop: '8px', padding: '12px' }}>
               {saving ? 'Salvando...' : 'Salvar Automação'}
             </button>
          </div>
       </div>
    </div>
  );
}
