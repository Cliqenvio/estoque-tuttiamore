// Leitor de código de barras físico (USB/Bluetooth em modo teclado/HID).
// O leitor "digita" os caracteres muito rápido e finaliza com Enter (ou Tab).
// Estratégia: escutar o teclado global — uma sequência rápida de teclas terminada
// em Enter é tratada como bipagem, sem precisar de nenhum campo focado na tela.

const INTERVALO_MAX_MS = 150; // acima disso entre teclas, considera digitação humana e zera
const TAMANHO_MINIMO = 3;     // códigos menores que isso não são tratados como bipagem

let buffer = '';
let ultimaTecla = 0;
let handler = null;

function ehCampoDeTexto(el) {
    if (!el) return false;
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

document.addEventListener('keydown', (e) => {
    if (!handler) return;
    // Se um campo está focado, deixa o próprio campo tratar
    // (o Enter dos campos manuais já dispara a busca)
    if (ehCampoDeTexto(document.activeElement)) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    const agora = Date.now();
    if (agora - ultimaTecla > INTERVALO_MAX_MS) buffer = '';
    ultimaTecla = agora;

    if (e.key === 'Enter' || e.key === 'Tab') {
        if (buffer.length >= TAMANHO_MINIMO) {
            const codigo = buffer;
            buffer = '';
            e.preventDefault();
            handler(codigo);
        } else {
            buffer = '';
        }
        return;
    }

    if (e.key.length === 1) {
        buffer += e.key;
        e.preventDefault(); // evita scroll/atalhos disparados pelas teclas do leitor
    }
});

// Registra o handler global de bipagem física. O roteamento por tela fica no app.js.
export function aoBipeFisico(fn) {
    handler = fn;
}
