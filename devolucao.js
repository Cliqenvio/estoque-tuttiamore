import { getClaudeApiKey } from './api.js';

export async function analisarEtiqueta(imageBase64, mimeType) {
    const apiKey = getClaudeApiKey();
    if (!apiKey) throw new Error('Chave Claude não configurada. Vá em "configurar loja (admin)" e adicione a chave.');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'anthropic-dangerous-allow-browser': 'true',
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 400,
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: { type: 'base64', media_type: mimeType, data: imageBase64 },
                    },
                    {
                        type: 'text',
                        text: 'Esta é uma etiqueta de envio ou devolução de e-commerce brasileiro. Extraia as seguintes informações em JSON:\n{"cliente": "Nome completo do remetente ou destinatário (quem devolveu)", "pedido": "Número do pedido, sem # ou prefixo", "cep": "CEP no formato 00000-000", "marketplace": "Nome do marketplace se visível (Mercado Livre, Shopee, etc.) ou null"}\n\nSe uma informação não estiver visível, use null. Retorne APENAS o JSON válido, sem texto adicional.',
                    }
                ],
            }],
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Erro da API Claude: HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = (data.content[0]?.text || '').trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
    try {
        return JSON.parse(text);
    } catch {
        throw new Error('IA retornou formato inesperado. Preencha os campos manualmente.');
    }
}

export function gerarMensagemWhatsApp({ cliente, pedido, conta, itens, motivo }) {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const itensTexto = itens.length > 0
        ? itens.map(i => `  • ${i}`).join('\n')
        : '  • (não informado)';

    return [
        '📦 *Devolução Recebida - Tuttiamore*',
        '',
        `Olá, ${cliente || 'cliente'}! Confirmamos o recebimento da sua devolução.`,
        '',
        `🏪 *Conta:* ${conta || 'Tuttiamore'}`,
        `👤 *Cliente:* ${cliente || '—'}`,
        `📦 *Itens devolvidos:*`,
        itensTexto,
        `🔖 *Pedido:* #${pedido || '—'}`,
        `🗓️ *Recebido em:* ${hoje}`,
        `📝 *Motivo:* ${motivo || 'Não informado'}`,
    ].join('\n');
}
