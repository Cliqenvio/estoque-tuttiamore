// Sincronização do recebimento na nuvem (Cloudflare Worker + KV).
// Permite continuar um recebimento em outro aparelho pelo código da sessão.
// Dado de baixa sensibilidade (SKUs + quantidades); acesso pelo código do recebimento.

const WORKER_URL = 'https://estoque-tuttiamore-sync.cliqsolutions.workers.dev';

export function nuvemDisponivel() {
    return !!WORKER_URL;
}

// Identificador fixo deste aparelho — usado pra saber quando OUTRO aparelho assumiu.
export function deviceId() {
    let id = localStorage.getItem('device_id');
    if (!id) {
        id = 'd' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('device_id', id);
    }
    return id;
}

// Código curto, legível, sem caracteres ambíguos (0/O, 1/I).
export function gerarCodigo() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c = '';
    for (let i = 0; i < 5; i++) c += abc[Math.floor(Math.random() * abc.length)];
    return c;
}

// Envia a sessão pra nuvem. expectedRev = versão que este aparelho tinha (null = forçar).
// Retorna { ok, rev, atualizadoEm } ou { conflito: true, remoto } se outro aparelho salvou por cima.
export async function enviarSessaoNuvem(codigo, sessao, expectedRev) {
    const res = await fetch(`${WORKER_URL}/s/${encodeURIComponent(codigo)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessao, device: deviceId(), expectedRev: expectedRev ?? null }),
    });
    if (res.status === 409) {
        const d = await res.json().catch(() => ({}));
        return { conflito: true, remoto: d.remoto || null };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    return { ok: true, rev: d.rev, atualizadoEm: d.atualizadoEm };
}

// Baixa a sessão de um código. Retorna { sessao, rev, device, atualizadoEm } ou null se não existe.
export async function baixarSessaoNuvem(codigo) {
    const res = await fetch(`${WORKER_URL}/s/${encodeURIComponent(codigo)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
}
