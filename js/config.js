/* ============================================================================
   RELO — Configuração do site oficial (§23).

   Ambientes separados. Production NUNCA aponta para localhost.
   ========================================================================== */
(function () {
  const host = location.hostname;
  const ehLocal = ["localhost", "127.0.0.1", "0.0.0.0", ""].includes(host);

  // ---------------------------------------------------------------- ambientes
  const AMBIENTES = {
    development: {
      environment: "development",
      apiBase: "http://localhost:3000",
      mercadoPagoMode: "mock",
    },
    staging: {
      // BLOQUEADO POR INFRAESTRUTURA: preencher com a URL HTTPS de staging.
      environment: "staging",
      apiBase: "", // ex.: "https://api-staging.relogame.com.br"
      mercadoPagoMode: "sandbox",
    },
    production: {
      // BLOQUEADO POR INFRAESTRUTURA: preencher com a URL HTTPS de produção.
      environment: "production",
      apiBase: "https://relobackend-production.up.railway.app", // ex.: "https://api.relogame.com.br"
      mercadoPagoMode: "production",
    },
  };

  const nome = ehLocal ? "development"
             : host.startsWith("staging.") ? "staging"
             : "production";
  const ambiente = AMBIENTES[nome];

  if (ambiente.environment === "production" && /localhost|127\.0\.0\.1/.test(ambiente.apiBase)) {
    console.error("[RELO] Production não pode apontar para localhost. API desabilitada.");
    ambiente.apiBase = "";
  }
  if (!ambiente.apiBase && !ehLocal) {
    console.warn(`[RELO] Nenhuma API configurada para "${nome}". Defina apiBase em js/config.js.`);
  }

  window.RELO_CONFIG = {
    ENVIRONMENT: ambiente.environment,
    API_BASE: ambiente.apiBase,
    API_VERSION: 1,
    MERCADO_PAGO_MODE: ambiente.mercadoPagoMode,
    USE_MOCK: false,

    // Client ID WEB do Google — o MESMO GOOGLE_CLIENT_ID da Railway (o Android
    // também pede token para ele). Não é segredo: só identifica o app. Para o
    // botão funcionar, o domínio do site precisa estar em "Origens JavaScript
    // autorizadas" desse client no Google Cloud Console.
    GOOGLE_CLIENT_ID: "710710408953-o7hjlq8skkuo6emnjibd8mb7iaqsqj7l.apps.googleusercontent.com",

    // Sign in with Apple na web usa um SERVICES ID (não o bundle do app),
    // agrupado ao App ID com.relogame.game — assim o `sub` da Apple é o mesmo
    // do iPhone e a conta é a mesma. Vazio => botão Apple aparece desabilitado.
    // Depois de criar, acrescente o mesmo valor em APPLE_SIGNIN_AUDIENCES na Railway.
    APPLE_SERVICES_ID: "",
    APPLE_REDIRECT_URI: "https://www.relogame.com.br/loja/",

    // Únicos destinos aceitos para o checkout devolvido pelo backend.
    CHECKOUT_HOSTS: ["www.mercadopago.com.br", "mercadopago.com.br", "sandbox.mercadopago.com.br", "www.mercadopago.com", "mercadopago.com"],

    // Endpoints CANÔNICOS da conta única — os MESMOS que o jogo usa (§22).
    ENDPOINTS: {
      // auth
      guest:        "/auth/guest",
      register:     "/auth/register",
      login:        "/auth/login",
      login_google: "/auth/google",
      login_apple:  "/auth/apple",
      upgrade:      "/auth/guest/upgrade",
      refresh:      "/auth/refresh",
      logout:       "/auth/logout",
      me:           "/auth/me",

      // economia
      wallet:       "/wallet",
      transactions: "/wallet/transactions",
      catalog:      "/catalog",
      purchase:     "/catalog/purchase",
      inventory:    "/inventory",
      save:         "/save",

      // venda de Pipoints
      packs:        "/store/pipoints/packs",
      orders:       "/store/pipoints/orders",

      // conteúdo/infra
      leaderboard:  "/leaderboard/top",
      stats:        "/stats/global",
      downloads:    "/downloads",
      news:         "/news",
      health:       "/health",
      version:      "/version",
    },

    DOWNLOADS: { windows: "#", android: "#", ios: "#", versao: "0.9.0 (Beta)", tamanho: "420 MB" },
    // Preencha quando cada loja publicar: os botões do site passam a abrir o link.
    // App Store: https://apps.apple.com/br/app/relo/id6806365806
    // Google Play: https://play.google.com/store/apps/details?id=com.relogame.game
    LOJAS: { appstore: "", googleplay: "", windows: "" },
    PAGAMENTO: { provider: "mercadopago", moeda: "BRL" },
    LINKS: {
      whatsapp: "https://chat.whatsapp.com/Ls8HBv661sO7fnt6NtETIt?s=cl&p=i&mlu=1&amv=2",
      whatsapp_apoiadores: "https://chat.whatsapp.com/D0rBGDbubrSKToEU6dzrZl?s=cl&p=i&mlu=1&amv=2",
      pix: "39845365-60d9-4783-be50-a7fb9562d3a7"
    },
  };
})();
