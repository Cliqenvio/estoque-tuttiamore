// Cache local do catálogo de produtos (id, sku, gtin, nome).
// Imagem e estoque são buscados sob demanda — não ficam no cache.

const KEY_CATALOGO = 'catalogo_local';
const KEY_SYNC_AT = 'catalogo_sync_at';

function lerCatalogo() {
    try {
        const raw = localStorage.getItem(KEY_CATALOGO);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function salvarCatalogo(itens) {
    localStorage.setItem(KEY_CATALOGO, JSON.stringify(itens));
    localStorage.setItem(KEY_SYNC_AT, new Date().toISOString());
}

export function tamanhoCatalogo() {
    return lerCatalogo().length;
}

export function ultimaSync() {
    const iso = localStorage.getItem(KEY_SYNC_AT);
    return iso ? new Date(iso) : null;
}

export function buscarPorCodigo(codigo) {
    const c = codigo.trim();
    if (!c) return null;
    const itens = lerCatalogo();
    // Tenta GTIN exato primeiro (caso bipado)
    let match = itens.find((i) => i.gtin === c);
    if (match) return match;
    // Depois SKU exato (caso digitado)
    match = itens.find((i) => i.sku === c);
    return match || null;
}

function getCredenciais() {
    const chaveApi = localStorage.getItem('chave_api');
    const chaveApp = localStorage.getItem('chave_aplicacao');
    if (!chaveApi || !chaveApp) throw new Error('Credenciais não configuradas');
    return { chaveApi, chaveApp };
}

function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function buscarPagina(url) {
    const r = await fetch(url);
    const texto = await r.text();
    let dados;
    try { dados = texto ? JSON.parse(texto) : {}; } catch { dados = { raw: texto }; }
    if (!r.ok) {
        // Erro 633: limite de requisições por loja (100/min)
        const msg = dados?.Message || `HTTP ${r.status}`;
        if (dados?.Code === '633' || r.status === 429) {
            throw new Error('Limite de requisições por minuto atingido. Aguarde 1 minuto e tente novamente.');
        }
        throw new Error(msg);
    }
    return dados;
}

// Sincroniza o catálogo paginando a API. onProgress recebe { atual, total }.
// Throttle: 700ms entre chamadas (~85 req/min, abaixo do limite de 100/min por loja).
export async function sincronizarCatalogo(onProgress) {
    const { chaveApi, chaveApp } = getCredenciais();
    const BASE = 'https://api.awsli.com.br/v1';
    const LIMIT = 100;
    const DELAY_ENTRE_REQS_MS = 700;

    const montarUrl = (offset) =>
        `${BASE}/produto/?chave_api=${chaveApi}&chave_aplicacao=${chaveApp}&limit=${LIMIT}&offset=${offset}`;

    // Primeira chamada pra descobrir o total
    const d0 = await buscarPagina(montarUrl(0));
    const total = d0.meta?.total_count ?? d0.objects.length;
    let coletados = [];

    const adicionar = (objects) => {
        for (const p of objects) {
            if (!p.id) continue;
            coletados.push({
                id: p.id,
                sku: p.sku || '',
                gtin: p.gtin || '',
                nome: p.nome || '',
            });
        }
    };

    adicionar(d0.objects || []);
    if (onProgress) onProgress({ atual: coletados.length, total });

    // Paginar o resto com pausa entre cada request
    let offset = LIMIT;
    while (offset < total) {
        await esperar(DELAY_ENTRE_REQS_MS);
        const d = await buscarPagina(montarUrl(offset));
        adicionar(d.objects || []);
        offset += LIMIT;
        if (onProgress) onProgress({ atual: coletados.length, total });
    }

    salvarCatalogo(coletados);
    return { total: coletados.length };
}

export function limparCatalogo() {
    localStorage.removeItem(KEY_CATALOGO);
    localStorage.removeItem(KEY_SYNC_AT);
}
