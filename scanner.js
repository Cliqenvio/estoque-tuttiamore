import { BrowserMultiFormatReader } from 'https://esm.sh/@zxing/browser@0.1.5';

let codeReader = null;
let activeControls = null;

export async function iniciarScanner(videoEl, onCodigoLido) {
    if (!('mediaDevices' in navigator)) {
        throw new Error('Este navegador não suporta acesso à câmera');
    }

    codeReader = new BrowserMultiFormatReader();

    // Tenta usar câmera traseira (environment)
    const constraints = {
        video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
        },
    };

    activeControls = await codeReader.decodeFromConstraints(
        constraints,
        videoEl,
        (result, err, controls) => {
            if (result) {
                const texto = result.getText();
                onCodigoLido(texto, controls);
            }
            // Ignora erros de "não encontrou código no frame" — são contínuos
        }
    );

    return activeControls;
}

export function pararScanner() {
    try {
        if (activeControls && typeof activeControls.stop === 'function') {
            activeControls.stop();
        }
    } catch (e) {
        console.warn('Erro ao parar scanner:', e);
    }
    activeControls = null;
    codeReader = null;
}
