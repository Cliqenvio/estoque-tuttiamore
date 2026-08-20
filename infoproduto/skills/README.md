# As 13 skills — Do zero ao app

Skills instaláveis que acompanham o infoproduto **Do zero ao app**.
As dez primeiras cobrem as etapas da construção de um app de uso interno com IA;
as três últimas cuidam da vida do app depois do lançamento.

| # | Skill | Fase | Entregável |
|---|---|---|---|
| 1 | `escopo-de-uma-pagina` | Descobrir | `ESCOPO.md` |
| 2 | `ambiente-zero` | Descobrir | máquina pronta + repositório |
| 3 | `stack-minima` | Descobrir | `DECISOES.md` |
| 4 | `modelo-de-dados` | Construir | `MODELO.md` + dados de exemplo |
| 5 | `primeira-tela-viva` | Construir | app no ar fazendo uma coisa real |
| 6 | `fluxo-completo` | Construir | o processo inteiro funcionando |
| 7 | `quem-entra-e-quem-ve` | Confiar | login, papéis, segredos fora do front |
| 8 | `dados-que-ja-existem` | Confiar | dados legados dentro do app, validados |
| 9 | `nao-quebra` | Confiar | testes de fumaça + revisão + rollback |
| 10 | `no-ar-e-vivo` | Entregar | app publicado, backup, custo, manual |
| 11 | `socorro-quebrou` | Crescer | incidente resolvido sem perder a confiança |
| 12 | `relatorios-que-respondem` | Crescer | números com dono, CSV certo, envio automático |
| 13 | `ia-dentro-do-app` | Crescer | IA no app com teto de custo e confirmação humana |

## Instalação

### Claude Code

```bash
# Para todos os seus projetos (recomendado)
./instalar.sh

# ou manualmente:
mkdir -p ~/.claude/skills
cp -r escopo-de-uma-pagina ambiente-zero stack-minima modelo-de-dados \
      primeira-tela-viva fluxo-completo quem-entra-e-quem-ve \
      dados-que-ja-existem nao-quebra no-ar-e-vivo \
      socorro-quebrou relatorios-que-respondem ia-dentro-do-app ~/.claude/skills/
```

Para instalar só no projeto atual, copie para `.claude/skills/` dentro do projeto.

Confira com `/skills` dentro do Claude Code — as 13 devem aparecer na lista.

### Codex CLI, Gemini CLI e outros assistentes

Esses assistentes ainda não carregam skills automaticamente. Use o conteúdo como
instrução: abra o `SKILL.md` da etapa e cole o corpo dele no início da conversa, ou
salve tudo num `AGENTS.md` na raiz do projeto.

## Como usar

Você não precisa chamar a skill pelo nome. Descreva o problema em português e o
assistente aciona a skill certa:

> Quero parar de controlar o estoque na planilha e fazer um app para a equipe usar no celular.

Se quiser forçar uma etapa específica no Claude Code, chame direto:

> Use a skill escopo-de-uma-pagina para o meu caso.

## Ordem

As skills 1 → 10 funcionam melhor em ordem, mas não são um trilho. Se o app já existe,
entre por onde dói: sem backup? `no-ar-e-vivo`. Quebra a cada mudança? `nao-quebra`.
Planilha para importar? `dados-que-ja-existem`. Quebrou em produção? `socorro-quebrou`.
Pediram gráficos? `relatorios-que-respondem`. Querem IA no app? `ia-dentro-do-app`.
