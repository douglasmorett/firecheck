import { GoogleGenerativeAI } from '@google/generative-ai';
async function run() {
  try {
    const apiKey = 'AIzaSyDRDJvfIirqxTqScCHdJXBcNqEzJYHmHyA';
    const genAI = new GoogleGenerativeAI(apiKey);
    console.log("SDK instantiated");
  } catch(e) {
    console.error('Error:', e);
  }
}
run();
