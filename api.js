const BASE_URL = 'https://api.awsli.com.br/v1';

function getCredenciais() {
    const chaveApi = localStorage.getItem('chave_api');
    const chaveApp = localStorage.getItem('chave_aplicacao');
    if (!chaveApi || !chaveApp) {
        throw new Error('Credenciais não configuradas');
    }
    return { chaveApi, chaveApp };
}

function montarUrl(path, params = {}) {
    const { chaveApi, chaveApp } = getCredenciais();
    const url = new URL(`${BASE_URL}${path}`);
    url.searchParams.set('chave_api', chaveApi);
    url.searchParams.set('chave_aplicacao', chaveApp);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return url.toString();
}

async function requisitar(path, options = {}) {
    const url = montarUrl(path, options.params || {});
    const res = await fetch(url, {
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const texto = await res.text();
    let dados;
    try { dados = texto ? JSON.parse(texto) : {}; } catch { dados = { raw: texto }; }
    if (!res.ok) {
        const msg = dados?.Message || dados?.error_message || dados?.error || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return dados;
}

export function salvarCredenciais(chaveApi, chaveApp) {
    localStorage.setItem('chave_api', chaveApi.trim());
    localStorage.setItem('chave_aplicacao', chaveApp.trim());
}

export function temCredenciais() {
    return !!(localStorage.getItem('chave_api') && localStorage.getItem('chave_aplicacao'));
}

export function limparCredenciais() {
    localStorage.removeItem('chave_api');
    localStorage.removeItem('chave_aplicacao');
}

// Busca o detalhe completo de um produto (em paralelo: dados + estoque).
// O endpoint /produto_estoque/<id>/ usa o ID DO PRODUTO no path.
// Retorna: { id, sku, gtin, nome, imagemUrl, estoqueGerenciado, estoqueQuantidade, estoqueRaw }
export async function getDetalheProduto(produtoId) {
    const [p, e] = await Promise.all([
        requisitar(`/produto/${produtoId}/`),
        requisitar(`/produto_estoque/${produtoId}/`),
    ]);
    return {
        id: p.id,
        sku: p.sku,
        gtin: p.gtin,
        nome: p.nome,
        imagemUrl: p.imagem_principal?.pequena || p.imagem_principal?.media || null,
        estoqueGerenciado: !!e.gerenciado,
        estoqueQuantidade: Number(e.quantidade ?? 0),
        estoqueRaw: e,
    };
}

// Atualiza o estoque via PUT /produto_estoque/<id_do_produto>/
// PUT exige o objeto completo. Recebe `estoqueAnterior` (que veio de getDetalheProduto.estoqueRaw)
// e reenvia tudo trocando só a quantidade.
export async function atualizarEstoqueProduto(produtoId, novaQuantidade, estoqueAnterior) {
    const body = { ...estoqueAnterior, quantidade: novaQuantidade };
    return await requisitar(`/produto_estoque/${produtoId}/`, {
        method: 'PUT',
        body,
    });
}

// Atualiza o GTIN/EAN de um produto via PUT /produto/<id>/
// PUT funciona como merge na Loja Integrada (não exige objeto inteiro).
export async function atualizarGtinProduto(produtoId, novoGtin) {
    return await requisitar(`/produto/${produtoId}/`, {
        method: 'PUT',
        body: { gtin: novoGtin },
    });
}

export function salvarClaudeApiKey(key) {
    localStorage.setItem('claude_api_key', key.trim());
}

export function getClaudeApiKey() {
    return localStorage.getItem('claude_api_key') || '';
}

export function temClaudeApiKey() {
    return !!localStorage.getItem('claude_api_key');
}

export function calcularNovaQuantidade(atual, acao, valor) {
    const v = Number(valor);
    if (Number.isNaN(v) || v < 0) throw new Error('Quantidade inválida');
    if (acao === 'somar') return atual + v;
    if (acao === 'subtrair') return Math.max(0, atual - v);
    if (acao === 'definir') return v;
    throw new Error('Ação desconhecida');
}
