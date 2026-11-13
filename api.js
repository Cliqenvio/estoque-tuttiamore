const BASE_URL = 'https://api.awsli.com.br/v1';

// Duas formas de acesso à Loja Integrada:
//  - TOKEN PESSOAL (atual, desde out/2026): vai no cabeçalho "Authorization: Basic <token>".
//  - chave_api + chave_aplicacao (formato antigo): vão na URL.
// Se houver token salvo, ele tem prioridade.
export function getAutenticacaoLI() {
    const token = localStorage.getItem('li_token');
    if (token) return { headers: { Authorization: `Basic ${token}` }, query: {} };
    const chaveApi = localStorage.getItem('chave_api');
    const chaveApp = localStorage.getItem('chave_aplicacao');
    if (!chaveApi || !chaveApp) {
        throw new Error('Credenciais não configuradas');
    }
    return { headers: {}, query: { chave_api: chaveApi, chave_aplicacao: chaveApp } };
}

function montarUrl(path, params = {}, query = {}) {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return url.toString();
}

async function requisitar(path, options = {}) {
    const auth = getAutenticacaoLI();
    const url = montarUrl(path, options.params || {}, auth.query);
    const res = await fetch(url, {
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...auth.headers },
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
    localStorage.removeItem('li_token');
}

// Token pessoal da Loja Integrada. Aceita com ou sem o "Basic " na frente.
export function salvarTokenPessoal(token) {
    const limpo = token.trim().replace(/^basic\s+/i, '').replace(/\s+/g, '');
    localStorage.setItem('li_token', limpo);
    localStorage.removeItem('chave_api');
    localStorage.removeItem('chave_aplicacao');
}

export function temCredenciais() {
    return !!(localStorage.getItem('li_token') ||
        (localStorage.getItem('chave_api') && localStorage.getItem('chave_aplicacao')));
}

export function limparCredenciais() {
    localStorage.removeItem('li_token');
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

// Busca só os dados básicos do produto (1 request, sem estoque).
// Usado pra foto do card de bipagem — mais leve que getDetalheProduto (que faz 2 requests).
export async function getFotoProduto(produtoId) {
    const p = await requisitar(`/produto/${produtoId}/`);
    return {
        imagemPequenaUrl: p.imagem_principal?.pequena || p.imagem_principal?.media || null,
        imagemGrandeUrl: p.imagem_principal?.grande || p.imagem_principal?.media || p.imagem_principal?.pequena || null,
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

export function calcularNovaQuantidade(atual, acao, valor) {
    const v = Number(valor);
    if (Number.isNaN(v) || v < 0) throw new Error('Quantidade inválida');
    if (acao === 'somar') return atual + v;
    if (acao === 'subtrair') return Math.max(0, atual - v);
    if (acao === 'definir') return v;
    throw new Error('Ação desconhecida');
}
