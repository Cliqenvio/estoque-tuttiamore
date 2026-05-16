import { SENHA_MASTER, USUARIOS_AUTORIZADOS } from './config.js';

const KEY_USUARIO = 'usuario_logado';

function buscarUsuario(email) {
    const e = email.trim().toLowerCase();
    return USUARIOS_AUTORIZADOS.find(u => u.email.toLowerCase() === e) || null;
}

export function checarHorarioPermitido(usuario) {
    if (!usuario?.restricaoHorario) return;
    const hora = new Date().getHours();
    const { inicio, fim } = usuario.restricaoHorario;
    if (hora < inicio || hora >= fim) {
        throw new Error(
            `Acesso permitido apenas das ${String(inicio).padStart(2, '0')}h às ${String(fim).padStart(2, '0')}h.`
        );
    }
}

export function login(email, senha) {
    const user = buscarUsuario(email);
    if (!user) throw new Error('Email não autorizado.');
    if (senha !== SENHA_MASTER) throw new Error('Senha incorreta.');
    checarHorarioPermitido(user);
    localStorage.setItem(KEY_USUARIO, user.email);
    return user;
}

export function logout() {
    localStorage.removeItem(KEY_USUARIO);
}

export function usuarioAtual() {
    const email = localStorage.getItem(KEY_USUARIO);
    if (!email) return null;
    return buscarUsuario(email);
}

export function estaLogado() {
    return !!usuarioAtual();
}
