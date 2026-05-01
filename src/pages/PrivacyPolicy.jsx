import React from 'react';

const PrivacyPolicy = () => {
  return (
    <div style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', minHeight: '100vh', padding: '60px 20px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ 
        maxWidth: '850px', 
        margin: '0 auto', 
        lineHeight: '1.7',
        backgroundColor: 'var(--bg-card-hover)',
        padding: '50px',
        borderRadius: '24px',
        border: '1px solid var(--border-color)',
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
            <li style={{ marginBottom: '10px' }}><strong style={{ color: '#fff' }}>Dados Operacionais:</strong> Respostas de checklists, observações em texto e fotos capturadas pela câmera do dispositivo.</li>
            <li style={{ marginBottom: '10px' }}><strong style={{ color: '#fff' }}>Dados de Localização:</strong> Coletamos a geolocalização precisa no momento do envio do checklist para fins de auditoria de presença.</li>
            <li style={{ marginBottom: '10px' }}><strong style={{ color: '#fff' }}>Identificadores de Dispositivo:</strong> Coletamos IDs de dispositivo para funcionamento de notificações push e segurança.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#ff4d00', fontSize: '1.5rem', borderBottom: '1px solid rgba(255, 77, 0, 0.2)', paddingBottom: '10px', marginBottom: '16px' }}>
            2. Finalidade do Processamento
          </h2>
          <p style={{ color: '#a0a0a0' }}>Os dados coletados são utilizados para:</p>
          <ul style={{ color: '#a0a0a0', paddingLeft: '20px' }}>
            <li style={{ marginBottom: '10px' }}>Operacionalizar o sistema de checklists e auditorias;</li>
            <li style={{ marginBottom: '10px' }}>Garantir a veracidade das auditorias (fotos e localização);</li>
            <li style={{ marginBottom: '10px' }}>Geração de relatórios de desempenho e conformidade;</li>
            <li style={{ marginBottom: '10px' }}>Envio de notificações críticas via Push ou WhatsApp.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#ff4d00', fontSize: '1.5rem', borderBottom: '1px solid rgba(255, 77, 0, 0.2)', paddingBottom: '10px', marginBottom: '16px' }}>
            3. Compartilhamento de Dados
          </h2>
          <p style={{ color: '#a0a0a0' }}>O FireCheck <strong>não vende</strong> seus dados. O compartilhamento ocorre apenas com:</p>
          <ul style={{ color: '#a0a0a0', paddingLeft: '20px' }}>
            <li style={{ marginBottom: '10px' }}>Provedores de infraestrutura e nuvem (Firebase / Google Cloud);</li>
            <li style={{ marginBottom: '10px' }}>Serviços de IA para análise de fotos (Google Gemini);</li>
            <li style={{ marginBottom: '10px' }}>Cumprimento de obrigações legais.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#ff4d00', fontSize: '1.5rem', borderBottom: '1px solid rgba(255, 77, 0, 0.2)', paddingBottom: '10px', marginBottom: '16px' }}>
            4. Retenção e Exclusão de Dados (Obrigatório Google Play)
          </h2>
          <p style={{ color: '#a0a0a0' }}>
            Os dados são retidos enquanto a conta estiver ativa. Oferecemos as seguintes opções para exclusão:
          </p>
          <ul style={{ color: '#a0a0a0', paddingLeft: '20px' }}>
            <li style={{ marginBottom: '10px' }}><strong style={{ color: '#fff' }}>Exclusão via App:</strong> Acesse as configurações do seu perfil no aplicativo para solicitar a exclusão da conta.</li>
            <li style={{ marginBottom: '10px' }}><strong style={{ color: '#fff' }}>Solicitação via E-mail:</strong> Envie um e-mail para <strong>douglas@grupohakim.com.br</strong> com o assunto "Exclusão de Dados".</li>
          </ul>
          <p style={{ color: '#a0a0a0' }}>
            Após a solicitação, os dados serão removidos em até 30 dias.
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
          borderTop: '1px solid var(--border-color)',
          paddingTop: '20px'
        }}>
          Última atualização: 22 de abril de 2026. <br /> FireCheck Inc. — Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
