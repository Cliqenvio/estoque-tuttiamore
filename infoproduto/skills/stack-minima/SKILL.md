---
name: stack-minima
description: "Escolhe a tecnologia mais simples que resolve o problema de um app interno e registra a decisão por escrito. Use quando alguém perguntar 'que linguagem eu uso', 'preciso de banco de dados?', 'React ou não?', 'preciso de servidor?', 'quanto vai custar de hospedagem', ou quando o assistente estiver prestes a criar um projeto e ainda não houver decisão registrada. Considera número de usuários, aparelho, internet, orçamento e quem vai manter. Produz um arquivo DECISOES.md."
---

# Stack mínima

## Por que esta skill existe

Assistentes de código têm um viés: eles geram o que mais apareceu no treino. Para "app
de estoque" isso costuma significar Next.js + Postgres + Docker + autenticação com
provedor externo + fila de mensagens — uma stack que uma equipe de cinco pessoas manteria
com esforço, entregue para uma pessoa que nunca abriu um terminal.

Complexidade não é gratuita: ela é paga depois, sozinho, no dia em que quebra.

**A regra:** escolha a coisa mais simples que aguenta o volume descrito no `ESCOPO.md` —
e não a mais simples que existe. Simples demais também cobra: uma planilha compartilhada
com 8 pessoas editando ao mesmo tempo é um problema pior que um banco de dados.

## As 6 perguntas que decidem tudo

Responda com base no `ESCOPO.md`. Se faltar alguma, pergunte.

1. **Quantas pessoas usam ao mesmo tempo?** (1–3 / 4–20 / mais de 20)
2. **Em que aparelho?** (celular / desktop / os dois)
3. **Precisa funcionar sem internet?** (sim / não)
4. **Os dados podem ficar só no aparelho, ou várias pessoas precisam ver o mesmo dado?**
5. **Existe sistema que já tem esses dados?** (ERP, e-commerce, planilha na nuvem)
6. **Quem vai mexer nisso daqui a seis meses?** (você / alguém técnico / ninguém)

A pergunta 6 é a que mais gente ignora e a que mais cobra. Se a resposta é "ninguém",
a stack precisa ser algo que continue funcionando parado — sem atualização de dependência,
sem certificado expirando, sem servidor para reiniciar.

## Tabela de decisão

| Situação | Stack recomendada | Por quê |
|---|---|---|
| 1–3 pessoas, dados só de leitura, roda no celular | **HTML + CSS + JavaScript puro, hospedado no GitHub Pages** | Zero build, zero servidor, zero custo. Abre como site, instala como app. |
| 4–20 pessoas, precisam ver o mesmo dado, sem tela complexa | **Front simples + Supabase** (banco + login prontos) | Banco de verdade sem administrar servidor. Plano gratuito costuma bastar. |
| Precisa guardar pouco estado compartilhado, mas nada mais | **Front simples + Cloudflare Workers + KV** | Um arquivo de servidor, publica em segundos, custo praticamente zero. |
| Muitas telas, muitos formulários, mais de 20 pessoas | **Next.js + Postgres gerenciado (Supabase/Neon), publicado na Vercel** | Aguenta crescer; aceite o custo de manutenção. |
| Os dados já vivem numa planilha e vão continuar vivendo | **App que lê e escreve na planilha via API** | Não migre o que ninguém pediu para migrar. |
| Só precisa transformar dado e cuspir relatório | **Script + planilha. Não faça um app.** | Nem todo problema é app. |

## O default para app interno de empresa pequena

Se a resposta honesta para as 6 perguntas for "não sei ainda", comece assim:

- **Front:** HTML, CSS e JavaScript sem framework, sem passo de build
- **Guardar dado local:** `localStorage` / IndexedDB
- **Guardar dado compartilhado:** só se o escopo exigir — e aí, Supabase ou um Worker com KV
- **Hospedar:** GitHub Pages (gratuito, HTTPS, publica a cada `git push`)
- **Instalar no celular:** um `manifest.json` transforma o site em app instalável (PWA),
  sem loja de aplicativos, sem taxa de 30%, sem revisão da Apple

Isso não é "gambiarra de iniciante". É a stack certa para o problema: um app usado por
seis pessoas do estoque não tem os problemas de um app usado por seis milhões.

## O que perguntar antes de aceitar uma dependência

Cada biblioteca nova precisa passar por estas quatro perguntas:

1. Quanto código eu escreveria sem ela? (se a resposta for "umas 30 linhas", escreva as 30 linhas)
2. Ela precisa de um passo de build?
3. Ela quebra sozinha se ficar seis meses sem atualizar?
4. Se ela sumir amanhã, o app para?

## Custo — diga o número

Termine sempre com o custo mensal estimado, em reais, incluindo o cenário de crescimento:

| Item | Hoje | Se dobrar o uso |
|---|---|---|
| Hospedagem | R$ 0 (GitHub Pages) | R$ 0 |
| Banco | R$ 0 (Supabase free até 500 MB) | ~R$ 130/mês (plano Pro) |
| Domínio próprio | ~R$ 40/ano | ~R$ 40/ano |
| IA dentro do app (se houver) | por uso | por uso |

Se algum item puder virar uma conta inesperada (cobrança por uso, por requisição, por
token), diga isso em voz alta agora e configure um limite de gasto no painel do provedor.

## O que produzir

Escreva `DECISOES.md` na raiz do projeto:

```markdown
# Decisões técnicas

## Stack escolhida
- **Front:** <o quê>
- **Dados:** <onde ficam>
- **Hospedagem:** <onde>
- **Autenticação:** <como>

## Por quê
<3 a 5 frases ligando a escolha às respostas das 6 perguntas.>

## O que foi recusado e por quê
- **<tecnologia>** — <motivo do descarte>

## Custo mensal estimado
<tabela>

## Quando essa decisão deve ser revista
<gatilho concreto: "quando passar de 20 usuários", "quando a planilha passar de 5 mil linhas">
```

## Armadilhas

- **Escolher pela lista de vagas.** A stack que dá emprego não é a stack que resolve o
  problema de seis pessoas do estoque.
- **Banco de dados por reflexo.** Muito app interno guarda menos de 5 mil registros que
  mudam uma vez por dia. Isso cabe num arquivo JSON versionado no Git.
- **Docker sem servidor.** Se você não vai administrar um servidor, você não precisa de
  container.
- **Login com provedor externo antes de existir app.** Configurar OAuth leva mais tempo
  que a v1 inteira. Veja a skill `quem-entra-e-quem-ve`.
