import { useState } from 'react';
import { 
  Flame, 
  ArrowRight, 
  Repeat, 
  TrendingUp, 
  DollarSign, 
  ShieldCheck, 
  Users, 
  Zap, 
  ArrowLeft,
  Sparkles,
  Utensils,
  Dumbbell,
  Truck,
  Building2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CAKTO_AFFILIATE_LINK = "https://app.cakto.com.br/affiliate/invite/c15a7c11-6c61-4201-9b66-b7e401c85c45";

export default function ResellerPage() {
  const navigate = useNavigate();
  const [clientCount, setClientCount] = useState(25);
  const [selectedPlan, setSelectedPlan] = useState(97); // Plano base R$ 97 por padrão
  const [commissionRate] = useState(30); // 30% de comissão recorrente

  // Cálculo da Renda Recorrente Mensal (MRR) estimada
  const monthlyRevenue = (clientCount * selectedPlan * (commissionRate / 100));
  const yearlyRevenue = monthlyRevenue * 12;

  const handleOpenCakto = () => {
    window.open(CAKTO_AFFILIATE_LINK, '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={{ backgroundColor: '#0B0F17', color: '#F3F4F6', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Top Banner Accent */}
      <div style={{ background: 'linear-gradient(90deg, #FF4D00 0%, #FF8800 50%, #FF4D00 100%)', padding: '8px 16px', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600, color: '#FFFFFF', letterSpacing: '0.3px' }}>
        🔥 Programa Oficial de Afiliados e Revenda FireCheck — Construa sua Renda Passiva Recorrente
      </div>

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 5%', backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', position: 'sticky', top: 0, zIndex: 1000 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div style={{ backgroundColor: '#FF4D00', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(255, 77, 0, 0.5)' }}>
            <Flame size={24} color="#FFFFFF" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.5px' }}>FireCheck</span>
            <span style={{ fontSize: '0.7rem', color: '#FF8800', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Programa de Revenda</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => navigate('/')} 
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#D1D5DB', padding: '8px 16px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <ArrowLeft size={16} /> Voltar ao Site
          </button>
          <button 
            onClick={handleOpenCakto} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FF4D00', color: '#FFFFFF', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 20px rgba(255, 77, 0, 0.4)', transition: 'all 0.2s' }}
          >
            Seja Nosso Revendedor <ArrowRight size={16} />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ padding: '80px 5% 60px', textAlign: 'center', position: 'relative', overflow: 'hidden', background: 'radial-gradient(circle at 50% 20%, rgba(255, 77, 0, 0.15) 0%, rgba(11, 15, 23, 1) 70%)' }}>
        
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255, 77, 0, 0.12)', border: '1px solid rgba(255, 77, 0, 0.3)', padding: '6px 16px', borderRadius: '20px', fontSize: '0.85rem', color: '#FF8800', fontWeight: 600, marginBottom: '24px' }}>
          <Sparkles size={16} /> Ganhe Comissões Mensais no Modelo SaaS Recorrente
        </div>

        <h1 style={{ fontSize: 'clamp(2.2rem, 5vw, 3.8rem)', fontWeight: 900, lineHeight: 1.15, maxWidth: '1000px', margin: '0 auto 24px', color: '#FFFFFF', letterSpacing: '-1px' }}>
          Pare de vender 1 vez e passe a receber <span style={{ background: 'linear-gradient(90deg, #FF4D00, #FF9900)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TODOS os meses</span>
        </h1>

        <p style={{ fontSize: 'clamp(1.05rem, 2vw, 1.3rem)', color: '#9CA3AF', maxWidth: '800px', margin: '0 auto 40px', lineHeight: 1.6 }}>
          Revenda o <strong>FireCheck</strong> — a plataforma inteligente de gestão de equipes, checklists e processos operacionais por IA. Construa uma carteira de clientes e receba <strong>comissões de assinatura mensal recorrente</strong> continuamente.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={handleOpenCakto} 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', backgroundColor: '#FF4D00', color: '#FFFFFF', border: 'none', padding: '18px 40px', borderRadius: '12px', fontSize: '1.2rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 0 35px rgba(255, 77, 0, 0.5)', transition: 'transform 0.2s', textDecoration: 'none' }}
          >
            Quero Me Tornar Revendedor na Cakto <ArrowRight size={22} />
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '12px', fontSize: '0.85rem', color: '#6B7280', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ShieldCheck size={16} color="#10B981" /> Cadastro Gratuito</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Zap size={16} color="#FF8800" /> Afiliação Instantânea via Cakto</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Repeat size={16} color="#60A5FA" /> Comissões em cada renovação</span>
          </div>
        </div>

        {/* Stats Highlight Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', maxWidth: '1000px', margin: '60px auto 0', padding: '24px', backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(10px)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#FF8800' }}>Modelo SaaS</div>
            <div style={{ fontSize: '0.85rem', color: '#9CA3AF', marginTop: '4px' }}>Software como Serviço (Recorrente)</div>
          </div>
          <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.1)', borderRight: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10B981' }}>Alta Retenção</div>
            <div style={{ fontSize: '0.85rem', color: '#9CA3AF', marginTop: '4px' }}>Empresas usam o FireCheck diariamente</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#60A5FA' }}>Zero Suporte</div>
            <div style={{ fontSize: '0.85rem', color: '#9CA3AF', marginTop: '4px' }}>Infraestrutura e TI 100% nossas</div>
          </div>
        </div>
      </section>

      {/* Diferenciais Únicos da Assinatura Recorrente */}
      <section style={{ padding: '80px 5%', backgroundColor: '#0F172A' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '16px' }}>
              Por que Revender Assinatura Mensal é o <span style={{ color: '#FF8800' }}>Melhor Negócio</span>?
            </h2>
            <p style={{ fontSize: '1.1rem', color: '#9CA3AF', maxWidth: '700px', margin: '0 auto' }}>
              Compare o modelo tradicional de vendas únicas com a liberdade financeira da Renda Recorrente (MRR).
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>
            
            {/* Card 1 */}
            <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.6)', padding: '32px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(255, 77, 0, 0.15)', color: '#FF4D00', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Repeat size={26} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFFFFF' }}>Venda 1 Vez, Receba Sempre</h3>
              <p style={{ color: '#9CA3AF', lineHeight: 1.6, fontSize: '0.95rem' }}>
                Em infoprodutos ou serviços normais, no mês seguinte o seu faturamento volta a ZERO. No FireCheck, a indicação feita hoje continua gerando comissão no seu bolso mês após mês.
              </p>
            </div>

            {/* Card 2 */}
            <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.6)', padding: '32px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={26} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFFFFF' }}>Efeito Bola de Neve Acumulativo</h3>
              <p style={{ color: '#9CA3AF', lineHeight: 1.6, fontSize: '0.95rem' }}>
                Se você indicar 5 novos clientes por mês, ao final de 10 meses terá 50 empresas te gerando renda cumulativa simultaneamente. Sua receita só cresce com o tempo.
              </p>
            </div>

            {/* Card 3 */}
            <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.6)', padding: '32px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(96, 165, 250, 0.15)', color: '#60A5FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={26} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFFFFF' }}>Software Indispensável para Empresas</h3>
              <p style={{ color: '#9CA3AF', lineHeight: 1.6, fontSize: '0.95rem' }}>
                O FireCheck gerencia checklists de rotina, abertura/fechamento, vistorias e fotos da operação. Quando a empresa adota, ela não consegue viver sem. O cancelamento é mínimo!
              </p>
            </div>

            {/* Card 4 */}
            <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.6)', padding: '32px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(236, 72, 153, 0.15)', color: '#EC4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={26} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFFFFF' }}>Inteligência Artificial Nativa (Bill IA)</h3>
              <p style={{ color: '#9CA3AF', lineHeight: 1.6, fontSize: '0.95rem' }}>
                O FireCheck cria checklists inteiros apenas por comando de voz ou texto em segundos. Isso torna a demonstração para os clientes um efeito "UAU!" irresistível.
              </p>
            </div>

            {/* Card 5 */}
            <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.6)', padding: '32px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={26} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFFFFF' }}>Plataforma Cakto Seguro e Automático</h3>
              <p style={{ color: '#9CA3AF', lineHeight: 1.6, fontSize: '0.95rem' }}>
                Todo o rastreamento das suas indicações, controle de comissões e pagamentos são intermediados pela Cakto. Transparência total e saques direto para sua conta.
              </p>
            </div>

            {/* Card 6 */}
            <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.6)', padding: '32px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#A855F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={26} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFFFFF' }}>Suporte Técnico Integrado</h3>
              <p style={{ color: '#9CA3AF', lineHeight: 1.6, fontSize: '0.95rem' }}>
                Você se preocupa apenas em conectar os donos de negócios ao FireCheck. O atendimento ao cliente, atualizações de sistema e suporte técnico são 100% nossos.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Simulador Interativo de Renda Recorrente */}
      <section style={{ padding: '80px 5%', backgroundColor: '#0B0F17', position: 'relative' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)', border: '1px solid rgba(255, 77, 0, 0.3)', borderRadius: '24px', padding: '40px 6%', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <span style={{ color: '#FF8800', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Simulador de Renda Recorrente (30% de Comissão)</span>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#FFFFFF', marginTop: '8px' }}>
              Quanto você quer receber todo mês?
            </h2>
            <p style={{ color: '#9CA3AF', fontSize: '0.95rem', marginTop: '8px' }}>
              Mova a barra abaixo e simule seus ganhos mensais acumulados como revendedor FireCheck.
            </p>
          </div>

          {/* Selector de Plano de Referência */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#D1D5DB', fontWeight: 600, marginBottom: '10px' }}>
              Selecione o plano do cliente para a simulação:
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {[
                { price: 97, label: 'Plano R$ 97/mês (Base)' },
                { price: 147, label: 'Plano R$ 147/mês (Pro)' },
                { price: 197, label: 'Plano R$ 197/mês (Business)' }
              ].map((plan) => (
                <button
                  key={plan.price}
                  onClick={() => setSelectedPlan(plan.price)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: selectedPlan === plan.price ? '2px solid #FF4D00' : '1px solid rgba(255,255,255,0.15)',
                    backgroundColor: selectedPlan === plan.price ? 'rgba(255, 77, 0, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                    color: selectedPlan === plan.price ? '#FF8800' : '#9CA3AF',
                    transition: 'all 0.2s'
                  }}
                >
                  {plan.label}
                </button>
              ))}
            </div>
          </div>

          {/* Slider Controls */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ color: '#E5E7EB', fontWeight: 600, fontSize: '1.1rem' }}>Clientes Ativos Indicados:</span>
              <span style={{ color: '#FF8800', fontWeight: 900, fontSize: '1.8rem' }}>{clientCount} empresas</span>
            </div>
            
            <input 
              type="range" 
              min="5" 
              max="200" 
              step="5"
              value={clientCount} 
              onChange={(e) => setClientCount(Number(e.target.value))}
              style={{ width: '100%', height: '10px', borderRadius: '5px', accentColor: '#FF4D00', cursor: 'pointer' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6B7280', fontSize: '0.8rem', marginTop: '8px' }}>
              <span>5 empresas</span>
              <span>50 empresas</span>
              <span>100 empresas</span>
              <span>200 empresas</span>
            </div>
          </div>

          {/* Result Box */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', backgroundColor: 'rgba(15, 23, 42, 0.7)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 600 }}>Renda Mensal Recorrente (MRR)</div>
              <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#10B981', marginTop: '4px' }}>
                R$ {monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '1rem', fontWeight: 500, color: '#9CA3AF' }}>/mês</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600, marginTop: '4px' }}>
                30% de comissão = R$ {(selectedPlan * 0.3).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} por cliente/mês
              </div>
            </div>

            <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <div style={{ fontSize: '0.85rem', color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 600 }}>Ganhos Anuais Estimados</div>
              <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#FF8800', marginTop: '4px' }}>
                R$ {yearlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '1rem', fontWeight: 500, color: '#9CA3AF' }}>/ano</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '4px' }}>Renda acumulada em 12 meses</div>
            </div>
          </div>

          {/* Aviso sobre a oscilação conforme o plano assinado */}
          <div style={{ marginTop: '20px', padding: '14px 18px', backgroundColor: 'rgba(255, 77, 0, 0.08)', borderRadius: '12px', border: '1px solid rgba(255, 77, 0, 0.25)', fontSize: '0.825rem', color: '#D1D5DB', textAlign: 'center', lineHeight: 1.5 }}>
            <span style={{ color: '#FF8800', fontWeight: 700 }}>💡 Observação Importante:</span> O valor exato da sua renda mensal pode oscilar para mais ou para menos dependendo do plano assinado por cada cliente indicado (ex: R$ 97, R$ 147 ou R$ 197/mês) ou upgrades de contratação. A sua comissão é sempre fixa em <strong>30% recorrente</strong> em cada mensalidade paga!
          </div>

          <div style={{ textAlign: 'center', marginTop: '28px' }}>
            <button 
              onClick={handleOpenCakto} 
              style={{ backgroundColor: '#FF4D00', color: '#FFFFFF', border: 'none', padding: '16px 36px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 0 25px rgba(255, 77, 0, 0.4)', transition: 'all 0.2s' }}
            >
              Começar a Construir Essa Renda Agora <ArrowRight size={20} style={{ verticalAlign: 'middle', marginLeft: '8px' }} />
            </button>
          </div>

        </div>
      </section>

      {/* Mercados e Nichos de Alta Procura */}
      <section style={{ padding: '80px 5%', backgroundColor: '#0F172A' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#FFFFFF' }}>
              Quem são os seus <span style={{ color: '#FF8800' }}>Clientes Potenciais</span>?
            </h2>
            <p style={{ color: '#9CA3AF', fontSize: '1.05rem', marginTop: '12px' }}>
              Praticamente qualquer empresa física ou operacional precisa padronizar rotinas e cobrar provas de execução com foto.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            
            <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
              <Utensils size={36} color="#FF8800" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ color: '#FFFFFF', fontSize: '1.1rem', fontWeight: 700 }}>Restaurantes & Bares</h4>
              <p style={{ color: '#9CA3AF', fontSize: '0.85rem', marginTop: '8px' }}>Checklist de higiene da cozinha, abertura, fechamento e controle de temperatura.</p>
            </div>

            <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
              <Dumbbell size={36} color="#60A5FA" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ color: '#FFFFFF', fontSize: '1.1rem', fontWeight: 700 }}>Academias & Studios</h4>
              <p style={{ color: '#9CA3AF', fontSize: '0.85rem', marginTop: '8px' }}>Limpeza de equipamentos, recepção, som ambiente e manutenção preventiva.</p>
            </div>

            <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
              <Truck size={36} color="#10B981" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ color: '#FFFFFF', fontSize: '1.1rem', fontWeight: 700 }}>Frota & Logística</h4>
              <p style={{ color: '#9CA3AF', fontSize: '0.85rem', marginTop: '8px' }}>Vistoria de saída/entrada de veículos, estado de pneus, lataria e combustível.</p>
            </div>

            <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
              <Building2 size={36} color="#EC4899" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ color: '#FFFFFF', fontSize: '1.1rem', fontWeight: 700 }}>Franquias & Varejo</h4>
              <p style={{ color: '#9CA3AF', fontSize: '0.85rem', marginTop: '8px' }}>Auditoria de padrão de marca, organização de vitrines e caixa da loja.</p>
            </div>

          </div>
        </div>
      </section>

      {/* Como Funciona em 3 Passos */}
      <section style={{ padding: '80px 5%', backgroundColor: '#0B0F17' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <span style={{ color: '#10B981', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Simplicidade Total</span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#FFFFFF', marginTop: '8px' }}>
              Como Funciona em 3 Passos Simples
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px', position: 'relative' }}>
            
            <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', padding: '32px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: 'rgba(255, 77, 0, 0.3)', position: 'absolute', top: '16px', right: '20px' }}>01</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '12px' }}>Afilie-se Gratuitamente</h3>
              <p style={{ color: '#9CA3AF', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Clique no botão de afiliação e faça seu cadastro rápido na plataforma <strong>Cakto</strong>. A aprovação do seu link é imediata.
              </p>
            </div>

            <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', padding: '32px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: 'rgba(255, 77, 0, 0.3)', position: 'absolute', top: '16px', right: '20px' }}>02</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '12px' }}>Apresente aos Negócios</h3>
              <p style={{ color: '#9CA3AF', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Recomende o FireCheck para donos de restaurantes, academias, lojas e empresas que sofrem com falhas de equipe.
              </p>
            </div>

            <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', padding: '32px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: 'rgba(255, 77, 0, 0.3)', position: 'absolute', top: '16px', right: '20px' }}>03</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '12px' }}>Receba Recorrente</h3>
              <p style={{ color: '#9CA3AF', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Acompanhe em tempo real suas vendas e comissões no painel da Cakto. Receba pagamentos automáticos em cada renovação de assinatura!
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* CTA Final */}
      <section style={{ padding: '90px 5%', background: 'radial-gradient(circle at 50% 50%, rgba(255, 77, 0, 0.25) 0%, rgba(15, 23, 42, 1) 80%)', textAlign: 'center' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          
          <Flame size={48} color="#FF4D00" style={{ margin: '0 auto 20px', filter: 'drop-shadow(0 0 15px rgba(255,77,0,0.8))' }} />
          
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, color: '#FFFFFF', marginBottom: '20px' }}>
            Pronto para construir sua <span style={{ color: '#FF8800' }}>Renda Mensal Recorrente</span>?
          </h2>

          <p style={{ fontSize: '1.15rem', color: '#D1D5DB', marginBottom: '36px', lineHeight: 1.6 }}>
            Cadastre-se como revendedor oficial do FireCheck na Cakto de forma gratuita e imediata.
          </p>

          <button 
            onClick={handleOpenCakto} 
            style={{ backgroundColor: '#FF4D00', color: '#FFFFFF', border: 'none', padding: '20px 48px', borderRadius: '14px', fontSize: '1.25rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 0 40px rgba(255, 77, 0, 0.6)', transition: 'all 0.2s' }}
          >
            Quero Me Cadastrar Como Revendedor Agora <ArrowRight size={24} style={{ verticalAlign: 'middle', marginLeft: '10px' }} />
          </button>

          <div style={{ marginTop: '24px', fontSize: '0.85rem', color: '#9CA3AF' }}>
            Plataforma 100% segura via Cakto Afiliados • Suporte dedicado
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '30px 5%', backgroundColor: '#070A0F', borderTop: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center', color: '#6B7280', fontSize: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Flame size={18} color="#FF4D00" />
          <span style={{ color: '#FFFFFF', fontWeight: 700 }}>FireCheck</span>
        </div>
        <p>© {new Date().getFullYear()} FireCheck - Todos os direitos reservados. Programa de Revenda Oficial via Cakto.</p>
      </footer>

    </div>
  );
}
