// Gerencia sessões de bipagem em lote — relatório de contagem e recebimento de mercadoria.
// Cada tipo tem sua própria sessão persistida em localStorage (uma ativa por tipo, KISS).

// detalheAjuste: inclui no CSV as colunas de correção de EAN (usado no recebimento)
function criarStoreSessao({ chave, titulo, colunaQtd, prefixoArquivo, detalheAjuste = false }) {

    function ler() {
        try {
            const raw = localStorage.getItem(chave);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    function salvar(sessao) {
        localStorage.setItem(chave, JSON.stringify(sessao));
    }

    function sessaoAtiva() {
        return ler();
    }

    function temSessao() {
        return !!ler();
    }

    // extra.referencia: texto livre opcional (ex.: nota fiscal/fornecedor no recebimento)
    function iniciarSessao(usuarioEmail, usuarioNome, extra = {}) {
        const sessao = {
            id: `sessao_${Date.now()}`,
            criadoEm: new Date().toISOString(),
            criadoPor: { email: usuarioEmail, nome: usuarioNome },
            referencia: extra.referencia || '',
            itens: {},     // { [produtoId]: { id, sku, gtin, nome, imagemUrl, quantidade } }
            pendentes: [], // [{ ean, ts }] — EANs bipados sem produto cadastrado
        };
        salvar(sessao);
        return sessao;
    }

    function encerrarSessao() {
        localStorage.removeItem(chave);
    }

    // Conta um produto encontrado (soma +1, ou cria entrada se for o primeiro bipe).
    // codigoBipado: o código que foi lido fisicamente (útil pra corrigir EAN depois).
    function contarProduto(produto, codigoBipado = '') {
        const s = ler();
        if (!s) throw new Error('Nenhuma sessão ativa');
        const existente = s.itens[produto.id];
        if (existente) {
            existente.quantidade += 1;
            if (codigoBipado) existente.codigoBipado = codigoBipado;
        } else {
            s.itens[produto.id] = {
                id: produto.id,
                sku: produto.sku || '',
                gtin: produto.gtin || '',
                nome: produto.nome || '',
                imagemUrl: produto.imagemUrl || null,
                quantidade: 1,
                ajustarEan: false,
                codigoBipado: codigoBipado || '',
            };
        }
        salvar(s);
        return s.itens[produto.id];
    }

    // Marca/desmarca um item pra corrigir o EAN cadastrado na Loja Integrada depois.
    function marcarAjusteEan(produtoId, marcado) {
        const s = ler();
        if (!s || !s.itens[produtoId]) return;
        s.itens[produtoId].ajustarEan = !!marcado;
        salvar(s);
    }

    // Edita manualmente a quantidade contada (ex.: usuário corrigindo)
    function ajustarQuantidade(produtoId, novaQuantidade) {
        const s = ler();
        if (!s) throw new Error('Nenhuma sessão ativa');
        const item = s.itens[produtoId];
        if (!item) throw new Error('Produto não está na contagem');
        const qtd = Math.max(0, Math.floor(Number(novaQuantidade) || 0));
        if (qtd === 0) {
            delete s.itens[produtoId];
        } else {
            item.quantidade = qtd;
        }
        salvar(s);
    }

    // Preenche a imagem de um item já contado (carregada em background)
    function atualizarImagemItem(produtoId, imagemUrl) {
        const s = ler();
        if (!s || !s.itens[produtoId]) return;
        s.itens[produtoId].imagemUrl = imagemUrl;
        salvar(s);
    }

    // Marca um EAN como pendente (não encontrado no cache)
    function adicionarPendente(ean) {
        const s = ler();
        if (!s) throw new Error('Nenhuma sessão ativa');
        if (!s.pendentes.some(p => p.ean === ean)) {
            s.pendentes.push({ ean, ts: new Date().toISOString() });
            salvar(s);
        }
    }

    function removerPendente(ean) {
        const s = ler();
        if (!s) return;
        s.pendentes = s.pendentes.filter(p => p.ean !== ean);
        salvar(s);
    }

    function listarItens() {
        const s = ler();
        if (!s) return [];
        return Object.values(s.itens).sort((a, b) => a.nome.localeCompare(b.nome));
    }

    function listarPendentes() {
        const s = ler();
        return s?.pendentes || [];
    }

    function totalUnidades() {
        return listarItens().reduce((acc, i) => acc + i.quantidade, 0);
    }

    // Gera CSV (BOM + cabeçalho + linhas)
    function gerarCsv() {
        const s = ler();
        if (!s) return '';
        const cabecalho = detalheAjuste
            ? `SKU,EAN,Nome,${colunaQtd},Corrigir EAN,Código bipado`
            : `SKU,EAN,Nome,${colunaQtd}`;
        const linhas = [cabecalho];
        for (const item of listarItens()) {
            const nome = String(item.nome).replace(/"/g, '""');
            if (detalheAjuste) {
                linhas.push(`"${item.sku}","${item.gtin}","${nome}",${item.quantidade},${item.ajustarEan ? 'SIM' : ''},"${item.codigoBipado || ''}"`);
            } else {
                linhas.push(`"${item.sku}","${item.gtin}","${nome}",${item.quantidade}`);
            }
        }
        if (s.pendentes.length > 0) {
            linhas.push('');
            linhas.push('# EANs pendentes (não associados a produto):');
            for (const p of s.pendentes) {
                linhas.push(`"${p.ean}"`);
            }
        }
        if (s.referencia) {
            linhas.push('');
            linhas.push(`# Referência: ${String(s.referencia).replace(/"/g, '""')}`);
        }
        return '﻿' + linhas.join('\n');
    }

    function gerarResumoTexto() {
        const s = ler();
        if (!s) return '';
        const itens = listarItens();
        const linhas = [
            `${titulo} — ${new Date(s.criadoEm).toLocaleString('pt-BR')}`,
            `Por: ${s.criadoPor?.nome || s.criadoPor?.email}`,
        ];
        if (s.referencia) linhas.push(`Referência: ${s.referencia}`);
        linhas.push(
            ``,
            `Total: ${itens.length} produtos · ${totalUnidades()} unidades`,
            ``,
            ...itens.map(i => `${i.quantidade}x ${i.sku} — ${i.nome}${i.ajustarEan ? ' ⚠️' : ''}`),
        );
        const corrigir = itens.filter(i => i.ajustarEan);
        if (corrigir.length > 0) {
            linhas.push('');
            linhas.push(`⚠️ Corrigir EAN cadastrado (${corrigir.length}):`);
            linhas.push(...corrigir.map(i => `· ${i.sku} — ${i.nome}${i.codigoBipado ? ` (bipado: ${i.codigoBipado})` : ''}`));
        }
        if (s.pendentes.length > 0) {
            linhas.push('');
            linhas.push(`EANs pendentes (${s.pendentes.length}):`);
            linhas.push(...s.pendentes.map(p => `· ${p.ean}`));
        }
        return linhas.join('\n');
    }

    function baixarCsv() {
        const csv = gerarCsv();
        const s = ler();
        const data = new Date(s.criadoEm).toISOString().slice(0, 16).replace(/[:T]/g, '-');
        const nomeArquivo = `${prefixoArquivo}_${data}.csv`;
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

    async function compartilhar() {
        const texto = gerarResumoTexto();
        if (navigator.share) {
            try {
                await navigator.share({ title: titulo, text: texto });
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

    return {
        sessaoAtiva,
        temSessao,
        iniciarSessao,
        encerrarSessao,
        contarProduto,
        marcarAjusteEan,
        ajustarQuantidade,
        atualizarImagemItem,
        adicionarPendente,
        removerPendente,
        listarItens,
        listarPendentes,
        totalUnidades,
        gerarCsv,
        gerarResumoTexto,
        baixarCsv,
        compartilhar,
    };
}

// Relatório de contagem: SUBSTITUI o estoque na gravação final (fluxo já existente).
// Mantém a mesma chave de localStorage de antes — sessões em andamento sobrevivem à atualização.
export const relatorio = criarStoreSessao({
    chave: 'relatorio_ativo',
    titulo: 'Relatório de contagem',
    colunaQtd: 'Quantidade contada',
    prefixoArquivo: 'relatorio',
});

// Recebimento de mercadoria: SÓ gera relatório — nunca altera estoque na Loja Integrada.
export const recebimento = criarStoreSessao({
    chave: 'recebimento_ativo',
    titulo: 'Recebimento de mercadoria',
    colunaQtd: 'Quantidade recebida',
    prefixoArquivo: 'recebimento',
    detalheAjuste: true,
});
