const express = require('express');
const path = require('path');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


function getBotResponse(userInput) {
    const input = userInput.trim().toLowerCase();
    let botResponse = '';

  
    if (input === 'oi' || input === 'olá' || input === 'ola') {
        botResponse = '🤖 Olá! Tudo bem por aí?';
    } else if (input === 'tudo bem?' || input === 'como vai?') {
        botResponse = '🤖 Estou ótimo, obrigado por perguntar!';
    } else if (input === 'qual o seu nome?') {
        botResponse = '🤖 Eu sou um chatbot web rodando em Node.js e Express!';
    } else if (input.includes('ajuda')) { 
         botResponse = '🤖 Claro! Posso responder perguntas básicas. Tente perguntar meu nome ou como estou.';
    }

    else {
        botResponse = '🤖 Desculpe, não entendi. Pode tentar dizer de outra forma?';
    }
    return botResponse;
}


app.post('/chat', (req, res) => {

    const userMessage = req.body.message;

    if (!userMessage) {
        return res.status(400).json({ error: 'Mensagem não encontrada no corpo da requisição' });
    }


    const botReply = getBotResponse(userMessage);

    
    res.json({ reply: botReply });
});


app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
    console.log('Acesse essa URL no seu navegador para ver o chatbot!');
});