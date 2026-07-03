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
            itens: {},     // { [produtoId]: { id, sku, gtin, nome, imagemUrl, quantidade, ordem } }
            pendentes: [], // [{ ean, ts, quantidade }] — EANs bipados sem produto cadastrado
            seq: 0,        // contador crescente: define a ordem "último bipado primeiro"
        };
        salvar(sessao);
        return sessao;
    }

    function encerrarSessao() {
        localStorage.removeItem(chave);
    }

    // Conta um produto encontrado (soma quantidade, ou cria entrada se for o primeiro bipe).
    // codigoBipado: o código que foi lido fisicamente (útil pra corrigir EAN depois).
    // quantidade: quanto somar (default 1; usado ao associar um pendente bipado N vezes).
    function contarProduto(produto, codigoBipado = '', quantidade = 1) {
        const s = ler();
        if (!s) throw new Error('Nenhuma sessão ativa');
        s.seq = (s.seq || 0) + 1; // marca este bipe como o mais recente
        const existente = s.itens[produto.id];
        if (existente) {
            existente.quantidade += quantidade;
            existente.ordem = s.seq; // sobe pro topo — foi o último bipado
            if (codigoBipado) existente.codigoBipado = codigoBipado;
        } else {
            s.itens[produto.id] = {
                id: produto.id,
                sku: produto.sku || '',
                gtin: produto.gtin || '',
                nome: produto.nome || '',
                imagemUrl: produto.imagemUrl || null,
                quantidade,
                ajustarEan: false,
                codigoBipado: codigoBipado || '',
                ordem: s.seq,
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

    // Registra um EAN não encontrado no catálogo (soma a quantidade a cada bipe)
    function adicionarPendente(ean) {
        const s = ler();
        if (!s) throw new Error('Nenhuma sessão ativa');
        let p = s.pendentes.find(x => x.ean === ean);
        if (p) {
            p.quantidade = (p.quantidade || 1) + 1;
        } else {
            p = { ean, ts: new Date().toISOString(), quantidade: 1 };
            s.pendentes.push(p);
        }
        salvar(s);
        return p;
    }

    function removerPendente(ean) {
        const s = ler();
        if (!s) return;
        s.pendentes = s.pendentes.filter(p => p.ean !== ean);
        salvar(s);
    }

    // ordem: 'recente' (default) → último bipado no topo; 'nome' → alfabético
    function listarItens(ordem = 'recente') {
        const s = ler();
        if (!s) return [];
        const itens = Object.values(s.itens);
        if (ordem === 'nome') {
            return itens.sort((a, b) => a.nome.localeCompare(b.nome));
        }
        return itens.sort((a, b) => (b.ordem || 0) - (a.ordem || 0));
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
        for (const item of listarItens('nome')) {
            const nome = String(item.nome).replace(/"/g, '""');
            if (detalheAjuste) {
                linhas.push(`"${item.sku}","${item.gtin}","${nome}",${item.quantidade},${item.ajustarEan ? 'SIM' : ''},"${item.codigoBipado || ''}"`);
            } else {
                linhas.push(`"${item.sku}","${item.gtin}","${nome}",${item.quantidade}`);
            }
        }
        if (s.pendentes.length > 0) {
            linhas.push('');
            linhas.push('# EANs não encontrados (código,quantidade bipada):');
            for (const p of s.pendentes) {
                linhas.push(`"${p.ean}",${p.quantidade || 1}`);
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
        const itens = listarItens('nome');
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
            linhas.push(`EANs não encontrados (${s.pendentes.length}):`);
            linhas.push(...s.pendentes.map(p => `· ${p.ean} (${p.quantidade || 1}x)`));
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
