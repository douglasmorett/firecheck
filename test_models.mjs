import { GoogleGenerativeAI } from '@google/generative-ai';
async function run() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);
    console.log("SDK instantiated");
  } catch(e) {
    console.error('Error:', e);
  }
}
run();
