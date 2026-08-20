---
name: quem-entra-e-quem-ve
description: "Coloca login, papéis e proteção de segredos em um app interno, no nível certo de rigor — sem transformar a v1 num projeto de segurança corporativa e sem deixar chave de API exposta no navegador. Use quando o app for sair do computador de uma pessoa e ser usado pela equipe, quando surgir 'preciso de login', 'o vendedor não pode ver o custo', 'como escondo a chave da API', ou antes de publicar qualquer coisa que toque dado real da empresa."
---

# Quem entra e quem vê

## Por que esta skill existe

App interno tem dois erros clássicos e opostos.

O primeiro: montar autenticação corporativa completa — provedor externo, dois fatores,
recuperação de senha por e-mail, papéis granulares — antes de existir app. Duas semanas
gastas em algo que oito pessoas usariam com uma senha combinada.

O segundo, mais grave: publicar na internet um app que carrega a **chave da API do ERP**
dentro do JavaScript. Qualquer pessoa aperta F12 e leva as credenciais da empresa inteira.

O nível certo depende de duas coisas: **onde o app está** e **o que ele acessa**.

## A pergunta que decide o nível

**"Se a pessoa errada abrir isso, o que ela consegue fazer?"**

| Resposta | Nível necessário |
|---|---|
| Ver dados que já estão no site público da empresa | Nenhum login. Publique. |
| Ver preço de custo, margem, dado de cliente | Login simples com lista de e-mails autorizados |
| Alterar estoque, preço, pedido no sistema de verdade | Login + papéis + segredo no servidor |
| Ver dado pessoal de terceiros (LGPD) | O acima + registro de acesso + política de retenção |

Suba um nível quando doer, não antes. Mas **nunca** fique abaixo do nível 3 se o app
escreve em sistema de produção.

## A regra inegociável: segredo não mora no navegador

Tudo que vai para o navegador é público. Sempre. Não existe "escondido no JavaScript",
não existe "ofuscado", não existe "está numa variável".

```js
// ❌ NUNCA — qualquer usuário lê isso em 5 segundos
const API_KEY = "d11a7a789f97e0f2b8c4";
fetch("https://api.erp.com/produtos", { headers: { "X-Key": API_KEY } });
```

O jeito certo tem duas formas, e as duas custam poucos minutos:

**Forma A — um intermediário mínimo.** Um arquivo de servidor (Cloudflare Worker, função
da Vercel, rota do Next) guarda a chave, recebe o pedido do app, chama o ERP e devolve só
o que interessa:

```js
// worker/src/index.js — a chave vive aqui, no servidor
const CORS = {
  "access-control-allow-origin": "https://SEU-USUARIO.github.io", // só o seu app
  "access-control-allow-headers": "authorization",
};
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS")   // o navegador "pergunta antes de mandar"
      return new Response(null, { status: 204, headers: CORS });
    if (request.headers.get("authorization") !== env.APP_TOKEN)
      return new Response("não autorizado", { status: 401, headers: CORS });
    const r = await fetch("https://api.erp.com/produtos", {
      headers: { "X-Key": env.ERP_API_KEY }   // variável de ambiente, não código
    });
    return new Response(await r.text(),
      { headers: { "content-type": "application/json", ...CORS } });
  }
};
```

Três detalhes fazem o exemplo funcionar de verdade: o bloco `OPTIONS` responde à pergunta
que o navegador faz antes de mandar a requisição (app e Worker vivem em endereços
diferentes — sem essa resposta, tudo é bloqueado); o `access-control-allow-origin` autoriza
só o endereço do seu app, nunca `*`; e a checagem do token barra quem chega só com a URL.

E de onde o app tira o `APP_TOKEN`? Da regra de sempre: obtido no login e guardado só no
aparelho — ou digitado uma vez por usuário, como na Forma B. Se ele estiver escrito no
JavaScript, vale a honestidade da tranca: barra o desconhecido que achou a URL, não quem
sabe abrir o F12.

```bash
npx wrangler secret put ERP_API_KEY   # guarda o segredo fora do repositório
```

**Forma B — cada pessoa usa a própria credencial.** O app pede a chave ao usuário na
primeira vez e guarda **só no aparelho dele** (`localStorage`). Serve bem quando o ERP
emite credencial por usuário e o app é usado por poucas pessoas.

Se a chave hoje está no código: **troque a chave**, não basta apagar do arquivo. Ela está
no histórico do Git para sempre.

## Login proporcional: os três degraus

### Degrau 1 — lista de autorizados (v1, poucos usuários)

Uma lista de e-mails permitidos e senha por usuário. Vale para 3–15 pessoas de confiança,
em app que **lê** dado sensível mas não escreve em produção.

Honestidade obrigatória: se a lista está num arquivo que vai para o navegador, isso é uma
**tranca, não um cofre** — impede o colega curioso, não impede quem sabe abrir o F12.
Diga isso ao usuário em vez de vender segurança que não existe, e mantenha o dado
sensível de verdade atrás do intermediário da Forma A.

### Degrau 2 — login de verdade sem construir login (recomendado quando cresce)

Use um serviço pronto (Supabase Auth, Clerk, Auth0). Ganha senha com hash, recuperação por
e-mail, sessão e expiração sem você escrever nada disso. Tempo real de integração: uma a
duas horas.

### Degrau 3 — entrar com a conta da empresa

Se a empresa usa Google Workspace ou Microsoft 365, "Entrar com Google/Microsoft" restrito
ao domínio da empresa resolve entrada e saída de funcionário de uma vez: desligou, perdeu
o acesso. Não há senha para gerenciar.

## Papéis: comece com dois

Não modele uma matriz de permissões. Comece com:

- **operador** — faz o trabalho do dia a dia
- **admin** — configura, corrige e vê o que é sensível

Adicione um terceiro só quando alguém for barrado de fato. E vale a regra da tela: se a
pessoa não pode fazer, **o botão não aparece** — mas a verificação também acontece do lado
do servidor. Esconder botão é conforto; a checagem no servidor é a segurança.

## Checklist antes de publicar

- [ ] Nenhuma chave, senha ou token está em arquivo que vai para o navegador
- [ ] `git log -p | grep -iE "api[_-]?key|secret|password|token"` não devolve segredo vivo
- [ ] Existe `.gitignore` com `.env`, e o `.env` nunca foi commitado
- [ ] Se algo vazou no histórico, a credencial foi **rotacionada**
- [ ] O repositório está **privado**
- [ ] Toda ação de escrita valida quem é o usuário **no servidor**
- [ ] Existe caminho para tirar o acesso de alguém em menos de 5 minutos
- [ ] Se guarda dado pessoal: você sabe dizer qual, por quê e por quanto tempo (LGPD)

## Combine com

Rode uma revisão de segurança dedicada antes de publicar (no Claude Code:
`/security-review`). Ela pega o que o checklist manual esquece: injeção, CORS aberto,
dependência vulnerável, dado sensível em log.

## Armadilhas

- **Senha única compartilhada que ninguém troca.** Quando alguém sai da empresa, ninguém
  troca — e o acesso continua. Se usar senha compartilhada, marque uma data para trocar.
- **`.env` commitado.** Acontece na primeira semana de todo projeto. Crie o `.gitignore` antes.
- **Repositório público por engano.** Confira duas vezes — o código do app interno mostra
  a estrutura do seu negócio.
- **Bloquear no front e liberar no servidor.** É o buraco mais comum em app feito com IA:
  a tela esconde o botão, mas a rota aceita a chamada de qualquer um.
