import React from 'react';

const PrivacyPolicy = () => {
  return (
    <div style={{ backgroundColor: '#0a0b0e', color: 'white', minHeight: '100vh', padding: '40px 20px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', lineHeight: '1.6' }}>
        <h1 style={{ color: 'var(--primary)', marginBottom: '32px' }}>Política de Privacidade — FireCheck</h1>
        
        <section style={{ marginBottom: '24px' }}>
          <h2>1. Coleta de Informações</h2>
          <p>O FireCheck coleta informações básicas para o funcionamento do sistema de auditoria, como:</p>
          <ul>
            <li>Nome e E-mail (para identificação e login);</li>
            <li>Fotos e Localização (opcional, enviadas durante a execução de checklists);</li>
            <li>Dados da Loja/Filial.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '24px' }}>
          <h2>2. Uso dos Dados</h2>
          <p>Os dados são utilizados exclusivamente para:</p>
          <ul>
            <li>Geração de relatórios de conformidade e auditoria;</li>
            <li>Ranking de performance entre colaboradores;</li>
            <li>Notificações push sobre ocorrências e alertas da IA.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '24px' }}>
          <h2>3. Segurança</h2>
          <p>Empregamos medidas de segurança modernas (criptografia e SSL) para proteger seus dados. As informações não são vendidas ou compartilhadas com terceiros para fins de marketing.</p>
        </section>

        <section style={{ marginBottom: '24px' }}>
          <h2>4. Seus Direitos</h2>
          <p>Você pode solicitar a exclusão de seus dados ou a alteração de seu cadastro a qualquer momento entrando em contato com o administrador da sua unidade ou através do suporte direto.</p>
        </section>

        <section style={{ marginBottom: '24px' }}>
          <h2>5. Contato</h2>
          <p>Para dúvidas sobre privacidade, entre em contato com: douglas@grupohakim.com.br</p>
        </section>

        <div style={{ marginTop: '40px', fontSize: '0.8rem', color: '#666' }}>
          Última atualização: 21 de abril de 2026.
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
