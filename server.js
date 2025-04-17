const chatbox = document.getElementById('chatbox');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');

function appendMessage(message, isUser) {
    const messageDiv = document.createElement('p');
    messageDiv.classList.add(isUser ? 'user-message' : 'bot-message');
    messageDiv.textContent = message;
    chatbox.appendChild(messageDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
}

async function sendMessage() {
    const userText = userInput.value.trim();
    if (userText) {
        appendMessage(userText, true);
        userInput.value = '';

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: userText }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            appendMessage(data.reply, false); // 'reply' é a chave da resposta do seu backend
        } catch (error) {
            console.error("Erro ao enviar mensagem:", error);
            appendMessage("Ops! Algo deu errado ao enviar a mensagem.", false);
        }
    }
}

sendButton.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

// Mensagem inicial do bot (opcional, pode manter ou remover)
appendMessage("🤖 Olá! Como posso ajudar?", false);