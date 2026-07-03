# Cofre na nuvem do recebimento (Cloudflare Worker + KV)

Mini-servidor que guarda as sessões de **recebimento** do app pra continuar em outro
aparelho pelo código da sessão. Só o recebimento usa; o resto do app segue client-side.

- **URL:** https://estoque-tuttiamore-sync.cliqsolutions.workers.dev
- **Conta Cloudflare:** contato.binfor@gmail.com (`68b7ac62e3da54f9b2487ff8f2290032`)
- **KV namespace:** `SESSOES` (id `a9557dd04b99468db7f77c341a7f9915`)
- Sessões expiram sozinhas em **30 dias** (TTL).

## Rotas
- `GET /s/:codigo` → devolve a sessão (ou 404)
- `PUT /s/:codigo` → salva; body `{ sessao, device, expectedRev }`. Se `expectedRev`
  não bate com a versão atual → `409 { conflito, remoto }` (outro aparelho salvou por cima).
- `GET /health` → status

## Deploy (rodar desta pasta)
```
npx wrangler deploy
```
O login do wrangler já está configurado na máquina do João. O front consome a URL
em `cloud.js` (constante `WORKER_URL`).
