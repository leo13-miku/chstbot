// server.js
require('dotenv').config(); // Para carregar a API key do .env
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai"); // Importa a biblioteca do Google

const app = express();
const port = 3000;

// --- Configuração da API do Google ---
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY; // Pega do arquivo .env

if (!GOOGLE_API_KEY) {
    console.error("ERRO: A variável de ambiente GOOGLE_API_KEY não está definida.");
    process.exit(1);
}

// Inicializa o cliente da API Generativa do Google
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
// Escolha o modelo Gemini que você quer usar (ex: gemini-pro)
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

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
                // { role: "user", parts: "Olá" },
                // { role: "model", parts: "Olá! Como posso ajudar?" }
            ],
            generationConfig: {
                // maxOutputTokens: 200, // Opcional: Limita o tamanho da resposta
                temperature: 0.7,     // Opcional: Controla a criatividade
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
        // O tratamento de erro específico da API do Google pode ser diferente
        // Consulte a documentação da biblioteca @google/generative-ai para detalhes
        console.error(error);
        console.error("-----------------------------------------");
        return "🤖 Desculpe, não consegui processar sua pergunta com a IA do Google no momento.";
    }
}

app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    if (!userMessage) {
        return res.status(400).json({ error: 'Mensagem não encontrada', reply: '🤖 Por favor, envie uma mensagem.' });
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