import fetch from 'node-fetch';

// Para rodar: node test_whatsapp.mjs <telefone_destino> [api_url] [api_key] [instance]
// Exemplo: node test_whatsapp.mjs 21999999999
// Exemplo completo: node test_whatsapp.mjs 21999999999 https://evolution.seuservidor.com api_key_aqui minha_instancia

const phone = process.argv[2];
const evoUrl = process.argv[3] || process.env.EVOLUTION_API_URL || 'https://www.firecheckapp.com.br'; // Caso use proxy
const evoKey = process.argv[4] || process.env.EVOLUTION_API_KEY;
const evoInstance = process.argv[5] || process.env.EVOLUTION_INSTANCE || 'firecheck';

if (!phone) {
  console.error('Erro: Por favor, forneça o telefone de destino (com DDD, ex: 21999999999).');
  console.log('Uso: node test_whatsapp.mjs <telefone> [api_url] [api_key] [instance]');
  process.exit(1);
}

// Limpa o número
const cleanPhone = phone.replace(/\D/g, '');
const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;

console.log(`Disparando mensagem de WhatsApp de teste...`);
console.log(`Telefone Formatado: ${fullPhone}`);
console.log(`Endpoint: ${evoUrl}/message/sendText/${evoInstance}`);

async function sendTestWhatsapp() {
  try {
    const textMsg = `🔥 *FireCheck - WhatsApp Teste*\n\nSeu sistema de notificações do WhatsApp está ativo e conectado com sucesso! 🚀`;
    
    const headers = { 'Content-Type': 'application/json' };
    if (evoKey) {
      headers['apikey'] = evoKey;
    }

    const response = await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ number: fullPhone, text: textMsg })
    });

    const data = await response.json();
    if (response.ok) {
      console.log('✅ Mensagem enviada com sucesso!');
      console.dir(data);
    } else {
      console.error('❌ Falha ao enviar mensagem:');
      console.dir(data);
    }
  } catch (error) {
    console.error('❌ Erro na requisição:', error.message);
  }
}

sendTestWhatsapp();
