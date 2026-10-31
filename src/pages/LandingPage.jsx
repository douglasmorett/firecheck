import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API_URL from '../api';
import './LandingPage.css';

// Página inicial do site (firecheckapp.com.br), feita para o celular primeiro:
// quem chega pelo anúncio vê a promessa, o vídeo e o botão sem rolar, e a barra
// fixa no pé mantém o "7 dias grátis" à mão até o fim da página.

const EMPRESAS = [
  ['logo_grupo_tavares', 'Grupo Tavares', 'Alimentação & Restaurantes'],
  ['logo_fitmax_academia', 'FitMax Academia', 'Fitness & Bem-Estar'],
  ['logo_hotel_meridian', 'Hotel Meridian', 'Hotelaria & Turismo'],
  ['logo_logflex', 'LogFlex Transportes', 'Logística & Frota'],
  ['logo_clinica', 'Clínica Bem Estar', 'Saúde & Clínicas'],
  ['logo_padaria', 'Padaria São Jorge', 'Panificação & Varejo'],
  ['logo_bella_forma', 'Bella Forma Studio', 'Beleza & Estética'],
  ['logo_mega_super', 'Mega Supermercados', 'Varejo & Supermercados'],
  ['logo_burger_house', 'Rede Burger House', 'Fast Food & Franquias'],
  ['logo_autoprime', 'AutoPrime', 'Concessionárias & Auto'],
];

const SETORES = [
  ['/dirty-grill.png', 'Cozinha Comercial', 'Crostas de gordura carbonizada na lateral direita da chapa. Refaça a limpeza.', 'Notificar funcionário'],
  ['/gym-treadmill.png', 'Academia Fitness', 'Suor não higienizado no painel da esteira 3. Limpeza incompleta.', 'Notificar recepcionista'],
  ['/fleet-tire.png', 'Logística e Frota', 'Desgaste excessivo detectado no pneu traseiro direito. Abaixo do indicador TWI.', 'Bloquear veículo'],
  ['/hotel-bed.png', 'Hotelaria', 'Lençol amassado e travesseiros fora de esquadro. Arrumação fora do padrão da rede.', 'Notificar camareira'],
];

// Cada módulo, com o que ele faz hoje (conferido nas telas gravadas dos tutoriais do app).
const DETALHES = [
  {
    id: 'checklist', icone: '✅', nome: 'Checklist com IA',
    titulo: <>Checklist que a IA <em>monta e confere.</em></>,
    texto: 'Abertura, fechamento, limpeza, temperatura, segurança: qualquer rotina vira checklist no celular da equipe.',
    itens: [
      'Crie falando ou escrevendo: a IA faz perguntas e monta as tarefas',
      'Sim/não, número, estrelas, múltipla escolha, lista e texto',
      'Foto tirada na hora pela câmera do app (1 a 4 por tarefa)',
      'A IA confere a foto, reprova o que está fora do padrão e pede para refazer',
      'Repetição diária, semanal, mensal, trimestral ou semestral, para a equipe toda ou pessoas certas',
      'Selfie e assinatura na finalização, se você quiser',
      'Resultado com fotos, análise da IA e PDF para guardar',
    ],
    fotos: [['/telas/checklist-ia-cria.jpg', 'A IA montando o checklist'], ['/telas/checklist-ia-reprova.jpg', 'A IA reprovando a foto da bancada']],
  },
  {
    id: 'estoque', icone: '📦', nome: 'Estoque',
    titulo: <>Controle de estoque <em>com estoque mínimo.</em></>,
    texto: 'Cada produto com o seu mínimo. A equipe conta pelo celular e o FireCheck mostra na hora o que está faltando.',
    itens: [
      'Lista de produtos com unidade (kg, L, un) e estoque mínimo',
      'A equipe digita quanto tem e vê "abaixo do mínimo, faltam X"',
      'Ao finalizar, o aviso com a lista de reposição vai para o seu WhatsApp',
      'Histórico de conferências: quem contou, quando e o que ficou abaixo',
      'Relatório item por item, com a observação deixada pela equipe',
      'Entrada e saída de produtos registradas pelo celular',
    ],
    fotos: [['/telas/estoque-contagem.jpg', 'Contagem de estoque no celular da equipe'], ['/telas/compras-relatorio.jpg', 'Relatório da conferência no painel']],
  },
  {
    id: 'compras', icone: '🛒', nome: 'Lista de compras',
    titulo: <>Lista de compras <em>que se monta sozinha.</em></>,
    texto: 'O que ficou abaixo do mínimo na contagem já aparece com a quantidade que falta. Você compra o certo, sem achismo.',
    itens: [
      'Listas por rotina: compras da semana, hortifrúti do dia',
      'Cada item com quanto precisa ter e quanto tem hoje',
      'Responsável e frequência de cada lista',
      'Aviso no WhatsApp quando algo fica abaixo do mínimo',
      'Histórico para saber o que mais falta e quando',
    ],
    fotos: [['/telas/compras-relatorio.jpg', 'Itens abaixo do mínimo, com o que falta']],
  },
  {
    id: 'frota', icone: '🚚', nome: 'Frota',
    titulo: <>Checklist de carro e moto <em>antes de sair.</em></>,
    texto: 'Os veículos da empresa com vistoria pelo celular do motorista. Pneu, óleo, lataria: tudo com foto e conferido pela IA.',
    itens: [
      'Cadastro do veículo com placa, modelo, km e foto',
      'Motorista vinculado: a vistoria aparece no celular dele',
      'Você escolhe o que conferir e com que frequência',
      'Pedir uma vistoria na hora, com um toque',
      'Foto de cada item analisada pela IA (ex.: pneus calibrados)',
      'Histórico das vistorias com a placa de cada veículo',
    ],
    fotos: [['/telas/frota-ia.jpg', 'Vistoria da moto aprovada pela IA'], ['/telas/frota-veiculos.jpg', 'Os veículos da empresa']],
  },
  {
    id: 'perdas', icone: '🗑️', nome: 'Descarte e perdas',
    titulo: <>Descarte e perdas <em>com foto e valor.</em></>,
    texto: 'O que foi para o lixo deixa de sumir. A equipe registra na hora e o gestor recebe o aviso.',
    itens: [
      'O que foi descartado, quantidade e unidade',
      'Valor estimado em reais e o motivo (vencido, erro de preparo...)',
      'Foto do descarte, tirada na hora',
      'Ocorrências também: freezer parou, equipamento quebrou',
      'O gestor é avisado no WhatsApp a cada registro',
    ],
    fotos: [['/telas/descarte-foto.jpg', 'Registro de descarte com foto e valor']],
  },
  {
    id: 'whatsapp', icone: '💬', nome: 'Avisos no WhatsApp',
    titulo: <>Tudo chega no <em>seu WhatsApp.</em></>,
    texto: 'Conecte o WhatsApp da empresa lendo um QR Code. Os avisos saem do seu número para você, seu gerente e quem mais você cadastrar.',
    itens: [
            'Checklist reprovado pela IA e checklist concluído',
      'Estoque abaixo do mínimo, com a lista de reposição',
      'Ocorrência e descarte registrados pela equipe',
      'Atraso e ausência no ponto (com o módulo de ponto)',
      'Você escolhe quais avisos recebe',
    ],
    fotos: [['/telas/whatsapp-qr.jpg', 'Conectar o WhatsApp da empresa pelo QR'], ['/telas/whatsapp-avisos.jpg', 'Escolha dos avisos']],
  },
  {
    id: 'painel', icone: '📊', nome: 'Painel e ranking',
    titulo: <>Sua operação <em>numa tela só.</em></>,
    texto: 'Checklists do dia, conformidade, alertas da IA e o ranking da equipe, no celular ou no computador.',
    itens: [
      'Checklists de hoje e quantos foram concluídos',
      'Conformidade geral da loja',
      'Alertas da IA para você agir primeiro',
      'Auditoria em tempo real: quem fez, a que horas, com que foto',
      'Ranking da equipe com pódio e nota de cada um',
    ],
    fotos: [['/telas/painel.jpg', 'Painel do dono'], ['/telas/ranking.jpg', 'Ranking da equipe']],
  },
  {
    id: 'ponto', icone: '🕐', nome: 'Ponto', opcional: true,
    titulo: <>Ponto eletrônico <em>com selfie e GPS.</em></>,
    texto: 'Módulo à parte, se você quiser: o funcionário bate o ponto pelo celular, com selfie e localização.',
    itens: [
      'Selfie com reconhecimento facial na hora de bater',
      'Localização e endereço gravados em cada batida',
      'Aviso de atraso e ausência no WhatsApp',
      'Escala, banco de horas, atestados e feriados',
      'Tablet da loja como relógio de ponto',
      'Fechamento por e-mail para o contador, em PDF e planilha',
    ],
    fotos: [['/telas/ponto-selfie.jpg', 'Ponto com selfie e GPS'], ['/telas/ponto-gestor.jpg', 'Ponto no painel do gestor']],
  },
];

// Telas do celular ficam em pé; as do painel (computador) aparecem inteiras, sem corte.
const CELULAR = /checklist-|estoque-contagem|descarte-foto|ponto-selfie/;

function Modulos({ onTestar }) {
  const [ativo, setAtivo] = useState(DETALHES[0].id);
  const m = DETALHES.find((d) => d.id === ativo);
  return (
    <section className="lp-sec" id="modulos">
      <div className="lp-in">
        <h2>Tudo que a sua operação <em>precisa conferir.</em></h2>
        <p className="lp-lead">Um app só para checklist, estoque, compras, frota e perdas. Toque em cada um para ver como funciona.</p>
        <div className="lp-abas" role="tablist">
          {DETALHES.map((d) => (
            <button key={d.id} role="tab" aria-selected={d.id === ativo} className={d.id === ativo ? 'on' : ''} onClick={() => setAtivo(d.id)}>
              <span>{d.icone}</span>{d.nome}{d.opcional && <small> · opcional</small>}
            </button>
          ))}
        </div>
        <div className="lp-mod-det" key={m.id}>
          <div className="lp-mod-txt">
            <h3>{m.titulo}</h3>
            <p>{m.texto}</p>
            <ul>{m.itens.map((i) => <li key={i}>{i}</li>)}</ul>
            <button className="lp-cta" onClick={() => onTestar(`Módulo ${m.nome}: testar grátis`)}>Testar 7 dias grátis</button>
          </div>
          <div className={`lp-mod-fotos n${m.fotos.length}`}>
            {m.fotos.map(([src, legenda]) => (
              <figure key={src}><img src={src} alt={legenda} loading="lazy" className={CELULAR.test(src) ? 'fone' : 'desk'} /><figcaption>{legenda}</figcaption></figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  ['Precisa de cartão para testar?', 'Não. São 7 dias com tudo liberado. Se não quiser continuar, a conta simplesmente para.'],
  ['Funciona no celular da minha equipe?', 'Sim: Android, iPhone e pelo navegador. Você acompanha pelo celular ou pelo computador.'],
  ['Como chega o aviso no WhatsApp?', 'Você conecta o WhatsApp da sua empresa lendo um QR Code. Os avisos saem desse número para você e para quem você cadastrar.'],
  ['A IA confere mesmo a foto?', 'Sim. Ela compara a foto com o que a tarefa pede e escreve o motivo quando reprova. O funcionário refaz e manda de novo.'],
  ['Posso cancelar quando quiser?', 'Pode. Sem fidelidade e sem multa no plano mensal.'],
];

const ZAP = 'https://wa.me/5522998851680?text=Olá,%20estou%20no%20site%20do%20FireCheck%20e%20gostaria%20de%20tirar%20uma%20dúvida.';
const ZAP_50 = 'https://wa.me/5522998851680?text=Olá,%20tenho%20mais%20de%2050%20funcionários%20e%20gostaria%20de%20um%20plano%20personalizado%20do%20FireCheck.';

// QR ilustrativo (desenho fixo, não é um código de verdade).
function QrIlustrativo() {
  const n = 21, quadros = [];
  const canto = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let on;
    if (canto(x, y)) { const cx = x < 7 ? x : x - (n - 7), cy = y < 7 ? y : y - (n - 7); on = cx === 0 || cx === 6 || cy === 0 || cy === 6 || (cx >= 2 && cx <= 4 && cy >= 2 && cy <= 4); }
    else on = ((x * 7 + y * 13 + x * y) % 5) < 2;
    if (on) quadros.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
  }
  return <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} aria-hidden="true"><rect x="-1" y="-1" width={n + 2} height={n + 2} fill="#fff" /><g fill="#111">{quadros}</g></svg>;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState('anual'); // 'mensal' ou 'anual'
  const [videoTocando, setVideoTocando] = useState(false);
  const [barraVisivel, setBarraVisivel] = useState(false);
  const videoRef = useRef(null);
  const heroCtaRef = useRef(null);
  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));

  const handleTrackAndNavigate = (buttonName, path) => {
    fetch(`${API_URL}/api/track-quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, step: 0, completed: false, clickedCta: true, clickedButton: buttonName }),
    }).catch(() => {});
    if (path) {
      if (path.startsWith('http')) window.open(path);
      else navigate(path);
    }
  };
  const testar = (onde) => handleTrackAndNavigate(onde, '/checkout?plan=trial');
  const irPara = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  // Visitante ao vivo e tempo na página (painel Master), como antes.
  useEffect(() => {
    const ping = () => {
      fetch(`${API_URL}/api/ping`).catch(() => {});
      fetch(`${API_URL}/api/track-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, step: 0, completed: false, clickedCta: false, q1: null, q2: null, q3: null, q4: null }),
      }).catch(() => {});
    };
    ping();
    const interval = setInterval(ping, 10000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // A barra do pé aparece quando o botão do topo sai da tela.
  useEffect(() => {
    const alvo = heroCtaRef.current;
    if (!alvo || !('IntersectionObserver' in window)) { setBarraVisivel(true); return; }
    const obs = new IntersectionObserver(([e]) => setBarraVisivel(!e.isIntersecting && e.boundingClientRect.top < 0));
    obs.observe(alvo);
    return () => obs.disconnect();
  }, []);

  const tocarVideo = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.play().catch(() => {});
    setVideoTocando(true);
    handleTrackAndNavigate('video_play', null);
  };

  const anual = billingCycle === 'anual';

  return (
    <div className="lp">
      <header className="lp-top">
        <div className="lp-in">
          <div className="lp-logo"><img src="/icon-192.png" alt="" /><span><b>Fire</b>Check</span></div>
          <nav className="lp-nav">
            <button className="lp-so-desk" onClick={() => irPara('como-funciona')}>Como funciona</button>
            <button className="lp-so-desk" onClick={() => irPara('pricing')}>Planos</button>
            <button className="lp-so-desk" onClick={() => navigate('/revenda')}>Revenda</button>
            <button className="lp-entrar" onClick={() => navigate('/login')}>Entrar</button>
          </nav>
        </div>
      </header>

      {/* Promessa + vídeo */}
      <section className="lp-sec lp-hero">
        <div className="lp-in lp-hero-grid">
          <div>
            <span className="lp-kicker">Checklist com IA para equipe de loja</span>
            <h1>Sua equipe faz. <em>A IA confere.</em> Você recebe no WhatsApp.</h1>
            <p className="lp-sub">Checklist, vistoria de frota, compras, estoque e perdas num app só. Foto pela câmera, inteligência artificial conferindo e o aviso no WhatsApp da sua empresa.</p>
            <div ref={heroCtaRef}>
              <button className="lp-cta" onClick={() => testar('Começar 7 Dias Grátis')}>Testar 7 dias grátis</button>
              <p className="lp-fine">Sem cartão · cancela quando quiser · Android, iPhone e computador</p>
            </div>
          </div>
          <div className="lp-video">
            <video
              ref={videoRef}
              src="/firecheck-checklist-clipe.mp4"
              poster="/firecheck-checklist-clipe-capa.jpg"
              playsInline
              preload="none"
              controls={videoTocando}
              onEnded={() => setVideoTocando(false)}
            />
            {!videoTocando && (
              <button className="lp-play" onClick={tocarVideo} aria-label="Ver o vídeo">
                <span>▶ Veja funcionando · 37 s</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Empresas */}
      <div className="lp-logos">
        <h5>Empresas que já automatizaram com o FireCheck</h5>
        <div className="lp-faixa">
          <div className="lp-trilho">
            {[...EMPRESAS, ...EMPRESAS].map(([logo, nome, setor], i) => (
              <div className="lp-lg" key={i} aria-hidden={i >= EMPRESAS.length}>
                <img src={`/logos/${logo}.png`} alt="" loading="lazy" />
                <div><b>{nome}</b><small>{setor}</small></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* A IA audita */}
      <section className="lp-sec lp-cinza">
        <div className="lp-in">
          <h2>A IA audita <em>qualquer padrão.</em></h2>
          <p className="lp-lead">Foto tirada na hora, pela câmera do app. A IA compara com o que a tarefa pede e escreve o motivo quando reprova.</p>
          <div className="lp-carro">
            {SETORES.map(([img, titulo, analise, botao]) => (
              <div className="lp-setor" key={titulo}>
                <div className="hd">← {titulo}</div>
                <div className="img"><img src={img} alt={titulo} loading="lazy" /><span>Reprovado</span></div>
                <div className="ia"><b>⚠️ Análise da IA</b>{analise}</div>
                <div className="bt">{botao}</div>
              </div>
            ))}
          </div>
          <p className="lp-nota lp-arraste">← arraste para ver os 4 setores</p>
          <div className="lp-selos"><span>📷 Foto pela câmera</span><span>🕚 Hora e quem fez</span><span>🤖 Motivo escrito pela IA</span><span>🔁 Refazer na hora</span></div>
        </div>
      </section>

      {/* WhatsApp da empresa */}
      <section className="lp-sec lp-escuro">
        <div className="lp-in lp-zap-grid">
          <div>
            <h2>Conecte o WhatsApp <em>da sua empresa.</em></h2>
            <p className="lp-lead">Os avisos saem do número da sua empresa para você, seu gerente e quem mais você cadastrar. Conecta em 1 minuto, lendo um QR Code.</p>
            <div className="lp-qr">
              <QrIlustrativo />
              <p><b>Abra o WhatsApp da empresa</b>Aparelhos conectados → Conectar um aparelho → aponte para o QR. Pronto: aparece "Conectado".</p>
            </div>
          </div>
          <div>
            <div className="lp-avisos">
                            <div><b>❌ Reprovado pela IA</b><br />Chapa: "crosta de gordura na lateral direita"</div>
              <div className="al"><b>📦 Estoque abaixo do mínimo</b><br />Molho de tomate: 4 L (mínimo 10)</div>
              <div className="ok"><b>✅ Checklist Concluído</b><br />Abertura da loja · Ana · 12/12 itens · fotos aprovadas</div>
            </div>
            <p className="lp-nota">Até 10 números extras, como sócio ou gerente. Você escolhe quais avisos cada um recebe.</p>
          </div>
        </div>
      </section>

      {/* Módulos, um por um */}
      <Modulos onTestar={testar} />

      {/* Como funciona */}
      <section className="lp-sec lp-cinza" id="como-funciona">
        <div className="lp-in">
          <h2>Como funciona</h2>
          <div className="lp-passos">
            <div className="lp-passo"><i>1</i><div><b>Fale o que tem que ser feito</b><small>Grave um áudio ou escreva. A IA monta o checklist com foto obrigatória e horário.</small></div></div>
            <div className="lp-passo"><i>2</i><div><b>A equipe faz pelo celular</b><small>Cada tarefa com foto pela câmera. A IA confere e reprova o que saiu do padrão.</small></div></div>
            <div className="lp-passo"><i>3</i><div><b>Você recebe no WhatsApp</b><small>Reprovou, concluiu, faltou estoque, teve descarte. E o painel guarda tudo com foto, hora e quem fez.</small></div></div>
          </div>
          <div className="lp-chips"><span>Restaurante e delivery</span><span>Franquia e rede</span><span>Padaria</span><span>Academia</span><span>Hotel</span><span>Frota</span><span>Clínica</span><span>Supermercado</span></div>
        </div>
      </section>

      {/* Preço */}
      <section className="lp-sec" id="pricing">
        <div className="lp-in">
          <h2>Preço simples. <em>7 dias grátis.</em></h2>
          <div className="lp-troca" role="tablist">
            <button className={!anual ? 'on' : ''} onClick={() => setBillingCycle('mensal')}>Mensal</button>
            <button className={anual ? 'on' : ''} onClick={() => setBillingCycle('anual')}>Anual · economize até 35%</button>
          </div>
          <div className="lp-planos">
            <div className="lp-plano">
              <span className="tag">MAIS ESCOLHIDO</span>
              <h3>Só Checklists</h3>
              <div className="pr"><b>R$ {anual ? '97' : '149'}</b><span>/mês{anual ? ' no anual' : ''}</span></div>
              <div className="ex">{anual ? 'Faturado R$ 1.164/ano (economiza R$ 624/ano)' : 'Sem fidelidade'}</div>
              <ul>
                <li>Checklists ilimitados</li>
                <li>Até 30 pessoas na equipe</li>
                <li>IA monta e confere as fotos</li>
                <li>Frota, compras, estoque, descarte e ranking</li>
                <li>Avisos no WhatsApp da sua empresa</li>
                <li>Relatório em PDF de cada checklist</li>
              </ul>
              <button className="lp-cta" onClick={() => testar('Plano Só Checklists: testar grátis')}>Começar meus 7 dias grátis</button>
              <p className="lp-fine">Sem cartão. Você só paga se continuar.</p>
            </div>
            <div className="lp-plano sec">
              <h3>Combo Checklist + Ponto</h3>
              <div className="pr"><b>R$ {anual ? '167' : '197'}</b><span>/mês{anual ? ' no anual' : ''}</span></div>
              <div className="ex">{anual ? '12x R$ 167 (economiza R$ 360/ano)' : 'Economize R$ 101/mês vs os 2 separados'}</div>
              <ul>
                <li>Tudo do Só Checklists</li>
                <li>Ponto com reconhecimento facial e GPS</li>
                <li>Até 50 pessoas na equipe</li>
                <li>Suporte VIP com gerente de conta</li>
              </ul>
              <button className="lp-cta" onClick={() => handleTrackAndNavigate(`Assinar Combo ${billingCycle}`, `/checkout?plan=combo_${billingCycle}`)}>Assinar o Combo</button>
            </div>
            <div className="lp-plano sec">
              <h3>Só Ponto</h3>
              <div className="pr"><b>R$ {anual ? '97' : '149'}</b><span>/mês{anual ? ' no anual' : ''}</span></div>
              <div className="ex">{anual ? 'Faturado R$ 1.164/ano (economiza R$ 624/ano)' : 'Sem fidelidade'}</div>
              <ul>
                <li>Até 30 pessoas na equipe</li>
                <li>Reconhecimento facial com IA e GPS</li>
                <li>Alerta de atraso e ausência no WhatsApp</li>
                <li>Folha de ponto pronta pro contador</li>
              </ul>
              <button className="lp-cta" onClick={() => handleTrackAndNavigate(`Assinar Só Ponto ${billingCycle}`, `/checkout?plan=ponto_${billingCycle}`)}>Assinar Só Ponto</button>
            </div>
          </div>
          <p className="lp-nota" style={{ color: 'var(--lp-mu)' }}>
            Mais de 50 funcionários? <a style={{ color: 'var(--lp-p)', fontWeight: 700 }} onClick={() => handleTrackAndNavigate('Falar com consultor (Custom >50)', ZAP_50)}>Fale com a gente pelo WhatsApp</a>.
          </p>
        </div>
      </section>

      {/* Perguntas */}
      <section className="lp-sec lp-cinza">
        <div className="lp-in lp-faq">
          <h2>Perguntas frequentes</h2>
          <div style={{ marginTop: 12 }}>
            {FAQ.map(([p, r]) => <details key={p}><summary>{p}</summary><p>{r}</p></details>)}
          </div>
        </div>
      </section>

      {/* Fechamento */}
      <section className="lp-sec lp-escuro lp-centro">
        <div className="lp-in" style={{ textAlign: 'center' }}>
          <h2>Pare de descobrir <em>no dia seguinte.</em></h2>
          <p className="lp-lead" style={{ margin: '8px auto 0' }}>Monte o primeiro checklist em 2 minutos. A equipe recebe hoje.</p>
          <button className="lp-cta" onClick={() => testar('Testar Grátis 7 Dias (Footer)')}>Testar 7 dias grátis</button>
          <p className="lp-fine" style={{ color: '#9CA3AF' }}>Sem cartão · firecheckapp.com.br</p>
        </div>
      </section>

      <footer className="lp-rodape">
        <p>© 2026 FireCheck. Checklist inteligente para equipes.</p>
        <p><Link to="/privacy">Política de Privacidade</Link><Link to="/terms">Termos de Uso</Link><a onClick={() => navigate('/revenda')}>Revenda</a></p>
      </footer>

      <div className={`lp-fixa${barraVisivel ? ' on' : ''}`}>
        <small><b>7 dias grátis</b>sem cartão de crédito</small>
        <a className="lp-zap-mini" href={ZAP} target="_blank" rel="noopener noreferrer" aria-label="Tirar dúvida no WhatsApp"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.888-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.347-.272.297-1.04 1.016-1.04 2.479 0 1.463 1.065 2.876 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg></a>
        <button onClick={() => testar('Barra fixa: começar agora')}>Começar agora</button>
      </div>

      <a className="lp-zap" href={ZAP} target="_blank" rel="noopener noreferrer" title="Falar com o suporte pelo WhatsApp" aria-label="WhatsApp">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.888-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.347-.272.297-1.04 1.016-1.04 2.479 0 1.463 1.065 2.876 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
      </a>
    </div>
  );
}
