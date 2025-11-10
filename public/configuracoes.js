document.addEventListener('DOMContentLoaded', async () => {
    const personalityInput = document.getElementById('personality-input');
    const saveButton = document.getElementById('save-button');
    const feedback = document.getElementById('feedback');

    // 1. Buscar a personalidade atual quando a página carrega
    try {
        const response = await fetch('/api/user/preferences');
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login.html'; // Redireciona se não estiver logado
            }
            throw new Error('Não foi possível carregar suas configurações.');
        }
        const data = await response.json();
        personalityInput.value = data.customSystemInstruction || '';
    } catch (error) {
        feedback.textContent = error.message;
        feedback.style.color = 'red';
    }

    // 2. Adicionar evento ao botão para salvar
    saveButton.addEventListener('click', async () => {
        const newPersonality = personalityInput.value;
        try {
            const response = await fetch('/api/user/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customSystemInstruction: newPersonality })
            });

            const data = await response.json();

            if (response.ok) {
                feedback.textContent = 'Personalidade salva com sucesso!';
                feedback.style.color = 'green';
            } else {
                throw new Error(data.error || 'Erro ao salvar.');
            }
        } catch (error) {
            feedback.textContent = error.message;
            feedback.style.color = 'red';
        }
    });
});