---
name: ambiente-zero
description: "Prepara do zero a máquina de quem nunca programou para construir um app com IA: instala Node, Git, o assistente de código (Claude Code, Codex CLI ou equivalente), cria a conta e o repositório no GitHub e valida tudo com um teste real. Use quando a pessoa disser que 'não tem nada instalado', 'não sei nem por onde começar', 'nunca usei terminal', quando aparecerem erros de 'command not found', 'npm não é reconhecido', 'permission denied', ou quando for preciso montar o ambiente em um computador novo."
---

# Ambiente zero

## Por que esta skill existe

A maior taxa de desistência não está no código — está nos primeiros 40 minutos, no
terminal preto que responde `command not found`. Quem nunca programou não sabe que isso
é normal, acha que quebrou o computador, e para.

O trabalho aqui é chegar a um estado verificável: **a pessoa digita um comando, algo
acontece, e ela entende o que aconteceu.**

## Regra de conduta

- **Um comando por vez.** Nunca despeje um bloco de seis comandos. Mande um, peça para
  colar a saída, confirme, mande o próximo.
- **Diga sempre o que vai acontecer antes.** "Esse comando vai baixar ~80 MB e demorar
  uns 2 minutos. No fim ele imprime um número de versão."
- **Erro é esperado, não é fracasso.** Diga isso na primeira vez que um aparecer.
- **Nunca peça para desligar antivírus, rodar como administrador sem explicar, ou colar
  um script de origem desconhecida.**

## Passo 0 — Descobrir onde a pessoa está

Antes de qualquer instalação, rode o diagnóstico:

```bash
# macOS / Linux
uname -s -m; node -v 2>/dev/null || echo "node: FALTA"; git --version 2>/dev/null || echo "git: FALTA"
```

```powershell
# Windows (PowerShell)
$PSVersionTable.PSVersion; node -v; git --version
```

Se a pessoa não sabe abrir o terminal:
- **macOS:** `Cmd + Espaço`, digite `Terminal`, Enter.
- **Windows:** tecla Windows, digite `PowerShell`, Enter. (Não use o "Prompt de Comando" antigo.)
- **Linux:** `Ctrl + Alt + T`.

## Passo 1 — Node.js

O assistente de código roda em cima do Node. É a única dependência obrigatória.

- **Todos os sistemas:** baixar o instalador **LTS** em <https://nodejs.org> e seguir o
  assistente gráfico. É o caminho com menos chance de erro para quem está começando.
- **macOS com Homebrew já instalado:** `brew install node`
- **Windows com winget:** `winget install OpenJS.NodeJS.LTS`

Valide **fechando e reabrindo o terminal** (isso é obrigatório: o terminal só enxerga
programas novos depois de reiniciar) e rodando:

```bash
node -v
npm -v
```

Precisa aparecer algo como `v22.x.x` e `10.x.x`. Se aparecer `command not found` mesmo
depois de reabrir, o instalador não colocou o Node no PATH — reinstale pelo instalador
oficial em vez de tentar consertar o PATH na mão.

## Passo 2 — Git

Git é o "salvar com histórico". Sem ele, não existe desfazer, e não existe publicar.

- **macOS:** `xcode-select --install` (vem junto) ou `brew install git`
- **Windows:** `winget install Git.Git`
- **Linux (Debian/Ubuntu):** `sudo apt install git`

Configure a identidade — sem isso o Git recusa gravar:

```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"
git config --global init.defaultBranch main
```

## Passo 3 — O assistente de código

Escolha **um**. Todos funcionam para o que este material ensina.

| Ferramenta | Instalação | Roda onde |
|---|---|---|
| Claude Code | `npm install -g @anthropic-ai/claude-code` | terminal, VS Code, navegador |
| Codex CLI | `npm install -g @openai/codex` | terminal |
| Gemini CLI | `npm install -g @google/gemini-cli` | terminal |

Depois de instalar, rode o comando (`claude`, `codex` ou `gemini`) e faça o login que ele
pedir — abre o navegador, você entra na conta, volta para o terminal.

> **Erro comum:** `EACCES: permission denied` no `npm install -g` (macOS/Linux).
> **Não** resolva com `sudo npm install -g`. Isso instala pacotes como root e cria
> problemas piores depois. Resolva mudando a pasta global do npm:
> ```bash
> mkdir -p ~/.npm-global && npm config set prefix ~/.npm-global
> echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc && source ~/.zshrc
> ```

## Passo 4 — GitHub

O GitHub é onde o código fica guardado fora da sua máquina. Serve para três coisas que
importam: **backup**, **histórico** e **publicar o app na internet**.

1. Criar conta em <https://github.com> (gratuita).
2. Criar um repositório **privado** com o nome do projeto. Privado é o padrão correto para
   app interno de empresa.
3. Conectar a pasta local:

```bash
mkdir meu-app && cd meu-app
git init
echo "# Meu app" > README.md
git add . && git commit -m "Primeiro commit"
git remote add origin https://github.com/SEU-USUARIO/meu-app.git
git push -u origin main
```

Na primeira vez o Git vai pedir login. Use o navegador quando ele oferecer, ou gere um
**Personal Access Token** em Settings → Developer settings → Tokens. A senha da conta
não funciona mais no `git push`.

## Passo 5 — O teste que prova que funciona

Não termine sem isso. Dentro da pasta do projeto, abra o assistente e peça:

> Crie um arquivo `index.html` com uma página que mostre "Funciona" em letras grandes e a
> data de hoje. Depois me diga como abrir no navegador.

Se a pessoa vir a página no navegador, o ambiente está pronto — e, mais importante, ela
acabou de ver o ciclo inteiro: **pedir → gerar → ver acontecer.**

## Passo 6 — As três coisas que ela precisa saber usar

Ensine só isso, agora. O resto vem quando doer.

1. **`cd <pasta>`** — entrar numa pasta. `cd ..` volta uma.
2. **`git add . && git commit -m "o que mudou"`** — salvar um ponto de restauração.
3. **`git push`** — mandar para o GitHub.

E o mais valioso: **`git log --oneline`** para ver o histórico, e
**`git restore .`** para jogar fora as mudanças não salvas quando algo der muito errado.

## Checklist de saída

- [ ] `node -v` responde com um número
- [ ] `git --version` responde com um número
- [ ] `git config user.email` mostra o e-mail certo
- [ ] O assistente abre e responde
- [ ] Existe um repositório privado no GitHub com pelo menos um commit
- [ ] A pessoa abriu uma página gerada por ela no próprio navegador
