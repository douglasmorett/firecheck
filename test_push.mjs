import fetch from 'node-fetch';

// Para rodar: node test_push.mjs <email> [api_url]
// Exemplo: node test_push.mjs luiz.tavares.nunes.2023@gmail.com
// Exemplo local: node test_push.mjs luiz.tavares.nunes.2023@gmail.com http://localhost:3000

const email = process.argv[2];
const apiUrl = process.argv[3] || 'https://www.firecheckapp.com.br';

if (!email) {
  console.error('Erro: Por favor, forneça o email do usuário de teste.');
  console.log('Uso: node test_push.mjs <email> [api_url]');
  process.exit(1);
}

const endpoint = `${apiUrl}/api/test-push`;

console.log(`Disparando push de teste...`);
console.log(`Email: ${email}`);
console.log(`Endpoint: ${endpoint}`);

async function sendTestPush() {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();
    if (response.ok) {
      console.log('✅ Notificação de teste enviada com sucesso!');
      console.dir(data);
    } else {
      console.error('❌ Falha ao enviar notificação:');
      console.dir(data);
    }
  } catch (error) {
    console.error('❌ Erro na requisição:', error.message);
  }
}

sendTestPush();
