// server.js
import dotenv from 'dotenv';
import express from 'express';
import path, { dirname } from 'path'; // Importa 'dirname' também
import { fileURLToPath } from 'url';   // Para obter __dirname em módulos ES
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config(); // Para carregar a API key do .env

// Equivalente a __dirname em módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

// --- Configuração da API do Google ---
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
    console.error("ERRO: A variável de ambiente GOOGLE_API_KEY não está definida.");
    process.exit(1);
}

// Inicializa o cliente da API Generativa do Google
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
// Escolha o modelo Gemini que você quer usar (ex: gemini-pro)
const model = genAI.getGenerativeModel({ model: "gemini-pro" }); // << ATENÇÃO AQUI SE O PROBLEMA FOR O MODELO

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Função para chamar a API do Google Gemini
async function getGoogleAIResponse(userInput) {
    if (!userInput || userInput.trim() === "") {
        return "Por favor, digite alguma coisa.";
    }
    try {
        console.log(`Enviando para Google AI (Gemini): "${userInput}"`);

        const chat = model.startChat({
            history: [
                // Você pode adicionar um histórico de conversa aqui se quiser
                // { role: "user", parts: [{ text: "Olá" }] }, // Estrutura de 'parts' pode variar
                // { role: "model", parts: [{ text: "Olá! Como posso ajudar?" }] }
            ],
            generationConfig: {
                // maxOutputTokens: 200,
                temperature: 0.7,
            }
        });

        const result = await chat.sendMessage(userInput);
        const response = await result.response;
        const botReply = response.text().trim();

        console.log(`Recebido do Google AI (Gemini): "${botReply}"`);
        return botReply;

    } catch (error) {
        console.error("-----------------------------------------");
        console.error("Erro ao chamar a API do Google AI (Gemini):");
        console.error(error); // << PRECISAMOS VER ESTE ERRO DETALHADO
        console.error("-----------------------------------------");
        return "🤖 Desculpe, não consegui processar sua pergunta com a IA do Google no momento.";
    }
}

app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    if (!req.body || !userMessage) { // Adicionada verificação para req.body
        return res.status(400).json({ error: 'Mensagem não encontrada ou corpo da requisição ausente.', reply: '🤖 Por favor, envie uma mensagem.' });
    }

    const botReply = await getGoogleAIResponse(userMessage);
    res.json({ reply: botReply });
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
    if (!GOOGLE_API_KEY.startsWith('AIzaSy')) {
        console.warn("AVISO: Sua GOOGLE_API_KEY não parece uma chave válida do Google (geralmente começa com 'AIzaSy'). Verifique se é a chave correta.");
    } else {
        console.log("Pronto para usar a API do Google AI (Gemini)!");
    }
});