// Cofre na nuvem das sessões de recebimento do app Estoque Bipagem.
// Guarda um JSON por código (ex.: "R7K2") num banco chave-valor (KV).
// Segurança: dado de baixa sensibilidade (SKUs + quantidades). O acesso é pelo
// código do recebimento — quem não sabe o código, não lê. Sem segredo no repo.

const TTL_SEGUNDOS = 60 * 60 * 24 * 30; // sessões expiram sozinhas em 30 dias
const CODIGO_RE = /^[A-Z0-9]{4,8}$/;
const MAX_BODY = 512 * 1024;            // 512 KB por sessão (folga enorme)

const ORIGENS_OK = [
    'https://cliqenvio.github.io',
];

function cors(request) {
    const origin = request.headers.get('Origin') || '';
    const permitido = ORIGENS_OK.includes(origin)
        || origin.startsWith('http://localhost')
        || origin.startsWith('http://127.0.0.1');
    return {
        'Access-Control-Allow-Origin': permitido ? origin : ORIGENS_OK[0],
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    };
}

function json(obj, status, headersCors) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json', ...headersCors },
    });
}

export default {
    async fetch(request, env) {
        const headersCors = cors(request);
        if (request.method === 'OPTIONS') return new Response(null, { headers: headersCors });

        const url = new URL(request.url);
        if (url.pathname === '/' || url.pathname === '/health') {
            return json({ ok: true, servico: 'estoque-tuttiamore-sync' }, 200, headersCors);
        }

        const m = url.pathname.match(/^\/s\/([^/]+)$/);
        if (!m) return json({ error: 'rota não encontrada' }, 404, headersCors);
        const codigo = decodeURIComponent(m[1]).toUpperCase();
        if (!CODIGO_RE.test(codigo)) return json({ error: 'código inválido' }, 400, headersCors);

        const chave = 's:' + codigo;

        if (request.method === 'GET') {
            const raw = await env.SESSOES.get(chave);
            if (!raw) return json({ error: 'não encontrado' }, 404, headersCors);
            return new Response(raw, { headers: { 'Content-Type': 'application/json', ...headersCors } });
        }

        if (request.method === 'PUT') {
            const tamanho = Number(request.headers.get('content-length') || 0);
            if (tamanho > MAX_BODY) return json({ error: 'sessão grande demais' }, 413, headersCors);

            let body;
            try { body = await request.json(); }
            catch { return json({ error: 'json inválido' }, 400, headersCors); }
            if (!body || typeof body.sessao !== 'object' || body.sessao === null) {
                return json({ error: 'faltou o campo sessao' }, 400, headersCors);
            }

            const atualRaw = await env.SESSOES.get(chave);
            const atual = atualRaw ? JSON.parse(atualRaw) : null;

            // Controle de versão otimista: se já existe uma versão diferente da que
            // este aparelho tinha, é porque OUTRO aparelho salvou por cima → conflito.
            // expectedRev = null significa "forçar" (primeira gravação / retomada).
            const expectedRev = (body.expectedRev === undefined) ? null : body.expectedRev;
            if (atual && expectedRev !== null && atual.rev !== expectedRev) {
                return json({ conflito: true, remoto: atual }, 409, headersCors);
            }

            const doc = {
                sessao: body.sessao,
                rev: (atual?.rev || 0) + 1,
                device: String(body.device || 'desconhecido').slice(0, 60),
                atualizadoEm: new Date().toISOString(),
            };
            await env.SESSOES.put(chave, JSON.stringify(doc), { expirationTtl: TTL_SEGUNDOS });
            return json({ ok: true, rev: doc.rev, atualizadoEm: doc.atualizadoEm }, 200, headersCors);
        }

        return json({ error: 'método não suportado' }, 405, headersCors);
    },
};
