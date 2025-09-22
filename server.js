import dotenv from 'dotenv';
import express from 'express';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { MongoClient, ServerApiVersion } from 'mongodb';

// --- NOVAS DEPENDÊNCIAS PARA O PAINEL DE ADMIN ---
import session from 'express-session';
import bcrypt from 'bcryptjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); // Necessário para processar o formulário de login
app.use(express.static(path.join(__dirname, 'public')));

// --- CONFIGURAÇÃO DA SESSÃO PARA O PAINEL DE ADMIN ---
app.use(session({
    secret: process.env.SESSION_SECRET, // Adicione esta variável ao seu .env
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 3600000 } // Em produção, use 'secure: true' com HTTPS
}));

// --- SUA LÓGICA EXISTENTE (Google AI e MongoDB) ---
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
// ... (o resto da sua configuração da IA continua aqui, sem alterações)
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        // ... (resto das configurações de segurança)
    ],
    generationConfig: { maxOutputTokens: 800 }
});

const mongoUriLogs = process.env.MONGO_URI_LOGS;
const mongoUriHistoria = process.env.MONGO_URI_HISTORIA;

if (!mongoUriLogs || !mongoUriHistoria) {
    console.error("ERRO: As variáveis de ambiente MONGO_URI_LOGS e MONGO_URI_HISTORIA devem ser definidas.");
    process.exit(1);
}

let dbLogs;
let dbHistoria;
// --- NOVA VARIÁVEL PARA COLEÇÕES DO PAINEL ---
let sessoesCollection;
let botConfigCollection;

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
        // --- INICIALIZANDO AS COLEÇÕES QUE O PAINEL USARÁ ---
        sessoesCollection = dbHistoria.collection("sessoesChat");
        botConfigCollection = dbHistoria.collection("botConfig");
        console.log("🚀 Todas as conexões com os bancos de dados foram estabelecidas.");
    }
}

initializeDatabases();

// --- PAINEL DE ADMINISTRAÇÃO ---

// Middleware para verificar se o admin está autenticado
const isAuthenticated = (req, res, next) => {
    if (req.session.isAuthenticated) {
        return next();
    }
    res.redirect('/admin/login');
};

// --- ROTAS DE AUTENTICAÇÃO ---
app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin/login.html'));
});

app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USERNAME;
    const adminPassHash = process.env.ADMIN_PASSWORD_HASH;

    if (username === adminUser && await bcrypt.compare(password, adminPassHash)) {
        req.session.isAuthenticated = true;
        res.redirect('/admin/dashboard');
    } else {
        res.send('Credenciais inválidas. <a href="/admin/login">Tentar novamente</a>');
    }
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/admin/dashboard');
        }
        res.clearCookie('connect.sid');
        res.redirect('/admin/login');
    });
});

// --- ROTAS DO PAINEL (PROTEGIDAS) ---
app.get('/admin/dashboard', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin/admin.html'));
});

// --- API PARA O PAINEL (PROTEGIDA) ---

// 1. API para buscar as métricas
app.get('/api/admin/metrics', isAuthenticated, async (req, res) => {
    try {
        const totalConversations = await sessoesCollection.countDocuments();
        // Para "usuários únicos", se você não tiver um campo de usuário, pode contar sessionIds distintos.
        // Neste caso, é o mesmo que o total de conversas.
        const uniqueUsers = await sessoesCollection.distinct('sessionId');
        
        const recentConversations = await sessoesCollection.find({})
            .sort({ startTime: -1 })
            .limit(5)
            .project({ "messages.text": 1, startTime: 1, sessionId: 1 }) // Retorna apenas o texto das mensagens e o início
            .toArray();

        res.json({
            totalConversations,
            uniqueUsers: uniqueUsers.length,
            recentConversations
        });
    } catch (error) {
        console.error("[Admin API] Erro ao buscar métricas:", error);
        res.status(500).json({ error: 'Erro ao buscar métricas.' });
    }
});

// 2. API para buscar e atualizar a configuração do bot
app.get('/api/admin/bot-config', isAuthenticated, async (req, res) => {
    try {
        const config = await botConfigCollection.findOne({ key: 'personality' });
        res.json({ personality: config ? config.value : 'Você é um assistente prestativo.' });
    } catch (error) {
        console.error("[Admin API] Erro ao buscar configuração do bot:", error);
        res.status(500).json({ error: 'Erro ao buscar configuração.' });
    }
});

app.post('/api/admin/bot-config', isAuthenticated, async (req, res) => {
    const { personality } = req.body;
    if (!personality) {
        return res.status(400).json({ error: 'O campo "personality" é obrigatório.' });
    }
    try {
        await botConfigCollection.updateOne(
            { key: 'personality' },
            { $set: { key: 'personality', value: personality } },
            { upsert: true }
        );
        res.json({ message: 'Personalidade do bot atualizada com sucesso!' });
    } catch (error) {
        console.error("[Admin API] Erro ao salvar configuração do bot:", error);
        res.status(500).json({ error: 'Erro ao salvar configuração.' });
    }
});


// --- SUAS ROTAS DE API EXISTENTES (PÚBLICAS) ---
// ... (todas as suas rotas como /api/chat/historicos, /api/log-connection, etc. continuam aqui, sem alterações)

app.get('/api/chat/historicos', async (req, res) => {
    // ... seu código original
});

app.post('/api/log-connection', async (req, res) => {
    // ... seu código original
});

app.post('/api/chat/salvar-historico', async (req, res) => {
    // ... seu código original
});

app.post('/api/chat', async (req, res) => {
    // ... seu código original
});


app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
    console.log(`Frontend disponível em http://localhost:${port}/`);
    console.log(`Painel de Admin disponível em http://localhost:${port}/admin/login`);
    if (GOOGLE_API_KEY && dbLogs && dbHistoria) {
        console.log("✅ Servidor pronto e conectado a todos os serviços (Google AI e MongoDBs).");
    }
});