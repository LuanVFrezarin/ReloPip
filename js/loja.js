/* ============================================================================
   RELO — Loja de Pipoints do site.

   Faz exatamente o que o jogo faz (ReloPipointsPurchaseService.cs):
     POST /store/pipoints/orders  → abre o checkout do Mercado Pago
     GET  /store/pipoints/orders/:id a cada 3 s até APPROVED ou estado final.

   Regras de segurança desta página:
   - Os PP só são creditados pelo BACKEND, depois de consultar o Mercado Pago
     (webhook assinado ou reconciliação). Nada aqui credita, e os parâmetros de
     retorno do MP na URL são tratados só como "qual pedido consultar".
   - Nenhum dado vindo da API vai para innerHTML: tudo é textContent.
   - O checkout só abre se a URL for HTTPS num host do Mercado Pago.
   - Tokens: access token só em memória (relo-session.js); refresh em cookie
     HttpOnly do backend. Nada de token em localStorage/sessionStorage.
   ========================================================================== */
(function () {
  "use strict";
  const S = window.ReloSession;
  const cfg = window.RELO_CONFIG || {};
  const $ = id => document.getElementById(id);

  const PEDIDO_RE = /^pur_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const FINAIS = ["REJECTED", "CANCELLED", "EXPIRED", "ERROR", "REFUNDED", "CHARGEBACK"];
  const CHAVE_PEDIDO = "relo_pedido_pendente"; // só o id do pedido (não é segredo)
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const num = new Intl.NumberFormat("pt-BR");

  let pacotes = [];
  let comprando = false;
  let consulta = null;

  /* --------------------------------------------------------------- util */
  function el(tag, cls, texto) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (texto != null) e.textContent = texto;
    return e;
  }
  let toastT = 0;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("show"), 3800);
  }
  function nonceAleatorio() {
    const b = new Uint8Array(32);
    crypto.getRandomValues(b);
    return Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
  }
  function guardar(chave, valor) { try { valor == null ? sessionStorage.removeItem(chave) : sessionStorage.setItem(chave, valor); } catch {} }
  function ler(chave) { try { return sessionStorage.getItem(chave); } catch { return null; } }

  /** Só deixa sair para o checkout oficial do Mercado Pago. */
  function checkoutSeguro(url) {
    try {
      const u = new URL(String(url));
      const hosts = cfg.CHECKOUT_HOSTS || [];
      if (u.protocol !== "https:" || u.port || u.username || u.password || !hosts.includes(u.hostname)) return null;
      if (cfg.ENVIRONMENT === "production" && u.hostname.startsWith("sandbox.")) return null;
      return u.href;
    } catch { return null; }
  }

  /* ------------------------------------------------------------- conta */
  function pintarConta() {
    const dentro = S.autenticado;
    $("contaFora").hidden = dentro;
    $("contaDentro").hidden = !dentro;
    $("chip").hidden = !dentro;
    $("histBox").hidden = !dentro;
    if (!dentro) return;
    const a = S.account || {};
    $("contaNome").textContent = a.displayName || "Jogador";
    $("contaEmail").textContent = a.email || "";
    const w = S.wallet || {};
    const saldo = num.format(Number(w.pipoints ?? w.balance ?? 0));
    $("saldo").textContent = saldo;
    $("chipSaldo").textContent = saldo;
  }

  async function aposLogin() {
    pintarConta();
    try { await S.sincronizarCarteira(); } catch {}
    carregarHistorico();
    // Voltou do Mercado Pago sem sessão e entrou agora: retoma a consulta.
    const pendente = ler(CHAVE_PEDIDO);
    if (pendente) acompanharPedido(pendente);
  }

  function erroLogin(e) {
    $("erroLogin").textContent = (e && e.message) || "Não foi possível entrar.";
  }

  // E-mail e senha — mesmo POST /auth/login do jogo.
  $("formEmail").addEventListener("submit", async ev => {
    ev.preventDefault();
    $("erroLogin").textContent = "";
    const email = $("email").value.trim();
    const senha = $("senha").value;
    if (!email || !senha) { $("erroLogin").textContent = "Preencha e-mail e senha."; return; }
    const b = $("btnEntrar");
    b.disabled = true;
    try {
      await S.entrar(email, senha);
      $("senha").value = "";
      await aposLogin();
      toast("Entrou! Escolha seu pacote.");
    } catch (e) { erroLogin(e); }
    finally { b.disabled = false; }
  });

  // Google Identity Services — ID token validado na Railway (aud/iss/exp/nonce).
  function iniciarGoogle() {
    const alvo = $("googleBtn");
    if (!cfg.GOOGLE_CLIENT_ID || !S.disponivel()) { alvo.classList.add("off"); alvo.textContent = "Google indisponível"; return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onerror = () => { alvo.classList.add("off"); alvo.textContent = "Google indisponível"; };
    s.onload = () => {
      const nonce = nonceAleatorio();
      google.accounts.id.initialize({
        client_id: cfg.GOOGLE_CLIENT_ID,
        nonce,
        ux_mode: "popup",
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: true,
        callback: async resp => {
          $("erroLogin").textContent = "";
          try {
            await S.entrarComGoogle(resp.credential, nonce);
            await aposLogin();
            toast("Entrou com Google!");
          } catch (e) { erroLogin(e); }
        },
      });
      const largura = Math.min(360, Math.max(220, alvo.clientWidth || 300));
      google.accounts.id.renderButton(alvo, {
        theme: "filled_black", size: "large", shape: "pill", text: "continue_with",
        logo_alignment: "center", locale: "pt-BR", width: largura,
      });
    };
    document.head.appendChild(s);
  }

  // Sign in with Apple JS — popup; o identityToken vai para o mesmo /auth/apple do iPhone.
  function iniciarApple() {
    const b = $("appleBtn");
    if (!cfg.APPLE_SERVICES_ID || !S.disponivel()) {
      b.disabled = true;
      b.title = "Em breve no site. No iPhone, entre pelo jogo.";
      b.querySelector("span").textContent = "Apple — em breve no site";
      return;
    }
    let pronto = null;
    const carregar = () => pronto || (pronto = new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/pt_BR/appleid.auth.js";
      s.async = true;
      s.onload = ok;
      s.onerror = () => { pronto = null; falha(new Error("Não deu para carregar o login da Apple.")); };
      document.head.appendChild(s);
    }));
    b.addEventListener("click", async () => {
      $("erroLogin").textContent = "";
      b.disabled = true;
      try {
        await carregar();
        const nonce = nonceAleatorio();
        const state = nonceAleatorio();
        AppleID.auth.init({
          clientId: cfg.APPLE_SERVICES_ID, scope: "name email",
          redirectURI: cfg.APPLE_REDIRECT_URI, state, nonce, usePopup: true,
        });
        const r = await AppleID.auth.signIn();
        const auth = r && r.authorization;
        if (!auth || auth.state !== state || !auth.id_token) throw new Error("A Apple não confirmou o login. Tente de novo.");
        const n = r.user && r.user.name;
        const nome = n ? [n.firstName, n.lastName].filter(Boolean).join(" ") : "";
        await S.entrarComApple(auth.id_token, nonce, nome);
        await aposLogin();
        toast("Entrou com Apple!");
      } catch (e) {
        // Usuário fechou o popup: não é erro.
        if (e && (e.error === "popup_closed_by_user" || e.error === "user_cancelled_authorize")) return;
        erroLogin(e && e.message ? e : new Error("Não foi possível entrar com Apple."));
      } finally { b.disabled = false; }
    });
  }

  async function sair() {
    clearTimeout(consulta);
    $("statusBox").hidden = true;
    await S.sair();
    pintarConta();
    toast("Você saiu.");
  }
  $("btnSair").addEventListener("click", sair);
  $("btnSair2").addEventListener("click", sair);
  S.on("change", pintarConta);

  /* ----------------------------------------------------------- pacotes */
  function pintarPacotes() {
    const box = $("packs");
    box.replaceChildren();
    box.setAttribute("aria-busy", "false");
    if (!pacotes.length) { box.append(el("p", "lj-muted", "Pacotes indisponíveis agora. Tente de novo em instantes.")); return; }
    for (const p of pacotes) {
      const card = el("article", "lj-pack" + (p.featured ? " dest" : ""));
      if (p.label) card.append(el("span", "lj-tag", String(p.label)));
      const pp = el("div", "lj-pp", num.format(Number(p.pipointsAmount || p.pipoints || 0)));
      pp.append(el("small", null, "PP"));
      card.append(pp);
      if (Number(p.bonusPipoints) > 0) card.append(el("span", "lj-bonus", `+${num.format(p.bonusPipoints)} de bônus`));
      card.append(el("div", "lj-preco", brl.format(Number(p.priceBrlCents || 0) / 100)));
      const b = el("button", "btn btn-primary", "Comprar");
      b.type = "button";
      b.setAttribute("aria-label", `Comprar ${num.format(Number(p.pipointsAmount || p.pipoints || 0))} PP por ${brl.format(Number(p.priceBrlCents || 0) / 100)}`);
      b.addEventListener("click", () => comprar(p, b));
      card.append(b);
      box.append(card);
    }
  }

  async function carregarPacotes() {
    try {
      const lista = await S.pacotes();
      pacotes = (Array.isArray(lista) ? lista : []).filter(p => p && typeof p.id === "string");
    } catch { pacotes = []; }
    pintarPacotes();
  }

  async function comprar(pacote, botao) {
    $("erroCompra").textContent = "";
    if (comprando) return;
    if (!S.autenticado) {
      toast("Entre com a conta do jogo para comprar.");
      $("contaFora").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (S.ehVisitante) { $("erroCompra").textContent = S.mensagem("conta_visitante_precisa_registrar"); return; }

    comprando = true;
    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = "Abrindo…";
    try {
      const pedido = await S.criarPedido(pacote.id);
      if (!pedido || !PEDIDO_RE.test(String(pedido.id || ""))) throw new Error("Resposta inesperada do servidor.");

      // Desenvolvimento local: backend em modo mock, sem checkout real.
      if (pedido.provider === "mock" && cfg.ENVIRONMENT === "development") {
        await S.aprovarMock(pedido.id);
        acompanharPedido(pedido.id);
        botao.disabled = false;
        botao.textContent = textoOriginal;
        return;
      }

      const url = checkoutSeguro(pedido.checkoutUrl || pedido.initPoint);
      if (!url) throw new Error("Checkout inválido. Nada foi cobrado — tente de novo.");
      guardar(CHAVE_PEDIDO, pedido.id);
      // Mesma aba: no celular, popup é bloqueado e o retorno (back_url) volta para cá.
      window.location.assign(url);
    } catch (e) {
      $("erroCompra").textContent = (e && e.message) || "Não foi possível iniciar a compra.";
      botao.disabled = false;
      botao.textContent = textoOriginal;
    } finally {
      comprando = false;
    }
  }

  /* ----------------------------------------------- retorno + consulta */
  function status(tipo, titulo, texto) {
    $("statusBox").hidden = false;
    $("statusCard").className = "lj-status " + tipo;
    $("statusTitulo").textContent = titulo;
    $("statusTexto").textContent = texto;
  }

  /** Igual a ConsultarAteConcluir do jogo: 3 s entre consultas, até ~3 min. */
  function acompanharPedido(id) {
    if (!PEDIDO_RE.test(String(id || ""))) return;
    if (!S.autenticado) {
      status("esperando", "Acompanhe seu pedido",
        "Entre com a mesma conta do RELO para consultar o pagamento.");
      return;
    }
    clearTimeout(consulta);
    status("esperando", "Confirmando seu pagamento…", "Pix costuma confirmar em segundos. Pode deixar esta página aberta.");
    const inicio = Date.now();
    const passo = async () => {
      let pedido = null;
      try { pedido = await S.pedido(id); }
      catch (e) {
        if (e && e.status === 404) { guardar(CHAVE_PEDIDO, null); status("falhou", "Pedido não encontrado", "Esse pedido não é desta conta. Confira se entrou com a conta certa."); return; }
        if (e && e.dados && e.dados.purchase) pedido = e.dados.purchase;
      }
      const st = pedido && pedido.status;
      if (st === "APPROVED") {
        guardar(CHAVE_PEDIDO, null);
        status("ok", "Pagamento aprovado!", `${num.format(Number(pedido.pipointsAmount || 0))} PP já estão na sua conta — no site e no jogo.`);
        try { await S.sincronizarCarteira(); } catch {}
        carregarHistorico();
        return;
      }
      if (FINAIS.includes(st)) {
        guardar(CHAVE_PEDIDO, null);
        status("falhou", "Pagamento não concluído", "Nada foi creditado. Se o valor saiu da sua conta, fale com o suporte com o número do pedido: " + id);
        carregarHistorico();
        return;
      }
      if (Date.now() - inicio > 180000) {
        status("esperando", "Ainda processando", "Alguns pagamentos (boleto, análise do cartão) demoram. Os PP entram sozinhos quando o Mercado Pago aprovar.");
        return;
      }
      consulta = setTimeout(passo, 3000);
    };
    passo();
  }

  /** Lê o retorno do Mercado Pago e limpa a URL (payment_id etc. não ficam no histórico). */
  function lerRetorno() {
    const q = new URLSearchParams(location.search);
    if (![...q.keys()].length) return ler(CHAVE_PEDIDO);
    const ref = q.get("external_reference") || "";
    history.replaceState(null, "", location.pathname + location.hash);
    const id = PEDIDO_RE.test(ref) ? ref : ler(CHAVE_PEDIDO);
    if (id) guardar(CHAVE_PEDIDO, id);
    return id;
  }

  /* --------------------------------------------------------- histórico */
  const ROTULO = { APPROVED: "Aprovado", PENDING: "Aguardando", REJECTED: "Recusado", CANCELLED: "Cancelado",
    EXPIRED: "Expirado", ERROR: "Não iniciado", REFUNDED: "Estornado", CHARGEBACK: "Contestado" };
  async function carregarHistorico() {
    if (!S.autenticado) return;
    let lista = [];
    try { lista = await S.pedidos(); } catch { return; }
    const corpo = $("histCorpo");
    corpo.replaceChildren();
    const linhas = (Array.isArray(lista) ? lista : []).filter(p => p && p.provider !== "apple_app_store" && p.provider !== "google_play").slice(0, 20);
    if (!linhas.length) {
      const tr = el("tr"); const td = el("td", "lj-muted", "Nenhuma compra ainda.");
      td.colSpan = 4; tr.append(td); corpo.append(tr); return;
    }
    for (const p of linhas) {
      const tr = el("tr");
      const d = p.createdAt ? new Date(String(p.createdAt).replace(" ", "T") + (String(p.createdAt).endsWith("Z") ? "" : "Z")) : null;
      tr.append(el("td", null, d && !isNaN(d) ? d.toLocaleDateString("pt-BR") : "—"));
      tr.append(el("td", null, `${num.format(Number(p.pipointsAmount || 0))} PP`));
      tr.append(el("td", null, brl.format(Number(p.amountBrlCents || 0) / 100)));
      const st = String(p.status || "");
      tr.append(el("td", "st-" + st.replace(/[^A-Z]/g, ""), ROTULO[st] || st));
      corpo.append(tr);
    }
  }

  // Voltou do checkout pelo botão "voltar" (página restaurada do bfcache):
  // só destrava os botões. Se ele pagar depois, o webhook credita mesmo assim.
  window.addEventListener("pageshow", ev => {
    if (!ev.persisted) return;
    comprando = false;
    pintarPacotes();
  });

  /* -------------------------------------------------------------- boot */
  async function iniciar() {
    const pedidoRetorno = lerRetorno();
    iniciarGoogle();
    iniciarApple();
    carregarPacotes();
    if (!S.disponivel()) { $("erroLogin").textContent = "Loja indisponível neste ambiente."; return; }
    const restaurou = await S.restaurar().catch(() => false);
    // Logado: aposLogin já retoma o pedido pendente. Deslogado: mostra o aviso.
    if (restaurou) await aposLogin();
    else { pintarConta(); if (pedidoRetorno) acompanharPedido(pedidoRetorno); }
  }
  iniciar();
})();
