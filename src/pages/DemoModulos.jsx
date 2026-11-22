import { useEffect, useRef, useState } from 'react';
import './DemoModulos.css';

// Demonstrações da landing (22/11/2026): cada módulo vira uma cena curta, feita em
// código, no lugar dos quadros tirados dos vídeos de tutorial (saíam cinza, com cursor
// e etiqueta de passo). Os textos seguem o que o app e os avisos do WhatsApp mostram
// de verdade (api/index.js: FOTO REPROVADA NA CONFERÊNCIA, DESCARTE REGISTRADO,
// Estoque abaixo do mínimo). As fotos são as mesmas dos tutoriais (tutoriais/ambiente/fotos).

const A = ({ on, d = 0, className = '', children }) => (
  <div className={`dm-a${on ? ' dm-v' : ''}${className ? ` ${className}` : ''}`} style={{ '--d': `${d}ms` }}>{children}</div>
);

const Cena = ({ on, sai, children, className = '' }) => (
  <div className={`dm-cena${on ? ' on' : ''}${sai ? ' sai' : ''}${className ? ` ${className}` : ''}`}>{children}</div>
);

const Topo = ({ titulo, sub }) => (
  <div className="dm-topo"><b>{titulo}</b>{sub && <small>{sub}</small>}</div>
);

const IconeZap = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.4.7-2 1-2.3.2-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.2 1.4Z" /></svg>
);

// Banner do WhatsApp descendo no topo da tela, como no celular de verdade.
const Notif = ({ on, titulo, children }) => (
  <div className={`dm-notif${on ? ' on' : ''}`} aria-hidden={!on}>
    <i><IconeZap /></i>
    <div><span>WhatsApp · agora</span><b>{titulo}</b><p>{children}</p></div>
  </div>
);

const Foto = ({ src, alt, className = '' }) => <img className={`dm-foto ${className}`} src={src} alt={alt} loading="lazy" decoding="async" />;

const CENAS = {
  checklist: {
    passos: [['Você fala a rotina', 2800], ['A IA monta as tarefas', 3400], ['A equipe faz pelo celular', 2600], ['A IA reprova a foto', 3600], ['Refez a foto e passou', 3000]],
    Tela: ({ p }) => (
      <>
        <Cena on={p <= 1} sai={p > 1}>
          <Topo titulo="Criar checklist" sub="Bill IA · escutando" />
          <div className="dm-corpo">
            <A on className="dm-bal eu">
              <span className="dm-audio"><i /><i /><i /><i /><i /><i /><i /><i /> 0:14</span>
              Abertura da loja, todo dia às 8h: acender as luzes, ligar o ar, bancada limpa com foto e a temperatura da geladeira.
            </A>
            {p === 0 && <div className="dm-digitando"><i /><i /><i /></div>}
            <A on={p >= 1} className="dm-bal ia">
              <b>Montei o checklist "Abertura da loja"</b>
              <small>Todo dia · hora limite 08:30</small>
              {[['💡', 'Acender as luzes', 'Sim/não'], ['❄️', 'Ligar o ar-condicionado', 'Sim/não'], ['📷', 'Bancada de inox limpa e seca', 'Foto ao vivo'], ['🌡️', 'Temperatura da geladeira', 'Número']].map(([ic, t, tipo], i) => (
                <A key={t} on={p >= 1} d={350 + i * 260} className="dm-tarefa"><span>{ic}</span>{t}<em>{tipo}</em></A>
              ))}
            </A>
            <A on={p >= 1} d={1600} className="dm-botao">Salvar checklist</A>
          </div>
        </Cena>
        <Cena on={p >= 2}>
          <Topo titulo="Abertura da loja" sub="Lucas · 08:12 · 2 de 4" />
          <div className="dm-corpo">
            <div className="dm-feito">✓ Acender as luzes <em>Sim</em></div>
            <div className="dm-feito">✓ Ligar o ar-condicionado <em>Sim</em></div>
            <div className={`dm-item${p === 3 ? ' ruim' : p === 4 ? ' bom' : ''}`}>
              <b>Bancada de inox limpa e seca</b>
              <small>📷 Foto ao vivo, obrigatória</small>
              <div className="dm-fotos">
                <Foto src="/telas/demo-bancada-suja.jpg" alt="Foto da bancada com restos de comida" className={p === 4 ? 'some' : ''} />
                <Foto src="/telas/demo-bancada.jpg" alt="Foto da bancada limpa" className={p === 4 ? '' : 'some'} />
                {p === 2 && <span className="dm-scan" />}
              </div>
              {p === 2 && <div className="dm-conf"><i className="dm-gira" /> A IA está conferindo a foto…</div>}
              {p === 3 && <div className="dm-veredito ruim"><b>⚠ A foto não passou na conferência</b>A bancada ainda tem restos de comida e um utensílio.<span>📷 Refazer a foto</span></div>}
              {p === 4 && <div className="dm-veredito bom"><b>✓ Aprovado pela IA</b>Tudo certo: a foto mostra exatamente o que foi pedido.</div>}
            </div>
            <div className="dm-pend">Temperatura da geladeira (°C)</div>
          </div>
        </Cena>
        <Notif on={p === 3} titulo="⚠️ FOTO REPROVADA NA CONFERÊNCIA">Lucas · Bancada de inox limpa e seca: a bancada ainda tem restos de comida.</Notif>
      </>
    ),
  },

  estoque: {
    passos: [['A equipe conta pelo celular', 2600], ['O app compara com o mínimo', 3400], ['Finaliza a conferência', 2200], ['A reposição chega no WhatsApp', 3600]],
    Tela: ({ p }) => (
      <>
        <Topo titulo="Conferência de estoque" sub="Cozinha · hoje 08:40" />
        <div className="dm-corpo">
          {[
            ['Óleo de soja', '18 L', '20 L', null, 0],
            ['Queijo muçarela', '10 kg', '4 kg', 'Faltam 6 kg', 1],
            ['Copo descartável 300 ml', '500 un', '300 un', 'Faltam 200 un', 1],
          ].map(([nome, min, tem, falta, passo], i) => (
            <A key={nome} on={p >= passo} d={passo === 1 ? (i - 1) * 700 : 0} className={`dm-est${falta ? ' baixo' : ' ok'}`}>
              <div><b>{nome}</b><small>Mínimo {min}</small></div>
              <span className="dm-campo">{tem}</span>
              <em>{falta ? `⚠ Abaixo do mínimo! ${falta}` : '✓ Estoque suficiente'}</em>
            </A>
          ))}
          <A on={p >= 2} className={`dm-botao${p >= 2 ? ' apertado' : ''}`}>{p >= 2 ? '✓ Conferência enviada' : 'Finalizar e enviar'}</A>
        </div>
        <Notif on={p === 3} titulo="🛒 Estoque abaixo do mínimo">Queijo muçarela: faltam 6 kg · Copo descartável 300 ml: faltam 200 un</Notif>
      </>
    ),
  },

  compras: {
    passos: [['A contagem termina', 2200], ['A lista se monta sozinha', 3800], ['Você compra o certo', 3400]],
    Tela: ({ p }) => (
      <>
        <Topo titulo="Compras da semana" sub="Responsável: João · toda segunda" />
        <div className="dm-corpo">
          <A on className="dm-origem">Veio da contagem de hoje, 08:40</A>
          <div className="dm-comp cab"><span>Item</span><span>Precisa</span><span>Tem</span><span>Comprar</span></div>
          {[
            ['Queijo muçarela', '10 kg', '4 kg', '6 kg'],
            ['Copo 300 ml', '500 un', '300 un', '200 un'],
            ['Tomate', '8 kg', '3 kg', '5 kg'],
            ['Óleo de soja', '18 L', '20 L', null],
          ].map(([nome, precisa, tem, comprar], i) => (
            <A key={nome} on={p >= 1} d={i * 450} className={`dm-comp${comprar ? '' : ' tem'}`}>
              <span>{nome}</span><span>{precisa}</span><span>{tem}</span><b>{comprar || 'ok'}</b>
            </A>
          ))}
          <A on={p >= 2} className="dm-resumo"><b>3 itens para comprar</b>sem achismo: só o que ficou abaixo do mínimo</A>
        </div>
        <Notif on={p === 2} titulo="🛒 Estoque abaixo do mínimo">Queijo muçarela: faltam 6 kg · Tomate: faltam 5 kg · Copo 300 ml: faltam 200 un</Notif>
      </>
    ),
  },

  frota: {
    passos: [['Você pede a vistoria', 2600], ['O motorista tira a foto', 2400], ['A IA confere', 3600], ['Fica no histórico', 2800]],
    Tela: ({ p }) => (
      <>
        <Cena on={p === 0} sai={p > 0}>
          <Topo titulo="Frota e veículos" />
          <div className="dm-corpo">
            <div className="dm-veic">
              <Foto src="/telas/demo-moto.jpg" alt="Moto da empresa" />
              <b>Honda CG 160 · ABC-1D23</b>
              <small>32.450 km · Motorista: Carlos</small>
            </div>
            <A on d={700} className="dm-botao apertado">✓ Vistoria enviada para o Carlos</A>
          </div>
        </Cena>
        <Cena on={p >= 1}>
          <Topo titulo="Vistoria · ABC-1D23" sub="Carlos · 08:02" />
          <div className="dm-corpo">
            <div className={`dm-item${p >= 3 ? ' bom' : ''}`}>
              <b>1. Pneus calibrados</b>
              <small>📷 Foto ao vivo</small>
              <div className="dm-fotos">
                <Foto src="/telas/demo-moto.jpg" alt="Foto dos pneus da moto" />
                {p === 1 && <span className="dm-flash" />}
                {p === 2 && <span className="dm-scan" />}
              </div>
              {p === 2 && <div className="dm-conf"><i className="dm-gira" /> A IA está conferindo a foto…</div>}
              {p >= 3 && <div className="dm-veredito bom"><b>✓ Aprovado pela IA</b>Os dois pneus aparecem cheios e a moto está inteira, sem avaria à vista.</div>}
            </div>
            <A on={p >= 3} d={300} className="dm-feito">✓ Óleo do motor no nível <em>Sim</em></A>
            <A on={p >= 3} d={700} className="dm-hist">Vistoria concluída · 08:04 · guardada no histórico da placa</A>
          </div>
        </Cena>
      </>
    ),
  },

  perdas: {
    passos: [['A equipe registra', 3000], ['Tira a foto na hora', 2200], ['Envia para o gestor', 1800], ['O aviso chega no WhatsApp', 3600]],
    Tela: ({ p }) => (
      <>
        <Topo titulo="Registrar descarte" sub="Lucas · 14:20" />
        <div className="dm-corpo">
          {[['O que foi descartado', 'Salgado de forno'], ['Quantidade', '6 un'], ['Valor estimado', 'R$ 21,00'], ['Motivo', 'Erro de preparo']].map(([rot, val], i) => (
            <A key={rot} on d={i * 450} className="dm-form"><small>{rot}</small><span className="dm-campo">{val}</span></A>
          ))}
          <A on={p >= 1} className="dm-fotos"><Foto src="/telas/demo-descarte.jpg" alt="Foto do descarte" />{p === 1 && <span className="dm-flash" />}</A>
          <A on={p >= 2} className={`dm-botao verde${p >= 2 ? ' apertado' : ''}`}>{p >= 2 ? '✓ Enviado para o gestor' : 'Enviar para o gestor'}</A>
        </div>
        <Notif on={p === 3} titulo="📉 DESCARTE REGISTRADO">Quem: Lucas · Salgado de forno · 6 un · R$ 21,00 · Erro de preparo · 📷 com foto</Notif>
      </>
    ),
  },

  whatsapp: {
    passos: [['Checklist concluído', 2400], ['Foto reprovada', 2600], ['Checklist atrasado', 2600], ['Estoque abaixo do mínimo', 3400]],
    Tela: ({ p }) => (
      <div className="dm-zap">
        <div className="dm-zap-topo"><i><IconeZap /></i><div><b>FireCheck · Sua loja</b><small>avisos da operação</small></div></div>
        <div className="dm-zap-msgs">
          {[
            ['✅ *Checklist concluído*', 'Fechamento da loja · Ana · 23:04'],
            ['⚠️ *FOTO REPROVADA NA CONFERÊNCIA*', 'Lucas · Bancada de inox limpa e seca: a bancada ainda tem restos de comida.'],
            ['⏰ *Checklist atrasado*', 'Limpeza do banheiro passou das 15:00 e ninguém fez.'],
            ['🛒 *Estoque abaixo do mínimo*', 'Queijo muçarela: faltam 6 kg'],
          ].map(([t, txt], i) => (
            <A key={t} on={p >= i} className="dm-zap-msg">
              <b>{t.replace(/\*/g, '')}</b>{txt}<small>{['23:04', '08:14', '15:01', '08:41'][i]}</small>
            </A>
          ))}
        </div>
      </div>
    ),
  },

  painel: {
    passos: [['Os números do dia', 2800], ['Alertas da IA primeiro', 2800], ['Quem fez, a que horas', 3000], ['Ranking da equipe', 3800]],
    Tela: ({ p }) => (
      <>
        <Cena on={p <= 2} sai={p > 2}>
          <Topo titulo="Painel" sub="Hoje" />
          <div className="dm-corpo">
            <div className="dm-kpis">
              <div><small>Checklists hoje</small><b>27</b><em>✓ 25 concluídos</em></div>
              <div><small>Conformidade</small><b>96%</b><i className="dm-barra"><span style={{ width: p >= 0 ? '96%' : 0 }} /></i></div>
            </div>
            <A on={p >= 1} className="dm-alerta"><b>⚠ Alerta da IA</b>Bancada de inox: foto reprovada · Lucas · 08:14</A>
            <A on={p >= 2} className="dm-sub">Auditoria em tempo real</A>
            {[['demo-rosto-ana', 'Ana', 'Abertura da loja', '08:12'], ['demo-rosto-juliana', 'Juliana', 'Temperatura da geladeira', '08:20'], ['demo-rosto-lucas', 'Lucas', 'Limpeza do salão', '08:31']].map(([f, n, t, h], i) => (
              <A key={n} on={p >= 2} d={250 + i * 300} className="dm-audit"><img src={`/telas/${f}.jpg`} alt="" /><div><b>{n}</b><small>{t}</small></div><em>{h} ✓</em></A>
            ))}
          </div>
        </Cena>
        <Cena on={p === 3}>
          <Topo titulo="Ranking da equipe" sub="Este mês" />
          <div className="dm-corpo">
            <div className="dm-podio">
              {[['demo-rosto-lucas', 'Lucas', '91%', 2], ['demo-rosto-ana', 'Ana', '100%', 1], ['demo-rosto-juliana', 'Juliana', '80%', 3]].map(([f, n, nota, pos]) => (
                <div key={n} className={`p${pos}`}><img src={`/telas/${f}.jpg`} alt="" /><b>{n}</b><small>{nota}</small><span>{pos}º</span></div>
              ))}
            </div>
            {[['Ana', 100, '35/35'], ['Lucas', 91, '32/35'], ['Juliana', 80, '28/35']].map(([n, v, t], i) => (
              <A key={n} on={p === 3} d={500 + i * 250} className="dm-rank"><b>{n}</b><i className="dm-barra"><span style={{ width: p === 3 ? `${v}%` : 0 }} /></i><small>{t}</small></A>
            ))}
          </div>
        </Cena>
      </>
    ),
  },
};

const reduzMovimento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function DemoModulo({ id }) {
  const cena = CENAS[id];
  const n = cena.passos.length;
  const [p, setP] = useState(() => (reduzMovimento() ? n - 1 : 0));
  const [visivel, setVisivel] = useState(false);
  const ref = useRef(null);

  // Só anda quando está na tela: fora dela não gasta nada.
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setVisivel(true); return undefined; }
    const io = new IntersectionObserver(([e]) => setVisivel(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visivel || reduzMovimento()) return undefined;
    const t = setTimeout(() => setP((x) => (x + 1) % n), cena.passos[p][1]);
    return () => clearTimeout(t);
  }, [p, visivel, n, cena]);

  const { Tela } = cena;
  return (
    <div className="dm" ref={ref}>
      <div className="dm-fone">
        <div className="dm-tela">
          <div className="dm-status"><span>9:41</span><span className="dm-ilha" /><span>● ● ▮</span></div>
          <div className="dm-palco"><Tela p={p} /></div>
        </div>
      </div>
      <ol className="dm-passos" aria-label="Passos da demonstração">
        {cena.passos.map(([rot, ms], i) => (
          <li key={rot} className={i === p ? 'on' : i < p ? 'foi' : ''}>
            <button type="button" onClick={() => setP(i)} aria-current={i === p ? 'step' : undefined}>
              <i>{i + 1}</i><span>{rot}</span>
              <u>{i === p && <s key={`${p}-${visivel}`} style={{ '--ms': `${ms}ms`, animationPlayState: visivel ? 'running' : 'paused' }} />}</u>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Ilustrações do "Como funciona": uma cena parada por passo, com o mesmo visual do app.
export function IlustraPasso({ n }) {
  if (n === 1) return (
    <div className="dm-il dm-il1" aria-hidden="true">
      <div className="dm-bal eu"><span className="dm-audio"><i /><i /><i /><i /><i /><i /><i /><i /> 0:14</span>Abertura às 8h: luzes, ar e bancada limpa com foto.</div>
      <div className="dm-il-seta">↓ a IA monta</div>
      <div className="dm-il-tarefas"><span>💡 Acender as luzes</span><span>❄️ Ligar o ar</span><span>📷 Bancada limpa <em>foto</em></span><span>⏱ até 08:30</span></div>
    </div>
  );
  if (n === 2) return (
    <div className="dm-il dm-il2" aria-hidden="true">
      <div className="dm-il-foto"><img src="/telas/demo-bancada-suja.jpg" alt="" loading="lazy" /><span className="ruim">✕ Reprovada</span></div>
      <div className="dm-il-foto"><img src="/telas/demo-bancada.jpg" alt="" loading="lazy" /><span className="bom">✓ Aprovada</span></div>
      <p>“A bancada ainda tem restos de comida.”</p>
    </div>
  );
  return (
    <div className="dm-il dm-il3" aria-hidden="true">
      {[['⚠️', 'Foto reprovada', 'Bancada de inox · Lucas'], ['⏰', 'Checklist atrasado', 'Limpeza do banheiro'], ['🛒', 'Estoque abaixo do mínimo', 'Queijo muçarela: faltam 6 kg']].map(([ic, t, s]) => (
        <div key={t} className="dm-il-notif"><i><IconeZap /></i><div><b>{ic} {t}</b><small>{s}</small></div></div>
      ))}
    </div>
  );
}
