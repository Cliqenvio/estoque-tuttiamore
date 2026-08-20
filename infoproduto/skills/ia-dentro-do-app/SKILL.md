---
name: ia-dentro-do-app
description: "Coloca IA dentro do próprio app interno — foto ou PDF virando campos preenchidos, texto livre virando categoria, busca em linguagem natural — com a chave no servidor, teto de custo, fallback manual e o padrão sugestão-não-decisão. Use quando surgir 'ler a nota fiscal com IA', 'extrair os dados da foto', 'classificar automaticamente', 'buscar escrevendo do meu jeito', 'pôr inteligência artificial no app', ou quando alguém quiser automatizar com IA uma decisão que hoje é humana."
---

# IA dentro do app

## Por que esta skill existe

Até aqui a IA foi a ferramenta que **construiu** o app. Esta skill é sobre outra coisa:
IA como peça **dentro** do app — o conferente fotografa a etiqueta e os campos se
preenchem; o texto solto do vendedor vira categoria; a busca entende "caixa azul grande".

É a funcionalidade mais fácil de vender e a mais fácil de fazer errado. Errada, ela vira
três coisas: uma conta de API surpresa, um vazamento de chave, ou — o pior — números
errados gravados com confiança. Esta skill existe para nenhuma das três acontecer.

## A régua: IA entra quando as três respostas são sim

1. **A entrada é bagunçada?** Foto, PDF escaneado, texto livre, fala. Se a entrada já é
   estruturada (um número, uma data, um código), não é caso de IA — é código comum.
2. **Errar de vez em quando é tolerável e corrigível?** IA erra por natureza. Preencher
   um formulário que o humano revisa, sim. Calcular saldo, dar baixa, faturar — nunca.
3. **Alguém confere o resultado no fluxo?** Se não existe olho humano entre a IA e o dado
   gravado, redesenhe o fluxo até existir.

A linha divisória em uma frase: **IA para interpretar, código para calcular.** Soma,
saldo, regra fixa, validação de dígito — determinismo, sempre. O modelo lê o mundo
bagunçado e entrega estrutura; dali em diante o código comum assume.

## Onde ela rende de verdade em app interno

| Caso | Entrada | Saída | Quem confere |
|---|---|---|---|
| Nota/etiqueta fotografada | foto | fornecedor, nº, itens, quantidades | conferente, antes de gravar |
| Classificação de despesa | descrição livre | categoria sugerida | financeiro, num clique |
| Busca natural no catálogo | "caixa azul 20 litros" | os 5 SKUs mais prováveis | quem busca escolhe |
| Resumo do turno | movimentos do dia | 3 frases para o grupo | quem envia lê antes |

O padrão comum a todos: a IA **sugere** e a pessoa **confirma**. Os campos vêm
preenchidos e editáveis, com um botão de confirmar — nunca gravados direto. Isso não é
desconfiança decorativa: é o que transforma um acerto de 90% em uma ferramenta útil, em
vez de 10% de dado ruim entrando calado.

## Arquitetura: a chamada mora no servidor

A regra da skill `quem-entra-e-quem-ve` vale em dobro aqui: **a chave da API de IA nunca
vai ao navegador** — quem a rouba gasta em minutos o orçamento do mês. A chamada vive no
mesmo intermediário (Worker, função) que já guarda os outros segredos:

```js
// worker: recebe a imagem do app, chama o modelo, devolve só o JSON validado
export default {
  async fetch(request, env) {
    // token + CORS iguais aos da skill quem-entra-e-quem-ve — sem isso,
    // qualquer pessoa com a URL gasta o seu orçamento de IA
    if (request.headers.get("authorization") !== env.APP_TOKEN)
      return new Response("não autorizado", { status: 401 });
    const { imagemBase64 } = await request.json();
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.IA_API_KEY, "anthropic-version": "2023-06-01",
                 "content-type": "application/json" },
      body: JSON.stringify({
        model: "MODELO_PEQUENO_ATUAL",   // consulte a doc: o menor que resolve
        max_tokens: 1024,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg",
                                     data: imagemBase64 } },
          { type: "text", text:
            "Extraia desta etiqueta: fornecedor, numero_nota, itens[{descricao, quantidade}]. " +
            "Responda SOMENTE o JSON. Campo ilegível = null. NÃO chute valores." }
        ]}],
      }),
    });
    // a resposta vem num envelope; o JSON pedido está em content[0].text
    const resposta = await r.json();
    let dados = null;
    try { dados = JSON.parse(resposta.content?.[0]?.text); } catch {}
    // valide como se viesse de um estagiário apressado
    if (!dados || !Array.isArray(dados.itens))
      return new Response(JSON.stringify({ erro: "não consegui ler" }),
        { status: 422, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify(dados),
      { headers: { "content-type": "application/json" } });
  }
};
```

Três decisões embutidas aí que não são detalhe:

- **"Campo ilegível = null. NÃO chute."** Sem essa instrução, modelos preenchem o que não
  leram — e um chute confiante é pior que um campo vazio.
- **Valide a resposta no servidor** como se viesse de um estagiário apressado: os campos
  existem? quantidade é número positivo? Se não passou, devolva erro — não devolva "quase".
- **O menor modelo que resolve.** Extração de etiqueta não precisa do modelo mais caro.
  Consulte a documentação do provedor na hora de escolher (no Claude Code, a skill
  pública `claude-api` traz modelos e preços atuais) — e teste o barato primeiro.

## Custo: trate como conta de luz, não como aposta

IA dentro do app é o único pedaço do produto com custo por uso. Antes de ligar:

1. **Faça a conta de padeiro:** custo de uma chamada × usos por dia × 22 dias. Etiquetas
   fotografadas 60×/dia num modelo pequeno custam centavos por dia — mas faça a conta com
   os preços atuais, não confie na intuição (nem na minha).
2. **Configure o teto no painel do provedor** para o dobro da estimativa. Estourou o teto,
   o app cai no caminho manual — não gera fatura surpresa.
3. **Não chame à toa:** cache do que repete (a mesma descrição de despesa não precisa ser
   classificada duas vezes) e nada de chamar a cada tecla digitada na busca — só no Enter.
4. **Registre cada chamada** (quando, quem, para quê): é o seu medidor. No fim do mês,
   compare com a fatura e anote no `DECISOES.md`.

## Fallback manual: obrigatório, não opcional

O fluxo que existia antes da IA continua existindo: sem internet, com o teto estourado ou
com a API fora, a pessoa digita na mão como sempre digitou. A IA é um atalho por cima do
caminho manual — nunca uma ponte que substitui o chão. Se o app fica inutilizável quando
a IA falha, o desenho está errado.

## Antes de ligar: o teste dos 20 casos

Junte 20 exemplos **reais e difíceis** — a etiqueta amassada, a foto escura, a descrição
ambígua, o item que não existe no catálogo. Rode todos e conte acertos por campo, não por
impressão geral.

- Acertou 18+ e errou de forma óbvia (deixou vazio) → ligue, com confirmação humana.
- Errou chutando com confiança → ajuste a instrução ("null, não chute") e repita.
- Abaixo de 15 → o caso não está maduro; o fluxo manual continua sendo melhor.

Guarde os 20 casos: viram o teste de regressão de quando você trocar de modelo — modelos
mudam de comportamento entre versões, e os seus 20 casos são o que diz se a troca melhorou
ou piorou **no seu problema**.

## A lição do estudo de caso

O app de estoque que acompanha este material teve uma feature de IA impressionante:
fotografar etiqueta de devolução, extrair os dados, gerar mensagem de WhatsApp. Foi
removida duas semanas depois — não porque a IA funcionava mal, mas porque **ninguém tinha
aquele problema**. A régua desta skill começa na dor, não na tecnologia: "onde a IA cabe
neste app?" é a pergunta errada. A certa é "qual tarefa de interpretar bagunça custa tempo
todo dia?" — e às vezes a resposta é "nenhuma", e o app fica melhor sem.

## Armadilhas

- **IA de demonstração.** Funcionalidade que impressiona na reunião e ninguém usa na
  segunda-feira. O teste dos 20 casos com material real revela isso antes do custo.
- **Gravar sem confirmar.** O acerto de 90% vira 10% de lixo silencioso no banco. Sempre
  sugestão → confirmação.
- **Instrução gigante que ninguém mantém.** Se o prompt do worker passou de uma tela,
  está tentando resolver com prosa o que era para ser código ou fluxo.
- **Dado sensível sem decisão.** Foto de nota fiscal tem CNPJ e preço; folha de ponto tem
  dado pessoal. Decida de caso pensado o que pode sair para a API — e escreva a decisão
  no `DECISOES.md` (LGPD agradece).
- **Trocar de modelo sem re-testar.** Os 20 casos existem para isso.

## Checklist de saída

- [ ] A tarefa passa na régua das três perguntas (bagunça, erro tolerável, olho humano)
- [ ] A chave da API vive no servidor; o navegador nunca a vê
- [ ] Existe teto de gasto configurado no painel do provedor
- [ ] A IA sugere e a pessoa confirma — nada é gravado direto
- [ ] O fluxo manual continua funcionando com a IA desligada
- [ ] Os 20 casos reais rodaram, com acertos contados por campo
- [ ] O custo real do primeiro mês está anotado no `DECISOES.md`
