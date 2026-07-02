// Sons de feedback da bipagem, gerados via Web Audio (sem arquivos de áudio).
// Sucesso: 1 beep agudo curto. Erro: 2 beeps graves.
// O AudioContext precisa de um gesto do usuário pra destravar — chamar
// destravarAudio() dentro de um clique/tecla garante isso.

let ctx = null;

function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}

function beep(freq, duracaoMs, { volume = 0.15, atrasoMs = 0 } = {}) {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(c.destination);

    const t0 = c.currentTime + atrasoMs / 1000;
    const t1 = t0 + duracaoMs / 1000;
    gain.gain.setValueAtTime(volume, t0);
    // Fade out rápido no final pra não estalar
    gain.gain.setValueAtTime(volume, Math.max(t0, t1 - 0.02));
    gain.gain.linearRampToValueAtTime(0.0001, t1);
    osc.start(t0);
    osc.stop(t1 + 0.02);
}

export function destravarAudio() {
    try { getCtx(); } catch { /* áudio indisponível — segue sem som */ }
}

export function somSucesso() {
    try { beep(1200, 90); } catch { /* sem som, não quebra a bipagem */ }
}

export function somErro() {
    try {
        beep(260, 200);
        beep(180, 260, { atrasoMs: 230 });
    } catch { /* sem som, não quebra a bipagem */ }
}
