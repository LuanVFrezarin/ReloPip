/* ============================================================================
   RELO — Sessão do site (§11, §22, §24).

   Mesma conta canônica do jogo. Diferenças em relação à versão anterior:

   - O access token vive SÓ EM MEMÓRIA. Antes o JWT ficava em
     localStorage["relo_jwt"], legível por qualquer script da página (XSS).
   - O refresh token vem num cookie HttpOnly definido pelo backend: o
     JavaScript não consegue lê-lo, e a renovação usa credentials:"include".
   - Em 401 a sessão é renovada UMA vez (single-flight) e a requisição repetida.
   ========================================================================== */
window.ReloSession = (function () {
  const cfg = window.RELO_CONFIG || {};
  const base = String(cfg.API_BASE || "").replace(/\/$/, "");
  const E = cfg.ENDPOINTS || {};

  let accessToken = null;
  let account = null;
  let wallet = null;
  let renovando = null;   // Promise única de refresh em voo
  let versaoSessao = 0;

  const ouvintes = { change: [], error: [] };

  function on(evento, fn) { (ouvintes[evento] || (ouvintes[evento] = [])).push(fn); }
  function emitir(evento, dado) { (ouvintes[evento] || []).forEach(fn => { try { fn(dado); } catch (e) { console.error(e); } }); }

  const disponivel = () => !!base;

  function mensagem(erro) {
    return ({
      credenciais_invalidas: "E-mail ou senha inválidos.",
      email_em_uso: "Este e-mail já possui conta.",
      email_invalido: "E-mail inválido.",
      senha_fraca: "A senha precisa ter 8+ caracteres, com letra e número.",
      muitas_tentativas: "Muitas tentativas. Aguarde alguns minutos.",
      sem_token: "Entre na sua conta para continuar.",
      sessao_revogada: "Sua sessão expirou. Entre novamente.",
      token_revogado: "Sua sessão expirou. Entre novamente.",
      saldo_insuficiente: "Pipoints insuficientes.",
      item_ja_possuido: "Você já possui este item.",
      pacote_nao_encontrado: "Pacote indisponível.",
      conta_visitante_precisa_registrar: "Crie uma conta para comprar Pipoints.",
      google_nao_configurado: "Login com Google indisponível nesta versão.",
      SAVE_CONFLICT: "Seu progresso foi atualizado em outro dispositivo.",
    })[erro] || String(erro || "Falha na operação.").replaceAll("_", " ");
  }

  /** Requisição crua. Não trata 401 — quem trata é `api`. */
  async function bruta(path, opts = {}) {
    if (!disponivel()) throw new Error("Backend não configurado para este ambiente.");
    const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    if (accessToken && opts.auth !== false) headers.Authorization = `Bearer ${accessToken}`;

    const resposta = await fetch(base + path, {
      ...opts,
      headers,
      credentials: "include", // necessário para o cookie HttpOnly do refresh
      body: opts.body && typeof opts.body !== "string" ? JSON.stringify(opts.body) : opts.body,
    });
    const texto = await resposta.text();
    let dados = {};
    try { dados = texto ? JSON.parse(texto) : {}; } catch { dados = { error: texto }; }
    return { ok: resposta.ok, status: resposta.status, dados };
  }

  /** Requisição com renovação automática em 401. */
  async function api(path, opts = {}) {
    const versao = versaoSessao;
    const conferir = () => {
      if (opts.auth !== false && versao !== versaoSessao) {
        const erro = new Error('A conta foi alterada. Repita a operação na conta atual.');
        erro.code = 'sessao_alterada';
        throw erro;
      }
    };
    let r = await bruta(path, opts);
    conferir();
    if (r.status === 401 && opts.auth !== false) {
      const renovou = await renovar();
      conferir();
      if (renovou) r = await bruta(path, opts);
    }
    conferir();
    if (!r.ok) {
      const erro = new Error(mensagem(r.dados && r.dados.error));
      erro.code = r.dados && r.dados.error;
      erro.status = r.status;
      erro.dados = r.dados;
      throw erro;
    }
    return r.dados;
  }

  /** POST /auth/refresh usando o cookie HttpOnly. Single-flight. */
  function renovar() {
    if (renovando) return renovando;
    const versao = versaoSessao;
    renovando = (async () => {
      try {
        const r = await bruta(E.refresh || "/auth/refresh", { method: "POST", auth: false, body: {} });
        if (versao !== versaoSessao) return false;
        if (!r.ok || !r.dados.accessToken) { limpar(); return false; }
        accessToken = r.dados.accessToken;
        if (r.dados.account) account = r.dados.account;
        return true;
      } catch { if (versao === versaoSessao) limpar(); return false; }
      finally { renovando = null; }
    })();
    return renovando;
  }

  function adotar(dados) {
    if (dados.account && dados.account.accountId !== account?.accountId) versaoSessao++;
    accessToken = dados.accessToken || accessToken;
    account = dados.account || account;
    wallet = dados.wallet || wallet;
    emitir("change", { account, wallet });
    return dados;
  }

  function limpar() {
    versaoSessao++;
    accessToken = null;
    account = null;
    wallet = null;
    // Restos de versões antigas que guardavam o JWT em texto puro.
    try { localStorage.removeItem("relo_jwt"); } catch {}
    emitir("change", { account: null, wallet: null });
  }

  // ------------------------------------------------------------------ públicos
  return {
    on, api, mensagem, disponivel,
    get account() { return account; },
    get wallet() { return wallet; },
    get autenticado() { return !!accessToken && !!account; },
    get ehVisitante() { return !!account && account.accountType === "GUEST"; },
    get accountId() { return account ? account.accountId : null; },

    /** Tenta reaproveitar a sessão do cookie ao abrir a página. */
    async restaurar() {
      if (!disponivel()) return false;
      if (!(await renovar())) return false;
      try { adotar(await api(E.me || "/auth/me")); return true; }
      catch { limpar(); return false; }
    },

    async entrar(email, senha) {
      return adotar(await api(E.login || "/auth/login", {
        auth: false, method: "POST", body: { email, password: senha, platform: "Web" },
      }));
    },

    async cadastrar(email, senha, nome) {
      return adotar(await api(E.register || "/auth/register", {
        auth: false, method: "POST", body: { email, password: senha, displayName: nome, platform: "Web" },
      }));
    },

    async entrarComGoogle(idToken) {
      if (!cfg.GOOGLE_CLIENT_ID) throw new Error(mensagem("google_nao_configurado"));
      return adotar(await api(E.login_google || "/auth/google", {
        auth: false, method: "POST", body: { idToken, platform: "Web" },
      }));
    },

    async sair() {
      const req = bruta(E.logout || "/auth/logout", { method: "POST", body: {} });
      limpar();
      try { await req; } catch {}
    },

    async sincronizarCarteira() {
      wallet = await api(E.wallet || "/wallet");
      emitir("change", { account, wallet });
      return wallet;
    },

    async inventario() { return api(E.inventory || "/inventory"); },
    async extrato() { return api(E.transactions || "/wallet/transactions"); },
    async catalogo() { return api(E.catalog || "/catalog", { auth: false }); },
    async pacotes() { return api(E.packs || "/store/pipoints/packs", { auth: false }); },

    async criarPedido(packId) {
      return api(E.orders || "/store/pipoints/orders", {
        method: "POST",
        headers: { "Idempotency-Key": `site-order-${crypto.randomUUID()}` },
        body: { packId },
      });
    },

    async pedido(id) { return api(`${E.orders || "/store/pipoints/orders"}/${encodeURIComponent(id)}`); },
    async pedidos() { return api(E.orders || "/store/pipoints/orders"); },

    /** Simulação local de pagamento. O backend recusa fora de 127.0.0.1/dev. */
    async aprovarMock(id) {
      return api(`${E.orders || "/store/pipoints/orders"}/${encodeURIComponent(id)}/mock`, {
        method: "POST", body: { scenario: "APPROVED" },
      });
    },
  };
})();
