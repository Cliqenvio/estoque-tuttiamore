import {
    salvarCredenciais,
    temCredenciais,
    getDetalheProduto,
    getFotoProduto,
    atualizarEstoqueProduto,
    atualizarGtinProduto,
    calcularNovaQuantidade,
} from './api.js';

import { iniciarScanner, pararScanner } from './scanner.js';
import { aoBipeFisico } from './hid.js';
import { somSucesso, somErro, destravarAudio } from './sounds.js';
import { login, logout, usuarioAtual, estaLogado, checarHorarioPermitido } from './auth.js';
import {
    sincronizarCatalogo,
    buscarPorCodigo,
    buscarPorTermo,
    atualizarItemCache,
    tamanhoCatalogo,
    ultimaSync,
} from './catalog.js';
import { relatorio, recebimento } from './reports.js';

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
    recebimento: document.getElementById('tela-recebimento'),
    'resumo-recebimento': document.getElementById('tela-resumo-recebimento'),
    'associar-ean': document.getElementById('tela-associar-ean'),
    gravando: document.getElementById('tela-gravando'),
};

const videoEl = document.getElementById('video-scanner');
const videoElRel = document.getElementById('video-scanner-rel');
const videoElRec = document.getElementById('video-scanner-rec');
const scanStatus = document.getElementById('scan-status');

// ============ Estado ============
let telaAtualNome = null;
let itemAtual = null;
let scannerAtivo = false;
let scannerAtivoEm = null; // 'scan', 'relatorio' ou 'recebimento'
let ultimoCodigoLido = null;
let ultimoCodigoTimestamp = 0;
let eanPendenteAssociacao = null; // EAN que estamos tentando associar a um produto
let origemAssociarEan = null;     // 'scan', 'relatorio' ou 'recebimento'

// ============ Helpers ============
function mostrarTela(nome) {
    telaAtualNome = nome;
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

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Cache em memória das fotos por produto (evita repetir chamadas em bipes seguidos
// do mesmo produto — importante pro rate limit da Loja Integrada).
const fotoCache = new Map(); // produtoId -> Promise<{imagemPequenaUrl, imagemGrandeUrl} | null>

function buscarFotoComCache(produtoId) {
    if (!fotoCache.has(produtoId)) {
        fotoCache.set(produtoId, getFotoProduto(produtoId).catch(() => null));
    }
    return fotoCache.get(produtoId);
}

// ============ Modo de leitura (câmera × leitor físico USB/Bluetooth) ============
function modoLeitura() {
    return localStorage.getItem('modo_leitura') || 'camera';
}

function definirModoLeitura(modo) {
    localStorage.setItem('modo_leitura', modo);
}

function atualizarBotoesModoLeitura() {
    const texto = modoLeitura() === 'camera'
        ? '🔌 usar leitor físico (USB/Bluetooth)'
        : '📷 usar câmera do aparelho';
    document.querySelectorAll('.btn-modo-leitura').forEach(b => { b.textContent = texto; });
}

document.querySelectorAll('.btn-modo-leitura').forEach(btn => {
    btn.addEventListener('click', () => {
        definirModoLeitura(modoLeitura() === 'camera' ? 'fisico' : 'camera');
        atualizarBotoesModoLeitura();
        // Reabre a tela atual pra aplicar o novo modo
        if (telaAtualNome === 'scan') irParaScan();
        else if (telaAtualNome === 'relatorio') irParaModoRelatorio();
        else if (telaAtualNome === 'recebimento') irParaRecebimento();
    });
});

// ============ Leitor físico: roteamento global por tela ============
// O leitor em modo teclado "digita" o código + Enter. O hid.js captura isso
// globalmente (sem precisar de campo focado) e cai aqui.
aoBipeFisico((codigo) => {
    switch (telaAtualNome) {
        case 'scan':
        case 'produto':
            // Bipar em cima da tela de produto pula direto pro próximo produto
            buscarEMostrarProduto(codigo);
            break;
        case 'relatorio':
            processarBipeSessao('relatorio', codigo);
            break;
        case 'recebimento':
            processarBipeSessao('recebimento', codigo);
            break;
        case 'mensagem':
            // Continua o fluxo em que o usuário estava
            if (relatorio.temSessao()) {
                irParaModoRelatorio().then(() => processarBipeSessao('relatorio', codigo));
            } else if (recebimento.temSessao()) {
                irParaRecebimento().then(() => processarBipeSessao('recebimento', codigo));
            } else if (estaLogado()) {
                buscarEMostrarProduto(codigo);
            }
            break;
        // Demais telas (login, setup, sync, resumos, associar): ignora
    }
});

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
        return;
    }
    if (relatorio.temSessao()) {
        if (confirm('Você tem uma sessão de relatório em andamento. Continuar?')) {
            irParaModoRelatorio();
            return;
        }
        relatorio.encerrarSessao();
    }
    if (recebimento.temSessao()) {
        if (confirm('Você tem um recebimento em andamento. Continuar?')) {
            irParaRecebimento();
            return;
        }
        recebimento.encerrarSessao();
    }
    irParaScan();
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
    document.getElementById('input-sku-manual').value = '';

    const container = document.getElementById('scanner-container');
    const leitorBox = document.getElementById('leitor-box-scan');

    if (modoLeitura() === 'fisico') {
        container.classList.add('hidden');
        leitorBox.classList.remove('hidden');
        setStatus(tamanhoCatalogo() > 0 ? 'Leitor pronto — bipe um código' : 'Catálogo vazio. Sincronize primeiro.');
        return;
    }

    container.classList.remove('hidden');
    leitorBox.classList.add('hidden');
    setStatus(tamanhoCatalogo() > 0 ? 'Aponte a câmera ou cole o código' : 'Catálogo vazio. Sincronize primeiro.');

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
    if (relatorio.temSessao()) irParaModoRelatorio();
    else if (recebimento.temSessao()) irParaRecebimento();
    else if (estaLogado()) irParaScan();
    else mostrarTela('login');
});

// ============ Sessões de bipagem em lote (relatório + recebimento) ============
// UI de cada tipo de sessão, pra generalizar o processamento do bipe.
const uiSessao = {
    relatorio: {
        store: relatorio,
        feedbackEl: document.getElementById('relatorio-feedback'),
        listaEl: document.getElementById('relatorio-lista'),
        atualizarInfo: atualizarInfoRelatorio,
        msgVazio: 'Nenhum produto contado ainda. Bipe um código pra começar.',
    },
    recebimento: {
        store: recebimento,
        feedbackEl: document.getElementById('recebimento-feedback'),
        listaEl: document.getElementById('recebimento-lista'),
        atualizarInfo: atualizarInfoRecebimento,
        msgVazio: 'Nenhum produto conferido ainda. Bipe um código pra começar.',
        // Hooks exclusivos do recebimento: sons + card com foto
        aoEncontrar: (item) => { somSucesso(); mostrarCardRecebimento(item.id); },
        aoNaoEncontrar: () => somErro(),
        aoTocarItem: (item) => mostrarCardRecebimento(item.id),
    },
};

const feedbackTimers = new WeakMap();
function mostrarFeedbackEm(el, tipo, msg) {
    el.className = `feedback-bipe ${tipo}`;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(feedbackTimers.get(el));
    feedbackTimers.set(el, setTimeout(() => el.classList.add('hidden'), 3000));
}

function renderizarListaSessao(origem) {
    const { store, listaEl, atualizarInfo, msgVazio } = uiSessao[origem];
    const itens = store.listarItens();
    listaEl.innerHTML = '';
    if (itens.length === 0) {
        listaEl.innerHTML = `<p class="hint center">${msgVazio}</p>`;
        return;
    }
    const aoTocarItem = uiSessao[origem].aoTocarItem;
    for (const item of itens) {
        const row = document.createElement('div');
        row.className = 'rel-item' + (item.ajustarEan ? ' rel-item-ajuste' : '');
        row.innerHTML = `
            <div class="rel-item-foto">${item.imagemUrl ? `<img src="${item.imagemUrl}" alt="">` : ''}</div>
            <div class="rel-item-info">
                <div class="rel-item-nome">${escapeHtml(item.nome)}${item.ajustarEan ? ' <span class="badge-ajuste">corrigir EAN</span>' : ''}</div>
                <div class="rel-item-sku">${escapeHtml(item.sku)} · ${escapeHtml(item.gtin || '—')}</div>
            </div>
            <div class="rel-item-qtd">
                <button class="rel-qtd-btn" data-id="${item.id}" data-d="-1">−</button>
                <span>${item.quantidade}</span>
                <button class="rel-qtd-btn" data-id="${item.id}" data-d="+1">+</button>
            </div>
        `;
        if (aoTocarItem) {
            const info = row.querySelector('.rel-item-info');
            info.classList.add('rel-item-clicavel');
            info.addEventListener('click', () => aoTocarItem(item));
        }
        listaEl.appendChild(row);
    }
    listaEl.querySelectorAll('.rel-qtd-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.id);
            const d = Number(btn.dataset.d);
            const item = store.listarItens().find(i => i.id === id);
            if (!item) return;
            store.ajustarQuantidade(id, item.quantidade + d);
            renderizarListaSessao(origem);
            atualizarInfo();
        });
    });
    if (origem === 'recebimento') sincronizarCardRecebimento();
}

// Processa um código bipado dentro de uma sessão (relatório ou recebimento)
async function processarBipeSessao(origem, codigo) {
    try { checarHorarioPermitido(usuarioAtual()); }
    catch (err) { logout(); mostrarMensagem('erro', 'Fora do horário', err.message); return; }

    const { store, feedbackEl, atualizarInfo, aoEncontrar, aoNaoEncontrar } = uiSessao[origem];

    const item = buscarPorCodigo(codigo);
    if (!item) {
        // EAN não encontrado: som de erro + tela de associar
        aoNaoEncontrar?.(codigo);
        store.adicionarPendente(codigo);
        eanPendenteAssociacao = codigo;
        origemAssociarEan = origem;
        irParaAssociarEan();
        return;
    }

    // Achou: conta primeiro (não trava a UI), carrega imagem em background depois.
    const contado = store.contarProduto({ ...item, imagemUrl: null }, codigo);
    mostrarFeedbackEm(feedbackEl, 'sucesso', `+1: ${item.nome} (total: ${contado.quantidade})`);
    renderizarListaSessao(origem);
    atualizarInfo();
    aoEncontrar?.(item, contado, codigo);

    buscarFotoComCache(item.id).then(f => {
        if (f?.imagemPequenaUrl) {
            store.atualizarImagemItem(item.id, f.imagemPequenaUrl);
            renderizarListaSessao(origem);
        }
    });
}

// Configura a área de leitura (câmera × leitor físico) das telas de sessão
async function configurarLeituraSessao(origem) {
    const cfg = origem === 'relatorio'
        ? { containerId: 'scanner-container-rel', boxId: 'leitor-box-rel', video: videoElRel, onBipe: onCodigoBipadoRelatorio }
        : { containerId: 'scanner-container-rec', boxId: 'leitor-box-rec', video: videoElRec, onBipe: onCodigoBipadoRecebimento };

    const container = document.getElementById(cfg.containerId);
    const box = document.getElementById(cfg.boxId);

    if (modoLeitura() === 'fisico') {
        container.classList.add('hidden');
        box.classList.remove('hidden');
        return;
    }

    container.classList.remove('hidden');
    box.classList.add('hidden');
    try {
        scannerAtivo = true;
        scannerAtivoEm = origem;
        await iniciarScanner(cfg.video, cfg.onBipe);
    } catch (err) {
        scannerAtivo = false;
        scannerAtivoEm = null;
        mostrarFeedbackEm(uiSessao[origem].feedbackEl, 'erro', `Câmera indisponível: ${err.message}`);
    }
}

// ============ Modo relatório ============
document.getElementById('btn-iniciar-relatorio').addEventListener('click', () => {
    const u = usuarioAtual();
    if (!u) { mostrarTela('login'); return; }
    if (tamanhoCatalogo() === 0) {
        alert('Catálogo vazio. Sincronize primeiro.');
        return;
    }
    if (recebimento.temSessao()) {
        alert('Você tem um recebimento em andamento. Conclua (ou cancele) antes de iniciar um relatório.');
        return;
    }
    if (relatorio.temSessao()) {
        // Já existe contagem em andamento — continua nela em vez de sobrescrever
        irParaModoRelatorio();
        return;
    }
    relatorio.iniciarSessao(u.email, u.nome);
    irParaModoRelatorio();
});

async function irParaModoRelatorio() {
    if (!estaLogado()) { mostrarTela('login'); return; }
    atualizarInfoRelatorio();
    renderizarListaSessao('relatorio');
    mostrarTela('relatorio');
    document.getElementById('input-sku-relatorio').value = '';
    await configurarLeituraSessao('relatorio');
}

function atualizarInfoRelatorio() {
    const s = relatorio.sessaoAtiva();
    const el = document.getElementById('relatorio-info');
    if (!s) { el.textContent = ''; return; }
    const itens = relatorio.listarItens();
    el.textContent = `${itens.length} produtos · ${relatorio.totalUnidades()} unidades · por ${s.criadoPor?.nome || ''}`;
}

function onCodigoBipadoRelatorio(codigo) {
    const agora = Date.now();
    if (codigo === ultimoCodigoLido && agora - ultimoCodigoTimestamp < 1500) return;
    ultimoCodigoLido = codigo;
    ultimoCodigoTimestamp = agora;
    processarBipeSessao('relatorio', codigo);
}

document.getElementById('btn-buscar-relatorio').addEventListener('click', () => {
    const c = document.getElementById('input-sku-relatorio').value.trim();
    if (!c) return;
    document.getElementById('input-sku-relatorio').value = '';
    processarBipeSessao('relatorio', c);
});

document.getElementById('input-sku-relatorio').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-buscar-relatorio').click();
});

document.getElementById('btn-finalizar-relatorio').addEventListener('click', () => irParaResumoRelatorio());

document.getElementById('btn-sair-relatorio').addEventListener('click', () => {
    if (confirm('Cancelar a sessão de relatório? Tudo que foi contado será perdido.')) {
        relatorio.encerrarSessao();
        irParaScan();
    }
});

// ============ Resumo do relatório ============
function renderizarResumoItens(itens, listaEl) {
    listaEl.innerHTML = '';
    if (itens.length === 0) {
        listaEl.innerHTML = '<p class="hint center">Nenhum produto na lista.</p>';
        return;
    }
    for (const item of itens) {
        const row = document.createElement('div');
        row.className = 'rel-item' + (item.ajustarEan ? ' rel-item-ajuste' : '');
        row.innerHTML = `
            <div class="rel-item-foto">${item.imagemUrl ? `<img src="${item.imagemUrl}" alt="">` : ''}</div>
            <div class="rel-item-info">
                <div class="rel-item-nome">${escapeHtml(item.nome)}${item.ajustarEan ? ' <span class="badge-ajuste">corrigir EAN</span>' : ''}</div>
                <div class="rel-item-sku">${escapeHtml(item.sku)} · ${escapeHtml(item.gtin || '—')}${item.ajustarEan && item.codigoBipado ? ` · bipado: ${escapeHtml(item.codigoBipado)}` : ''}</div>
            </div>
            <div class="rel-item-qtd"><span class="qtd-final">${item.quantidade}</span></div>
        `;
        listaEl.appendChild(row);
    }
}

function irParaResumoRelatorio() {
    const s = relatorio.sessaoAtiva();
    if (!s) { irParaScan(); return; }

    const itens = relatorio.listarItens();
    const pendentes = relatorio.listarPendentes();

    document.getElementById('resumo-meta').textContent =
        `${itens.length} produtos · ${relatorio.totalUnidades()} unidades · iniciado ${new Date(s.criadoEm).toLocaleString('pt-BR')} por ${s.criadoPor?.nome || ''}`;

    renderizarResumoItens(itens, document.getElementById('resumo-itens'));

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
        relatorio.encerrarSessao();
        irParaScan();
    }
});

document.getElementById('btn-exportar-csv').addEventListener('click', () => relatorio.baixarCsv());

document.getElementById('btn-compartilhar').addEventListener('click', async () => {
    const res = await relatorio.compartilhar();
    if (res.copiado) alert('Resumo copiado pra área de transferência!');
    else if (res.error) alert('Erro: ' + res.error);
});

document.getElementById('btn-gravar-estoque').addEventListener('click', () => gravarTudoNaLoja());

// ============ Gravação em lote (só o relatório grava estoque) ============
async function gravarTudoNaLoja() {
    const itens = relatorio.listarItens();
    if (itens.length === 0) { alert('Nenhum item pra gravar.'); return; }
    if (!confirm(
        `Gravar ${itens.length} produtos como NOVO estoque na Loja Integrada?\n\n` +
        `Isso SUBSTITUI as quantidades atuais pelas que foram contadas.\n\n` +
        `Total: ${relatorio.totalUnidades()} unidades.`
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
        relatorio.encerrarSessao();
        mostrarMensagem('sucesso', 'Estoque gravado',
            `${itens.length} produtos atualizados com sucesso na Loja Integrada.`);
    } else {
        const detalhe = erros.slice(0, 5).map(e => `· ${e.item.sku}: ${e.erro}`).join('\n');
        mostrarMensagem('erro', `Gravado com ${erros.length} erro(s)`,
            `${itens.length - erros.length} OK, ${erros.length} falharam.\n\nPrimeiros erros:\n${detalhe}\n\nA sessão NÃO foi encerrada — corrija e tente de novo.`);
    }
}

// ============ Card do produto bipado no recebimento (foto + ajustar EAN) ============
let recProdutoFocoId = null;

function mostrarCardRecebimento(produtoId) {
    const card = document.getElementById('rec-produto-card');
    const itemSessao = recebimento.sessaoAtiva()?.itens?.[produtoId];
    if (!itemSessao) { card.classList.add('hidden'); recProdutoFocoId = null; return; }

    recProdutoFocoId = produtoId;
    card.classList.remove('hidden');
    document.getElementById('rec-produto-nome').textContent = itemSessao.nome;
    document.getElementById('rec-produto-sku').textContent = `${itemSessao.sku || '—'} · ${itemSessao.gtin || 'sem EAN'}`;
    document.getElementById('rec-produto-qtd').textContent = `${itemSessao.quantidade}× recebido`;
    atualizarBotaoAjusteCard();

    const img = document.getElementById('rec-produto-img');
    const ph = document.getElementById('rec-produto-img-ph');
    img.classList.add('hidden');
    ph.classList.remove('hidden');
    ph.textContent = 'carregando…';
    buscarFotoComCache(produtoId).then(f => {
        if (recProdutoFocoId !== produtoId) return; // usuário já bipou outro produto
        if (f?.imagemGrandeUrl) {
            img.src = f.imagemGrandeUrl;
            img.classList.remove('hidden');
            ph.classList.add('hidden');
        } else {
            ph.textContent = 'sem foto';
        }
    });
}

function atualizarBotaoAjusteCard() {
    const btn = document.getElementById('btn-rec-ajustar-ean');
    const item = recProdutoFocoId ? recebimento.sessaoAtiva()?.itens?.[recProdutoFocoId] : null;
    if (!item) return;
    btn.classList.toggle('marcado', !!item.ajustarEan);
    btn.textContent = item.ajustarEan
        ? '✓ Marcado pra corrigir EAN — tocar pra desmarcar'
        : '⚠️ Ajustar código de barras';
}

// Mantém o card coerente quando a lista muda (ex.: quantidade zerada remove o item)
function sincronizarCardRecebimento() {
    const card = document.getElementById('rec-produto-card');
    const item = recProdutoFocoId ? recebimento.sessaoAtiva()?.itens?.[recProdutoFocoId] : null;
    if (!item) {
        card.classList.add('hidden');
        recProdutoFocoId = null;
        return;
    }
    document.getElementById('rec-produto-qtd').textContent = `${item.quantidade}× recebido`;
    atualizarBotaoAjusteCard();
}

document.getElementById('btn-rec-ajustar-ean').addEventListener('click', () => {
    const item = recProdutoFocoId ? recebimento.sessaoAtiva()?.itens?.[recProdutoFocoId] : null;
    if (!item) return;
    recebimento.marcarAjusteEan(recProdutoFocoId, !item.ajustarEan);
    atualizarBotaoAjusteCard();
    renderizarListaSessao('recebimento');
});

// ============ Modo recebimento (conferência — só relatório, não altera estoque) ============
document.getElementById('btn-iniciar-recebimento').addEventListener('click', () => {
    destravarAudio(); // gesto do usuário destrava os sons de bipagem
    const u = usuarioAtual();
    if (!u) { mostrarTela('login'); return; }
    if (tamanhoCatalogo() === 0) {
        alert('Catálogo vazio. Sincronize primeiro.');
        return;
    }
    if (relatorio.temSessao()) {
        alert('Você tem um relatório de contagem em andamento. Finalize (ou cancele) antes de iniciar um recebimento.');
        return;
    }
    if (!recebimento.temSessao()) {
        const ref = prompt('Referência do recebimento (nota fiscal, fornecedor...) — opcional:', '');
        if (ref === null) return; // cancelou
        recebimento.iniciarSessao(u.email, u.nome, { referencia: ref.trim() });
    }
    irParaRecebimento();
});

async function irParaRecebimento() {
    if (!estaLogado()) { mostrarTela('login'); return; }
    destravarAudio();
    atualizarInfoRecebimento();
    renderizarListaSessao('recebimento');
    mostrarTela('recebimento');
    document.getElementById('input-sku-recebimento').value = '';
    // Reexibe o card do último produto bipado, se ainda estiver na sessão
    if (recProdutoFocoId && recebimento.sessaoAtiva()?.itens?.[recProdutoFocoId]) {
        mostrarCardRecebimento(recProdutoFocoId);
    } else {
        recProdutoFocoId = null;
        document.getElementById('rec-produto-card').classList.add('hidden');
    }
    await configurarLeituraSessao('recebimento');
}

function atualizarInfoRecebimento() {
    const s = recebimento.sessaoAtiva();
    const el = document.getElementById('recebimento-info');
    if (!s) { el.textContent = ''; return; }
    const ref = s.referencia ? ` · ref: ${s.referencia}` : '';
    el.textContent = `${recebimento.listarItens().length} produtos · ${recebimento.totalUnidades()} unidades${ref}`;
}

function onCodigoBipadoRecebimento(codigo) {
    const agora = Date.now();
    if (codigo === ultimoCodigoLido && agora - ultimoCodigoTimestamp < 1500) return;
    ultimoCodigoLido = codigo;
    ultimoCodigoTimestamp = agora;
    processarBipeSessao('recebimento', codigo);
}

document.getElementById('btn-buscar-recebimento').addEventListener('click', () => {
    const c = document.getElementById('input-sku-recebimento').value.trim();
    if (!c) return;
    document.getElementById('input-sku-recebimento').value = '';
    processarBipeSessao('recebimento', c);
});

document.getElementById('input-sku-recebimento').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-buscar-recebimento').click();
});

document.getElementById('btn-finalizar-recebimento').addEventListener('click', () => irParaResumoRecebimento());

document.getElementById('btn-sair-recebimento').addEventListener('click', () => {
    if (confirm('Cancelar o recebimento? Tudo que foi conferido será perdido.')) {
        recebimento.encerrarSessao();
        irParaScan();
    }
});

// ============ Resumo do recebimento ============
function irParaResumoRecebimento() {
    const s = recebimento.sessaoAtiva();
    if (!s) { irParaScan(); return; }

    const itens = recebimento.listarItens();
    const pendentes = recebimento.listarPendentes();
    const ref = s.referencia ? ` · ref: ${s.referencia}` : '';

    document.getElementById('resumo-rec-meta').textContent =
        `${itens.length} produtos · ${recebimento.totalUnidades()} unidades${ref} · iniciado ${new Date(s.criadoEm).toLocaleString('pt-BR')} por ${s.criadoPor?.nome || ''}`;

    renderizarResumoItens(itens, document.getElementById('resumo-rec-itens'));

    const pendBox = document.getElementById('resumo-rec-pendentes-box');
    const pendLista = document.getElementById('resumo-rec-pendentes');
    if (pendentes.length > 0) {
        pendBox.classList.remove('hidden');
        pendLista.innerHTML = pendentes.map(p => `<div class="pendente-ean">${escapeHtml(p.ean)}</div>`).join('');
    } else {
        pendBox.classList.add('hidden');
    }

    mostrarTela('resumo-recebimento');
}

document.getElementById('btn-voltar-recebimento').addEventListener('click', () => irParaRecebimento());

document.getElementById('btn-rec-exportar-csv').addEventListener('click', () => recebimento.baixarCsv());

document.getElementById('btn-rec-compartilhar').addEventListener('click', async () => {
    const res = await recebimento.compartilhar();
    if (res.copiado) alert('Resumo copiado pra área de transferência!');
    else if (res.error) alert('Erro: ' + res.error);
});

document.getElementById('btn-rec-encerrar').addEventListener('click', () => {
    if (!confirm('Concluir o recebimento?\n\nA lista será apagada do aparelho. Exporte ou compartilhe antes, se ainda não fez.')) return;
    const prods = recebimento.listarItens().length;
    const unidades = recebimento.totalUnidades();
    recebimento.encerrarSessao();
    mostrarMensagem('sucesso', 'Recebimento concluído',
        `${prods} produtos · ${unidades} unidades conferidas.\nO estoque na Loja Integrada não foi alterado.`);
});

// ============ Associar EAN não encontrado ============
async function irParaAssociarEan() {
    document.getElementById('ean-pendente').textContent = eanPendenteAssociacao;
    document.getElementById('input-busca-produto').value = '';
    document.getElementById('resultados-busca').innerHTML = '<p class="hint center">Digite SKU ou nome pra buscar.</p>';
    document.getElementById('associar-erro').classList.add('hidden');

    // Botão "pular" muda texto conforme a origem
    const btnPular = document.getElementById('btn-pular-associacao');
    btnPular.textContent = origemAssociarEan === 'scan'
        ? 'voltar ao scanner sem associar'
        : 'pular este EAN por enquanto';

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
        : origem === 'recebimento'
            ? 'Vai gravar o EAN na Loja Integrada e contar +1 na conferência do recebimento.'
            : 'Vai gravar o EAN na Loja Integrada e abrir a tela do produto pra você ajustar o estoque.';

    if (!confirm(
        `Associar EAN ${eanPendenteAssociacao} ao produto:\n\n${item.nome}\nSKU: ${item.sku}\nEAN atual: ${item.gtin || '(vazio)'}\n\n` + acaoFinal
    )) return;

    const erroEl = document.getElementById('associar-erro');
    erroEl.classList.add('hidden');

    try {
        await atualizarGtinProduto(item.id, eanPendenteAssociacao);
        atualizarItemCache(item.id, { gtin: eanPendenteAssociacao });
        // Remove dos pendentes da sessão de origem (se houver)
        if (origem === 'relatorio') relatorio.removerPendente(eanPendenteAssociacao);
        if (origem === 'recebimento') recebimento.removerPendente(eanPendenteAssociacao);

        const eanAssociado = eanPendenteAssociacao;
        eanPendenteAssociacao = null;
        origemAssociarEan = null;

        if (origem === 'relatorio') {
            // Conta +1 e volta pra sessão
            relatorio.contarProduto({ ...item, gtin: eanAssociado }, eanAssociado);
            irParaModoRelatorio();
        } else if (origem === 'recebimento') {
            recebimento.contarProduto({ ...item, gtin: eanAssociado }, eanAssociado);
            irParaRecebimento().then(() => mostrarCardRecebimento(item.id));
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
    else if (origem === 'recebimento') irParaRecebimento();
    else irParaScan();
}

document.getElementById('btn-voltar-associar').addEventListener('click', sairAssociarEan);
document.getElementById('btn-pular-associacao').addEventListener('click', sairAssociarEan);

// ============ Inicialização ============
atualizarBotoesModoLeitura();

if (estaLogado()) {
    irAposLogin();
} else if (!temCredenciais()) {
    mostrarTela('setup');
} else {
    mostrarTela('login');
}
