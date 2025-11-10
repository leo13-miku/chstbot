document.addEventListener('DOMContentLoaded', async () => {
    // --- VERIFICAÇÃO DE SESSÃO ---
    try {
        const sessionResponse = await fetch('/api/session');
        const sessionData = await sessionResponse.json();
        if (!sessionData.loggedIn) {
            window.location.href = '/login.html'; // Redireciona para login se não estiver logado
            return; // Para a execução do script
        }
        document.getElementById('welcome-message').textContent = `Bem-vindo, ${sessionData.username}!`;
    } catch (error) {
        console.error('Erro ao verificar sessão, redirecionando para login.');
        window.location.href = '/login.html';
        return;
    }
    // --- FIM DA VERIFICAÇÃO ---

    const chatbox = document.getElementById('chatbox');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const logoutButton = document.getElementById('logout-button');

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

            if (!response.ok) {
                 if (response.status === 401) {
                    alert("Sua sessão expirou. Por favor, faça login novamente.");
                    window.location.href = '/login.html';
                }
                throw new Error('Falha na comunicação com o servidor.');
            }

            const data = await response.json();
            
            chatHistory.push({ role: 'model', parts: [{ text: data.resposta }] });
            appendMessage(data.resposta, false);

        } catch (error) {
            console.error("Erro ao enviar mensagem:", error);
            appendMessage(`🤖 Ops! Algo deu errado: ${error.message}`, false);
        }
    }

    function appendMessage(message, senderIsUser) {
        const messageElement = document.createElement('p');
        messageElement.classList.add(senderIsUser ? 'user-message' : 'bot-message');
        messageElement.textContent = message;
        chatbox.appendChild(messageElement);
        chatbox.scrollTop = chatbox.scrollHeight;
    }
    
    async function logout() {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login.html';
    }

    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') { sendMessage(); }
    });
    logoutButton.addEventListener('click', logout);

    appendMessage("Olá! Sou seu assistente. Como posso ajudar?", false);
});