// Senha padrão (usada pelos usuários que NÃO têm senha própria definida).
// Pra trocar: gere uma nova string longa e substitua aqui.
export const SENHA_MASTER = '/Tuttiamore1';

// Lista de emails autorizados.
// senha = '...' → senha individual do usuário (se ausente, vale a SENHA_MASTER)
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
        senha: '//Tuttiamore2',
        restricaoHorario: { inicio: 8, fim: 18 },
    },
];
