/* Página do responsável: autoriza/revoga a interação do menor (ECA Digital art. 21). */
(function () {
  const S = window.ReloSession, $ = id => document.getElementById(id);
  const token = new URLSearchParams(location.search).get("t") || "";
  const erro = t => { $("erro").textContent = t; };
  async function carregar() {
    if (!token) { $("pedido").textContent = "Link incompleto. Abra o link exatamente como veio no e-mail."; return; }
    try {
      const r = await S.api("/account/age/guardian?t=" + encodeURIComponent(token), { auth: false });
      const nome = document.createElement("b"); nome.textContent = r.jogador;
      $("pedido").textContent = "";
      $("pedido").append("O jogador ", nome, " pediu sua autorização para conversar com outros jogadores no RELO.",
        r.status === "GRANTED" ? " Situação atual: AUTORIZADO." : r.status === "REVOKED" ? " Situação atual: RECUSADO." : "");
      $("btnAutorizar").disabled = false; $("btnRecusar").disabled = false;
    } catch (e) {
      $("pedido").textContent = e.code === "autorizacao_expirada" ? "Este link expirou. Peça ao jogador para enviar um novo pedido pelo jogo." : "Link inválido.";
    }
  }
  async function decidir(autorizar) {
    erro(""); $("btnAutorizar").disabled = true; $("btnRecusar").disabled = true;
    try {
      await S.api("/account/age/guardian", { auth: false, method: "POST", body: { token, authorize: autorizar } });
      $("feito").hidden = false;
      $("feito").textContent = autorizar ? "Autorização registrada. O chat é liberado na próxima vez que o jogo abrir." : "Pronto: a conversa com outros jogadores continua desligada.";
    } catch (e) { erro(e.message || "Não foi possível registrar agora."); }
    $("btnAutorizar").disabled = false; $("btnRecusar").disabled = false;
  }
  $("btnAutorizar").addEventListener("click", () => decidir(true));
  $("btnRecusar").addEventListener("click", () => decidir(false));
  carregar();
})();
