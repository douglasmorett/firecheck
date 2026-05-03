import { GoogleGenerativeAI } from '@google/generative-ai';

async function run() {
  try {
    const apiKey = 'AIzaSyDRDJvfIirqxTqScCHdJXBcNqEzJYHmHyA';
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const photoUrl = 'https://storage.googleapis.com/fire-check-storage.firebasestorage.app/tasks/Duga Burguer/1777819453075-wx3h4.jpeg';
    console.log('Fetching photo...', photoUrl);
    
    // Encode the URL properly to handle spaces just in case Vercel's node environment chokes on it
    const encodedUrl = encodeURI(photoUrl);
    const imgRes = await fetch(encodedUrl);
    if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
    
    const arrayBuffer = await imgRes.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = imgRes.headers.get('content-type') || "image/jpeg";

    const prompt = `Você é um auditor objetivo de tarefas. Analise a foto para verificar se o que foi explicitamente pedido na tarefa "Pintar parede" está presente na imagem.
    Regras:
    1. Foque APENAS em verificar se a instrução principal foi cumprida.
    2. Se o item pedido está na foto, "approved": true e message deve ser um elogio curto.
    3. Se o item pedido NÃO está na foto, "approved": false e explique rapidamente o que faltou.
    Responda ESTRITAMENTE em JSON: {"approved": boolean, "message": "string"}.`;

    console.log('Calling Gemini...');
    const result = await model.generateContent([ prompt, { inlineData: { data: base64Data, mimeType } } ]);
    const response = await result.response;
    const aiResponse = JSON.parse(response.text().match(/\{[\s\S]*\}/)?.[0] || response.text());
    
    console.log('AI Response:', aiResponse);
  } catch(e) {
    console.error('Error:', e);
  }
}
run();
