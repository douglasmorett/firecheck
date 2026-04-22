import React from 'react';

const PrivacyPolicy = () => {
  return (
    <div style={{ backgroundColor: '#0a0b0e', color: 'white', minHeight: '100vh', padding: '60px 20px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ 
        maxWidth: '850px', 
        margin: '0 auto', 
        lineHeight: '1.7',
        backgroundColor: '#16181d',
        padding: '50px',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
      }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          fontWeight: '800', 
          marginBottom: '32px',
          background: 'linear-gradient(to right, #ffffff, #a0a0a0)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-1px'
        }}>
          Política de Privacidade
        </h1>
        
        <p style={{ color: '#a0a0a0', marginBottom: '32px' }}>
          Esta Política de Privacidade descreve como o <strong>FireCheck</strong> coleta, usa e protege as informações dos usuários ao utilizar nossa plataforma e aplicativo móvel.
        </p>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#ff4d00', fontSize: '1.5rem', borderBottom: '1px solid rgba(255, 77, 0, 0.2)', paddingBottom: '10px', marginBottom: '16px' }}>
            1. Informações que Coletamos
          </h2>
          <p style={{ color: '#a0a0a0' }}>Para fornecer nossos serviços de auditoria e checklist, coletamos as seguintes categorias de dados:</p>
          <ul style={{ color: '#a0a0a0', paddingLeft: '20px' }}>
            <li style={{ marginBottom: '10px' }}><strong style={{ color: '#fff' }}>Dados de Cadastro:</strong> Nome, e-mail, cargo e dados da empresa/unidade.</li>
            <li style={{ marginBottom: '10px' }}><strong style={{ color: '#fff' }}>Dados Operacionais:</strong> Respostas de checklists, observações em texto, fotos capturadas pela câmera do dispositivo e geolocalização no momento do envio.</li>
            <li style={{ marginBottom: '10px' }}><strong style={{ color: '#fff' }}>Dados de Uso:</strong> Informações sobre como você interage com o app, registros de erros e performance.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#ff4d00', fontSize: '1.5rem', borderBottom: '1px solid rgba(255, 77, 0, 0.2)', paddingBottom: '10px', marginBottom: '16px' }}>
            2. Finalidade do Processamento
          </h2>
          <p style={{ color: '#a0a0a0' }}>Os dados coletados são utilizados para:</p>
          <ul style={{ color: '#a0a0a0', paddingLeft: '20px' }}>
            <li style={{ marginBottom: '10px' }}>Operacionalizar o sistema de checklists e auditorias;</li>
            <li style={{ marginBottom: '10px' }}>Garantir a veracidade das auditorias (através de fotos em tempo real e localização);</li>
            <li style={{ marginBottom: '10px' }}>Geração de relatórios de desempenho e conformidade para a administração;</li>
            <li style={{ marginBottom: '10px' }}>Envio de notificações críticas via WhatsApp sobre atrasos ou inconformidades detectadas por nossa IA.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#ff4d00', fontSize: '1.5rem', borderBottom: '1px solid rgba(255, 77, 0, 0.2)', paddingBottom: '10px', marginBottom: '16px' }}>
            3. Compartilhamento de Dados
          </h2>
          <p style={{ color: '#a0a0a0' }}>O FireCheck <strong>não vende</strong> seus dados pessoais a terceiros. O compartilhamento ocorre apenas quando estritamente necessário para:</p>
          <ul style={{ color: '#a0a0a0', paddingLeft: '20px' }}>
            <li style={{ marginBottom: '10px' }}>Provedores de infraestrutura e nuvem (Google Cloud / AWS);</li>
            <li style={{ marginBottom: '10px' }}>Serviços de IA para análise de fotos (Google Gemini API);</li>
            <li style={{ marginBottom: '10px' }}>Cumprimento de obrigações legais ou ordens judiciais.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#ff4d00', fontSize: '1.5rem', borderBottom: '1px solid rgba(255, 77, 0, 0.2)', paddingBottom: '10px', marginBottom: '16px' }}>
            4. Seus Direitos (LGPD)
          </h2>
          <p style={{ color: '#a0a0a0' }}>
            Conforme a Lei Geral de Proteção de Dados (LGPD), você tem direito a acessar, corrigir, portar ou solicitar a exclusão de seus dados pessoais. Para exercer esses direitos, entre em contato através do e-mail abaixo.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#ff4d00', fontSize: '1.5rem', borderBottom: '1px solid rgba(255, 77, 0, 0.2)', paddingBottom: '10px', marginBottom: '16px' }}>
            5. Contato
          </h2>
          <p style={{ color: '#a0a0a0' }}>Para quaisquer dúvidas sobre esta política, entre em contato conosco:</p>
          <p style={{ color: '#fff', fontWeight: 'bold' }}>E-mail: douglas@grupohakim.com.br</p>
        </section>

        <div style={{ 
          marginTop: '60px', 
          fontSize: '0.85rem', 
          color: '#555', 
          textAlign: 'center',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          paddingTop: '20px'
        }}>
          Última atualização: 21 de abril de 2026. <br /> FireCheck Inc. — Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
