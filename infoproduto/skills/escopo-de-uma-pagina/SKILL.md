---
name: escopo-de-uma-pagina
description: "Transforma um processo manual da empresa em um escopo de uma página antes de escrever qualquer código. Use quando a pessoa disser que quer 'criar um app', 'fazer um sistema', 'automatizar uma planilha', 'parar de controlar no caderno/WhatsApp/Excel', ou quando trouxer uma ideia vaga de software interno. Também use quando um projeto já começou e ninguém consegue dizer em uma frase o que ele faz. Produz: dor, usuário, fluxo principal, dados, critério de pronto e a lista explícita do que NÃO entra na v1."
---

# Escopo de uma página

## Por que esta skill existe

Quase todo app interno que morre pela metade morreu do mesmo jeito: começou pela tela.
Alguém pediu "um sistema de estoque", o assistente gerou 14 telas bonitas, e três dias
depois ninguém sabia dizer qual problema aquilo resolvia. O custo não foi o código — foi
a decisão que ninguém tomou.

O trabalho aqui é ir do "quero um app" para uma página que qualquer pessoa da empresa lê
em dois minutos e concorda. Antes disso, não se escreve código.

## Como conduzir

Faça as perguntas em blocos, **no máximo três por vez**, e espere a resposta. Se a pessoa
não souber responder, ofereça duas opções concretas em vez de repetir a pergunta.

### Bloco 1 — A dor (obrigatório)
1. Qual tarefa hoje é feita na mão e te custa tempo ou dinheiro?
2. Quem faz, quantas vezes por dia/semana, e quanto tempo leva cada vez?
3. O que dá errado quando dá errado? (o erro concreto, não "fica desorganizado")

Se a pessoa não conseguir citar **um erro concreto que já aconteceu**, o problema
provavelmente não dói o bastante para virar software. Diga isso.

### Bloco 2 — O usuário real
4. Quem vai abrir isso todo dia? (cargo, não "a equipe")
5. Em que aparelho, em que lugar? (celular no estoque em pé? desktop no escritório? tablet no balcão?)
6. Essa pessoa é a que está pedindo o app, ou é outra? Se for outra, o que ela acha do processo atual?

O aparelho e o ambiente decidem metade da arquitetura. "Celular, em pé, com uma caixa na
outra mão" é um app completamente diferente de "desktop, sentado, com dois monitores".

### Bloco 3 — O fluxo principal
7. Descreva o caminho feliz em no máximo 7 passos, do começo ao fim, como se fosse uma receita.
8. Onde entra a informação e para onde ela vai depois? (planilha, ERP, WhatsApp, e-mail, nada)

Escreva os 7 passos de volta para a pessoa confirmar. Se sair mais de 7, tem mais de um
app aí dentro — escolha um.

### Bloco 4 — Os dados
9. Que informação precisa ficar guardada depois que a pessoa fecha o app?
10. De onde vem hoje? (planilha, sistema, cabeça de alguém)
11. Quanta coisa? (30 itens ou 30 mil? 5 registros por dia ou 5 mil?)

### Bloco 5 — Pronto é quando
12. Como você vai saber, em uma frase, que a v1 funcionou?

Force uma frase mensurável. "Ficar mais organizado" não serve. "A conferência de
recebimento sai em 15 minutos em vez de 2 horas" serve.

## O que produzir

Escreva o arquivo `ESCOPO.md` na raiz do projeto, exatamente com esta estrutura:

```markdown
# <Nome do app>

## A dor
<2 a 4 frases: o que é feito na mão hoje, por quem, quanto custa, o que dá errado.>

## Usuário e contexto
- **Quem usa:** <cargo>
- **Onde:** <aparelho, ambiente, condição>
- **Frequência:** <quantas vezes por dia/semana>

## O caminho feliz
1. <passo>
2. <passo>
... (máximo 7)

## Dados que precisam sobreviver
| O quê | De onde vem hoje | Volume | Quem edita |
|---|---|---|---|
| <entidade> | <origem> | <número> | <cargo> |

## Pronto é quando
<uma frase mensurável>

## FORA da v1
- <coisa boa que não entra agora>
- <coisa boa que não entra agora>
- <coisa boa que não entra agora>

## Riscos conhecidos
- <o que pode inviabilizar: API sem acesso, dado que não existe, pessoa que não vai usar>
```

## A regra do "FORA da v1"

A seção mais importante do documento é a que lista o que **não** vai ser feito. Ela precisa
ter no mínimo três itens, e eles precisam ser coisas que a pessoa realmente quer — não
palha. Se todos os itens de fora forem coisas que ninguém pediu, o corte não foi feito.

Candidatos clássicos a ficar de fora da v1 de um app interno:

- Relatórios e gráficos (a v1 exporta CSV; o gráfico vem depois que alguém sentir falta)
- Múltiplas empresas / filiais / centros de custo
- App nativo na loja de aplicativos (um site que abre no celular resolve)
- Notificação automática (WhatsApp, e-mail, push)
- Histórico de auditoria completo ("quem mudou o quê e quando")
- Perfis de permissão granulares (na v1 bastam dois: quem administra e quem opera)
- Integração com o ERP nos dois sentidos (comece lendo; escrever de volta é outro projeto)

## Armadilhas

- **Escopo que é uma lista de telas.** "Tela de cadastro, tela de listagem, tela de
  relatório" não é escopo, é chute de implementação. Escopo é fluxo e dado.
- **O app para todo mundo.** Se o escopo serve para três cargos diferentes, escolha o
  cargo que sofre mais e escreva para ele.
- **Substituir o ERP.** Ninguém substitui o ERP com um app de fim de semana. O app interno
  ganha exatamente onde o ERP é ruim: o pedaço manual, repetitivo, que ninguém automatizou.
- **Escopo escrito sozinho.** Se a pessoa que vai usar o app todo dia não leu o `ESCOPO.md`,
  ele não está validado. Peça para mandar para ela antes de continuar.

## Ao terminar

Leia o `ESCOPO.md` em voz alta para a pessoa e pergunte: *"se eu entregasse só isso, e nada
mais, resolveria seu problema?"*

- Se a resposta for **sim** → prossiga para a skill `ambiente-zero`.
- Se for **não** → falta um passo no caminho feliz; encontre qual e volte ao Bloco 3.
- Se for **"sim, mas seria bom se também..."** → o "mas" vai para a seção FORA da v1.
  Não negocie isso.
