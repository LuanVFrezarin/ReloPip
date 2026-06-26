/* ============================================================================
   RELO — Configuração do site oficial (integração com o Backend)
   ========================================================================== */
window.RELO_CONFIG = {
  // URL do backend (pasta Backend/). Em produção, troque pela URL HTTPS real.
  API_BASE: "",

  // false = usa o backend de verdade (cai para dados de demonstração se ele estiver offline).
  USE_MOCK: true,

  // Mesmo Google Client ID do backend (.env) e do jogo. Deixe vazio para esconder o botão Google.
  GOOGLE_CLIENT_ID: "",

  ENDPOINTS: {
    login:        "/auth/login",      // POST {email,password}
    register:     "/auth/register",   // POST {email,password,nick}
    login_google: "/auth/google",     // POST {idToken}
    player:       "/player/me",       // GET (Bearer)
    packs:        "/store/packs",     // GET
    items:        "/store/items",     // GET
    order:        "/store/order",     // POST (Bearer) {packId}
    leaderboard:  "/leaderboard/top", // GET ?limit
    stats:        "/stats/global",    // GET
    downloads:    "/downloads",       // GET
    news:         "/news",            // GET
  },

  DOWNLOADS: { windows: "#", android: "#", ios: "#", versao: "0.9.0 (Beta)", tamanho: "420 MB" },
  PAGAMENTO: { provider: "mercadopago", moeda: "BRL" },
  LINKS: {
    whatsapp: "https://chat.whatsapp.com/Ls8HBv661sO7fnt6NtETIt?s=cl&p=i&mlu=1&amv=2",
    whatsapp_apoiadores: "https://chat.whatsapp.com/D0rBGDbubrSKToEU6dzrZl?s=cl&p=i&mlu=1&amv=2",
    pix: "39845365-60d9-4783-be50-a7fb9562d3a7"
  },
};
