/* ============================================================================
   RELO — Dados da empresa usados nas páginas legais do site.
   PREENCHER ANTES DE PUBLICAR (os mesmos valores de Assets/Scripts/Legal/TermosDeUso.cs).
   ========================================================================== */
window.RELO_EMPRESA = {
  VERSAO: "1.0",
  DATA_VIGENCIA: "28/09/2026",
  EMPRESA: "RELO Games",
  CNPJ: "",
  ENDERECO: "",
  EMAIL_CONTATO: "suporte@relogame.com.br",
  EMAIL_DPO: "suporte@relogame.com.br",
  NOME_DPO: "Equipe de Privacidade RELO",
  CIDADE_FORO: "",
  URL_SITE: "https://relogame.com.br/legal/privacidade.html",
};
document.addEventListener("DOMContentLoaded", function () {
  var d = window.RELO_EMPRESA;
  document.querySelectorAll("[data-e]").forEach(function (el) {
    var v = d[el.getAttribute("data-e")];
    if (v != null) el.textContent = v;
  });
  document.querySelectorAll("[data-mail]").forEach(function (el) {
    var v = d[el.getAttribute("data-mail")];
    if (v) { el.textContent = v; el.href = "mailto:" + v.replace(/[\[\]]/g, ""); }
  });
});
