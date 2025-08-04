document.addEventListener('DOMContentLoaded', () => {
    const listaSessoesUI = document.getElementById('lista-sessoes');
    const visualizacaoDetalhadaUI = document.getElementById('visualizacao-detalhada');

    const backendUrl = '';
    async function carregarHistoricoSessoes() {
        listaSessoesUI.innerHTML = '<li class="placeholder">Carregando...</li>';
        try {
            const response = await fetch(`${backendUrl}/api/chat/historicos`);
            if (!response.ok) throw new Error('Falha ao buscar históricos.');
            
            const sessoes = await response.json();
            listaSessoesUI.innerHTML = '';

            if (sessoes.length === 0) {
                listaSessoesUI.innerHTML = '<li class="placeholder">Nenhum histórico encontrado.</li>';
                return;
            }

            sessoes.forEach(sessao => {
                const li = document.createElement('li');
                const dataFormatada = new Date(sessao.startTime).toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short'
                });
                li.textContent = `Conversa de ${dataFormatada}`;
                li.addEventListener('click', () => {
                    document.querySelectorAll('#lista-sessoes li').forEach(item => item.classList.remove('selected'));
                    li.classList.add('selected');
                    exibirConversaDetalhada(sessao);
                });

                listaSessoesUI.appendChild(li);
            });

        } catch (error) {
            console.error("Erro ao carregar histórico:", error);
            listaSessoesUI.innerHTML = '<li class="placeholder">Erro ao carregar. Tente novamente.</li>';
        }
    }

    function exibirConversaDetalhada(sessao) {
        visualizacaoDetalhadaUI.innerHTML = '';

        if (!sessao.messages || sessao.messages.length === 0) {
            visualizacaoDetalhadaUI.innerHTML = '<p class="placeholder">Sessão sem mensagens.</p>';
            return;
        }

        sessao.messages.forEach(msg => {
            const messageElement = document.createElement('p');
            messageElement.classList.add(msg.sender === 'user' ? 'user-message' : 'bot-message');
            messageElement.textContent = msg.text;
            visualizacaoDetalhadaUI.appendChild(messageElement);
        });

        visualizacaoDetalhadaUI.scrollTop = 0;
    }


    carregarHistoricoSessoes();
});