# Do zero ao app — 10 skills

Infoproduto: um PDF-guia de 48 páginas + 10 skills instaláveis que levam alguém que
nunca programou do problema manual até um aplicativo de uso interno publicado e em uso
pela equipe — construído com Claude Code, Codex CLI ou equivalente.

## O que tem aqui

```
infoproduto/
├── dist/
│   └── do-zero-ao-app-10-skills.pdf     ← o produto entregue ao comprador
├── skills/                              ← as 10 skills instaláveis
│   ├── instalar.sh                        (copia tudo para ~/.claude/skills)
│   ├── README.md
│   ├── escopo-de-uma-pagina/SKILL.md
│   ├── ambiente-zero/SKILL.md
│   ├── stack-minima/SKILL.md
│   ├── modelo-de-dados/SKILL.md
│   ├── primeira-tela-viva/SKILL.md
│   ├── fluxo-completo/SKILL.md
│   ├── quem-entra-e-quem-ve/SKILL.md
│   ├── dados-que-ja-existem/SKILL.md
│   ├── nao-quebra/SKILL.md
│   └── no-ar-e-vivo/SKILL.md
└── build/                               ← como o PDF é gerado
    ├── bordas.html                        capa, ficha e contracapa (sangria total)
    ├── livro.html                         o miolo inteiro
    ├── estilo.css                         o sistema visual
    ├── fontes.css + fonts/                Fraunces, Inter e JetBrains Mono embutidas
    ├── gerar.js                           renderiza com Chromium via Playwright
    └── build.py                           orquestra as duas passadas e junta tudo
```

## Como o PDF é gerado

```bash
cd build && python3 build.py
```

O build roda em duas passadas porque o sumário precisa dos números de página reais:

1. Renderiza o miolo e extrai o texto de cada página para descobrir onde cada capítulo caiu.
2. Escreve esses números no sumário e renderiza de novo. Se a paginação mudar por causa
   dos números (um "8" que virou "13" e empurrou uma linha), faz uma terceira passada.
3. Junta capa + ficha + miolo + contracapa e grava em `dist/`.

Duas páginas de folga no início do miolo são descartadas na junção — é o truque que faz o
número impresso no rodapé bater exatamente com a página física do PDF.

### Requisitos do build

- Node com `playwright` disponível (usa o Chromium já instalado, não baixa nada)
- Python com `pypdf`
- As fontes ficam versionadas em `build/fonts/`, então o build funciona offline

## Estrutura do guia

| | Capítulo | Skill | Entregável |
|---|---|---|---|
| 01 | Escopo de uma página | `escopo-de-uma-pagina` | `ESCOPO.md` |
| 02 | Ambiente zero | `ambiente-zero` | máquina pronta + repositório |
| 03 | Stack mínima | `stack-minima` | `DECISOES.md` |
| 04 | Modelo de dados | `modelo-de-dados` | `MODELO.md` + dados de exemplo |
| 05 | Primeira tela viva | `primeira-tela-viva` | app no ar fazendo uma coisa real |
| 06 | Fluxo completo | `fluxo-completo` | o processo inteiro funcionando |
| 07 | Quem entra e quem vê | `quem-entra-e-quem-ve` | login, papéis, segredos protegidos |
| 08 | Dados que já existem | `dados-que-ja-existem` | dados legados validados dentro do app |
| 09 | Não quebra | `nao-quebra` | testes de fumaça + revisão + rollback |
| 10 | No ar e vivo | `no-ar-e-vivo` | app publicado, backup, custo, manual |

Mais: introdução com a tese do app interno, as 7 regras de como falar com o assistente, o
estudo de caso do app de bipagem deste repositório, e quatro apêndices (instalação das
skills, skills públicas que combinam com cada etapa, plano de 30 dias e glossário).

## Editar o conteúdo

Todo o texto do guia está em `build/livro.html`, em ordem de leitura. As classes que
importam:

- `.abertura` — abre um capítulo em página nova (número, fase, título, skill, resumo)
- `.caixa.prompt` — bloco escuro com um pedido pronto para colar no assistente
- `.caixa.armadilha` — os erros comuns daquela etapa
- `.caixa.checklist` — o "só avance quando" do fim do capítulo
- `.caixa.caso` — exemplo tirado de projeto real
- `.regra` — a frase-chave destacada entre filetes

Se você adicionar ou remover uma seção que aparece no sumário, registre a âncora e o
trecho de busca na lista `ALVOS` em `build/build.py`.
