---
name: nao-quebra
description: "Instala a rede de segurança mínima de um app interno: teste de fumaça dos caminhos críticos, revisão automática antes de cada mudança e rotina de commit/rollback. Use quando o app já tem gente usando, quando 'consertar uma coisa quebrou outra', quando houver medo de mexer no código, antes de qualquer alteração grande, ou quando alguém perguntar 'preciso escrever teste?'."
---

# Não quebra

## Por que esta skill existe

O momento em que app interno feito com IA morre é previsível: o app está no ar, funcionando,
e uma mudança pequena quebra algo em silêncio. Ninguém percebe por três dias. Quando
percebem, os dados de três dias estão errados, a confiança acabou e a equipe volta para a
planilha.

Não é preciso cobertura de teste de software crítico. São precisos **três hábitos** que
custam meia hora para instalar e valem o projeto inteiro.

## Hábito 1 — Teste de fumaça dos caminhos críticos

Não teste tudo. Teste o que, se quebrar, para a operação. Em quase todo app interno são
de três a sete caminhos.

Para o app de estoque do estudo de caso:

1. Bipar um código existente mostra o produto certo
2. Bipar um código inexistente oferece associar, sem travar a bipagem
3. A conferência sobrevive a fechar e reabrir o navegador
4. Exportar CSV sai com o total certo
5. Usuário não autorizado não entra

Peça ao assistente para escrever isso como teste automático, na ferramenta mais simples
que o projeto suportar:

> Escreva testes de fumaça para estes 5 caminhos usando Playwright. Um arquivo,
> um teste por caminho, sem mock do que dá para usar de verdade. Cada teste precisa
> falhar de forma óbvia, com mensagem em português dizendo qual caminho quebrou.

```bash
npx playwright test          # roda tudo
```

**O teste que importa é o que já pegou um bug.** Toda vez que algo quebrar em produção,
o conserto tem duas partes: corrigir **e** adicionar o teste daquele caso. Assim a mesma
falha nunca volta duas vezes.

## Hábito 2 — Revisão antes de aceitar

Código gerado por IA parece pronto. É o risco principal: ele é plausível, bem formatado,
comentado — e às vezes errado de um jeito que só aparece com dado real.

Antes de commitar qualquer mudança que não seja trivial:

```bash
git diff              # olhe você mesmo, sempre
```

E peça uma revisão adversarial — o pedido importa mais do que parece:

> Revise o diff atual procurando **defeito**, não elogio. Para cada problema: arquivo,
> linha, qual entrada concreta faz quebrar e o que acontece. Foque em: dado que não existe,
> texto onde espera número, lista vazia, dois cliques, erro de rede, e valor que já está
> gravado no formato antigo. Se não houver defeito, diga "nenhum" — não invente.

No Claude Code, `/code-review` já faz esse trabalho com verificação adversarial das
descobertas, e `/security-review` cobre o lado de segurança.

**Três perguntas para fazer a si mesmo antes de aceitar código que você não entendeu:**

1. Se isso quebrar às 7h de uma segunda-feira, eu consigo achar onde?
2. Que dado eu tenho que **não** foi testado aqui?
3. Isso apaga ou sobrescreve alguma coisa? Dá para desfazer?

Se a resposta da 1 for "não", peça ao assistente para explicar o código em português antes
de aceitar. Código que ninguém entende é dívida com juros.

## Hábito 3 — Commit pequeno, rollback barato

O Git é o desfazer do projeto — mas só funciona se os commits forem pequenos e frequentes.

```bash
git add . && git commit -m "Exportacao CSV: corrige total quando ha ajuste negativo"
```

Uma mudança por commit. Mensagem que diz **o que mudou para o usuário**, não "ajustes".

Quando algo quebrar em produção:

```bash
git log --oneline                  # ache o último commit bom
git revert <hash-do-commit-ruim>   # desfaz mantendo o histórico
git push
```

`revert` é melhor que `reset` em código publicado: ele desfaz sem apagar história, e o
histórico é o que permite entender o que aconteceu.

E antes de qualquer mudança arriscada, um ramo separado custa cinco segundos:

```bash
git checkout -b tentativa-nova-conferencia
# se der certo: mescla. Se der errado: git checkout main e esqueça.
```

## O momento perigoso: mudança no formato do dado

A quebra mais cara não é de código, é de **dado**. Você muda `quantidade` de inteiro para
decimal, ou renomeia um campo, e os registros já gravados param de ser lidos.

Antes de mudar formato de dado gravado:

1. **Faça o backup** (exporte tudo — veja `no-ar-e-vivo`)
2. Escreva a migração para os dados antigos e rode nela primeiro
3. Deixe o código ler os **dois** formatos por um tempo
4. Só remova o formato antigo quando não sobrar registro nele

## Rotina semanal de 15 minutos

Uma vez por semana, com o app já em uso:

```bash
npx playwright test        # os caminhos críticos ainda passam?
git log --oneline -10      # o que mudou na semana
npm outdated               # alguma dependência com falha de segurança conhecida
```

E abra o app como usuário comum, no celular, e faça um ciclo completo. Leva três minutos e
pega o que teste automático não pega: a tela que ficou feia, o botão que sumiu no iPhone,
a lentidão que apareceu.

## Armadilhas

- **Teste que testa o mock.** Se o teste substitui o banco, a API e o relógio, ele testa a
  sua imaginação. Teste com o mais real que der.
- **Cobertura como meta.** 80% de cobertura em código que ninguém usa não vale um teste no
  caminho que a operação percorre 200 vezes por dia.
- **Commitar sem rodar.** "É uma mudança pequena" é a frase que antecede todo incidente.
- **Consertar sem entender.** Quando o assistente propõe um conserto, pergunte *por que
  quebrou*. Se a explicação não fizer sentido, o conserto provavelmente esconde o sintoma.

## Checklist de saída

- [ ] Existem de 3 a 7 testes de fumaça nos caminhos que param a operação
- [ ] Os testes rodam com um comando e você sabe qual é
- [ ] Todo bug que apareceu em produção virou um teste
- [ ] Commits são pequenos, com mensagem que descreve o efeito
- [ ] Você já executou um `git revert` pelo menos uma vez, de propósito, para saber fazer
