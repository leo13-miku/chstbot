// public/index.js (COLOQUE ESTE CÓDIGO AQUI)
document.addEventListener('DOMContentLoaded', () => {
    const chatbox = document.getElementById('chatbox');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');

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

        appendMessage(userText, true); // Mostra a mensagem do usuário
        userInput.value = ''; // Limpa o campo de input

        try {
            const response = await fetch('/chat', { // Envia para o backend na rota /chat
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: userText }), // Envia a mensagem como JSON
            });

            if (!response.ok) {
                // Tenta pegar uma mensagem de erro do JSON, se houver
                const errorData = await response.json().catch(() => ({ reply: "Erro desconhecido ao comunicar com o servidor." }));
                throw new Error(errorData.reply || `Erro HTTP: ${response.status}`);
            }

            const data = await response.json(); // Pega a resposta JSON do servidor
            appendMessage(data.reply, false); // Mostra a resposta do bot
        } catch (error) {
            console.error("Erro ao enviar mensagem:", error);
            appendMessage(`🤖 Ops! Algo deu errado: ${error.message}`, false);
        }
    }

    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    console.log("Frontend script (public/index.js) carregado!");
});