import {
    salvarCredenciais,
    temCredenciais,
    getDetalheProduto,
    atualizarEstoqueProduto,
    atualizarGtinProduto,
    calcularNovaQuantidade,
} from './api.js';

import { iniciarScanner, pararScanner } from './scanner.js';
import { login, logout, usuarioAtual, estaLogado, checarHorarioPermitido } from './auth.js';
import {
    sincronizarCatalogo,
    buscarPorCodigo,
    buscarPorTermo,
    atualizarItemCache,
    tamanhoCatalogo,
    ultimaSync,
} from './catalog.js';
import {
    sessaoAtiva,
    temSessao,
    iniciarSessao,
    encerrarSessao,
    contarProduto,
    ajustarQuantidade,
    adicionarPendente,
    removerPendente,
    listarItens,
    listarPendentes,
    totalUnidades,
    baixarCsv,
    compartilhar,
} from './reports.js';

// ============ Refs de telas ============
const telas = {
    setup: document.getElementById('tela-setup'),
    login: document.getElementById('tela-login'),
    sync: document.getElementById('tela-sync'),
    scan: document.getElementById('tela-scan'),
    produto: document.getElementById('tela-produto'),
    mensagem: document.getElementById('tela-mensagem'),
    relatorio: document.getElementById('tela-relatorio'),
    'resumo-relatorio': document.getElementById('tela-resumo-relatorio'),
    'associar-ean': document.getElementById('tela-associar-ean'),
    gravando: document.getElementById('tela-gravando'),
};

const videoEl = document.getElementById('video-scanner');
const videoElRel = document.getElementById('video-scanner-rel');
const scanStatus = document.getElementById('scan-status');

// ============ Estado ============
let itemAtual = null;
let scannerAtivo = false;
let scannerAtivoEm = null; // 'scan' ou 'relatorio'
let ultimoCodigoLido = null;
let ultimoCodigoTimestamp = 0;
let eanPendenteAssociacao = null; // EAN que estamos tentando associar a um produto
let origemAssociarEan = null;     // 'scan' (ajuste pontual) ou 'relatorio'

// ============ Helpers ============
function mostrarTela(nome) {
    for (const [k, el] of Object.entries(telas)) {
        el.classList.toggle('hidden', k !== nome);
    }
    // Para o scanner se sair da tela onde ele está rodando
    if (scannerAtivo && scannerAtivoEm && nome !== scannerAtivoEm) {
        pararScanner();
        scannerAtivo = false;
        scannerAtivoEm = null;
    }
}

function setStatus(msg) { scanStatus.textContent = msg; }

function formatarTempoDesde(data) {
    if (!data) return 'nunca';
    const seg = Math.floor((Date.now() - data.getTime()) / 1000);
    if (seg < 60) return 'agora';
    const min = Math.floor(seg / 60);
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h}h`;
    return `há ${Math.floor(h / 24)}d`;
}

function atualizarInfoTopbar() {
    const u = usuarioAtual();
    document.getElementById('usuario-info').textContent = u ? `${u.nome} (${u.email})` : '';
    const total = tamanhoCatalogo();
    const sync = ultimaSync();
    document.getElementById('catalogo-info').textContent = total > 0
        ? `Catálogo: ${total} produtos · sync ${formatarTempoDesde(sync)}`
        : 'Catálogo vazio — sincronize antes de bipar';
}

function esperar(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============ Setup credenciais ============
document.getElementById('btn-salvar-credenciais').addEventListener('click', () => {
    const api = document.getElementById('input-chave-api').value.trim();
    const app = document.getElementById('input-chave-app').value.trim();
    if (!api || !app) { alert('Preencha as duas chaves.'); return; }
    salvarCredenciais(api, app);
    mostrarTela('login');
});

document.getElementById('btn-voltar-login').addEventListener('click', () => mostrarTela('login'));
document.getElementById('btn-ir-setup').addEventListener('click', () => mostrarTela('setup'));

// ============ Login ============
const inputEmail = document.getElementById('input-email');
const inputSenha = document.getElementById('input-senha');
const loginErro = document.getElementById('login-erro');

function mostrarErroLogin(msg) { loginErro.textContent = msg; loginErro.classList.remove('hidden'); }
function limparErroLogin() { loginErro.textContent = ''; loginErro.classList.add('hidden'); }

document.getElementById('btn-login').addEventListener('click', () => {
    limparErroLogin();
    try {
        if (!temCredenciais()) {
            mostrarErroLogin('Loja ainda não configurada. Peça ao admin.');
            return;
        }
        login(inputEmail.value, inputSenha.value);
        inputSenha.value = '';
        irAposLogin();
    } catch (err) {
        mostrarErroLogin(err.message);
    }
});

inputSenha.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-login').click();
});

document.getElementById('btn-sair').addEventListener('click', () => {
    logout();
    mostrarTela('login');
});

document.getElementById('btn-toggle-senha').addEventListener('click', () => {
    const input = document.getElementById('input-senha');
    const btn = document.getElementById('btn-toggle-senha');
    if (input.type === 'password') {
        input.type = 'text';
        input.classList.add('senha-visivel');
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        input.classList.remove('senha-visivel');
        btn.textContent = '👁';
    }
});

function irAposLogin() {
    if (tamanhoCatalogo() === 0) {
        mostrarTela('sync');
        atualizarSyncInfo();
    } else if (temSessao()) {
        // Tem sessão de relatório aberta — pergunta se continua
        if (confirm('Você tem uma sessão de relatório em andamento. Continuar?')) {
            irParaModoRelatorio();
        } else {
            encerrarSessao();
            irParaScan();
        }
    } else {
        irParaScan();
    }
}

// ============ Sincronização ============
const syncInfo = document.getElementById('sync-info');
const syncProgresso = document.getElementById('sync-progresso');
const syncProgressoBarra = document.getElementById('sync-progresso-barra');
const syncMensagem = document.getElementById('sync-mensagem');
const btnIniciarSync = document.getElementById('btn-iniciar-sync');
const btnSyncCompleto = document.getElementById('btn-sync-completo');
const btnPularSync = document.getElementById('btn-pular-sync');

function atualizarSyncInfo() {
    const total = tamanhoCatalogo();
    const sync = ultimaSync();
    if (total === 0) {
        syncInfo.textContent = 'Nenhum produto sincronizado ainda. Clique para baixar o catálogo.';
        btnIniciarSync.textContent = 'Sincronizar agora';
        btnPularSync.classList.add('hidden');
        btnSyncCompleto.classList.add('hidden');
    } else {
        syncInfo.textContent = `Você tem ${total.toLocaleString('pt-BR')} produtos no cache (última sync ${formatarTempoDesde(sync)}). Atualizar baixa só o que mudou desde então.`;
        btnIniciarSync.textContent = '🔄 Atualizar (só mudanças)';
        btnPularSync.classList.remove('hidden');
        btnSyncCompleto.classList.remove('hidden');
    }
    syncProgresso.classList.add('hidden');
    syncMensagem.textContent = '';
}

async function executarSync({ incremental }) {
    btnIniciarSync.disabled = true;
    btnSyncCompleto.disabled = true;
    btnPularSync.classList.add('hidden');
    syncProgresso.classList.remove('hidden');
    syncProgressoBarra.style.width = '0%';
    syncMensagem.textContent = incremental ? 'Buscando mudanças…' : 'Baixando catálogo completo…';

    try {
        const res = await sincronizarCatalogo(({ atual, total }) => {
            const pct = total > 0 ? Math.round((atual / total) * 100) : 100;
            syncProgressoBarra.style.width = pct + '%';
            syncMensagem.textContent = total === 0
                ? 'Nada a atualizar.'
                : `${atual.toLocaleString('pt-BR')} / ${total.toLocaleString('pt-BR')}`;
        }, { incremental });
        syncProgressoBarra.style.width = '100%';

        if (res.incremental) {
            syncMensagem.textContent = res.novosOuAlterados === 0
                ? `Tudo em dia! Catálogo: ${res.total.toLocaleString('pt-BR')} produtos.`
                : `Atualizado: ${res.novosOuAlterados.toLocaleString('pt-BR')} novos/alterados. Total no cache: ${res.total.toLocaleString('pt-BR')}.`;
        } else {
            syncMensagem.textContent = `Concluído: ${res.total.toLocaleString('pt-BR')} produtos.`;
        }
        atualizarInfoTopbar();
        setTimeout(() => irParaScan(), 1200);
    } catch (err) {
        syncMensagem.textContent = `Erro: ${err.message}`;
        btnIniciarSync.disabled = false;
        btnSyncCompleto.disabled = false;
        if (tamanhoCatalogo() > 0) btnPularSync.classList.remove('hidden');
    }
}

btnIniciarSync.addEventListener('click', () => {
    const incremental = tamanhoCatalogo() > 0 && !!ultimaSync();
    executarSync({ incremental });
});

btnSyncCompleto.addEventListener('click', () => {
    if (!confirm('Refazer do zero?\n\nBaixa todos os 7000+ produtos novamente (~1 min). Use só se suspeitar que o cache está com produtos removidos ou desatualizado.')) return;
    executarSync({ incremental: false });
});

btnPularSync.addEventListener('click', () => irParaScan());
document.getElementById('btn-ir-sync').addEventListener('click', () => {
    mostrarTela('sync');
    atualizarSyncInfo();
});

// ============ Scan (modo ajuste pontual) ============
async function irParaScan() {
    if (!estaLogado()) { mostrarTela('login'); return; }
    atualizarInfoTopbar();
    mostrarTela('scan');
    setStatus(tamanhoCatalogo() > 0 ? 'Aponte a câmera ou cole o código' : 'Catálogo vazio. Sincronize primeiro.');
    document.getElementById('input-sku-manual').value = '';

    try {
        scannerAtivo = true;
        scannerAtivoEm = 'scan';
        await iniciarScanner(videoEl, onCodigoBipado);
    } catch (err) {
        scannerAtivo = false;
        scannerAtivoEm = null;
        setStatus(`Câmera indisponível: ${err.message}. Use o campo abaixo.`);
    }
}

function onCodigoBipado(codigo) {
    const agora = Date.now();
    if (codigo === ultimoCodigoLido && agora - ultimoCodigoTimestamp < 3000) return;
    ultimoCodigoLido = codigo;
    ultimoCodigoTimestamp = agora;
    buscarEMostrarProduto(codigo);
}

document.getElementById('btn-buscar-manual').addEventListener('click', () => {
    const c = document.getElementById('input-sku-manual').value.trim();
    if (!c) return;
    buscarEMostrarProduto(c);
});

document.getElementById('input-sku-manual').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-buscar-manual').click();
});

async function buscarEMostrarProduto(codigo) {
    try { checarHorarioPermitido(usuarioAtual()); }
    catch (err) { logout(); mostrarMensagem('erro', 'Fora do horário', err.message); return; }

    setStatus(`Buscando ${codigo}…`);
    pararScanner();
    scannerAtivo = false;
    scannerAtivoEm = null;

    const itemLocal = buscarPorCodigo(codigo);
    if (!itemLocal) {
        // Código não está no cache — oferece associar a um produto existente
        eanPendenteAssociacao = codigo;
        origemAssociarEan = 'scan';
        irParaAssociarEan();
        return;
    }

    try {
        const detalhe = await getDetalheProduto(itemLocal.id);
        if (!detalhe.estoqueGerenciado) {
            mostrarMensagem('erro', 'Sem controle de estoque', `${detalhe.nome} não tem estoque gerenciado na Loja Integrada.`);
            return;
        }
        itemAtual = detalhe;
        renderizarProduto();
        mostrarTela('produto');
    } catch (err) {
        mostrarMensagem('erro', 'Erro ao buscar detalhe', err.message);
    }
}

function renderizarProduto() {
    document.getElementById('produto-nome').textContent = itemAtual.nome;
    document.getElementById('produto-sku').textContent = itemAtual.sku || '—';
    document.getElementById('produto-gtin').textContent = itemAtual.gtin || '—';
    document.getElementById('produto-estoque').textContent = itemAtual.estoqueQuantidade;
    document.getElementById('input-quantidade').value = 1;

    const img = document.getElementById('produto-imagem');
    const placeholder = document.getElementById('produto-imagem-placeholder');
    if (itemAtual.imagemUrl) {
        img.src = itemAtual.imagemUrl;
        img.classList.remove('hidden');
        placeholder.classList.add('hidden');
    } else {
        img.classList.add('hidden');
        placeholder.classList.remove('hidden');
    }
}

document.getElementById('btn-voltar-scan').addEventListener('click', () => irParaScan());

document.querySelectorAll('[data-acao]').forEach((btn) => {
    btn.addEventListener('click', () => executarAcao(btn.dataset.acao));
});

async function executarAcao(acao) {
    try { checarHorarioPermitido(usuarioAtual()); }
    catch (err) { logout(); mostrarMensagem('erro', 'Fora do horário', err.message); return; }

    const valor = document.getElementById('input-quantidade').value;
    let novaQtd;
    try { novaQtd = calcularNovaQuantidade(itemAtual.estoqueQuantidade, acao, valor); }
    catch (err) { alert(err.message); return; }

    const usuario = usuarioAtual();
    if (!confirm(
        `${usuario.nome}, confirmar?\n\nProduto: ${itemAtual.nome}\nEstoque: ${itemAtual.estoqueQuantidade} → ${novaQtd}`
    )) return;

    try {
        await atualizarEstoqueProduto(itemAtual.id, novaQtd, itemAtual.estoqueRaw);
        mostrarMensagem('sucesso', 'Estoque atualizado',
            `${itemAtual.nome}\nde ${itemAtual.estoqueQuantidade} → ${novaQtd}\n(por ${usuario.nome})`);
    } catch (err) {
        mostrarMensagem('erro', 'Falha ao atualizar', err.message);
    }
}

// ============ Mensagem ============
function mostrarMensagem(tipo, titulo, detalhe) {
    const icone = document.getElementById('mensagem-icone');
    icone.className = tipo;
    icone.textContent = tipo === 'sucesso' ? '✓' : '✕';
    document.getElementById('mensagem-titulo').textContent = titulo;
    document.getElementById('mensagem-detalhe').textContent = detalhe;
    mostrarTela('mensagem');
}

document.getElementById('btn-mensagem-continuar').addEventListener('click', () => {
    if (temSessao()) irParaModoRelatorio();
    else if (estaLogado()) irParaScan();
    else mostrarTela('login');
});

// ============ Modo relatório ============
const relatorioInfo = document.getElementById('relatorio-info');
const relatorioFeedback = document.getElementById('relatorio-feedback');
const relatorioLista = document.getElementById('relatorio-lista');

document.getElementById('btn-iniciar-relatorio').addEventListener('click', () => {
    const u = usuarioAtual();
    if (!u) { mostrarTela('login'); return; }
    if (tamanhoCatalogo() === 0) {
        alert('Catálogo vazio. Sincronize primeiro.');
        return;
    }
    iniciarSessao(u.email, u.nome);
    irParaModoRelatorio();
});

async function irParaModoRelatorio() {
    if (!estaLogado()) { mostrarTela('login'); return; }
    atualizarInfoRelatorio();
    renderizarListaRelatorio();
    mostrarTela('relatorio');
    document.getElementById('input-sku-relatorio').value = '';

    try {
        scannerAtivo = true;
        scannerAtivoEm = 'relatorio';
        await iniciarScanner(videoElRel, onCodigoBipadoRelatorio);
    } catch (err) {
        scannerAtivo = false;
        scannerAtivoEm = null;
        mostrarFeedback('erro', `Câmera indisponível: ${err.message}`);
    }
}

function atualizarInfoRelatorio() {
    const s = sessaoAtiva();
    if (!s) { relatorioInfo.textContent = ''; return; }
    const itens = listarItens();
    relatorioInfo.textContent = `${itens.length} produtos · ${totalUnidades()} unidades · por ${s.criadoPor?.nome || ''}`;
}

function mostrarFeedback(tipo, msg) {
    relatorioFeedback.className = `feedback-bipe ${tipo}`;
    relatorioFeedback.textContent = msg;
    relatorioFeedback.classList.remove('hidden');
    clearTimeout(mostrarFeedback._t);
    mostrarFeedback._t = setTimeout(() => relatorioFeedback.classList.add('hidden'), 3000);
}

function renderizarListaRelatorio() {
    const itens = listarItens();
    relatorioLista.innerHTML = '';
    if (itens.length === 0) {
        relatorioLista.innerHTML = '<p class="hint center">Nenhum produto contado ainda. Bipe um código pra começar.</p>';
        return;
    }
    for (const item of itens) {
        const row = document.createElement('div');
        row.className = 'rel-item';
        row.innerHTML = `
            <div class="rel-item-foto">${item.imagemUrl ? `<img src="${item.imagemUrl}" alt="">` : ''}</div>
            <div class="rel-item-info">
                <div class="rel-item-nome">${escapeHtml(item.nome)}</div>
                <div class="rel-item-sku">${escapeHtml(item.sku)} · ${escapeHtml(item.gtin || '—')}</div>
            </div>
            <div class="rel-item-qtd">
                <button class="rel-qtd-btn" data-id="${item.id}" data-d="-1">−</button>
                <span>${item.quantidade}</span>
                <button class="rel-qtd-btn" data-id="${item.id}" data-d="+1">+</button>
            </div>
        `;
        relatorioLista.appendChild(row);
    }
    relatorioLista.querySelectorAll('.rel-qtd-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.id);
            const d = Number(btn.dataset.d);
            const item = listarItens().find(i => i.id === id);
            if (!item) return;
            ajustarQuantidade(id, item.quantidade + d);
            renderizarListaRelatorio();
            atualizarInfoRelatorio();
        });
    });
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function onCodigoBipadoRelatorio(codigo) {
    const agora = Date.now();
    if (codigo === ultimoCodigoLido && agora - ultimoCodigoTimestamp < 1500) return;
    ultimoCodigoLido = codigo;
    ultimoCodigoTimestamp = agora;
    processarBipeRelatorio(codigo);
}

document.getElementById('btn-buscar-relatorio').addEventListener('click', () => {
    const c = document.getElementById('input-sku-relatorio').value.trim();
    if (!c) return;
    document.getElementById('input-sku-relatorio').value = '';
    processarBipeRelatorio(c);
});

document.getElementById('input-sku-relatorio').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-buscar-relatorio').click();
});

async function processarBipeRelatorio(codigo) {
    try { checarHorarioPermitido(usuarioAtual()); }
    catch (err) { logout(); mostrarMensagem('erro', 'Fora do horário', err.message); return; }

    const item = buscarPorCodigo(codigo);
    if (!item) {
        // EAN não encontrado: vai pra tela de associar
        adicionarPendente(codigo);
        eanPendenteAssociacao = codigo;
        origemAssociarEan = 'relatorio';
        irParaAssociarEan();
        return;
    }

    // Achou: precisa também da imagem (não está no cache). Vamos buscar 1x e usar.
    // Pra não travar a UI: conta primeiro, depois carrega imagem em background.
    const itemSemImagem = { ...item, imagemUrl: null };
    const contado = contarProduto(itemSemImagem);
    mostrarFeedback('sucesso', `+1: ${item.nome} (total: ${contado.quantidade})`);
    renderizarListaRelatorio();
    atualizarInfoRelatorio();

    // Carrega imagem em background e atualiza
    if (!item.imagemUrl) {
        getDetalheProduto(item.id).then(d => {
            if (d.imagemUrl) {
                const s = sessaoAtiva();
                if (s && s.itens[item.id]) {
                    s.itens[item.id].imagemUrl = d.imagemUrl;
                    localStorage.setItem('relatorio_ativo', JSON.stringify(s));
                    renderizarListaRelatorio();
                }
            }
        }).catch(() => {});
    }
}

document.getElementById('btn-finalizar-relatorio').addEventListener('click', () => irParaResumoRelatorio());

document.getElementById('btn-sair-relatorio').addEventListener('click', () => {
    if (confirm('Cancelar a sessão de relatório? Tudo que foi contado será perdido.')) {
        encerrarSessao();
        irParaScan();
    }
});

// ============ Resumo do relatório ============
function irParaResumoRelatorio() {
    const s = sessaoAtiva();
    if (!s) { irParaScan(); return; }

    const itens = listarItens();
    const pendentes = listarPendentes();

    document.getElementById('resumo-meta').textContent =
        `${itens.length} produtos · ${totalUnidades()} unidades · iniciado ${new Date(s.criadoEm).toLocaleString('pt-BR')} por ${s.criadoPor?.nome || ''}`;

    const lista = document.getElementById('resumo-itens');
    lista.innerHTML = '';
    if (itens.length === 0) {
        lista.innerHTML = '<p class="hint center">Nenhum produto contado.</p>';
    } else {
        for (const item of itens) {
            const row = document.createElement('div');
            row.className = 'rel-item';
            row.innerHTML = `
                <div class="rel-item-foto">${item.imagemUrl ? `<img src="${item.imagemUrl}" alt="">` : ''}</div>
                <div class="rel-item-info">
                    <div class="rel-item-nome">${escapeHtml(item.nome)}</div>
                    <div class="rel-item-sku">${escapeHtml(item.sku)} · ${escapeHtml(item.gtin || '—')}</div>
                </div>
                <div class="rel-item-qtd"><span class="qtd-final">${item.quantidade}</span></div>
            `;
            lista.appendChild(row);
        }
    }

    const pendBox = document.getElementById('resumo-pendentes-box');
    const pendLista = document.getElementById('resumo-pendentes');
    if (pendentes.length > 0) {
        pendBox.classList.remove('hidden');
        pendLista.innerHTML = pendentes.map(p => `<div class="pendente-ean">${escapeHtml(p.ean)}</div>`).join('');
    } else {
        pendBox.classList.add('hidden');
    }

    mostrarTela('resumo-relatorio');
}

document.getElementById('btn-voltar-relatorio').addEventListener('click', () => irParaModoRelatorio());
document.getElementById('btn-encerrar-relatorio').addEventListener('click', () => {
    if (confirm('Encerrar sem gravar? A contagem será perdida.')) {
        encerrarSessao();
        irParaScan();
    }
});

document.getElementById('btn-exportar-csv').addEventListener('click', () => baixarCsv());

document.getElementById('btn-compartilhar').addEventListener('click', async () => {
    const res = await compartilhar();
    if (res.copiado) alert('Resumo copiado pra área de transferência!');
    else if (res.error) alert('Erro: ' + res.error);
});

document.getElementById('btn-gravar-estoque').addEventListener('click', () => gravarTudoNaLoja());

// ============ Gravação em lote ============
async function gravarTudoNaLoja() {
    const itens = listarItens();
    if (itens.length === 0) { alert('Nenhum item pra gravar.'); return; }
    if (!confirm(
        `Gravar ${itens.length} produtos como NOVO estoque na Loja Integrada?\n\n` +
        `Isso SUBSTITUI as quantidades atuais pelas que foram contadas.\n\n` +
        `Total: ${totalUnidades()} unidades.`
    )) return;

    mostrarTela('gravando');
    const info = document.getElementById('gravando-info');
    const barra = document.getElementById('gravando-barra');
    const msg = document.getElementById('gravando-mensagem');

    info.textContent = `Gravando ${itens.length} produtos...`;
    barra.style.width = '0%';
    msg.textContent = '';

    const erros = [];
    for (let i = 0; i < itens.length; i++) {
        const item = itens[i];
        try {
            // Pra usar o endpoint de PUT precisa do objeto raw do estoque.
            // Como não temos ele em cache, buscamos:
            const detalhe = await getDetalheProduto(item.id);
            await atualizarEstoqueProduto(item.id, item.quantidade, detalhe.estoqueRaw);
        } catch (err) {
            erros.push({ item, erro: err.message });
        }
        const pct = Math.round(((i + 1) / itens.length) * 100);
        barra.style.width = pct + '%';
        msg.textContent = `${i + 1} / ${itens.length} (${pct}%)`;
        // Throttle pra respeitar rate limit (2 reqs por item = 350ms entre items = ~85 reqs/min)
        await esperar(350);
    }

    if (erros.length === 0) {
        encerrarSessao();
        mostrarMensagem('sucesso', 'Estoque gravado',
            `${itens.length} produtos atualizados com sucesso na Loja Integrada.`);
    } else {
        const detalhe = erros.slice(0, 5).map(e => `· ${e.item.sku}: ${e.erro}`).join('\n');
        mostrarMensagem('erro', `Gravado com ${erros.length} erro(s)`,
            `${itens.length - erros.length} OK, ${erros.length} falharam.\n\nPrimeiros erros:\n${detalhe}\n\nA sessão NÃO foi encerrada — corrija e tente de novo.`);
    }
}

// ============ Associar EAN não encontrado ============
async function irParaAssociarEan() {
    document.getElementById('ean-pendente').textContent = eanPendenteAssociacao;
    document.getElementById('input-busca-produto').value = '';
    document.getElementById('resultados-busca').innerHTML = '<p class="hint center">Digite SKU ou nome pra buscar.</p>';
    document.getElementById('associar-erro').classList.add('hidden');

    // Botão "pular" muda texto conforme a origem
    const btnPular = document.getElementById('btn-pular-associacao');
    btnPular.textContent = origemAssociarEan === 'relatorio'
        ? 'pular este EAN por enquanto'
        : 'voltar ao scanner sem associar';

    mostrarTela('associar-ean');
    // Foca o input pra começar a digitar direto
    setTimeout(() => document.getElementById('input-busca-produto').focus(), 100);
}

const inputBuscaProduto = document.getElementById('input-busca-produto');
inputBuscaProduto.addEventListener('input', () => {
    const t = inputBuscaProduto.value.trim();
    const cont = document.getElementById('resultados-busca');
    if (t.length < 2) {
        cont.innerHTML = '<p class="hint center">Digite ao menos 2 caracteres.</p>';
        return;
    }
    const resultados = buscarPorTermo(t, 20);
    if (resultados.length === 0) {
        cont.innerHTML = '<p class="hint center">Nenhum produto encontrado.</p>';
        return;
    }
    cont.innerHTML = '';
    for (const item of resultados) {
        const row = document.createElement('div');
        row.className = 'rel-item rel-item-clicavel';
        row.innerHTML = `
            <div class="rel-item-info">
                <div class="rel-item-nome">${escapeHtml(item.nome)}</div>
                <div class="rel-item-sku">SKU: ${escapeHtml(item.sku)} · EAN atual: ${escapeHtml(item.gtin || '(vazio)')}</div>
            </div>
        `;
        row.addEventListener('click', () => confirmarAssociacao(item));
        cont.appendChild(row);
    }
});

async function confirmarAssociacao(item) {
    const origem = origemAssociarEan;
    const acaoFinal = origem === 'relatorio'
        ? 'Vai gravar o EAN na Loja Integrada e contar +1 pra este produto na sessão.'
        : 'Vai gravar o EAN na Loja Integrada e abrir a tela do produto pra você ajustar o estoque.';

    if (!confirm(
        `Associar EAN ${eanPendenteAssociacao} ao produto:\n\n${item.nome}\nSKU: ${item.sku}\nEAN atual: ${item.gtin || '(vazio)'}\n\n` + acaoFinal
    )) return;

    const erroEl = document.getElementById('associar-erro');
    erroEl.classList.add('hidden');

    try {
        await atualizarGtinProduto(item.id, eanPendenteAssociacao);
        atualizarItemCache(item.id, { gtin: eanPendenteAssociacao });
        // Remove dos pendentes (caso tenha sido adicionado no modo relatório)
        removerPendente(eanPendenteAssociacao);

        const eanAssociado = eanPendenteAssociacao;
        eanPendenteAssociacao = null;
        origemAssociarEan = null;

        if (origem === 'relatorio') {
            // Conta +1 e volta pra sessão
            const itemAtualizado = { ...item, gtin: eanAssociado };
            contarProduto(itemAtualizado);
            irParaModoRelatorio();
        } else {
            // Modo scan: abre tela do produto pro ajuste de estoque
            await abrirProduto(item.id);
        }
    } catch (err) {
        erroEl.textContent = `Falha ao gravar EAN: ${err.message}`;
        erroEl.classList.remove('hidden');
    }
}

// Busca detalhe do produto e vai pra tela de ajuste de estoque
async function abrirProduto(produtoId) {
    try {
        const detalhe = await getDetalheProduto(produtoId);
        if (!detalhe.estoqueGerenciado) {
            mostrarMensagem('erro', 'Sem controle de estoque', `${detalhe.nome} não tem estoque gerenciado na Loja Integrada.`);
            return;
        }
        itemAtual = detalhe;
        renderizarProduto();
        mostrarTela('produto');
    } catch (err) {
        mostrarMensagem('erro', 'Erro ao buscar detalhe', err.message);
    }
}

function sairAssociarEan() {
    const origem = origemAssociarEan;
    eanPendenteAssociacao = null;
    origemAssociarEan = null;
    if (origem === 'relatorio') irParaModoRelatorio();
    else irParaScan();
}

document.getElementById('btn-voltar-associar').addEventListener('click', sairAssociarEan);
document.getElementById('btn-pular-associacao').addEventListener('click', sairAssociarEan);

// ============ Inicialização ============
if (estaLogado()) {
    irAposLogin();
} else if (!temCredenciais()) {
    mostrarTela('setup');
} else {
    mostrarTela('login');
}
