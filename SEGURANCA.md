# Segurança do site — loja de Pipoints e login

Revisão de 17/11/2026. O site é estático (Vercel); quem decide tudo é o backend da Railway, o mesmo do jogo.

## Como a compra funciona (igual ao jogo)
1. Login: Google (ID token), Apple (identity token) ou e-mail/senha → `POST /auth/google|apple|login`. A Railway valida assinatura, `aud`, `iss`, `exp` e nonce.
2. `POST /store/pipoints/orders { packId }` com `Idempotency-Key` → backend cria o pedido e a preference do Mercado Pago. **O preço vem do banco, nunca do navegador.**
3. O site só redireciona se a URL for `https://` num host do Mercado Pago (`CHECKOUT_HOSTS`).
4. O crédito acontece **só no backend**: webhook com HMAC (`x-signature`) + consulta do pagamento no MP + conferência de valor, moeda e `external_reference`. Ledger com chave idempotente: nunca credita duas vezes.
5. Na volta (`/loja/?external_reference=...`) o site só usa o id para consultar `GET /store/pipoints/orders/:id` (escopado pela conta). Parâmetros de URL não creditam nada e são apagados da barra de endereço.

## Sessão
- Access token só em memória (sem `localStorage`). Refresh token em cookie `HttpOnly; Secure; SameSite=None; Path=/auth` da Railway.
- Login do site não derruba a sessão do jogo (superfícies separadas).
- Safari/Firefox bloqueiam cookie de terceiros: lá a sessão não volta ao recarregar (o jogador entra de novo). Corrige de vez com `api.relogame.com.br` (ver pendências).

## Cabeçalhos (vercel.json)
CSP restrita (scripts só do próprio site, Google GSI e Apple; `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`), HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `COOP: same-origin-allow-popups` (necessário para os popups do Google/Apple). `/loja` e `/api` com `no-store`.

## Código do site
- Nenhum dado da API vai para `innerHTML` (só `textContent`/`createElement`).
- Nenhum segredo no front: Client ID do Google e Services ID da Apple são públicos por natureza.
- `.vercelignore` tira scripts `.bat`, capturas e pastas de ferramenta do deploy.
- `api/waiting.js`: só GET/POST, `no-store`, IP pela borda da Vercel.

## Railway (variáveis ajustadas)
`CORS_ORIGIN` = `https://www.relogame.com.br,https://relogame.com.br` · `REFRESH_COOKIE_SAMESITE=none` · `MERCADO_PAGO_{SUCCESS,PENDING,FAILURE}_URL` = `https://www.relogame.com.br/loja/`.

## Pendências manuais
1. **Google Cloud Console** → Credenciais → client Web `710710408953-o7hj…` → *Origens JavaScript autorizadas*: `https://www.relogame.com.br` e `https://relogame.com.br`.
2. **Apple Developer** → Identifiers → *Services IDs* → criar `com.relogame.web`, ativar *Sign in with Apple* com **Primary App ID `com.relogame.game`** (isso mantém o mesmo `sub` → mesma conta do iPhone); domínio `www.relogame.com.br`, return URL `https://www.relogame.com.br/loja/`. Depois: `APPLE_SIGNIN_AUDIENCES=com.relogame.game,com.relogame.web` na Railway e `APPLE_SERVICES_ID: "com.relogame.web"` em `js/config.js`.
3. (Recomendado) Domínio `api.relogame.com.br` → Railway (CNAME no Registro.br). Aí `apiBase` passa para ele e o cookie volta a `SameSite=Lax` (primeira parte, funciona no Safari).
4. (Backend, próxima versão) Conferir `Origin` em `/auth/refresh` quando vier por cookie e checar o `ts` do webhook do MP (janela de 5 min).
