/* Página "Excluir minha conta" (Google Play exige um caminho pela web).
   Chama a MESMA rota do jogo: POST /auth/delete-account. */
(function () {
  const S = window.ReloSession;
  const $ = id => document.getElementById(id);
  let senhaDigitada = "";

  $("formLogin").addEventListener("submit", async ev => {
    ev.preventDefault();
    $("erroLogin").textContent = "";
    try {
      senhaDigitada = $("senha").value;
      await S.entrar($("email").value.trim(), senhaDigitada);
      $("nomeConta").textContent = (S.account && (S.account.displayName + " · " + (S.account.email || S.account.accountId))) || "";
      $("passoLogin").hidden = true;
      $("passoConfirmar").hidden = false;
      $("confirmacao").focus();
    } catch (e) { $("erroLogin").textContent = e.message || "Não foi possível entrar."; }
  });

  $("confirmacao").addEventListener("input", () => {
    $("btnExcluir").disabled = $("confirmacao").value.trim().toUpperCase() !== "EXCLUIR";
  });

  $("formExcluir").addEventListener("submit", async ev => {
    ev.preventDefault();
    $("erroExcluir").textContent = "";
    $("btnExcluir").disabled = true;
    try {
      await S.api("/auth/delete-account", { method: "POST", body: { confirmacao: "EXCLUIR", password: senhaDigitada, source: "site" } });
      senhaDigitada = "";
      $("passoConfirmar").hidden = true;
      $("passoFeito").hidden = false;
      try { await S.sair(); } catch {}
    } catch (e) {
      const msg = { senha_incorreta: "Senha incorreta. Volte e entre de novo.", muitas_tentativas: "Muitas tentativas. Aguarde alguns minutos." }[e.code];
      $("erroExcluir").textContent = msg || e.message || "Não foi possível excluir agora.";
      $("btnExcluir").disabled = false;
    }
  });
})();
