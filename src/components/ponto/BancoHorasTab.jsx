import React, { useState, useEffect, useCallback } from 'react';
import { Printer, ChevronDown, ChevronUp, RefreshCw, Scale } from 'lucide-react';
import API_URL from '../../api';
import { rotulosDoDia, formatarMinutos } from '../../utils/pontoBatidas';

// Banco de horas com saldo parcial: escolhe funcionário (ou todos) e período
// e imprime a folha de cada um. O cálculo é do servidor (/api/ponto/saldo):
// pares entrada→saída (o almoço fica fora), jornada da escala menos o
// intervalo, atestados e feriados abonados.

const auth = () => ({ 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') });
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '');
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const diaDaSemana = (d) => { const [a, m, dd] = d.split('-').map(Number); return DIAS[new Date(Date.UTC(a, m - 1, dd)).getUTCDay()]; };
const corDoSaldo = (min) => (min === null || min === undefined ? 'var(--text-muted)' : min < 0 ? '#EF4444' : '#10B981');
const comSinal = (min) => (min > 0 ? '+' : '') + formatarMinutos(min);

/** O que aparece na coluna "Ocorrência" (tela e folha impressa). */
function ocorrenciaDoDia(d) {
  if (d.abono) return d.abono.rotulo + (d.abono.observacao ? ` (${d.abono.observacao})` : '');
  if (d.em_andamento) return 'Em andamento';
  if (d.falta) return 'Falta';
  if (d.incompleto) return 'Batida faltando';
  if (d.folga) return d.batidas.length ? 'Folga trabalhada' : 'Folga';
  return '';
}

const batidasComNome = (d) => {
  const nomes = rotulosDoDia(d.batidas, { emAndamento: d.em_andamento });
  return d.batidas.map((b, i) => `${nomes[i]} ${b.hora}`);
};

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Abre a folha (uma página por funcionário) e chama a impressão, como o relatório de checklist. */
function imprimirFolhas(funcionarios, { inicio, fim, loja }) {
  const janela = window.open('', '_blank');
  if (!janela) { alert('Libere as janelas pop-up deste site para imprimir.'); return; }
  const paginas = funcionarios.map(f => `
    <section class="folha">
      <h1>Espelho de Ponto e Banco de Horas</h1>
      <p class="sub"><strong>${esc(loja)}</strong> · Período: ${dataBR(inicio)} a ${dataBR(fim)}</p>
      <p class="sub">Colaborador: <strong>${esc(f.nome)}</strong>${f.escala ? ` · Escala: ${esc(f.escala)}` : ' · Sem escala vinculada'}</p>
      <table>
        <thead><tr><th>Data</th><th>Batidas</th><th>Trabalhado</th><th>Esperado</th><th>Saldo</th><th>Ocorrência</th></tr></thead>
        <tbody>
          ${f.dias.map(d => `<tr>
            <td>${diaDaSemana(d.data)} ${dataBR(d.data)}</td>
            <td>${batidasComNome(d).map(esc).join('<br>')}</td>
            <td>${d.trabalhado_min ? formatarMinutos(d.trabalhado_min) : ''}</td>
            <td>${d.esperado_min ? formatarMinutos(d.esperado_min - d.abonado_min) : ''}</td>
            <td>${d.saldo_min !== null && (d.saldo_min !== 0 || d.trabalhado_min) ? comSinal(d.saldo_min) : ''}</td>
            <td>${esc(ocorrenciaDoDia(d))}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <table class="totais">
        <tr><td>Horas trabalhadas</td><td>${formatarMinutos(f.totais.trabalhado_min)}</td></tr>
        <tr><td>Horas esperadas</td><td>${f.totais.esperado_min === null ? '—' : formatarMinutos(f.totais.esperado_min)}</td></tr>
        <tr><td>Horas abonadas (atestado/feriado)</td><td>${formatarMinutos(f.totais.abonado_min)}</td></tr>
        <tr><td><strong>Saldo do banco de horas</strong></td><td><strong>${f.totais.saldo_min === null ? '—' : comSinal(f.totais.saldo_min)}</strong></td></tr>
        <tr><td>Faltas</td><td>${f.totais.faltas}</td></tr>
      </table>
      <div class="assinaturas">
        <div>______________________________<br>${esc(f.nome)}</div>
        <div>______________________________<br>Responsável</div>
      </div>
      <p class="rodape">FireCheck · emitido em ${new Date().toLocaleString('pt-BR')} · saldo parcial, sujeito a ajustes até o fechamento.</p>
    </section>`).join('');
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Banco de horas ${dataBR(inicio)} a ${dataBR(fim)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
      .folha { page-break-after: always; }
      .folha:last-child { page-break-after: auto; }
      h1 { font-size: 18px; margin: 0 0 6px 0; }
      .sub { margin: 2px 0; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
      th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
      th { background: #f3f4f6; }
      .totais { width: 50%; margin-top: 16px; }
      .assinaturas { display: flex; justify-content: space-between; margin-top: 48px; font-size: 12px; text-align: center; }
      .rodape { font-size: 10px; color: #6b7280; margin-top: 24px; }
    </style></head><body>${paginas}
    <script>window.onload = function () { window.print(); };</script>
    </body></html>`);
  janela.document.close();
}

export default function BancoHorasTab({ employees, userProfile }) {
  const [quem, setQuem] = useState('todos');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState(null);

  const carregar = useCallback(async (filtros) => {
    setCarregando(true);
    setErro('');
    try {
      const q = new URLSearchParams();
      if (filtros.quem && filtros.quem !== 'todos') q.set('userId', filtros.quem);
      if (filtros.inicio) q.set('inicio', filtros.inicio);
      if (filtros.fim) q.set('fim', filtros.fim);
      const res = await fetch(`${API_URL}/api/ponto/saldo?${q.toString()}`, { headers: auth() });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErro(d.error || 'Não foi possível calcular o banco de horas.'); setCarregando(false); return; }
      setDados(d);
      // Sem datas escolhidas, o servidor usa o período de fechamento da loja até hoje.
      if (!filtros.inicio) setInicio(d.inicio);
      if (!filtros.fim) setFim(d.fim);
    } catch {
      setErro('Erro de conexão.');
    }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar({ quem: 'todos' }); }, [carregar]);

  const lista = dados?.funcionarios || [];
  const loja = userProfile?.store_name || userProfile?.store || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card" style={{ padding: '20px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ minWidth: '200px', flex: 1 }}>
          <label className="input-label">Funcionário</label>
          <select className="input-field" value={quem} onChange={e => setQuem(e.target.value)}>
            <option value="todos">Todos</option>
            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">De</label>
          <input type="date" className="input-field" value={inicio} onChange={e => setInicio(e.target.value)} />
        </div>
        <div>
          <label className="input-label">Até</label>
          <input type="date" className="input-field" value={fim} onChange={e => setFim(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={() => carregar({ quem, inicio, fim })} disabled={carregando} style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={16} /> {carregando ? 'Calculando...' : 'Ver saldo'}
        </button>
        {lista.length > 1 && (
          <button className="btn-secondary" onClick={() => imprimirFolhas(lista, { inicio: dados.inicio, fim: dados.fim, loja })} style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Printer size={16} /> Imprimir todos
          </button>
        )}
      </div>

      {erro && <p style={{ color: 'var(--error)', margin: 0 }}>{erro}</p>}
      {dados && (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Saldo parcial de {dataBR(dados.inicio)} a {dataBR(dados.fim)}. O dia de hoje só entra depois do horário de saída da escala.
        </p>
      )}

      {lista.length === 0 && dados && !carregando && (
        <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum funcionário no período.</div>
      )}

      {lista.map(f => (
        <div key={f.user_id} className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Scale size={18} color="var(--primary)" /> {f.nome}</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {f.escala ? `Escala: ${f.escala}` : 'Sem escala vinculada — o saldo precisa de uma escala (aba Funcionários).'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" onClick={() => setAberto(aberto === f.user_id ? null : f.user_id)} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {aberto === f.user_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />} Dias
              </button>
              <button className="btn-secondary" onClick={() => imprimirFolhas([f], { inicio: dados.inicio, fim: dados.fim, loja })} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Printer size={16} /> Imprimir
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginTop: '16px' }}>
            {[
              ['Trabalhadas', formatarMinutos(f.totais.trabalhado_min), 'var(--text-main)'],
              ['Esperadas', f.totais.esperado_min === null ? '—' : formatarMinutos(f.totais.esperado_min), 'var(--text-main)'],
              ['Abonadas', formatarMinutos(f.totais.abonado_min), '#3B82F6'],
              ['Saldo', f.totais.saldo_min === null ? '—' : comSinal(f.totais.saldo_min), corDoSaldo(f.totais.saldo_min)],
              ['Faltas', String(f.totais.faltas), f.totais.faltas ? '#EF4444' : 'var(--text-main)'],
            ].map(([rotulo, valor, cor]) => (
              <div key={rotulo} style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '10px 12px' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{rotulo}</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '1.25rem', fontWeight: 'bold', color: cor }}>{valor}</p>
              </div>
            ))}
          </div>
          {f.totais.dias_incompletos > 0 && (
            <p style={{ margin: '10px 0 0 0', fontSize: '0.85rem', color: '#F59E0B' }}>
              {f.totais.dias_incompletos} dia(s) com batida faltando — corrija na ficha do funcionário para as horas contarem.
            </p>
          )}

          {aberto === f.user_id && (
            <div style={{ overflowX: 'auto', marginTop: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                    {['Data', 'Batidas', 'Trabalhado', 'Esperado', 'Saldo', 'Ocorrência'].map(h => <th key={h} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {f.dias.map(d => (
                    <tr key={d.data} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{diaDaSemana(d.data)} {dataBR(d.data)}</td>
                      <td style={{ padding: '6px 8px' }}>{batidasComNome(d).join(' · ')}</td>
                      <td style={{ padding: '6px 8px' }}>{d.trabalhado_min ? formatarMinutos(d.trabalhado_min) : ''}</td>
                      <td style={{ padding: '6px 8px' }}>{d.esperado_min ? formatarMinutos(d.esperado_min - d.abonado_min) : ''}</td>
                      <td style={{ padding: '6px 8px', color: corDoSaldo(d.saldo_min), fontWeight: 'bold' }}>{d.saldo_min !== null && (d.saldo_min !== 0 || d.trabalhado_min) ? comSinal(d.saldo_min) : ''}</td>
                      <td style={{ padding: '6px 8px', color: d.falta ? '#EF4444' : d.abono ? '#3B82F6' : 'var(--text-muted)' }}>{ocorrenciaDoDia(d)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
