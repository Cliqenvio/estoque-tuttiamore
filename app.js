import {
    salvarCredenciais,
    temCredenciais,
    getDetalheProduto,
    atualizarEstoqueProduto,
    calcularNovaQuantidade,
} from './api.js';

import { iniciarScanner, pararScanner } from './scanner.js';
import { login, logout, usuarioAtual, estaLogado, checarHorarioPermitido } from './auth.js';
import {
    sincronizarCatalogo,
    buscarPorCodigo,
    tamanhoCatalogo,
    ultimaSync,
} from './catalog.js';

// Refs de telas
const telas = {
    setup: document.getElementById('tela-setup'),
    login: document.getElementById('tela-login'),
    sync: document.getElementById('tela-sync'),
    scan: document.getElementById('tela-scan'),
    produto: document.getElementById('tela-produto'),
    mensagem: document.getElementById('tela-mensagem'),
};

const videoEl = document.getElementById('video-scanner');
const scanStatus = document.getElementById('scan-status');

// Estado
let itemAtual = null;       // { id, sku, gtin, nome, imagemUrl, estoqueQuantidade }
let scannerAtivo = false;
let ultimoCodigoLido = null;
let ultimoCodigoTimestamp = 0;

function mostrarTela(nome) {
    for (const [k, el] of Object.entries(telas)) {
        el.classList.toggle('hidden', k !== nome);
    }
    if (nome !== 'scan' && scannerAtivo) {
        pararScanner();
        scannerAtivo = false;
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
    const d = Math.floor(h / 24);
    return `há ${d}d`;
}

function atualizarInfoTopbar() {
    const u = usuarioAtual();
    document.getElementById('usuario-info').textContent = u ? `${u.nome} (${u.email})` : '';
    const total = tamanhoCatalogo();
    const sync = ultimaSync();
    const catEl = document.getElementById('catalogo-info');
    catEl.textContent = total > 0
        ? `Catálogo: ${total} produtos · sync ${formatarTempoDesde(sync)}`
        : 'Catálogo vazio — sincronize antes de bipar';
}

// ====== Setup credenciais da loja ======
document.getElementById('btn-salvar-credenciais').addEventListener('click', () => {
    const api = document.getElementById('input-chave-api').value.trim();
    const app = document.getElementById('input-chave-app').value.trim();
    if (!api || !app) { alert('Preencha as duas chaves.'); return; }
    salvarCredenciais(api, app);
    mostrarTela('login');
});

document.getElementById('btn-voltar-login').addEventListener('click', () => mostrarTela('login'));
document.getElementById('btn-ir-setup').addEventListener('click', () => mostrarTela('setup'));

// ====== Login ======
const inputEmail = document.getElementById('input-email');
const inputSenha = document.getElementById('input-senha');
const loginErro = document.getElementById('login-erro');

function mostrarErroLogin(msg) {
    loginErro.textContent = msg;
    loginErro.classList.remove('hidden');
}
function limparErroLogin() {
    loginErro.textContent = '';
    loginErro.classList.add('hidden');
}

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

function irAposLogin() {
    // Se cache vazio, sugere sincronizar antes
    if (tamanhoCatalogo() === 0) {
        mostrarTela('sync');
        atualizarSyncInfo();
    } else {
        irParaScan();
    }
}

// ====== Sincronização ======
const syncInfo = document.getElementById('sync-info');
const syncProgresso = document.getElementById('sync-progresso');
const syncProgressoBarra = document.getElementById('sync-progresso-barra');
const syncMensagem = document.getElementById('sync-mensagem');
const btnIniciarSync = document.getElementById('btn-iniciar-sync');
const btnPularSync = document.getElementById('btn-pular-sync');

function atualizarSyncInfo() {
    const total = tamanhoCatalogo();
    const sync = ultimaSync();
    if (total === 0) {
        syncInfo.textContent = 'Nenhum produto sincronizado ainda. Clique para baixar o catálogo.';
        btnPularSync.classList.add('hidden');
    } else {
        syncInfo.textContent = `Você tem ${total} produtos sincronizados (última sync ${formatarTempoDesde(sync)}).`;
        btnPularSync.classList.remove('hidden');
    }
    syncProgresso.classList.add('hidden');
    syncMensagem.textContent = '';
}

btnIniciarSync.addEventListener('click', async () => {
    btnIniciarSync.disabled = true;
    btnPularSync.classList.add('hidden');
    syncProgresso.classList.remove('hidden');
    syncProgressoBarra.style.width = '0%';
    syncMensagem.textContent = 'Iniciando…';

    try {
        const res = await sincronizarCatalogo(({ atual, total }) => {
            const pct = total > 0 ? Math.round((atual / total) * 100) : 0;
            syncProgressoBarra.style.width = pct + '%';
            syncMensagem.textContent = `${atual.toLocaleString('pt-BR')} / ${total.toLocaleString('pt-BR')} produtos`;
        });
        syncProgressoBarra.style.width = '100%';
        syncMensagem.textContent = `Concluído: ${res.total.toLocaleString('pt-BR')} produtos.`;
        atualizarInfoTopbar();
        setTimeout(() => irParaScan(), 800);
    } catch (err) {
        syncMensagem.textContent = `Erro: ${err.message}`;
        btnIniciarSync.disabled = false;
        if (tamanhoCatalogo() > 0) btnPularSync.classList.remove('hidden');
    }
});

btnPularSync.addEventListener('click', () => irParaScan());

document.getElementById('btn-ir-sync').addEventListener('click', () => {
    mostrarTela('sync');
    atualizarSyncInfo();
});

// ====== Scan ======
async function irParaScan() {
    if (!estaLogado()) { mostrarTela('login'); return; }
    atualizarInfoTopbar();
    mostrarTela('scan');
    setStatus(tamanhoCatalogo() > 0
        ? 'Aponte a câmera ou cole o código de barras'
        : 'Catálogo vazio. Sincronize primeiro.');
    document.getElementById('input-sku-manual').value = '';

    try {
        scannerAtivo = true;
        await iniciarScanner(videoEl, onCodigoBipado);
    } catch (err) {
        scannerAtivo = false;
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

// ====== Produto ======
async function buscarEMostrarProduto(codigo) {
    try { checarHorarioPermitido(usuarioAtual()); }
    catch (err) { logout(); mostrarMensagem('erro', 'Fora do horário', err.message); return; }

    setStatus(`Buscando ${codigo}…`);
    pararScanner();
    scannerAtivo = false;

    // Lookup no cache local primeiro (instantâneo)
    const itemLocal = buscarPorCodigo(codigo);
    if (!itemLocal) {
        mostrarMensagem(
            'erro',
            'Produto não encontrado',
            `Nenhum produto com código "${codigo}".\n\nSe é um produto novo, sincronize o catálogo.`
        );
        return;
    }

    try {
        // Detalhe online (pega estoque e imagem atuais)
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

// ====== Ações ======
document.querySelectorAll('[data-acao]').forEach((btn) => {
    btn.addEventListener('click', () => executarAcao(btn.dataset.acao));
});

async function executarAcao(acao) {
    try { checarHorarioPermitido(usuarioAtual()); }
    catch (err) { logout(); mostrarMensagem('erro', 'Fora do horário', err.message); return; }

    const valor = document.getElementById('input-quantidade').value;
    let novaQtd;
    try {
        novaQtd = calcularNovaQuantidade(itemAtual.estoqueQuantidade, acao, valor);
    } catch (err) { alert(err.message); return; }

    const usuario = usuarioAtual();
    if (!confirm(
        `${usuario.nome}, confirmar?\n\n` +
        `Produto: ${itemAtual.nome}\n` +
        `Estoque: ${itemAtual.estoqueQuantidade} → ${novaQtd}`
    )) return;

    try {
        await atualizarEstoqueProduto(itemAtual.id, novaQtd, itemAtual.estoqueRaw);
        mostrarMensagem(
            'sucesso',
            'Estoque atualizado',
            `${itemAtual.nome}\nde ${itemAtual.estoqueQuantidade} → ${novaQtd}\n(por ${usuario.nome})`
        );
    } catch (err) {
        mostrarMensagem('erro', 'Falha ao atualizar', err.message);
    }
}

// ====== Mensagem ======
function mostrarMensagem(tipo, titulo, detalhe) {
    const icone = document.getElementById('mensagem-icone');
    icone.className = tipo;
    icone.textContent = tipo === 'sucesso' ? '✓' : '✕';
    document.getElementById('mensagem-titulo').textContent = titulo;
    document.getElementById('mensagem-detalhe').textContent = detalhe;
    mostrarTela('mensagem');
}

document.getElementById('btn-mensagem-continuar').addEventListener('click', () => {
    if (estaLogado()) irParaScan(); else mostrarTela('login');
});

// ====== Inicialização ======
if (estaLogado()) {
    irAposLogin();
} else if (!temCredenciais()) {
    mostrarTela('setup');
} else {
    mostrarTela('login');
}
