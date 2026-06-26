# RELO — Site Oficial (Pré-lançamento)

Jogo online de pipa em desenvolvimento no Brasil. Site de pré-lançamento com lista de espera, plano de membro/fundador, galeria de pipas, vídeos de gameplay e bastidores.

## Rodar localmente

É um site estático. Basta abrir `index.html` no navegador, ou servir a pasta:

```
npx serve .
```

## Estrutura

```
index.html          # página única
css/style.css       # estilos
css/mov/            # vídeos (.mp4) e fotos das pipas + logo
js/config.js        # links (WhatsApp, PIX) e flags
js/api.js           # dados (galeria, vídeos, stats)
js/app.js           # interações e efeitos
api/waiting.js      # função serverless do contador (Vercel)
```

## Deploy na Vercel

1. Importe o repositório na Vercel (detecta automaticamente — é estático + função serverless em `/api`).
2. **Contador global da lista de espera** (opcional, mas recomendado): crie um banco Redis grátis no [Upstash](https://upstash.com) e adicione as variáveis de ambiente na Vercel:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

   Sem essas variáveis, o site funciona normalmente, mas a contagem fica **local por navegador** (não soma entre visitantes). Com elas, a contagem é **global e persistente**, contando 1 por visitante.

3. O contador começa do **0**.

## Configuração rápida (`js/config.js`)

- `LINKS.whatsapp` — grupo aberto (grátis)
- `LINKS.whatsapp_apoiadores` — grupo de membros (premium)
- `LINKS.pix` — chave PIX (R$ 10/mês para membros)
