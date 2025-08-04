document.addEventListener('DOMContentLoaded', () => {
    const chatbox = document.getElementById('chatbox');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');

    const backendUrl = '';
    let chatHistory = [];
    const currentSessionId = `sessao_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const chatStartTime = new Date();

    async function sendMessage() {
        const userText = userInput.value.trim();
        if (userText === "") return;

        chatHistory.push({ role: 'user', parts: [{ text: userText }] });
        appendMessage(userText, true);
        userInput.value = '';

        try {
            const response = await fetch(`${backendUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    historico: chatHistory.slice(0, -1),
                    novaMensagem: userText
                }),
            });

            if (!response.ok) throw new Error('Falha na comunicação com o servidor.');

            const data = await response.json();
            
            chatHistory.push({ role: 'model', parts: [{ text: data.resposta }] });
            appendMessage(data.resposta, false);

            await salvarHistoricoSessao(currentSessionId, "chatbotPrincipalIFCODE", chatStartTime, new Date(), chatHistory);

        } catch (error) {
            console.error("Erro ao enviar mensagem:", error);
            appendMessage(`🤖 Ops! Algo deu errado: ${error.message}`, false);
        }
    }

    async function salvarHistoricoSessao(sessionId, botId, startTime, endTime, messages) {
        try {
            const payload = { sessionId, botId, startTime: startTime.toISOString(), endTime: endTime.toISOString(), messages };
            await fetch(`${backendUrl}/api/chat/salvar-historico`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            console.log("Histórico da sessão enviado para arquivamento.");
        } catch (error) {
            console.error("Erro de rede ao salvar histórico:", error);
        }
    }

    function appendMessage(message, senderIsUser) {
        const messageElement = document.createElement('p');
        messageElement.classList.add(senderIsUser ? 'user-message' : 'bot-message');
        messageElement.textContent = message;
        chatbox.appendChild(messageElement);
        chatbox.scrollTop = chatbox.scrollHeight;
    }

    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    appendMessage("Olá! Sou seu assistente. Como posso ajudar?", false);
});