// server.js
import dotenv from 'dotenv';
import express from 'express';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"; // Adicionado HarmCategory e HarmBlockThreshold

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000; // Usar variável de ambiente para porta ou padrão 3000

// --- Configuração da API do Google ---
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
    console.error("ERRO: A variável de ambiente GOOGLE_API_KEY não está definida.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest", // Ou "gemini-1.5-pro-latest"
    // Adicionando configurações de segurança padrão (recomendado)
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ],
    generationConfig: { // Configurações de geração padrão para novas sessões
        // temperature: 0.7, // Exemplo: ajuste a criatividade (0.0 - 1.0)
        maxOutputTokens: 800, // Exemplo: máximo de tokens na resposta
    }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Para servir o frontend

// --- Gerenciamento de Sessões de Chat (em memória) ---
// ATENÇÃO: Para produção, use uma solução mais robusta (ex: Redis, DB)
const chatSessions = {}; // { sessionId: ChatSessionInstance }

/**
 * Obtém uma sessão de chat existente ou cria uma nova.
 * @param {string} sessionId Identificador único para a sessão de chat.
 * @returns {import("@google/generative-ai").ChatSession} O objeto ChatSession.
 */
function getOrCreateChatSession(sessionId) {
    if (!chatSessions[sessionId]) {
        console.log(`[Sessão: ${sessionId}] Iniciando nova sessão de chat.`);
        // Você pode iniciar com um histórico pré-definido se quiser
        // Por exemplo, para definir a personalidade do bot:
        // const initialHistory = [
        //   { role: "user", parts: [{ text: "Você é um assistente chamado Zippy e você é muito entusiasmado." }] },
        //   { role: "model", parts: [{ text: "Entendido! Zippy ao seu dispor com muito entusiasmo! 😄 Como posso te ajudar hoje?" }] },
        // ];
        chatSessions[sessionId] = model.startChat({
            history: [], // Começa com histórico vazio ou use initialHistory
            // As generationConfig e safetySettings definidas no 'model' acima serão usadas,
            // a menos que você queira sobrescrevê-las aqui para esta sessão específica.
        });
    } else {
        console.log(`[Sessão: ${sessionId}] Continuando sessão de chat existente.`);
    }
    return chatSessions[sessionId];
}

// Função para chamar a API do Google Gemini usando uma sessão específica
async function getGoogleAIResponse(sessionId, userInput) {
    if (!userInput || userInput.trim() === "") {
        return "Por favor, digite alguma coisa.";
    }

    const chat = getOrCreateChatSession(sessionId); // Usa a sessão correta

    try {
        console.log(`[Sessão: ${sessionId}] Enviando para Gemini: "${userInput}"`);

        const result = await chat.sendMessage(userInput); // Envia a mensagem na sessão existente
        const response = await result.response;
        const botReply = response.text().trim();

        console.log(`[Sessão: ${sessionId}] Recebido do Gemini: "${botReply}"`);
        return botReply;

    } catch (error) {
        console.error(`------------------[Sessão: ${sessionId}]-------------------`);
        console.error("Erro ao chamar a API do Google AI (Gemini):");
        console.error(error);
        console.error("-----------------------------------------");

        // Tratamento de erro mais específico
        if (error.message && error.message.includes("context_length_exceeded")) {
            // Opcional: Tentar limpar o histórico da sessão e avisar o usuário
            // delete chatSessions[sessionId]; // Isso apagaria a sessão
            return "🤖 Nossa conversa ficou muito longa e o limite de contexto foi atingido. Por favor, tente iniciar uma nova conversa ou resumir o que falamos.";
        }
        if (error.status && error.status === 429) { // Too Many Requests
            return "🤖 Estou recebendo muitas perguntas agora. Por favor, tente novamente em alguns instantes.";
        }
        return "🤖 Desculpe, não consegui processar sua pergunta com a IA do Google no momento.";
    }
}

// Rota para o chat
app.post('/chat', async (req, res) => {
    const { sessionId, message: userMessage } = req.body; // Espera sessionId e message

    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId é obrigatório.', reply: '🤖 Problema na identificação da sessão.' });
    }
    if (!userMessage || typeof userMessage !== 'string' || userMessage.trim() === "") {
        return res.status(400).json({ error: 'Mensagem não encontrada ou vazia.', reply: '🤖 Por favor, envie uma mensagem.' });
    }

    const botReply = await getGoogleAIResponse(sessionId, userMessage);
    // Opcional: enviar histórico de volta se o frontend precisar
    // const currentChat = chatSessions[sessionId];
    // const history = currentChat ? currentChat.history : [];
    // res.json({ reply: botReply, history: history });
    res.json({ reply: botReply });
});

// Rota opcional para limpar/resetar uma sessão (útil para debug ou se o usuário quiser)
app.post('/clear_session', (req, res) => {
    const { sessionId } = req.body;
    if (sessionId && chatSessions[sessionId]) {
        delete chatSessions[sessionId];
        console.log(`[Sessão: ${sessionId}] Sessão limpa.`);
        res.json({ message: `Sessão ${sessionId} limpa com sucesso.` });
    } else {
        res.status(404).json({ error: "Sessão não encontrada ou sessionId não fornecido." });
    }
});


app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
    console.log(`Acesse o frontend em http://localhost:${port}/ (se você tiver um index.html em 'public')`);
    if (GOOGLE_API_KEY && !GOOGLE_API_KEY.startsWith('AIzaSy')) { // Verificação de GOOGLE_API_KEY ajustada
        console.warn("AVISO: Sua GOOGLE_API_KEY não parece uma chave válida do Google (geralmente começa com 'AIzaSy'). Verifique se é a chave correta.");
    } else if (GOOGLE_API_KEY) {
        console.log("Pronto para usar a API do Google AI (Gemini)!");
    }
});