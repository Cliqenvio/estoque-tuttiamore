// Senha compartilhada entre todos os usuários autorizados.
// Pra trocar: gere uma nova string longa e substitua aqui.
export const SENHA_MASTER = 'Tt9PmKx3LqWnRz8vBsJg5cFhYd2W';

// Lista de emails autorizados.
// restricaoHorario = null  → pode acessar qualquer hora
// restricaoHorario = {inicio, fim} → só entre essas horas (formato 24h, fim NÃO incluso)
export const USUARIOS_AUTORIZADOS = [
    {
        email: 'joao@tuttiamore.com.br',
        nome: 'João',
        restricaoHorario: null,
    },
    {
        email: 'expedicao@tuttiamore.com.br',
        nome: 'Expedição',
        restricaoHorario: { inicio: 8, fim: 18 },
    },
];
