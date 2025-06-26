

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO DOM ---
    const chatbox = document.getElementById('chatbox');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    // Adicione um indicador de "pensando" se tiver um no seu HTML
    // const thinkingIndicator = document.getElementById('thinking-indicator'); 

    // --- CONFIGURAÇÃO E VARIÁVEIS GLOBAIS ---
    const backendUrl = ''; // Deixe vazio para local, ou coloque a URL do Render
    let chatHistory = [];  // GUARDA O HISTÓRICO DA CONVERSA
    const currentSessionId = `sessao_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const chatStartTime = new Date();

    // --- FUNÇÕES DE LÓGICA DO CHAT ---

    /**
     * Função principal que envia a mensagem do usuário para o backend.
     */
    async function sendMessage() {
        const userText = userInput.value.trim();
        if (userText === "") return;

        appendMessage(userText, true); // Mostra a mensagem do usuário na tela
        userInput.value = '';
        // if (thinkingIndicator) thinkingIndicator.style.display = 'block';

        try {
            // Requisição para o NOVO endpoint /api/chat
            const response = await fetch(`${backendUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Envia o corpo no NOVO formato
                body: JSON.stringify({
                    historico: chatHistory,
                    novaMensagem: userText
                }),
            });

            if (!response.ok) {
                throw new Error('Falha na comunicação com o servidor.');
            }

            const data = await response.json();

            // O backend agora devolve o histórico completo e atualizado
            chatHistory = data.historico;

            appendMessage(data.resposta, false); // Mostra a resposta do bot

            // --- CHAMADAS PARA LOG E ARQUIVAMENTO ---
            await salvarHistoricoSessao(currentSessionId, "chatbotPrincipalIFCODE", chatStartTime, new Date(), chatHistory);
            await registrarAcessoUsuario('interacao_chat');

        } catch (error) {
            console.error("Erro ao enviar mensagem:", error);
            appendMessage(`🤖 Ops! Algo deu errado: ${error.message}`, false);
        } finally {
            // if (thinkingIndicator) thinkingIndicator.style.display = 'none';
        }
    }

    // --- FUNÇÕES AUXILIARES (LOG E ARQUIVAMENTO) ---

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

    async function registrarAcessoUsuario(acao) {
        try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            const ip = ipData.ip;
            
            await fetch(`${backendUrl}/api/log-connection`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip, acao })
            });
            console.log(`Log de ação '${acao}' registrado.`);
        } catch (error) {
            console.error("Não foi possível registrar o log de acesso:", error);
        }
    }

    // --- FUNÇÕES DE EXIBIÇÃO ---

    function appendMessage(message, senderIsUser) {
        const messageElement = document.createElement('p');
        messageElement.classList.add(senderIsUser ? 'user-message' : 'bot-message');
        messageElement.textContent = message;
        chatbox.appendChild(messageElement);
        chatbox.scrollTop = chatbox.scrollHeight;
    }

    // --- EVENT LISTENERS ---

    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    // --- INICIALIZAÇÃO ---

    appendMessage("Olá! Sou seu assistente com memória persistente. Pode perguntar!", false);
    console.log("Frontend script (public/index.js) carregado e pronto! Session ID:", currentSessionId);
    // Registra a conexão inicial do usuário
    registrarAcessoUsuario('conexao_inicial');
});