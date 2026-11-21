import React, { useState, useEffect, useCallback } from 'react';
import { Printer, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import API_URL from '../../api';
import { iniciais } from '../painel/Painel';
import { rotulosDoDia, formatarMinutos } from '../../utils/pontoBatidas';

// Banco de horas com saldo parcial: escolhe funcionário (ou todos) e período
// e imprime a folha de cada um. O cálculo é do servidor (/api/ponto/saldo):
// pares entrada→saída (o almoço fica fora), jornada da escala menos o
// intervalo, atestados e feriados abonados.

const auth = () => ({ 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') });
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '');
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const diaDaSemana = (d) => { const [a, m, dd] = d.split('-').map(Number); return DIAS[new Date(Date.UTC(a, m - 1, dd)).getUTCDay()]; };
const corDoSaldo = (min) => (min === null || min === undefined ? 'var(--text-muted)' : min < 0 ? 'var(--bad)' : 'var(--ok)');
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
    <div className="pt-campos" style={{ gap: '18px' }}>
      <div className="card pt-card">
        <span className="fc-olho-rot">Período e funcionário</span>
        <div className="pt-filtros">
          <div style={{ minWidth: '200px', flex: 1 }}>
            <label className="input-label">Funcionário</label>
            <select className="input-field" value={quem} onChange={e => setQuem(e.target.value)}>
              <option value="todos">Todos</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">De</label>
            <input type="date" className="input-field mono" value={inicio} onChange={e => setInicio(e.target.value)} />
          </div>
          <div>
            <label className="input-label">Até</label>
            <input type="date" className="input-field mono" value={fim} onChange={e => setFim(e.target.value)} />
          </div>
          <button type="button" className="btn-primary" onClick={() => carregar({ quem, inicio, fim })} disabled={carregando} style={{ padding: '11px 18px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
            <RefreshCw size={15} /> {carregando ? 'Calculando...' : 'Ver saldo'}
          </button>
          {lista.length > 1 && (
            <button type="button" className="btn-secondary" onClick={() => imprimirFolhas(lista, { inicio: dados.inicio, fim: dados.fim, loja })} style={{ padding: '11px 18px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>
              <Printer size={15} /> Imprimir todos
            </button>
          )}
        </div>
        {dados && (
          <p className="pt-nota">
            Saldo parcial de <span className="mono">{dataBR(dados.inicio)}</span> a <span className="mono">{dataBR(dados.fim)}</span>. O dia de hoje só entra depois do horário de saída da escala.
          </p>
        )}
      </div>

      {erro && <p className="pt-erro">{erro}</p>}

      {lista.length === 0 && dados && !carregando && (
        <div className="card fc-vazio">Nenhum funcionário no período.</div>
      )}

      {lista.map(f => (
        <div key={f.user_id} className="card pt-card pt-banco">
          <div className="pt-banco-cab">
            <div className="pt-quem">
              <div className="fc-av"><span className="pt-av-ini">{iniciais(f.nome)}</span></div>
              <div style={{ minWidth: 0 }}>
                <h3>{f.nome}</h3>
                <p>{f.escala ? `Escala: ${f.escala}` : 'Sem escala vinculada — o saldo precisa de uma escala (aba Funcionários).'}</p>
              </div>
            </div>
            <div className="pt-mini-acoes">
              <button type="button" className="fc-mini-btn info" onClick={() => setAberto(aberto === f.user_id ? null : f.user_id)}>
                {aberto === f.user_id ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Dias
              </button>
              <button type="button" className="fc-mini-btn info" onClick={() => imprimirFolhas([f], { inicio: dados.inicio, fim: dados.fim, loja })}>
                <Printer size={14} /> Imprimir
              </button>
            </div>
          </div>

          <div className="pt-nums">
            {[
              ['Trabalhadas', formatarMinutos(f.totais.trabalhado_min), 'var(--text-main)'],
              ['Esperadas', f.totais.esperado_min === null ? '—' : formatarMinutos(f.totais.esperado_min), 'var(--text-main)'],
              ['Abonadas', formatarMinutos(f.totais.abonado_min), 'var(--text-main)'],
              ['Saldo', f.totais.saldo_min === null ? '—' : comSinal(f.totais.saldo_min), corDoSaldo(f.totais.saldo_min)],
              ['Faltas', String(f.totais.faltas), f.totais.faltas ? 'var(--bad)' : 'var(--text-main)'],
            ].map(([rotulo, valor, cor]) => (
              <div key={rotulo} className="pt-num">
                <span className="fc-olho-rot">{rotulo}</span>
                <strong style={{ color: cor }}>{valor}</strong>
              </div>
            ))}
          </div>
          {f.totais.dias_incompletos > 0 && (
            <p className="pt-aviso">
              <span className="mono">{f.totais.dias_incompletos}</span> dia(s) com batida faltando — corrija na ficha do funcionário para as horas contarem.
            </p>
          )}

          {aberto === f.user_id && (
            <div style={{ overflowX: 'auto' }}>
              <table className="pt-tabela">
                <thead>
                  <tr>
                    {['Data', 'Batidas', 'Trabalhado', 'Esperado', 'Saldo', 'Ocorrência'].map(h => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {f.dias.map(d => {
                    const oc = ocorrenciaDoDia(d);
                    return (
                      <tr key={d.data}>
                        <td className="mono">{diaDaSemana(d.data)} {dataBR(d.data)}</td>
                        <td className="mono" style={{ whiteSpace: 'normal', color: 'var(--text-muted)' }}>{batidasComNome(d).join(' · ')}</td>
                        <td className="mono">{d.trabalhado_min ? formatarMinutos(d.trabalhado_min) : ''}</td>
                        <td className="mono">{d.esperado_min ? formatarMinutos(d.esperado_min - d.abonado_min) : ''}</td>
                        <td className="mono" style={{ color: corDoSaldo(d.saldo_min) }}>{d.saldo_min !== null && (d.saldo_min !== 0 || d.trabalhado_min) ? comSinal(d.saldo_min) : ''}</td>
                        <td>{oc && <span className="fc-selo" style={{ '--c': d.falta ? 'var(--bad)' : d.abono ? 'var(--info)' : 'var(--text-muted)' }}><i /><span>{oc}</span></span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
