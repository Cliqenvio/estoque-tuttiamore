---
name: no-ar-e-vivo
description: "Publica o app para a equipe usar e monta o que faz ele continuar vivo depois: deploy automático, variáveis de ambiente, backup dos dados, custo controlado, manual de uma página e rotina de evolução. Use quando o app estiver pronto para sair da sua máquina, quando surgir 'como coloco no ar', 'como instalo no celular do pessoal', 'e se eu perder os dados', 'quanto custa por mês', ou quando um app já publicado estiver sem backup e sem dono."
---

# No ar e vivo

## Por que esta skill existe

Publicar é onde o app deixa de ser projeto e vira ferramenta. Também é onde aparecem as
perguntas que ninguém fez antes: quem instala no celular do pessoal? o que acontece se o
tablet quebrar? quem consegue mexer nisso se você estiver de férias?

Um app interno sem backup e sem manual não é um ativo da empresa — é um risco com a sua
cara nele.

## Parte 1 — Publicar

### Site estático (a maioria dos apps internos)

Se o app é HTML + CSS + JS, o caminho mais barato é o GitHub Pages:

1. Repositório → **Settings → Pages**
2. Source: **Deploy from a branch** → `main` → `/ (root)`
3. Salvar. Em ~2 minutos existe uma URL `https://<usuario>.github.io/<repo>/`

A partir daí, **todo `git push` publica**. Deploy deixa de ser evento.

Se preferir publicar só quando quiser, ou precisar de um passo de build, uma GitHub Action
resolve — e aproveite para carimbar a versão, o que economiza muito suporte:

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: github-pages
    steps:
      - uses: actions/checkout@v4
      - name: Carimbar versao
        run: sed -i "s#__VERSAO__#$(date +%Y.%m.%d)-${GITHUB_SHA::7}#g" index.html
      - uses: actions/upload-pages-artifact@v3
        with: { path: . }
      - uses: actions/deploy-pages@v4
```

Mostre essa versão em algum canto da tela. Quando alguém disser "não está funcionando", a
primeira pergunta vira "qual versão aparece aí?" — e metade dos chamados morre em
"recarregue a página".

### App com servidor

- **Vercel / Netlify** — conecte o repositório, cada push publica sozinho
- **Cloudflare Workers** — `npx wrangler deploy`; ideal para o intermediário que guarda os
  segredos (veja `quem-entra-e-quem-ve`)

### Segredos em produção

Nunca no código. No painel do provedor (Vercel → Environment Variables) ou por CLI:

```bash
npx wrangler secret put ERP_API_KEY
```

E confirme: `.env` no `.gitignore`, repositório privado.

## Parte 2 — Instalar no celular da equipe (sem loja de aplicativos)

Um site vira app instalável com um `manifest.json` na raiz:

```json
{
  "name": "Estoque Bipagem",
  "short_name": "Estoque",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#1a1a1a",
  "theme_color": "#1a1a1a",
  "icons": [
    { "src": "icone-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icone-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Com `<link rel="manifest" href="manifest.json">` no `<head>`, a instalação fica assim:

- **Android/Chrome:** menu ⋮ → "Instalar aplicativo" (ou "Adicionar à tela inicial")
- **iPhone/Safari:** botão compartilhar → "Adicionar à Tela de Início"

Vira ícone na tela, abre em tela cheia, sem barra de navegador. Sem loja, sem taxa, sem
revisão da Apple, e a atualização chega sozinha no próximo acesso.

Se o app é usado em pé, no estoque, garanta também: `user-scalable=no` no viewport para
não dar zoom por engano, botões grandes, e `theme-color` escuro para não ofuscar.

## Parte 3 — Backup: a parte que ninguém faz

Responda por escrito às três perguntas. Se travar em alguma, ainda não está publicado.

1. **Se o aparelho onde o dado está sumir agora, o que se perde?**
2. **Qual foi a última cópia dos dados e onde ela está?**
3. **Quanto tempo leva para voltar ao ar? Você já testou?**

O mínimo aceitável por tipo de armazenamento:

| Onde o dado vive | Backup mínimo |
|---|---|
| `localStorage` no aparelho | botão "Exportar tudo (JSON)" + rotina semanal de exportação |
| Cloudflare KV | script que lista as chaves e salva em arquivo, semanal |
| Supabase / Postgres | backup automático do plano + um `pg_dump` mensal guardado fora |
| Planilha na nuvem | histórico de versões já existe — confirme que está ligado |

**Restauração não testada não é backup.** Escolha um dia, apague o dado de um ambiente de
teste e restaure. A primeira vez sempre revela algo que faltava.

## Parte 4 — Custo sob controle

Publique com limite, não com esperança:

- Ative alerta de gasto em todo serviço pago por uso
- Se o app usa IA, defina um teto mensal no painel do provedor
- Anote o custo real no `DECISOES.md` no primeiro mês e compare com a estimativa

## Parte 5 — O manual de uma página

Escreva um `manual.html` (ou uma página dentro do app) que caiba numa tela e responda:

1. Para que serve
2. Como instalar no celular (com print)
3. Os 3 a 5 passos do uso diário
4. O que fazer quando dá errado — os três erros mais comuns e a solução
5. Quem chamar

Escreva na linguagem de quem usa. "Bipe o código" e não "efetue a leitura óptica do
identificador". E deixe o manual acessível **dentro do app**, não num e-mail que se perde.

## Parte 6 — Manter vivo

**A cada mudança pedida pela equipe**, decida entre três destinos: entra agora, entra na
lista, ou não entra (e diga por quê). Lista sem "não entra" vira backlog morto.

**Uma vez por mês**, 30 minutos:

```bash
npm outdated                  # dependência com falha conhecida?
npx playwright test           # caminhos críticos passam?
```
Mais: confira o custo do mês, verifique se o backup rodou, e pergunte a uma pessoa que usa
o que mais atrapalha hoje. Essa última pergunta gera as melhores tarefas do projeto.

**Bus factor.** Escreva no `README.md`: onde está hospedado, quais contas, quem tem acesso,
como publicar, como restaurar backup. Se só você sabe, o app é um risco. Cinco parágrafos
resolvem.

## Checklist de saída

- [ ] Existe URL estável e a equipe consegue instalar sozinha no celular
- [ ] Todo push publica (ou o comando de publicar está no `README.md`)
- [ ] A versão aparece em algum canto da tela
- [ ] Nenhum segredo no repositório; repositório privado
- [ ] Existe backup, com data da última cópia — e a restauração já foi testada
- [ ] Custo mensal conhecido, com alerta de gasto ligado
- [ ] Manual de uma página acessível dentro do app
- [ ] `README.md` responde: onde está, quem tem acesso, como publicar, como restaurar
