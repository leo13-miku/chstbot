// Aguarda o carregamento completo do HTML
document.addEventListener('DOMContentLoaded', () => {
    // Elementos da página
    const totalConversationsEl = document.getElementById('total-conversations');
    const uniqueUsersEl = document.getElementById('unique-users');
    const recentConversationsListEl = document.getElementById('recent-conversations-list');
    const botConfigForm = document.getElementById('bot-config-form');
    const personalityTextarea = document.getElementById('personality');
    const saveStatusEl = document.getElementById('save-status')
    // Função para buscar as métricas da API
    async function fetchMetrics() {
        try {
            const response = await fetch('/api/admin/metrics');
            if (!response.ok) {
                throw new Error('Falha ao buscar métricas. Você está logado?');
            }
            const data = await response.json();
            // Atualiza os elementos no HTML
            totalConversationsEl.textContent = data.totalConversations;
            uniqueUsersEl.textContent = data.uniqueUsers;
            // Limpa a lista de conversas recentes e a preenche
            recentConversationsListEl.innerHTML = '';
            if (data.recentConversations.length === 0) {
                recentConversationsListEl.innerHTML = '<p>Nenhuma conversa encontrada.</p>';
            } else {
                data.recentConversations.forEach(convo => {
                    const convoDiv = document.createElement('div');
                    convoDiv.className = 'conversation';
                    const startTime = new Date(convo.startTime).toLocaleString('pt-BR');
                    const firstMessage = convo.messages.length > 0 ? convo.messages[0].text : 'N/A';
                    convoDiv.innerHTML = `
                        <small><strong>Início:</strong> ${startTime}</small>
                        <p>"${firstMessage.substring(0, 80)}..."</p>
                    `;
                    recentConversationsListEl.appendChild(convoDiv);
                });
            }
        } catch (error) {
            console.error('Erro:', error);
            recentConversationsListEl.innerHTML = `<p style="color: #ff4d4d;">${error.message}</p>`;
        }
    }
    // Função para buscar a configuração atual do bot
    async function fetchBotConfig() {
        try {
            const response = await fetch('/api/admin/bot-config');
            if (!response.ok) {
                throw new Error('Falha ao buscar configuração do bot.');
            }
            const data = await response.json();
            personalityTextarea.value = data.personality;
        } catch (error) {
            console.error('Erro:', error);
            saveStatusEl.textContent = error.message;
        }
    }

    // Função para salvar a nova configuração do bot
    async function saveBotConfig(event) {
        event.preventDefault(); // Impede o recarregamento da página
        const newPersonality = personalityTextarea.value;
        
        saveStatusEl.textContent = 'Salvando...';

        try {
            const response = await fetch('/api/admin/bot-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ personality: newPersonality }),
            });

            if (!response.ok) {
                throw new Error('Falha ao salvar. Tente novamente.');
            }
            
            const result = await response.json();
            saveStatusEl.textContent = result.message;

            // Limpa a mensagem de status após alguns segundos
            setTimeout(() => {
                saveStatusEl.textContent = '';
            }, 3000);

        } catch (error) {
            console.error('Erro:', error);
            saveStatusEl.textContent = error.message;
        }
    }
    // Adiciona o evento de submit ao formulário
    botConfigForm.addEventListener('submit', saveBotConfig);
    // Chama as funções para carregar os dados quando a página é aberta
    fetchMetrics();
    fetchBotConfig();
});