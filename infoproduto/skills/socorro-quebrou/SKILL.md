---
name: socorro-quebrou
description: "O passo a passo do incidente em app interno: o que fazer, em ordem, no momento em que ele quebra em produção com a equipe usando. Use quando surgir 'parou de funcionar', 'deu erro na tela de todo mundo', 'tela branca', 'sumiram os dados', 'não salva mais', 'depois da atualização quebrou', ou quando alguém estiver prestes a mexer direto em produção sem diagnóstico. Cobre triagem em 5 minutos, revert antes de conserto, coleta de erro, dados corrompidos, comunicação com a equipe e o post-mortem de 5 linhas."
---

# Socorro, quebrou

## Por que esta skill existe

A skill `nao-quebra` diminui a chance do incidente. Esta aqui existe porque a chance nunca
chega a zero — e o que decide se o app perde a confiança da equipe não é quebrar, é
**quanto tempo fica quebrado e o que acontece com os dados nesse meio-tempo**.

O erro clássico do momento de pânico: abrir o código e sair mexendo em produção, sem
diagnóstico, sem commit, com o telefone tocando. Quase sempre isso transforma um problema
em dois.

## Regra zero: estanque primeiro, entenda depois

Na ordem, sem pular:

1. **Pare a sangria.** Se o app está gravando dado errado, avise a equipe para pausar o uso
   agora ("continuem no papel por 30 minutos"). Dado errado entrando é pior que app parado.
2. **Preserve a evidência.** Print da tela com o erro, hora exata, quem estava usando, o que
   a pessoa fez imediatamente antes. Não peça para "tentar de novo" ainda — repetir pode
   destruir a pista (ou duplicar um registro).
3. **Só então** comece o diagnóstico.

## Triagem em 5 minutos — as quatro perguntas

Antes de abrir qualquer arquivo, responda:

### 1. Qual versão aparece na tela?
Se o app carimba a versão (skill `no-ar-e-vivo`), essa pergunta resolve metade dos
chamados: a pessoa está numa versão de duas semanas atrás e um recarregar resolve.
No celular, PWA às vezes segura versão antiga — feche o app de verdade e reabra.

### 2. É com todo mundo ou com um aparelho?
- **Um aparelho** → problema local: versão velha, armazenamento cheio, permissão do
  navegador, data/hora errada no aparelho. Não mexa no código ainda.
- **Todo mundo, ao mesmo tempo** → problema central: o último deploy, o servidor/worker,
  a API externa que o app consome, o certificado.

### 3. Desde quando, e o que mudou?
```bash
git log --oneline --since="3 days ago"
```
Se o problema começou logo depois de um deploy, o culpado é o deploy até prova em
contrário. Não interessa que "a mudança era pequena e não tem nada a ver" — essa frase
já enganou todo mundo que constrói software.

### 4. A API externa está de pé?
Se o app depende de ERP, e-commerce ou serviço de terceiro, teste a origem antes de caçar
bug no seu código: o painel de status do serviço, ou um `curl` direto no endpoint. Falha
de terceiro é o incidente mais comum e o único que não é culpa do seu código.

## A decisão: reverter ou consertar?

**Se começou depois de um deploy: reverta primeiro, entenda depois.**

```bash
git log --oneline            # ache o commit do deploy que quebrou
git revert <hash>
git push                     # o deploy automático publica a versão boa
```

O revert devolve o app funcionando em minutos, tira a pressão, e transforma o incidente em
uma investigação com calma. Consertar "rapidinho" em cima do código quebrado, sob pressão,
é assim que um incidente de 20 minutos vira uma tarde perdida.

Conserte no lugar do revert apenas se ele for desfazer uma migração de dados já aplicada,
ou se a causa for óbvia e o conserto for uma linha que você **testou localmente antes de
subir**.

## Achando a causa quando não foi um deploy

Peça ajuda ao assistente do jeito certo — evidência primeiro, palpite depois:

> O app quebrou em produção. Sintoma: [o que a pessoa vê]. Mensagem de erro completa:
> [cole inteira, sem editar]. Começou em: [quando]. Último deploy: [quando, o que mudou].
> Acontece em: [um aparelho / todos]. Me ajude a formar hipóteses em ordem de probabilidade
> **antes** de propor qualquer conserto — e me diga como testar cada hipótese.

Para ver o erro no celular da pessoa: no Android, `chrome://inspect` no seu computador com
o aparelho no cabo USB mostra o console remoto; no caminho mais simples, um bloco no
próprio app que captura `window.onerror` e mostra/registra a última falha economiza essa
viagem — vale adicionar na primeira vez que fizer falta.

Quando houver vários commits suspeitos, o Git encontra o culpado por bisseção:

```bash
git bisect start
git bisect bad               # o estado atual está quebrado
git bisect good <hash-bom>   # um commit em que funcionava
# o git vai saltando pela metade; em cada parada você testa e responde:
git bisect good   # ou
git bisect bad
git bisect reset             # ao final, volta ao normal
```

Com 40 commits entre o bom e o ruim, são ~6 testes para achar o commit exato.

## Dados corrompidos ou perdidos

A parte com regras mais rígidas, porque aqui erro não tem desfazer:

1. **Antes de qualquer conserto, copie o estado atual** — exporte/despeje como estiver,
   errado mesmo. Consertar por cima do único retrato do problema destrói a evidência.
2. **Corrija por ajuste, não por edição.** No modelo de eventos (skill `modelo-de-dados`),
   o conserto é um movimento de `ajuste` com observação dizendo o porquê — nunca editar o
   registro histórico na mão. Seis meses depois, alguém vai perguntar "por que esse número
   mudou?", e a resposta estará gravada.
3. **Restauração de backup é a última opção, não a primeira** — ela desfaz também o
   trabalho bom feito depois do último backup. Calcule o que se perde antes de restaurar.

## Comunicação: uma mensagem, três informações

Mande no grupo da equipe assim que souber o básico — não quando tiver a solução:

> ⚠️ O app de estoque está fora do ar desde ~14h20. Enquanto isso, anotem as conferências
> no papel (planilha de contingência de sempre). Aviso aqui quando voltar — estimativa 1h.

O que quebrou, o que fazer enquanto isso, quando volta. Sem tecniquês, sem culpado, sem
novela. E quando voltar, avise que voltou — o silêncio pós-incidente é o que faz a equipe
perder a confiança, não o incidente.

## Depois: o post-mortem de 5 linhas

No dia seguinte (não no calor), escreva no repositório, em `INCIDENTES.md`:

```markdown
## 2026-08-20 — conferência travava ao bipar produto sem EAN
- **Impacto:** expedição parada 40 min; nenhum dado perdido
- **Causa:** deploy da véspera assumia EAN sempre preenchido
- **Conserto:** revert + correção com teste no dia seguinte
- **Para não repetir:** teste de fumaça novo cobrindo produto sem EAN
- **Sorte que tivemos:** era horário de pouco movimento (não contar com isso de novo)
```

A última linha de cada post-mortem vira trabalho: o teste novo entra na suíte da skill
`nao-quebra` **no mesmo dia**. Incidente que não vira teste é incidente agendado para
reaparecer.

## Armadilhas

- **Mexer em produção sem commitar antes.** Mesmo no incêndio: `git add . && git commit`
  antes de qualquer experimento. Custa cinco segundos e garante o caminho de volta.
- **Pedir "conserta isso" ao assistente sem evidência.** Ele vai propor algo plausível para
  o sintoma errado. Evidência completa primeiro, sempre.
- **"Funciona para mim."** Se quebra no aparelho da pessoa e não no seu, o problema está na
  diferença (versão, aparelho, dado daquela conta) — e a investigação é lá, não aqui.
- **Culpar o usuário.** "Ela clicou errado" descreve o gatilho, não a causa. App interno
  bom aguenta clique errado; se não aguentou, o conserto é no app.
- **Consertar e não contar.** Conserto silencioso ensina a equipe a não avisar da próxima
  falha — e a próxima você só descobre com três dias de dado errado.

## Checklist de saída

- [ ] O app voltou, e a equipe foi avisada de que voltou
- [ ] A causa é conhecida (não "parou de acontecer sozinho" — isso é o problema escondido)
- [ ] Se houve dado errado, foi corrigido por ajuste registrado, não por edição na mão
- [ ] O post-mortem de 5 linhas está no `INCIDENTES.md`
- [ ] O teste que teria pegado esse incidente existe e roda
