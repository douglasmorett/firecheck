import React, { useState } from 'react';
import { CheckCircle, Paperclip } from 'lucide-react';
import API_URL from '../../api';

// Lançamento de atestado, falta justificada, folga compensada ou feriado.
// Usado na aba "Atestados e Feriados" e na ficha do funcionário (botão
// "Abonar" num dia de falta). O dia lançado deixa de contar como falta no
// espelho e, exceto a folga compensada, não desconta do banco de horas.
const TIPOS_ABONO = [
  { valor: 'atestado', rotulo: 'Atestado médico', dica: 'O dia não conta como falta e as horas não são descontadas.' },
  { valor: 'falta_justificada', rotulo: 'Falta justificada', dica: 'O dia não conta como falta e as horas não são descontadas.' },
  { valor: 'folga_compensada', rotulo: 'Folga compensada (banco de horas)', dica: 'O dia não conta como falta, mas as horas da jornada saem do banco de horas.' },
  { valor: 'feriado', rotulo: 'Feriado (toda a equipe)', dica: 'Vale para todos: ninguém leva falta nem desconto. Quem trabalhar no feriado ganha as horas no banco.' },
];

const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

export default function AbonoForm({ employees = [], funcionarioFixo = null, dataInicial = '', tipoInicial = 'atestado', onSalvo, onCancelar }) {
  const [tipo, setTipo] = useState(tipoInicial);
  const [userId, setUserId] = useState(funcionarioFixo ? String(funcionarioFixo.id) : '');
  const [data, setData] = useState(dataInicial || hojeSP());
  const [dataFim, setDataFim] = useState('');
  const [observacao, setObservacao] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const ehFeriado = tipo === 'feriado';
  const dica = TIPOS_ABONO.find(t => t.valor === tipo)?.dica;

  const escolherArquivo = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // O arquivo vai em base64 no corpo da requisição: foto de celular grande
    // passa de 5 MB fácil, e aí é melhor avisar do que travar o envio.
    if (f.size > 5 * 1024 * 1024) { setErro('Arquivo maior que 5 MB. Tire uma foto menor do atestado.'); return; }
    const leitor = new FileReader();
    leitor.onload = (ev) => { setArquivo(ev.target.result); setNomeArquivo(f.name); setErro(''); };
    leitor.readAsDataURL(f);
  };

  const salvar = async () => {
    if (!ehFeriado && !userId) { setErro('Escolha o funcionário.'); return; }
    if (!data) { setErro('Informe a data.'); return; }
    setSalvando(true);
    setErro('');
    try {
      const res = await fetch(`${API_URL}/api/ponto/abonos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') },
        body: JSON.stringify({ tipo, userId: ehFeriado ? null : userId, data, dataFim: dataFim || null, observacao, arquivo }),
      });
      const resp = await res.json().catch(() => ({}));
      if (!res.ok) { setErro(resp.error || 'Não foi possível salvar.'); setSalvando(false); return; }
      setObservacao(''); setDataFim(''); setArquivo(null); setNomeArquivo('');
      setSalvando(false);
      if (onSalvo) onSalvo();
    } catch {
      setErro('Erro de conexão. Tente de novo.');
      setSalvando(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {erro && <div style={{ color: 'var(--error)', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '10px 12px', borderRadius: '10px', fontSize: '0.9rem' }}>{erro}</div>}
      <div>
        <label className="input-label">O que lançar</label>
        <select className="input-field" value={tipo} onChange={e => setTipo(e.target.value)}>
          {TIPOS_ABONO.filter(t => !funcionarioFixo || t.valor !== 'feriado').map(t => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
        </select>
        {dica && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '6px 0 0 0' }}>{dica}</p>}
      </div>
      {!ehFeriado && !funcionarioFixo && (
        <div>
          <label className="input-label">Funcionário</label>
          <select className="input-field" value={userId} onChange={e => setUserId(e.target.value)}>
            <option value="">Escolha...</option>
            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
        </div>
      )}
      {funcionarioFixo && <p style={{ margin: 0, fontSize: '0.9rem' }}>Funcionário: <strong>{funcionarioFixo.name}</strong></p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label className="input-label">Data</label>
          <input type="date" className="input-field" value={data} onChange={e => setData(e.target.value)} />
        </div>
        <div>
          <label className="input-label">Até (opcional)</label>
          <input type="date" className="input-field" value={dataFim} min={data} onChange={e => setDataFim(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="input-label">Observação</label>
        <input type="text" className="input-field" placeholder={ehFeriado ? 'Ex.: Proclamação da República' : 'Ex.: atestado de 2 dias, CID não informado'} value={observacao} onChange={e => setObservacao(e.target.value)} />
      </div>
      {!ehFeriado && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          <Paperclip size={16} color="var(--primary)" />
          {nomeArquivo ? <span style={{ color: 'var(--text-main)' }}>{nomeArquivo}</span> : 'Anexar foto ou PDF do atestado (opcional)'}
          <input type="file" accept="image/*,application/pdf" onChange={escolherArquivo} style={{ display: 'none' }} />
        </label>
      )}
      <div style={{ display: 'flex', gap: '12px' }}>
        {onCancelar && <button type="button" className="btn-secondary" style={{ flex: 1, padding: '12px' }} onClick={onCancelar}>Cancelar</button>}
        <button type="button" className="btn-primary" style={{ flex: 1, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={salvar} disabled={salvando}>
          <CheckCircle size={18} /> {salvando ? 'Salvando...' : 'Lançar'}
        </button>
      </div>
    </div>
  );
}
