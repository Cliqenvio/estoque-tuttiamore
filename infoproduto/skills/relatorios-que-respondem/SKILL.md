---
name: relatorios-que-respondem
description: "Transforma os eventos guardados pelo app em respostas: os três relatórios que toda operação pede, CSV que abre certo no Excel brasileiro, envio automático por rotina e o critério honesto de quando (não) fazer dashboard. Use quando surgir 'quero um relatório', 'quanto a gente vendeu/conferiu/gastou', 'preciso mandar isso pra contabilidade', 'quero um gráfico', 'quero um dashboard', ou quando a v1 do app já roda e chegou a hora dos números que ficaram de fora do escopo."
---

# Relatórios que respondem

## Por que esta skill existe

O escopo da v1 deixou relatórios de fora — de propósito, e foi a decisão certa. Mas o app
rodando gera a cobrança inevitável: *"e os números?"*. Esta skill existe para essa hora,
e para evitar os dois destinos ruins dos números em app interno: o dashboard de vaidade
que ninguém abre depois da segunda semana, e a exportação crua que obriga alguém a passar
uma hora no Excel toda sexta.

## A regra: relatório é uma pergunta, não uma tela

Ninguém precisa de "um relatório". Alguém precisa de uma **resposta**: quanto entrou hoje?
cadê o pedido 4412? o que eu mando para a contabilidade no dia 1º?

Portanto a skill começa sempre pela mesma exigência: **qual pergunta, de quem, com que
frequência?** Se ninguém fez a pergunta de verdade — se é "seria bom ter uns gráficos" —
pare aqui. Relatório sem dono é a funcionalidade mais abandonada do software interno.

Para cada pedido, anote três coisas:

| Pergunta | Quem pergunta | Frequência |
|---|---|---|
| "quanto foi conferido hoje?" | dono, fim do dia | diária |
| "cadê o produto X / o que houve com ele?" | expedição | quando some algo |
| "fechamento do mês para o contador" | financeiro | mensal |

Essas três linhas são, com outros nomes, **os três relatórios que quase toda operação
pede** — o resumo do período, o rastreio de um item, e o fechamento para alguém de fora.
Comece por eles; o resto é variação.

## A recompensa do modelo de eventos

Se o app seguiu a skill `modelo-de-dados` — guardar movimentos, calcular saldos — todo
relatório é uma consulta simples sobre o que já existe:

- **Resumo do dia** = movimentos com `quando` dentro do dia, agrupados por tipo
- **Rastreio do item** = todos os movimentos daquele `sku`, em ordem, com `quem` e `origem`
- **Fechamento do mês** = agregado do período, com saldo inicial e final por produto

Nenhum campo novo, nenhuma migração. É agora que a decisão do capítulo de dados paga o
que prometeu. Se algum relatório pedir um dado que não está nos eventos (ex.: custo na
época do movimento), a correção é passar a **gravar o dado no evento daqui para a frente**
— não tentar reconstruir o passado inventando valores.

### Defina cada número por escrito

A briga clássica de relatório não é técnica: é "vendas" significando pedido feito para uma
pessoa e pedido pago para outra. Todo relatório ganha uma linha de definição visível no
próprio rodapé: *"Conferido = itens bipados com sessão fechada. Exclui ajustes manuais."*
Uma linha dessas evita meses de números que "não batem" entre duas pessoas que estão ambas
certas.

## CSV que abre certo no Excel brasileiro

A exportação é o relatório mais barato e o mais usado — desde que abra certo. Para o
Excel em português:

```js
const SEP = ";";                       // Excel pt-BR espera ponto e vírgula
const BOM = "\uFEFF";              // sem isso, acentos viram lixo no Excel
const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
const num = c => (c / 100).toFixed(2).replace(".", ",");   // centavos → "1234,56"

const linhas = [
  ["data", "sku", "produto", "tipo", "quantidade", "valor"].join(SEP),
  ...movimentos.map(m => [
    m.quando.slice(0, 10), esc(m.sku), esc(m.nome), m.tipo, m.quantidade, num(m.valor)
  ].join(SEP)),
];
const blob = new Blob([BOM + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
```

As quatro decisões que importam aí: separador `;`, BOM na frente, decimal com vírgula, e
data ISO (`2026-08-20`) que ordena sozinha. Nomeie o arquivo com o período:
`conferencias-2026-08.csv`, nunca `export.csv`.

## Quando fazer gráfico — e quando não

Gráfico responde **comparação e tendência**; número responde **quantidade**. "Quanto
conferimos hoje?" é um número grande na tela, não um gráfico. "Estamos conferindo mais
rápido que no mês passado?" é uma linha no tempo.

Regras que evitam constrangimento:

- Um gráfico por pergunta. Painel com oito gráficos não responde nenhuma.
- Barras para comparar categorias, linha para tempo. Pizza quase nunca — acima de 3
  fatias ninguém compara ângulo.
- O número da semana **ao lado** do gráfico, em texto grande. Metade das pessoas só quer
  o número.

E o critério honesto para dashboard: **só quando a mesma pergunta foi feita três semanas
seguidas.** Antes disso, o CSV e o resumo respondem melhor e custam um décimo. Dashboard
construído no entusiasmo da primeira semana é o que vira abandono na terceira.

## Envio automático: o relatório que chega sozinho

O melhor relatório é o que ninguém precisa lembrar de abrir. Quando um resumo já foi
pedido (e aberto!) por duas semanas, automatize a entrega:

- **O mais simples que funciona:** uma GitHub Action agendada (`on: schedule`) que roda um
  script, monta o resumo e manda por e-mail — e-mail chega para todo mundo, não exige app.
- **No app:** o resumo do dia pronto na tela inicial ao abrir (zero infraestrutura).
- **WhatsApp:** só via API oficial (custo e cadastro) — para equipe pequena, um botão
  "copiar resumo" que a pessoa cola no grupo entrega 90% do valor com 0% da complicação.

Regra de ouro da automação: **só automatize o que alguém já consome manualmente.**
Automatizar relatório que ninguém abre só torna o desperdício pontual.

## O relatório que vira alerta: "me avisa quando"

O passo seguinte é o pedido que toda operação faz: *"me avisa quando o estoque ficar
abaixo do mínimo"*, *"quando um pedido passar de 3 dias parado"*. Alerta é um relatório
com gatilho — a mesma consulta sobre os eventos, rodada pela mesma rotina agendada, que só
fala quando a condição dispara.

Duas regras mantêm os alertas vivos:

1. **Todo alerta precisa de uma ação associada.** "Estoque baixo" sem "e aí faço o quê?"
   é ruído. Alerta demais treina a equipe a ignorar — inclusive o importante.
2. **A regra do silêncio suspeito.** Toda rotina agendada registra "rodei às X" num lugar
   visível (a tela inicial serve). Rotina que para de rodar é a falha que ninguém nota por
   um mês — o carimbo de execução entra na conferência mensal da skill `no-ar-e-vivo`,
   junto com o backup. E a mesma rotina agendada que manda o resumo pode exportar o backup,
   aposentando a rotina manual semanal que ninguém sustenta.

## Como pedir ao assistente

> O dono pergunta todo fim de dia quanto foi conferido. Crie a tela "Resumo do dia": total
> de itens, total por tipo de movimento e os 5 produtos mais movimentados, calculados dos
> movimentos gravados — sem campo novo no modelo. Um botão "Exportar CSV (Excel)" com
> ponto e vírgula, BOM e decimal com vírgula, nome do arquivo com a data. No rodapé, a
> definição por extenso do que conta como "conferido". Siga o padrão dos arquivos existentes.

## Armadilhas

- **Dashboard primeiro, pergunta depois.** É a ordem inversa; o resultado enfeita e não
  responde.
- **Números que "não batem".** Dois relatórios com a mesma palavra e definições diferentes.
  A linha de definição no rodapé existe para isso.
- **Recalcular o passado com regra nova.** Mudou a definição? Marque a data da mudança no
  relatório ("a partir de ago/2026, inclui ajustes") em vez de reescrever a história.
- **Exportar a tabela crua com 14 colunas.** Exportação também é uma resposta: só as
  colunas da pergunta.
- **Relatório sem dono continua sendo mantido.** Se ninguém abriu por um mês, remova.
  Relatório a menos é manutenção a menos.

## Checklist de saída

- [ ] Cada relatório existente responde uma pergunta que alguém fez de verdade
- [ ] Todo número tem definição por extenso visível no próprio relatório
- [ ] O CSV abre certo no Excel em português (acentos, vírgula decimal, colunas)
- [ ] Tudo é calculado dos eventos — nenhum total gravado à parte para "facilitar"
- [ ] O que é consumido toda semana chega sozinho (ou está na tela inicial)
- [ ] Toda rotina agendada mostra "rodei às X" — e alguém confere o carimbo no mês
- [ ] Você sabe dizer qual relatório ninguém abre — e já removeu
