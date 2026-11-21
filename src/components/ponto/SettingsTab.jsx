import React, { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import API_URL from '../../api';
import FechamentoContador from './FechamentoContador';

export default function SettingsTab({ userProfile }) {
  const [pontoHoraEntrada, setPontoHoraEntrada] = useState('08:00');
  const [pontoHoraSaida, setPontoHoraSaida] = useState('18:00');
  const [pontoTolerancia, setPontoTolerancia] = useState(15);
  const [contadorEmail, setContadorEmail] = useState('');
  const [fechamentoDia, setFechamentoDia] = useState('ultimo_dia');
  const [pontoTimezone, setPontoTimezone] = useState('America/Sao_Paulo');
  
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  // Muda a cada gravação: o quadro de envio ao contador relê o e-mail e o dia de fechamento salvos.
  const [versaoSalva, setVersaoSalva] = useState(0);

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
        setVersaoSalva(v => v + 1);
        setTimeout(() => setToast(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  return (
    <div className="pt-grade" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
       {toast && (
         <div className="pt-toast" role="status"><i />{toast}</div>
       )}

       {/* Horários e Tolerância do Ponto */}
       <div className="card pt-card">
          <div className="pt-card-cab">
             <div>
                <span className="fc-olho-rot">Jornada padrão</span>
                <h3>Horários Padrão e Tolerância</h3>
                <p>Defina o horário base da loja e a tolerância de atraso. Isso será usado caso o funcionário não tenha uma escala específica vinculada.</p>
             </div>
          </div>
          <div className="pt-campos">
             <div className="pt-2col">
                <div>
                   <label className="input-label">Entrada Padrão</label>
                   <input type="time" className="input-field mono" value={pontoHoraEntrada} onChange={e => setPontoHoraEntrada(e.target.value)} />
                </div>
                <div>
                   <label className="input-label">Saída Padrão</label>
                   <input type="time" className="input-field mono" value={pontoHoraSaida} onChange={e => setPontoHoraSaida(e.target.value)} />
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
             <p className="pt-aviso" style={{ '--c': 'var(--ink)', color: 'var(--text-muted)' }}>
                Se o funcionário bater ponto após <strong className="mono" style={{ color: 'var(--text-main)' }}>{pontoHoraEntrada}</strong> + <strong className="mono" style={{ color: 'var(--text-main)' }}>{pontoTolerancia}min</strong>, você receberá uma notificação push.
             </p>
             <button type="button" className="fc-pilula" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando Alterações...' : 'Salvar Regras'} <i><CheckCircle size={15} /></i>
             </button>
          </div>
       </div>

       {/* Automação Contábil + Timezone */}
       <div className="card pt-card">
          <div className="pt-card-cab">
             <div>
                <span className="fc-olho-rot">Contador e fuso</span>
                <h3>Automação Contábil e Região</h3>
                <p>Configure o fuso horário da sua loja e automatize o envio da folha de ponto para o contador.</p>
             </div>
          </div>
          <div className="pt-campos">
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
                <input type="email" multiple className="input-field" placeholder="contabilidade@empresa.com.br" value={contadorEmail} onChange={e => setContadorEmail(e.target.value)} />
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
             <button type="button" className="btn-secondary" onClick={handleSave} disabled={saving} style={{ padding: '11px 18px', alignSelf: 'flex-start', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
               {saving ? 'Salvando...' : 'Salvar Automação'}
             </button>
             <FechamentoContador userProfile={userProfile} versao={versaoSalva} />
          </div>
       </div>
    </div>
  );
}
