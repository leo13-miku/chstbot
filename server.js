import dotenv from 'dotenv';
import express from 'express';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { MongoClient, ServerApiVersion } from 'mongodb';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'public')));


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

const mongoUriLogs = process.env.MONGO_URI_LOGS;
const mongoUriHistoria = process.env.MONGO_URI_HISTORIA;

if (!mongoUriLogs || !mongoUriHistoria) {
    console.error("ERRO: As variáveis de ambiente MONGO_URI_LOGS e MONGO_URI_HISTORIA devem ser definidas.");
    process.exit(1);
}

let dbLogs;
let dbHistoria;

async function connectToMongoDB(uri, dbNameForLog) {
    const client = new MongoClient(uri, {
        serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
    });
    try {
        await client.connect();
        console.log(`✅ Conectado com sucesso ao MongoDB Atlas: ${dbNameForLog}`);
        return client.db();
    } catch (err) {
        console.error(`❌ Falha ao conectar ao MongoDB ${dbNameForLog}:`, err);
        return null;
    }
}

async function initializeDatabases() {
    console.log("Iniciando conexões com os bancos de dados...");
    dbLogs = await connectToMongoDB(mongoUriLogs, "Banco de Logs Compartilhado");
    dbHistoria = await connectToMongoDB(mongoUriHistoria, "Banco de Histórico Pessoal");
    
    if (!dbLogs || !dbHistoria) {
        console.error("🚨 ATENÇÃO: Falha ao conectar a um ou mais bancos de dados. O servidor será encerrado.");
        process.exit(1); 
    } else {
        console.log("🚀 Todas as conexões com os bancos de dados foram estabelecidas.");
    }
}

initializeDatabases();



app.get('/api/chat/historicos', async (req, res) => {
    if (!dbHistoria) {
        return res.status(500).json({ error: "Servidor não conectado ao banco de dados de histórico." });
    }
    try {
        const collection = dbHistoria.collection("sessoesChat");
        const historicos = await collection.find({})
                                            .sort({ startTime: -1 }) 
                                            .limit(20)
                                            .toArray(); 
        
        console.log(`[Busca Histórico] ${historicos.length} sessões encontradas e enviadas.`);
        res.json(historicos);

    } catch (error) {
        console.error("[Servidor] Erro ao buscar históricos:", error);
        res.status(500).json({ error: "Erro interno ao buscar históricos de chat." });
    }
});



app.post('/api/log-connection', async (req, res) => {
    if (!dbLogs) {
        return res.status(500).json({ error: "Servidor não conectado ao banco de dados de logs." });
    }
    const { ip, acao } = req.body;
    if (!ip || !acao) {
        return res.status(400).json({ error: "Dados de log incompletos (IP e ação são obrigatórios)." });
    }
    try {
        const collection = dbLogs.collection("tb_cl_user_log_acess");
        const agora = new Date();
        const logEntry = {
            col_data: agora.toISOString().split('T')[0],
            col_hora: agora.toTimeString().split(' ')[0],
            col_IP: ip,
            col_acao: acao
        };
        const result = await collection.insertOne(logEntry);
        console.log(`[Log de Acesso] Log inserido com sucesso com o ID: ${result.insertedId}`);
        res.status(201).json({ message: "Log registrado com sucesso!", data: logEntry });
    } catch (error) {
        console.error("Erro ao inserir log no MongoDB:", error);
        res.status(500).json({ error: "Erro interno do servidor ao registrar o log." });
    }
});


app.post('/api/chat/salvar-historico', async (req, res) => {
    if (!dbHistoria) {
        return res.status(500).json({ error: "Servidor não conectado ao banco de dados de histórico." });
    }
    try {
        
        const { sessionId, botId, startTime, endTime, messages } = req.body;
        
        if (!sessionId || !botId || !messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: "Dados incompletos para salvar histórico." });
        }
        
        const messagesFormatadas = messages.map(msg => ({
            sender: msg.role === 'user' ? 'user' : 'bot',
            text: msg.parts[0].text,
            timestamp: new Date()
        }));

        const novaSessao = {
            sessionId,
            userId: 'anonimo',
            botId,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            messages: messagesFormatadas, 
            loggedAt: new Date()
        };

        const collection = dbHistoria.collection("sessoesChat");
        
       
        const result = await collection.updateOne(
            { sessionId: sessionId }, 
            { $set: novaSessao },    
            { upsert: true }        
        );

        if (result.upsertedId) {
            console.log(`[Histórico de Chat] Nova sessão criada com sucesso. ID: ${result.upsertedId}`);
        } else {
            console.log(`[Histórico de Chat] Sessão ${sessionId} atualizada com sucesso.`);
        }

        res.status(201).json({ message: "Histórico de chat salvo com sucesso!", sessionId: novaSessao.sessionId });
    } catch (error) {
        console.error("[Erro] Em /api/chat/salvar-historico:", error);
        res.status(500).json({ error: "Erro interno ao salvar histórico de chat." });
    }
});


app.post('/api/chat', async (req, res) => {
    try {
        const { historico, novaMensagem } = req.body;
        if (!historico || !novaMensagem) {
            return res.status(400).json({ error: 'É necessário enviar o histórico e a nova mensagem.' });
        }
        const chat = model.startChat({
            history: historico,
        });
        const result = await chat.sendMessage(novaMensagem);
        const response = await result.response;
        const botReply = response.text();
        const historicoAtualizado = [
            ...historico,
            { role: 'user', parts: [{ text: novaMensagem }] },
            { role: 'model', parts: [{ text: botReply }] }
        ];
        console.log("[Chat] Resposta do Bot gerada com sucesso.");
        res.json({ 
            resposta: botReply, 
            historico: historicoAtualizado 
        });
    } catch (error) {
        console.error("Erro no endpoint /api/chat:", error);
        res.status(500).json({ error: "Erro ao processar a mensagem com a IA do Google." });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
    console.log(`Frontend disponível em http://localhost:${port}/`);
    if (GOOGLE_API_KEY && dbLogs && dbHistoria) {
        console.log("✅ Servidor pronto e conectado a todos os serviços (Google AI e MongoDBs).");
    }
});