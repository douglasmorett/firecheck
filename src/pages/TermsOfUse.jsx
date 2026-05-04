import { useNavigate } from 'react-router-dom';
import { Flame, ArrowLeft, Shield, FileText, AlertCircle, Users, CreditCard, Lock } from 'lucide-react';

export default function TermsOfUse() {
  const navigate = useNavigate();

  const sections = [
    {
      icon: <FileText size={20} color="#ff4d00" />,
      title: '1. Aceitação dos Termos',
      content: `Ao acessar ou utilizar os serviços do FireCheck ("Plataforma"), você ("Usuário") concorda em estar vinculado a estes Termos de Uso. Se você não concordar com qualquer parte destes termos, não poderá acessar a plataforma.\n\nEstes termos se aplicam a todos os visitantes, usuários e demais pessoas que acessem ou utilizem o serviço.`
    },
    {
      icon: <Shield size={20} color="#ff4d00" />,
      title: '2. Descrição do Serviço',
      content: `O FireCheck é uma plataforma SaaS (Software como Serviço) de gestão operacional e auditoria inteligente para empresas. Nossos serviços incluem:\n\n• Criação e gestão de checklists operacionais\n• Auditoria automatizada por Inteligência Artificial\n• Monitoramento em tempo real de equipes\n• Notificações push e alertas automáticos\n• Relatórios gerenciais e dashboards\n• Módulo de ponto eletrônico e financeiro\n\nO FireCheck reserva o direito de modificar, suspender ou descontinuar qualquer parte do serviço a qualquer momento.`
    },
    {
      icon: <Users size={20} color="#ff4d00" />,
      title: '3. Cadastro e Responsabilidades do Usuário',
      content: `Para utilizar a plataforma, o usuário deverá fornecer informações cadastrais verdadeiras, precisas e atualizadas. O usuário é responsável por:\n\n• Manter a confidencialidade de sua senha e conta\n• Todas as atividades realizadas em sua conta\n• Notificar imediatamente o FireCheck sobre qualquer uso não autorizado\n• Garantir que todos os membros da equipe cadastrados estejam cientes e concordem com estes termos\n\nO FireCheck não se responsabiliza por danos causados pelo descumprimento dessas obrigações.`
    },
    {
      icon: <CreditCard size={20} color="#ff4d00" />,
      title: '4. Pagamentos e Assinaturas',
      content: `O FireCheck oferece os seguintes planos:\n\n• Período de Teste: 7 dias gratuitos, sem necessidade de cartão de crédito\n• Plano Mensal: R$ 97,00/mês, cobrado mensalmente\n• Plano Anual: R$ 970,00/ano (equivalente a R$ 80,83/mês)\n\nAs cobranças são processadas por plataformas de pagamento terceirizadas. O cancelamento pode ser feito a qualquer momento, sem multa ou fidelidade. Ao cancelar, o acesso permanece ativo até o fim do período pago. Não realizamos reembolsos por períodos parcialmente utilizados.`
    },
    {
      icon: <Lock size={20} color="#ff4d00" />,
      title: '5. Privacidade e Proteção de Dados',
      content: `O FireCheck trata os dados dos usuários em conformidade com a Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018). Coletamos apenas os dados necessários para a prestação dos nossos serviços.\n\nOs dados dos funcionários cadastrados (nome, e-mail, histórico de checklists, fotos de auditoria) são de propriedade da empresa contratante e serão processados exclusivamente para fins operacionais da plataforma. Não vendemos ou compartilhamos dados pessoais com terceiros sem consentimento, exceto quando exigido por lei.\n\nPara mais detalhes, consulte nossa Política de Privacidade.`
    },
    {
      icon: <AlertCircle size={20} color="#ff4d00" />,
      title: '6. Uso Permitido e Proibido',
      content: `O usuário concorda em não utilizar a plataforma para:\n\n• Violar qualquer lei ou regulamento aplicável\n• Transmitir conteúdo ilegal, abusivo, difamatório ou fraudulento\n• Tentar acessar áreas restritas ou informações de outros usuários\n• Realizar engenharia reversa, descompilar ou desmontar o software\n• Usar a plataforma para fins de espionagem corporativa ou concorrência desleal\n• Sobrecarregar intencionalmente a infraestrutura do serviço\n\nO descumprimento dessas regras resultará na suspensão imediata da conta, sem direito a reembolso.`
    },
    {
      icon: <FileText size={20} color="#ff4d00" />,
      title: '7. Propriedade Intelectual',
      content: `Toda a propriedade intelectual da plataforma FireCheck, incluindo mas não limitado a software, design, marca, logos, textos e funcionalidades, são de propriedade exclusiva do FireCheck ou de seus licenciadores.\n\nO usuário recebe uma licença limitada, não exclusiva e intransferível para utilizar a plataforma durante o período de assinatura ativa. Esta licença não autoriza o usuário a sublicenciar, copiar, modificar ou criar trabalhos derivados da plataforma.`
    },
    {
      icon: <Shield size={20} color="#ff4d00" />,
      title: '8. Limitação de Responsabilidade',
      content: `O FireCheck fornece a plataforma "como está" e "conforme disponível". Não garantimos que o serviço será ininterrupto, livre de erros ou que os resultados da auditoria por IA serão 100% precisos em todos os casos.\n\nEm nenhuma hipótese o FireCheck será responsável por danos indiretos, incidentais, especiais ou consequentes, incluindo perda de lucros, dados ou goodwill, decorrentes do uso ou incapacidade de uso da plataforma.\n\nNossa responsabilidade total máxima ficará limitada ao valor pago pelo usuário nos últimos 3 (três) meses de assinatura.`
    },
    {
      icon: <AlertCircle size={20} color="#ff4d00" />,
      title: '9. Alterações nos Termos',
      content: `O FireCheck reserva o direito de modificar estes Termos de Uso a qualquer momento. As alterações entrarão em vigor imediatamente após a publicação na plataforma.\n\nNotificaremos os usuários sobre mudanças significativas por e-mail ou por notificação dentro do painel. O uso continuado da plataforma após tais alterações constitui aceitação dos novos termos.`
    },
    {
      icon: <FileText size={20} color="#ff4d00" />,
      title: '10. Foro e Legislação Aplicável',
      content: `Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. Qualquer controvérsia decorrente destes termos será submetida ao foro da Comarca de Campos dos Goytacazes, Estado do Rio de Janeiro, com renúncia expressa a qualquer outro, por mais privilegiado que seja.\n\nData de vigência: 03 de maio de 2026\n\nPara dúvidas ou solicitações relacionadas a estes termos, entre em contato pelo e-mail: contato@firecheckapp.com.br`
    }
  ];

  return (
    <div style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', minHeight: '100vh' }}>
      {/* NavBar */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 5%', backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 1000 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div style={{ backgroundColor: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
            <Flame size={20} color="white" />
          </div>
          <span style={{ fontSize: '1.3rem', fontWeight: 'bold', letterSpacing: '-1px' }}>FireCheck</span>
        </div>
        <button
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 16px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem' }}
        >
          <ArrowLeft size={16} /> Voltar
        </button>
      </nav>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #ff4d00 0%, #ff8c00 100%)', padding: '60px 5%', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '16px', marginBottom: '24px' }}>
          <FileText size={32} color="white" />
        </div>
        <h1 style={{ fontSize: 'min(3rem, 8vw)', fontWeight: '900', color: 'white', marginBottom: '12px', letterSpacing: '-1px' }}>
          Termos de Uso
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
          Leia com atenção antes de utilizar a plataforma FireCheck. Última atualização: 03 de maio de 2026.
        </p>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '60px 5%' }}>
        {/* Resumo */}
        <div style={{ backgroundColor: 'rgba(255,77,0,0.06)', border: '1px solid rgba(255,77,0,0.2)', borderRadius: '16px', padding: '24px', marginBottom: '48px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <AlertCircle size={24} color="#ff4d00" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: '700', marginBottom: '6px', color: '#ff4d00' }}>Resumo Simples</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6' }}>
              Ao usar o FireCheck você concorda: fornecer dados verdadeiros, usar a plataforma de forma ética, respeitar a propriedade intelectual e aceitar que podemos alterar os termos com aviso prévio. Em troca, oferecemos um serviço confiável, protegemos seus dados e garantimos transparência total.
            </div>
          </div>
        </div>

        {/* Seções */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {sections.map((section, i) => (
            <div key={i} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flexShrink: 0 }}>{section.icon}</div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: '700', margin: 0 }}>{section.title}</h2>
              </div>
              <div style={{ color: 'var(--text-muted)', lineHeight: '1.8', fontSize: '0.95rem', whiteSpace: 'pre-line' }}>
                {section.content}
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div style={{ marginTop: '48px', textAlign: 'center', padding: '32px', backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Dúvidas sobre nossos termos?</p>
          <a href="mailto:contato@firecheckapp.com.br" style={{ color: '#ff4d00', fontWeight: '600', textDecoration: 'none', fontSize: '1rem' }}>
            contato@firecheckapp.com.br
          </a>
          <div style={{ marginTop: '24px' }}>
            <button className="btn" style={{ padding: '12px 32px' }} onClick={() => navigate('/checkout')}>
              Criar Conta Grátis
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
