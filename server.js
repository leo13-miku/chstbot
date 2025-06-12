// server.js
import dotenv from 'dotenv';
import express from 'express';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { MongoClient, ServerApiVersion } from 'mongodb'; // Importação do MongoDB (Fase 1)

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// --- Configuração da API do Google ---
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
    console.error("ERRO: A variável de ambiente GOOGLE_API_KEY não está definida.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ],
    generationConfig: {
        maxOutputTokens: 800,
    }
});

// --- Bloco de Conexão com MongoDB (Fase 1) ---
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("ERRO: A variável de ambiente MONGO_URI não está definida.");
    process.exit(1);
}

const client = new MongoClient(MONGO_URI, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

let db; // Variável para armazenar a referência do banco

async function connectDB() {
  try {
    await client.connect();
    db = client.db("IIW2023A_Logs");
    console.log("Conectado ao MongoDB Atlas!");
  } catch (err) {
    console.error("Falha ao conectar ao MongoDB", err);
    process.exit(1);
  }
}
connectDB(); // Executa a conexão
// --- Fim do Bloco de Conexão ---

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Bloco do Endpoint de Log (Fase 2) ---
app.post('/api/log-connection', async (req, res) => {
    const { ip, acao } = req.body;
    if (!ip || !acao) {
        return res.status(400).json({ error: "Dados de log incompletos (IP e ação são obrigatórios)." });
    }
    try {
        const collection = db.collection("tb_cl_user_log_acess");
        const agora = new Date();
        const logEntry = {
            col_data: agora.toISOString().split('T')[0],
            col_hora: agora.toTimeString().split(' ')[0],
            col_IP: ip,
            col_acao: acao
        };
        const result = await collection.insertOne(logEntry);
        console.log(`Log inserido com sucesso com o ID: ${result.insertedId}`);
        res.status(201).json({ message: "Log registrado com sucesso!", data: logEntry });
    } catch (error) {
        console.error("Erro ao inserir log no MongoDB:", error);
        res.status(500).json({ error: "Erro interno do servidor ao registrar o log." });
    }
});
// --- Fim do Bloco de Endpoint de Log ---

// --- Gerenciamento de Sessões de Chat (código original) ---
const chatSessions = {}; 

function getOrCreateChatSession(sessionId) {
    if (!chatSessions[sessionId]) {
        console.log(`[Sessão: ${sessionId}] Iniciando nova sessão de chat.`);
        chatSessions[sessionId] = model.startChat({ history: [] });
    } else {
        console.log(`[Sessão: ${sessionId}] Continuando sessão de chat existente.`);
    }
    return chatSessions[sessionId];
}

async function getGoogleAIResponse(sessionId, userInput) {
    if (!userInput || userInput.trim() === "") {
        return "Por favor, digite alguma coisa.";
    }
    const chat = getOrCreateChatSession(sessionId);
    try {
        console.log(`[Sessão: ${sessionId}] Enviando para Gemini: "${userInput}"`);
        const result = await chat.sendMessage(userInput);
        const response = await result.response;
        const botReply = response.text().trim();
        console.log(`[Sessão: ${sessionId}] Recebido do Gemini: "${botReply}"`);
        return botReply;
    } catch (error) {
        console.error(`Erro ao chamar a API do Google AI (Gemini) para sessão ${sessionId}:`, error);
        if (error.message && error.message.includes("context_length_exceeded")) {
            return "🤖 Nossa conversa ficou muito longa. Por favor, inicie uma nova conversa.";
        }
        if (error.status && error.status === 429) {
            return "🤖 Estou recebendo muitas perguntas agora. Por favor, tente novamente em instantes.";
        }
        return "🤖 Desculpe, não consegui processar sua pergunta com a IA do Google no momento.";
    }
}

// Rota para o chat (código original)
app.post('/chat', async (req, res) => {
    const { sessionId, message: userMessage } = req.body;
    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId é obrigatório.' });
    }
    if (!userMessage || typeof userMessage !== 'string' || userMessage.trim() === "") {
        return res.status(400).json({ error: 'Mensagem vazia.' });
    }
    const botReply = await getGoogleAIResponse(sessionId, userMessage);
    res.json({ reply: botReply });
});

// Rota para limpar sessão (código original)
app.post('/clear_session', (req, res) => {
    const { sessionId } = req.body;
    if (sessionId && chatSessions[sessionId]) {
        delete chatSessions[sessionId];
        console.log(`[Sessão: ${sessionId}] Sessão limpa.`);
        res.json({ message: `Sessão ${sessionId} limpa com sucesso.` });
    } else {
        res.status(404).json({ error: "Sessão não encontrada." });
    }
});

// --- Listener final ---
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
    console.log(`Acesse o frontend em http://localhost:${port}/`);
    if (GOOGLE_API_KEY) {
        console.log("Pronto para usar a API do Google AI (Gemini)!");
    }
});