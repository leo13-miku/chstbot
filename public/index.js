// public/index.js (COLOQUE ESTE CÓDIGO AQUI)
document.addEventListener('DOMContentLoaded', () => {
    const chatbox = document.getElementById('chatbox');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');

    // --- PASSO 1: CRIAR/PEGAR O CRACHÁ MÁGICO ---
    let currentSessionId = localStorage.getItem('chatSessionId');
    if (!currentSessionId) {
        currentSessionId = 'chat-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
        localStorage.setItem('chatSessionId', currentSessionId);
        console.log("Novo Crachá (Session ID) gerado e guardado:", currentSessionId);
    } else {
        console.log("Crachá (Session ID) recuperado da gaveta:", currentSessionId);
    }
    // --- FIM DO PASSO 1 ---

    function appendMessage(message, senderIsUser) {
        const messageElement = document.createElement('p');
        messageElement.classList.add(senderIsUser ? 'user-message' : 'bot-message');
        messageElement.textContent = message;
        chatbox.appendChild(messageElement);
        chatbox.scrollTop = chatbox.scrollHeight;
    }

    async function sendMessage() {
        const userText = userInput.value.trim();
        if (userText === "") return;

        appendMessage(userText, true);
        userInput.value = '';

        // Para depuração, vamos ver o crachá antes de enviar
        console.log("Enviando com o Crachá (Session ID):", currentSessionId);

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // --- PASSO 2: COLOCAR O CRACHÁ NO ENVELOPE ---
                body: JSON.stringify({
                    sessionId: currentSessionId, // << ADICIONAMOS O CRACHÁ AQUI!
                    message: userText
                }),
                // --- FIM DO PASSO 2 ---
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ reply: "Erro desconhecido ao comunicar com o servidor." }));
                throw new Error(errorData.reply || `Erro HTTP: ${response.status}`);
            }

            const data = await response.json();
            appendMessage(data.reply, false);
        } catch (error) {
            console.error("Erro ao enviar mensagem:", error); // O erro ainda vai aparecer aqui se algo mais der errado
            appendMessage(`🤖 Ops! Algo deu errado: ${error.message}`, false);
        }
    }

    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    // Adiciona uma mensagem inicial para sabermos que o script carregou
    // e para vermos o sessionId no console logo de cara.
    appendMessage("Olá! Sou seu assistente. Pode perguntar!", false);
    console.log("Frontend script (public/index.js) carregado! Usando Session ID:", currentSessionId);
});