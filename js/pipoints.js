/* ============================================================================
   RELO — Página /pipoints (§18, §22).

   Toda a rede passa pelo window.ReloSession, que cuida de access token em
   memória, refresh por cookie HttpOnly e renovação em 401.

   O crédito de Pipoints NUNCA é assumido por causa do retorno do navegador:
   a página apenas consulta o status da compra, e quem credita é o webhook.
   ========================================================================== */
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const cfg = window.RELO_CONFIG || {};
  const S = window.ReloSession;

  let modoCadastro = false;
  let timerPagamento = null;
  let criandoPagamento = false;
  let ultimaConta = null;

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dinheiro = centavos => (Number(centavos || 0) / 100)
    .toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const numero = n => Number(n || 0).toLocaleString("pt-BR");

  function toast(texto) {
    const el = $("#toast");
    el.textContent = texto;
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 2800);
  }

  function exigirLogin() {
    if (S.autenticado) return true;
    abrirLogin();
    return false;
  }

  /* ------------------------------------------------------------- renderização */
  function renderConta() {
    const conta = S.account;
    $("#accountButton").textContent = conta ? "Sair" : "Entrar";
    $("#balance").textContent = S.wallet ? `${numero(S.wallet.pipoints)} PP` : "-- PP";
    $("#accountName").textContent = conta
      ? `${conta.displayName}${conta.accountType === "GUEST" ? " (visitante)" : ""}`
      : "Entre para consultar";
  }

  function renderPacotes(pacotes) {
    $("#packageGrid").innerHTML = pacotes.map(p => `
      <article class="pp-card ${p.featured ? "featured" : ""}">
        ${p.label ? `<span class="pp-tag">${esc(p.label)}</span>` : ""}
        <span class="pp-item-meta">Pipoints</span>
        <h3>${numero(p.pipointsAmount)} PP</h3>
        <p class="pp-price">${dinheiro(p.priceBrlCents)}</p>
        <button class="btn btn-primary" data-pack="${esc(p.id)}">Ir para o Mercado Pago</button>
      </article>`).join("");
    $$("[data-pack]").forEach(b => b.onclick = () => iniciarPagamento(b.dataset.pack));
  }

  /**
   * Fitas de rabiola do modelo, quando o item é uma pipa.
   * Vem de catalog_items.metadata.fitasRabiola — a MESMA contagem que o jogo usa
   * em gameplay (Peixinho 6, Quadrada 10, Pipão 20). Toda fita pode ser cortada
   * e aparada, então é informação de combate.
   */
  function rabiolaDe(item) {
    if (!item || item.type !== "KITE") return "";
    const n = item.metadata && item.metadata.fitasRabiola;
    if (n === undefined || n === null) return "";
    return n === 0 ? " · sem rabiola" : ` · ${n} fitas`;
  }

  const ROTULO_TIPO = {
    KITE: "Pipa", LINE: "Linha", REEL: "Carretilha",
    CHARACTER: "Personagem", CHARACTER_SKIN: "Personagem", KITE_SKIN: "Skin de pipa",
    COSMETIC: "Cosmetico", OTHER: "Item",
  };

  async function renderInventario() {
    const box = $("#inventoryGrid");
    if (!S.autenticado) { box.innerHTML = `<p class="pp-muted">Entre na sua conta para ver seu inventario.</p>`; return; }
    try {
      const dados = await S.inventario();
      const itens = (dados.items || []).filter(i => i.quantity > 0);
      if (!itens.length) { box.innerHTML = `<p class="pp-muted">Voce ainda nao possui itens.</p>`; return; }
      box.innerHTML = itens.map(i => `
        <article class="pp-card">
          <span class="pp-item-meta">${esc(ROTULO_TIPO[i.type] || i.type)}${esc(rabiolaDe(i))}</span>
          <h3>${esc(i.name)}</h3>
          <p class="pp-price">${i.quantity > 1 ? `x${i.quantity}` : ""}
            ${i.equipped ? " &middot; equipado" : ""}</p>
          <p class="pp-item-meta">${
            i.source === "SignupGrant" ? "Incluso"
            : i.source === "CapturedKiteItem" ? "Capturada no relo"
            : i.isCommercial ? "Comprado" : "Obtido no jogo"
          }</p>
        </article>`).join("");
    } catch (erro) {
      box.innerHTML = `<p class="pp-error">${esc(erro.message)}</p>`;
    }
  }

  const ROTULO_TX = {
    PAYMENT_CREDIT: "Compra de Pipoints", ITEM_PURCHASE: "Compra de item",
    GAME_REWARD: "Recompensa de partida", ADMIN_ADJUSTMENT: "Ajuste",
    REFUND: "Estorno", PROMOTION: "Promocao",
  };

  async function renderHistorico() {
    const box = $("#historyBox");
    if (!S.autenticado) { box.innerHTML = `<p class="pp-muted">Entre na sua conta para ver seu historico.</p>`; return; }
    try {
      const linhas = await S.extrato();
      if (!linhas.length) { box.innerHTML = `<p class="pp-muted">Nenhuma movimentacao ainda.</p>`; return; }
      box.innerHTML = `<table class="pp-table"><thead><tr>
          <th>Quando</th><th>Operacao</th><th>Pipoints</th><th>Saldo</th>
        </tr></thead><tbody>${linhas.map(t => `<tr>
          <td>${esc(new Date((t.createdAt || "").replace(" ", "T") + "Z").toLocaleString("pt-BR"))}</td>
          <td>${esc(ROTULO_TX[t.type] || t.type)}</td>
          <td class="${t.amount < 0 ? "pp-neg" : "pp-pos"}">${t.amount > 0 ? "+" : ""}${numero(t.amount)}</td>
          <td>${numero(t.balanceAfter)}</td>
        </tr>`).join("")}</tbody></table>`;
    } catch (erro) {
      box.innerHTML = `<p class="pp-error">${esc(erro.message)}</p>`;
    }
  }

  async function atualizarTudo() {
    if (S.autenticado) { try { await S.sincronizarCarteira(); } catch {} }
    renderConta();
    await Promise.all([renderInventario(), renderHistorico()]);
  }

  /* ---------------------------------------------------------------- pagamento */
  async function iniciarPagamento(packId) {
    if (criandoPagamento) return;
    if (!exigirLogin()) return;
    if (S.ehVisitante) { toast("Crie uma conta para comprar Pipoints."); return; }
    criandoPagamento = true;
    $$('[data-pack]').forEach(b => b.disabled = true);
    const conta = S.accountId;
    try {
      const pedido = await S.criarPedido(packId);
      if (conta !== S.accountId) return;

      // Checkout real do Mercado Pago: sai do site.
      if (pedido.checkoutUrl) { location.assign(pedido.checkoutUrl); return; }

      // Ambiente local (mock): acompanha o status aqui.
      $("#paymentSummary").textContent =
        `${numero(pedido.pipointsAmount)} PP por ${dinheiro(pedido.amountBrlCents)}`;
      $("#paymentStatus").textContent = "Ambiente local: aguardando simulacao.";
      const botaoMock = $("#mockApprove");
      botaoMock.hidden = pedido.provider !== "mock";
      botaoMock.onclick = () => aprovarMock(pedido.id);
      $("#paymentDialog").showModal();
      acompanhar(pedido.id);
    } catch (erro) { if (conta === S.accountId) toast(erro.message); }
    finally { criandoPagamento = false; $$('[data-pack]').forEach(b => b.disabled = false); }
  }

  const FINAIS = ["APPROVED", "REJECTED", "CANCELLED", "EXPIRED", "REFUNDED", "CHARGEBACK"];

  function acompanhar(id) {
    clearInterval(timerPagamento);
    const conta = S.accountId;
    let emVoo = false;
    timerPagamento = setInterval(async () => {
      if (conta !== S.accountId || !S.autenticado) { clearInterval(timerPagamento); return; }
      if (emVoo) return;
      emVoo = true;
      try {
        const pedido = await S.pedido(id);
        if (conta !== S.accountId) return;
        $("#paymentStatus").textContent = `Status: ${pedido.status}`;
        if (FINAIS.includes(pedido.status)) {
          clearInterval(timerPagamento);
          await atualizarTudo();
          if (pedido.status === "APPROVED") toast("Pipoints creditados.");
        }
      } catch { /* segue tentando até o status final */ }
      finally { emVoo = false; }
    }, 2500);
  }

  async function aprovarMock(id) {
    try {
      await S.aprovarMock(id);
      $("#paymentStatus").textContent = "Status: APPROVED";
      await atualizarTudo();
      toast("Teste aprovado e sincronizado.");
    } catch (erro) { toast(erro.message); }
  }

  /* -------------------------------------------------------------------- login */
  function abrirLogin() {
    modoCadastro = false;
    $("#nickRow").hidden = true;
    $("#authSubmit").textContent = "Entrar";
    $("#authToggle").textContent = "Criar uma conta";
    $("#authError").textContent = "";
    $("#authDialog").showModal();
  }

  async function respostaGoogle(res) {
    try {
      $("#authError").textContent = "Autenticando com Google...";
      await S.entrarComGoogle(res.credential);
      $("#authDialog").close();
      await atualizarTudo();
      await recuperarPagamento();
      toast("Login via Google feito com sucesso.");
    } catch (erro) { $("#authError").textContent = erro.message; }
  }

  function prepararGoogle() {
    const alvo = $("#googleBtnContainer");
    if (!cfg.GOOGLE_CLIENT_ID) {
      // Credencial ausente: informa, não simula (§10).
      alvo.innerHTML = `<p class="pp-muted">Login com Google indisponivel nesta versao.</p>`;
      return;
    }
    if (!window.google) return;
    google.accounts.id.initialize({ client_id: cfg.GOOGLE_CLIENT_ID, callback: respostaGoogle });
    google.accounts.id.renderButton(alvo,
      { theme: "outline", size: "large", text: "signin_with", shape: "rectangular" });
  }

  /* ---------------------------------------------------------------- bootstrap */
  async function iniciar() {
    if (!S.disponivel()) {
      $("#packageGrid").innerHTML =
        `<p class="pp-error">Loja indisponivel: backend nao configurado para o ambiente "${esc(cfg.ENVIRONMENT)}".</p>`;
      return;
    }

    try { renderPacotes(await S.pacotes()); }
    catch (erro) { $("#packageGrid").innerHTML = `<p class="pp-error">${esc(erro.message)}</p>`; }

    await S.restaurar();
    await atualizarTudo();
    await recuperarPagamento();

    // Retorno do Mercado Pago: só CONSULTA, nunca assume crédito.
    const params = new URLSearchParams(location.search);
    if (params.has("status")) {
      await atualizarTudo();
      toast(params.get("status") === "approved"
        ? "Pagamento retornou como aprovado. Confirmando com o servidor..."
        : "Pagamento retornou ao site. Aguardando confirmacao.");
    }

    prepararGoogle();
  }

  async function recuperarPagamento() {
    if (S.autenticado) {
      try {
        const pendente = (await S.pedidos()).find(p => p.status === 'PENDING' && p.provider === 'mercadopago');
        if (pendente) {
          $('#paymentSummary').textContent = `${numero(pendente.pipointsAmount)} PP por ${dinheiro(pendente.amountBrlCents)}`;
          $('#paymentStatus').textContent = 'Conferindo pagamento pendente...';
          $('#mockApprove').hidden = true;
          $('#paymentDialog').showModal();
          acompanhar(pendente.id);
        }
      } catch (erro) { toast(erro.message); }
    }

  }

  /* ------------------------------------------------------------------ eventos */
  S.on("change", () => {
    if (ultimaConta !== S.accountId) {
      ultimaConta = S.accountId;
      clearInterval(timerPagamento);
      $('#paymentDialog').close();
      $('#inventoryGrid').innerHTML = '';
      $('#historyBox').innerHTML = '';
    }
    renderConta();
  });

  $("#accountButton").onclick = async () => {
    if (S.autenticado) { await S.sair(); await atualizarTudo(); toast("Sessao encerrada."); }
    else abrirLogin();
  };

  $("#authToggle").onclick = () => {
    modoCadastro = !modoCadastro;
    $("#nickRow").hidden = !modoCadastro;
    $("#authSubmit").textContent = modoCadastro ? "Criar conta" : "Entrar";
    $("#authToggle").textContent = modoCadastro ? "Ja tenho uma conta" : "Criar uma conta";
    $("#password").minLength = modoCadastro ? 8 : 1;
  };

  $("#authForm").onsubmit = async evento => {
    evento.preventDefault();
    $("#authError").textContent = "";
    try {
      const email = $("#email").value, senha = $("#password").value;
      if (modoCadastro) await S.cadastrar(email, senha, $("#nick").value);
      else await S.entrar(email, senha);
      $("#authDialog").close();
      await atualizarTudo();
      toast("Conta sincronizada.");
      await recuperarPagamento();
    } catch (erro) { $("#authError").textContent = erro.message; }
  };

  $$("[data-close]").forEach(b => b.onclick = () => {
    b.closest("dialog").close();
    clearInterval(timerPagamento);
  });

  iniciar();
})();
