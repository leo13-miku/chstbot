const express = require('express'); // Importa o Express
const path = require('path'); // Módulo para lidar com caminhos de arquivos

const app = express(); // Cria a aplicação Express
const port = 3000; // Porta em que o servidor vai rodar

// --- Middleware ---
// Para o Express entender JSON no corpo das requisições (como a que virá do fetch)
app.use(express.json());
// Para servir arquivos estáticos (HTML, CSS, JS do cliente) da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- Lógica do Chatbot (Separada da interface) ---
function getBotResponse(userInput) {
    const input = userInput.trim().toLowerCase();
    let botResponse = '';

    // Lógica de processamento (a mesma de antes, mas agora numa função)
    if (input === 'oi' || input === 'olá' || input === 'ola') {
        botResponse = '🤖 Olá! Tudo bem por aí?';
    } else if (input === 'tudo bem?' || input === 'como vai?') {
        botResponse = '🤖 Estou ótimo, obrigado por perguntar!';
    } else if (input === 'qual o seu nome?') {
        botResponse = '🤖 Eu sou um chatbot web rodando em Node.js e Express!';
    } else if (input.includes('ajuda')) { // Exemplo de verificação mais flexível
         botResponse = '🤖 Claro! Posso responder perguntas básicas. Tente perguntar meu nome ou como estou.';
    }
    // Adicione mais regras aqui!
    else {
        botResponse = '🤖 Desculpe, não entendi. Pode tentar dizer de outra forma?';
    }
    return botResponse;
}

// --- Rota da API ---
// Endpoint que o frontend (script.js) vai chamar
app.post('/chat', (req, res) => {
    // Pega a mensagem do usuário do corpo da requisição JSON
    const userMessage = req.body.message;

    if (!userMessage) {
        return res.status(400).json({ error: 'Mensagem não encontrada no corpo da requisição' });
    }

    // Obtém a resposta do bot usando a função de lógica
    const botReply = getBotResponse(userMessage);

    // Envia a resposta do bot de volta para o frontend como JSON
    res.json({ reply: botReply });
});

// --- Iniciar o Servidor ---
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
    console.log('Acesse essa URL no seu navegador para ver o chatbot!');
});