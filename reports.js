// Gerencia sessões de relatório (contagem em lote).
// Apenas uma sessão ativa por vez (KISS). Persistida em localStorage.

const KEY_SESSAO = 'relatorio_ativo';

function lerSessao() {
    try {
        const raw = localStorage.getItem(KEY_SESSAO);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function salvarSessao(sessao) {
    localStorage.setItem(KEY_SESSAO, JSON.stringify(sessao));
}

export function sessaoAtiva() {
    return lerSessao();
}

export function temSessao() {
    return !!lerSessao();
}

export function iniciarSessao(usuarioEmail, usuarioNome) {
    const sessao = {
        id: `sessao_${Date.now()}`,
        criadoEm: new Date().toISOString(),
        criadoPor: { email: usuarioEmail, nome: usuarioNome },
        itens: {},     // { [produtoId]: { id, sku, gtin, nome, imagemUrl, quantidade } }
        pendentes: [], // [{ ean, ts }] — EANs bipados sem produto cadastrado
    };
    salvarSessao(sessao);
    return sessao;
}

export function encerrarSessao() {
    localStorage.removeItem(KEY_SESSAO);
}

// Conta um produto encontrado (soma +1, ou cria entrada se for o primeiro bipe).
export function contarProduto(produto) {
    const s = lerSessao();
    if (!s) throw new Error('Nenhuma sessão ativa');
    const existente = s.itens[produto.id];
    if (existente) {
        existente.quantidade += 1;
    } else {
        s.itens[produto.id] = {
            id: produto.id,
            sku: produto.sku || '',
            gtin: produto.gtin || '',
            nome: produto.nome || '',
            imagemUrl: produto.imagemUrl || null,
            quantidade: 1,
        };
    }
    salvarSessao(s);
    return s.itens[produto.id];
}

// Edita manualmente a quantidade contada (ex.: usuário corrigindo)
export function ajustarQuantidade(produtoId, novaQuantidade) {
    const s = lerSessao();
    if (!s) throw new Error('Nenhuma sessão ativa');
    const item = s.itens[produtoId];
    if (!item) throw new Error('Produto não está na contagem');
    const qtd = Math.max(0, Math.floor(Number(novaQuantidade) || 0));
    if (qtd === 0) {
        delete s.itens[produtoId];
    } else {
        item.quantidade = qtd;
    }
    salvarSessao(s);
}

// Marca um EAN como pendente (não encontrado no cache)
export function adicionarPendente(ean) {
    const s = lerSessao();
    if (!s) throw new Error('Nenhuma sessão ativa');
    if (!s.pendentes.some(p => p.ean === ean)) {
        s.pendentes.push({ ean, ts: new Date().toISOString() });
        salvarSessao(s);
    }
}

export function removerPendente(ean) {
    const s = lerSessao();
    if (!s) return;
    s.pendentes = s.pendentes.filter(p => p.ean !== ean);
    salvarSessao(s);
}

export function listarItens() {
    const s = lerSessao();
    if (!s) return [];
    return Object.values(s.itens).sort((a, b) => a.nome.localeCompare(b.nome));
}

export function listarPendentes() {
    const s = lerSessao();
    return s?.pendentes || [];
}

export function totalUnidades() {
    const itens = listarItens();
    return itens.reduce((acc, i) => acc + i.quantidade, 0);
}

// Gera CSV (BOM + cabeçalho + linhas)
export function gerarCsv() {
    const s = lerSessao();
    if (!s) return '';
    const linhas = ['SKU,EAN,Nome,Quantidade contada'];
    for (const item of listarItens()) {
        const nome = String(item.nome).replace(/"/g, '""');
        linhas.push(`"${item.sku}","${item.gtin}","${nome}",${item.quantidade}`);
    }
    if (s.pendentes.length > 0) {
        linhas.push('');
        linhas.push('# EANs pendentes (não associados a produto):');
        for (const p of s.pendentes) {
            linhas.push(`"${p.ean}"`);
        }
    }
    return '﻿' + linhas.join('\n');
}

export function gerarResumoTexto() {
    const s = lerSessao();
    if (!s) return '';
    const itens = listarItens();
    const linhas = [
        `Relatório de contagem — ${new Date(s.criadoEm).toLocaleString('pt-BR')}`,
        `Por: ${s.criadoPor?.nome || s.criadoPor?.email}`,
        ``,
        `Total: ${itens.length} produtos · ${totalUnidades()} unidades`,
        ``,
        ...itens.map(i => `${i.quantidade}x ${i.sku} — ${i.nome}`),
    ];
    if (s.pendentes.length > 0) {
        linhas.push('');
        linhas.push(`EANs pendentes (${s.pendentes.length}):`);
        linhas.push(...s.pendentes.map(p => `· ${p.ean}`));
    }
    return linhas.join('\n');
}

export function baixarCsv() {
    const csv = gerarCsv();
    const s = lerSessao();
    const data = new Date(s.criadoEm).toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const nomeArquivo = `relatorio_${data}.csv`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function compartilhar() {
    const texto = gerarResumoTexto();
    if (navigator.share) {
        try {
            await navigator.share({ title: 'Relatório de contagem', text: texto });
            return { ok: true };
        } catch (e) {
            if (e.name === 'AbortError') return { ok: false, abort: true };
            return { ok: false, error: e.message };
        }
    }
    // Fallback: copia pra área de transferência
    try {
        await navigator.clipboard.writeText(texto);
        return { ok: true, copiado: true };
    } catch (e) {
        return { ok: false, error: 'Não foi possível compartilhar.' };
    }
}
