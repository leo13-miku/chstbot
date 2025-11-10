import dotenv from 'dotenv';
import express from 'express';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { MongoClient, ServerApiVersion } from 'mongodb';
import mongoose from 'mongoose';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import User from './models/User.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 3600000 }
}));

// --- CONFIGURAÇÃO DA GOOGLE AI ---
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-pro", // Usando o nome mais comum e estável
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ],
    generationConfig: { maxOutputTokens: 800 }
});

const mongoUriHistoria = process.env.MONGO_URI_HISTORIA;
if (!mongoUriHistoria) {
    console.error("ERRO: A variável de ambiente MONGO_URI_HISTORIA deve ser definida.");
    process.exit(1);
}

let botConfigCollection;

async function startServer() {
    try {
        await mongoose.connect(mongoUriHistoria);
        console.log('✅ Conectado ao MongoDB com Mongoose.');

        const client = new MongoClient(mongoUriHistoria, {
            serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
        });
        await client.connect();
        const db = client.db();
        botConfigCollection = db.collection("botConfig");
        console.log('✅ Coleção de config do Bot inicializada.');

        app.listen(port, () => {
            console.log(`🚀 Servidor rodando em http://localhost:${port} e pronto para receber requisições.`);
        });

    } catch (error) {
        console.error('❌ Falha crítica ao inicializar o servidor:', error);
        process.exit(1);
    }
}

// --- Middlewares e Rotas ---
const isUserAuthenticated = (req, res, next) => {
    if (req.session.userId) { return next(); }
    res.status(401).json({ error: 'Acesso não autorizado. Faça login.' });
};

// ... (todas as outras rotas: /api/register, /api/login, etc. continuam aqui)
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userExists = await User.findOne({ username });
        if (userExists) {
            return res.status(400).json({ message: 'Usuário já existe.' });
        }
        const user = new User({ username, password });
        await user.save();
        
        req.session.userId = user._id;
        req.session.username = user.username;
        
        res.status(201).json({ message: 'Usuário registrado com sucesso!', username: user.username });
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor.', error });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (user && (await user.matchPassword(password))) {
            req.session.userId = user._id;
            req.session.username = user.username;
            res.json({ message: 'Login bem-sucedido!', username: user.username });
        } else {
            res.status(401).json({ message: 'Credenciais inválidas.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor.', error });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Não foi possível fazer logout.' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Logout bem-sucedido.' });
    });
});

app.get('/api/session', (req, res) => {
    if (req.session.userId) {
        res.json({ loggedIn: true, username: req.session.username });
    } else {
        res.json({ loggedIn: false });
    }
});


app.get('/api/user/preferences', isUserAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        res.json({ customSystemInstruction: user.customSystemInstruction });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar preferências.' });
    }
});

app.put('/api/user/preferences', isUserAuthenticated, async (req, res) => {
    const { customSystemInstruction } = req.body;
    try {
        await User.findByIdAndUpdate(req.session.userId, { customSystemInstruction });
        res.json({ message: 'Personalidade salva com sucesso!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao salvar preferências.' });
    }
});


app.post('/api/chat', isUserAuthenticated, async (req, res) => {
    try {
        const { historico, novaMensagem } = req.body;
        
        let systemInstruction = 'Você é um assistente prestativo.';

        const globalConfig = await botConfigCollection.findOne({ key: 'personality' });
        if (globalConfig && globalConfig.value) {
            systemInstruction = globalConfig.value;
        }

        const user = await User.findById(req.session.userId);
        if (user && user.customSystemInstruction) {
            systemInstruction = user.customSystemInstruction;
        }
        
        const fullHistory = [
            { role: "user", parts: [{ text: systemInstruction }] },
            { role: "model", parts: [{ text: "Ok, entendi. Pode começar." }] },
            ...historico
        ];

        const chat = model.startChat({
            history: fullHistory,
            generationConfig: { maxOutputTokens: 800 },
        });

        const result = await chat.sendMessage(novaMensagem);
        const response = await result.response;
        const text = response.text();

        res.json({ resposta: text });

    } catch (error) {
        console.error("Erro na API /api/chat:", error);
        res.status(500).send("Ocorreu um erro no servidor de chat.");
    }
});


// --- INICIALIZA O SERVIDOR ---
startServer();