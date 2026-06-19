import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyDdfsUv9UPZOpTKyGtQfZxRmesYqlNKyZQ";

async function testKey() {
  console.log("Testando API Key:", apiKey.substring(0, 12) + "...");
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent("Responda apenas: OK");
    const response = await result.response;
    console.log("✅ API FUNCIONANDO! Resposta:", response.text().substring(0, 50));
  } catch (error) {
    console.log("❌ API OFFLINE! Erro:", error.message.substring(0, 200));
    console.log("\nStatus:", error.status || "N/A");
    console.log("Código:", error.code || "N/A");
  }
}

testKey();
