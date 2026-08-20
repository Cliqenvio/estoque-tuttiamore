---
name: fluxo-completo
description: "Expande a primeira tela para o processo inteiro do escopo, uma fatia por vez, com os estados que app interno de verdade precisa ter: vazio, carregando, erro, sem internet, sem permissão e desfazer. Use quando já existe algo funcionando e é hora de cobrir o caminho completo, quando o usuário reclamar que 'só serve para uma parte', ou quando aparecerem telas que travam, somem ou não avisam nada ao dar erro."
---

# Fluxo completo

## Por que esta skill existe

O caminho feliz é 20% do trabalho e 80% do que se vê nas demonstrações. O que separa um
protótipo de uma ferramenta que a equipe usa todo dia é o comportamento nas bordas:
lista vazia, internet caiu, o código não existe, a pessoa clicou duas vezes, a bateria do
tablet acabou no meio da conferência.

Quem trabalha em operação — estoque, expedição, balcão, obra — vive nas bordas.

## Como crescer: uma fatia vertical por vez

Uma fatia vertical é um passo do caminho feliz funcionando **inteiro**: tela, regra,
gravação e feedback. Nunca faça "todas as telas" e depois "toda a lógica".

Ordem recomendada:

1. A ação que a pessoa mais repete (bipar, lançar, conferir)
2. A ação que corrige a anterior (ajustar, desfazer, editar)
3. A visão do que já foi feito (lista, resumo do dia, saldo)
4. A saída dos dados (exportar CSV, imprimir, mandar)
5. Só então: cadastro e configuração

Cada fatia é um commit. Cada fatia é testável por uma pessoa real.

## Os sete estados obrigatórios de toda tela

Para cada tela do app, garanta e verifique:

| Estado | Como testar | O que precisa aparecer |
|---|---|---|
| **Vazio** | usuário novo, banco zerado | frase que ensina o próximo passo, não "sem resultados" |
| **Carregando** | rede lenta (DevTools → Network → Slow 4G; nas versões antigas, Slow 3G) | indicação visível; botão desabilitado |
| **Erro** | desligue o Wi-Fi e tente | o que houve, em português, e o que fazer agora |
| **Sem permissão** | entre com o usuário mais limitado | some com o botão; não mostre e bloqueie depois |
| **Muitos dados** | 5.000 registros | ainda rola liso; busca antes de lista |
| **Duplo clique** | clique 3× rápido em "Salvar" | grava **uma** vez |
| **Desfazer** | grave algo errado de propósito | dá para reverter sem SQL |

O estado vazio é o mais negligenciado e o mais barato de acertar. Compare:

- ❌ "Nenhum resultado encontrado."
- ✅ "Nenhuma conferência hoje. Bipe o primeiro código para começar."

## Regra de ouro do app de operação: o dado não pode morrer

Se o app é usado em pé, no celular, com uma caixa na outra mão, ele **vai** perder conexão
e a aba **vai** ser fechada por engano. Portanto:

- Grave localmente **a cada ação**, não ao final ("Salvar" no fim da conferência é uma
  armadilha: quem esquece perde uma hora de trabalho)
- Ao reabrir, ofereça retomar: *"Você tem uma conferência de 47 itens iniciada às 14h32.
  Continuar?"*
- Sincronize com o servidor quando houver rede, com marcação de pendência visível
- Se dois aparelhos editarem a mesma coisa, **detecte e avise** — nunca sobrescreva calado

Esse trio (grava sempre, retoma, avisa conflito) é o que faz operação confiar no app.

## Feedback: o usuário precisa saber que funcionou

Em ambiente barulhento, feedback visual não basta:

- **Som** curto e distinto para sucesso e para erro (dois tons diferentes, não o mesmo)
- **Vibração** no celular (`navigator.vibrate(50)` — só Android; o iPhone não vibra pelo navegador, lá confie no som)
- **Cor** ocupando área grande, não um texto de 12px
- **Nunca** só um `alert()` — trava a tela e exige toque

## Como pedir cada fatia ao assistente

Peça o comportamento, não o componente. Um pedido bom inclui a borda:

> Adicione ao app a tela de resumo da conferência. Ela lista os itens bipados agrupados por
> SKU, com quantidade, ordenados pelo último bipado no topo. Precisa ter: estado vazio com
> a frase "Nenhum item bipado ainda", botão "Exportar CSV" desabilitado quando a lista está
> vazia, e um "desfazer" no último item. A lista precisa continuar fluida com 3.000 itens.
> Não crie framework novo, siga o padrão dos arquivos existentes.

A última frase importa: sem ela, o assistente costuma introduzir uma biblioteca nova a
cada pedido, e o projeto vira uma colcha de retalhos.

## Mantendo a casa em ordem

A cada 3 ou 4 fatias, pare e faça uma passada de arrumação:

> Leia os arquivos do projeto e me diga: (1) que código está repetido em mais de um lugar,
> (2) que função passou de 50 linhas, (3) que nome não corresponde ao que a função faz.
> Não mude nada ainda, só me mostre a lista.

Depois decida o que vale corrigir. Fazer isso a cada 4 fatias custa 15 minutos; fazer no
mês três custa uma reescrita.

## Armadilhas

- **Pedir "termine o app".** Pedido grande gera código grande que ninguém revisa. Uma fatia
  por vez, um commit por fatia.
- **Confirmar tudo.** "Tem certeza?" em toda ação treina a pessoa a clicar sim sem ler.
  Confirme só o irreversível — e prefira oferecer desfazer.
- **Mensagem de erro técnica.** `TypeError: undefined is not an object` não ajuda ninguém.
  Traduza para o que a pessoa deve fazer.
- **Menu antes de conteúdo.** App interno com 4 telas não precisa de menu lateral com
  ícones. Precisa de 4 botões grandes.
- **Formulário de 20 campos.** Se o processo real preenche 4, mostre 4 e esconda o resto
  atrás de "mais opções".

## Checklist de saída

- [ ] Todo passo do caminho feliz do `ESCOPO.md` funciona no app
- [ ] Toda tela tem estado vazio, de carregamento e de erro
- [ ] O trabalho em andamento sobrevive a fechar a aba
- [ ] Existe desfazer para a ação mais perigosa
- [ ] Uma pessoa da operação fez um ciclo completo sozinha, sem você do lado
