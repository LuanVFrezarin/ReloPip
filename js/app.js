/* RELO — interações da landing de pré-lançamento */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const API = window.ReloAPI;
  const LINKS = (window.RELO_CONFIG && window.RELO_CONFIG.LINKS) || {};
  const API_BASE = String((window.RELO_CONFIG && window.RELO_CONFIG.API_BASE) || "").replace(/\/$/, "");
  const waitingUrl = API_BASE ? API_BASE + "/api/waiting" : "/api/waiting";
  const fmt = n => Number(n || 0).toLocaleString("pt-BR");

  let waitTotal = 0, goal = 5000, slotsTotal = 0, membersCount = 0;
  // chaves versionadas — começa tudo do zero e ignora cache antigo dos navegadores
  const LS_TOTAL = "relo_wait_total_v2";
  const LS_REG = "relo_wait_registered_v2";

  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("load", () => setTimeout(() => $("#preloader")?.classList.add("hide"), 500));

  async function init() {
    startFX();
    setupCursor();
    setupTicker();
    setupNav();
    setupReveal();
    setupMagnetic();
    setupExternalLinks();
    setupLightbox();
  }

  /* ---------- FUNDO: partículas + faíscas ---------- */
  function startFX() {
    const c = $("#fxCanvas"); if (!c) return;
    if (matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    const ctx = c.getContext("2d");
    let w, h, parts = [];
    const COLORS = ["#ffd15a", "#9b5cff", "#ff5db1", "#52f28f", "#ffffff"];
    function resize() {
      w = c.width = innerWidth; h = c.height = innerHeight;
      const n = Math.min(innerWidth < 700 ? 22 : 40, Math.floor(w / 34));
      parts = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 2 + .4, vy: -(Math.random() * .4 + .1),
        vx: (Math.random() - .5) * .3, a: Math.random() * .5 + .2,
        col: COLORS[(Math.random() * COLORS.length) | 0]
      }));
    }
    resize(); addEventListener("resize", resize);
    (function loop() {
      ctx.clearRect(0, 0, w, h);
      parts.forEach(p => {
        p.y += p.vy; p.x += p.vx;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        ctx.globalAlpha = p.a; ctx.fillStyle = p.col;
        ctx.shadowBlur = 8; ctx.shadowColor = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      });
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      requestAnimationFrame(loop);
    })();
  }

  function setupCursor() {
    const g = $("#cursorGlow"); if (!g) return;
    addEventListener("mousemove", e => {
      g.style.left = e.clientX + "px"; g.style.top = e.clientY + "px";
    }, { passive: true });
  }

  function setupTicker() {
    const t = $("#tickerTrack"); if (!t) return;
    const msgs = [
      "RELO · Da laje pro céu",
      "Modo Pipão no ar · Rabiolão e xepa permanente",
      "Festival Noturno · relo contínuo com a linha acesa",
      "28 skins na Casa Relo",
      "Dezembro · Ninja Cone, DJ Colmeia e Passe de 20 níveis",
    ];
    const block = msgs.map(m => `<span>◆ ${m}</span>`).join("");
    t.innerHTML = block + block;
  }

  function setupNav() {
    const nav = $("#nav"), links = $("#navLinks");
    const onScroll = () => nav.classList.toggle("scrolled", scrollY > 20);
    addEventListener("scroll", onScroll); onScroll();
    $("#burger")?.addEventListener("click", () => links.classList.toggle("open"));
    $$("#navLinks a").forEach(a => a.addEventListener("click", () => links.classList.remove("open")));
  }

  function setupReveal() {
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    $$(".reveal:not(.in)").forEach(el => io.observe(el));
  }

  function setupMagnetic() {
    if (matchMedia("(hover:none)").matches) return;
    $$(".magnetic").forEach(el => {
      el.addEventListener("mousemove", e => {
        const r = el.getBoundingClientRect();
        const mx = e.clientX - r.left - r.width / 2;
        const my = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${mx * .18}px, ${my * .28}px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  }

  /* ---------- CONTEÚDO ---------- */
  async function loadContent() {
    const [stats, gallery, gameVids] = await Promise.all([
      API.getStats(), API.getGallery(), API.getGameVideos()
    ]);
    goal = Number(stats.goal || 5000);
    slotsTotal = Number(stats.slots || 100);
    membersCount = Number(stats.members || 64);
    waitTotal = Number(localStorage.getItem(LS_TOTAL) || stats.waiting || 0);

    renderAvatars($("#heroAvatars"), waitTotal > 0 ? 6 : 0);
    renderGameVideos(gameVids);
    renderGallery(gallery);
    renderMembers(gallery.length);

    setWaitCount(waitTotal);
    // anima as barras ao entrar na tela
    observeOnce($(".hype-panel"), () => animateWaitBars());
    observeOnce($(".launch-card"), () => setLaunch());
    observeOnce($(".dev-progress"), () => setDev());
    syncWaiting();
    setupReveal();
  }

  function renderAvatars(wrap, n) {
    if (!wrap) return;
    const L = ["R", "P", "C", "L", "V", "A", "D", "S"];
    wrap.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const s = document.createElement("span");
      s.className = "avatar"; s.textContent = L[i % L.length];
      wrap.appendChild(s);
    }
  }

  // toca/pausa vídeos conforme entram na tela (mudos, sem peso fora de vista)
  function scrollPlay(scope) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      const v = e.target;
      if (e.isIntersecting) v.play().catch(() => {}); else v.pause();
    }), { threshold: 0.35 });
    $$("video[data-scroll]", scope || document).forEach(v => io.observe(v));
  }

  // só esconde se o arquivo realmente falhar (404) ou não decodificar.
  // mp4 válido dispara loadeddata com largura > 0 -> mantém.
  function guardVideo(v) {
    const fail = () => v.closest(".has-vid")?.classList.add("novideo");
    v.addEventListener("loadeddata", () => { if (!v.videoWidth) fail(); });
    v.addEventListener("error", fail);
  }

  function renderGameVideos(items) {
    const grid = $("#gameVideoGrid"); if (!grid) return;
    grid.innerHTML = items.map(v => `
      <article class="gv-card has-vid ${v.featured ? "featured" : ""} reveal">
        <span class="vc-badge">▶ ${esc(v.title)}</span>
        <video data-scroll muted loop playsinline preload="metadata" src="${esc(v.src)}"></video>
        <div class="vc-info"><h3>${esc(v.title)}</h3><p>${esc(v.text)}</p></div>
      </article>`).join("");
    $$("#gameVideoGrid video").forEach(guardVideo);
    scrollPlay(grid);
  }

  let GALLERY = [];
  function renderGallery(items) {
    GALLERY = items;
    const grid = $("#galleryGrid"); if (!grid) return;
    grid.innerHTML = items.map(i => `
      <article class="shot reveal" data-cat="${esc(i.cat)}" data-img="${esc(i.img)}" data-title="${esc(i.title)}">
        <img src="${esc(i.img)}" loading="lazy" alt="${esc(i.title)}">
        <div class="shot-content">
          <span class="shot-tag ${esc(i.tag)}">${esc(i.tag)}</span>
          <h3>${esc(i.title)}</h3><small>${esc(i.cat)}</small>
        </div>
      </article>`).join("");

    $$("#galleryFilters .chip").forEach(chip => {
      chip.addEventListener("click", () => {
        $$("#galleryFilters .chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        const f = chip.dataset.filter;
        $$("#galleryGrid .shot").forEach(s => {
          s.classList.toggle("hide", f !== "all" && s.dataset.cat !== f);
        });
      });
    });

    $$("#galleryGrid .shot").forEach(s => {
      s.addEventListener("click", () => openLightbox(
        `<img src="${esc(s.dataset.img)}" alt="${esc(s.dataset.title)}">
         <div class="lb-cap"><small>Pipa do acervo</small><h3>${esc(s.dataset.title)}</h3></div>`));
    });
  }

  function renderMembers(kites) {
    const m = $("#sMembers"), k = $("#sKites");
    if (m) { m.dataset.count = membersCount; }
    if (k) { k.textContent = kites; }
  }

  /* ---------- CONTADORES / BARRAS ---------- */
  function setWaitCount(v) {
    ["#waitCount", "#launchTotal", "#heroTotal"].forEach(s => { const el = $(s); if (el) el.textContent = fmt(v); });
  }
  function pct() { return Math.min(100, Math.round(waitTotal / goal * 100)); }

  function animateWaitBars() {
    countTo("#waitCount", waitTotal);
    const bar = $("#waitBar"); if (bar) bar.style.width = pct() + "%";
    if ($("#waitGoal")) $("#waitGoal").textContent = fmt(goal);
    if ($("#waitPct")) $("#waitPct").textContent = pct() + "%";
    countTo("#sMembers", membersCount);
  }
  function setLaunch() {
    countTo("#launchTotal", waitTotal); countTo("#heroTotal", waitTotal);
    const bar = $("#launchBar"); if (bar) bar.style.width = pct() + "%";
    if ($("#launchGoal")) $("#launchGoal").textContent = fmt(goal);
  }
  function setDev() {
    const bar = $("#devBar"); if (bar) bar.style.width = "45%";
  }

  function countTo(sel, target) {
    const el = $(sel); if (!el) return;
    const from = Number(String(el.textContent).replace(/\D/g, "")) || 0;
    const start = performance.now(), dur = 1100;
    (function step(now) {
      const p = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.floor(from + (target - from) * e));
      if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(target);
    })(start);
  }

  function observeOnce(el, cb) {
    if (!el) return;
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { cb(); io.disconnect(); }
    }), { threshold: 0.3 });
    io.observe(el);
  }

  /* ---------- LISTA DE ESPERA ---------- */
  function setupWaitList() {
    const set = reg => {
      const b = $("#confirmWait");
      if (b) {
        b.classList.toggle("is-done", reg);
        b.innerHTML = reg
          ? '<svg><use href="#i-check"/></svg> Presença confirmada'
          : '<svg><use href="#i-check"/></svg> Sim, vou jogar';
        b.disabled = reg;
      }
      const h = $("#waitHint");
      if (h) h.textContent = reg ? "Você já está na lista. Agora chame seus amigos!" : "Seu clique conta uma única vez neste navegador.";
    };
    const registered = localStorage.getItem(LS_REG) === "1";
    set(registered);

    const join = async () => {
      if (localStorage.getItem(LS_REG) === "1") { toast("Você já está na lista 🎉"); return; }
      localStorage.setItem(LS_REG, "1");
      waitTotal += 1; localStorage.setItem(LS_TOTAL, String(waitTotal));
      set(true); bumpCounts();
      const registroRemoto = fetch(waitingUrl, { method: "POST" });
      try { confetti(); } catch {}
      toast("Presença confirmada. Bem-vindo ao céu do RELO! 🪁");
      try {
        const res = await registroRemoto;
        const d = res.ok ? await res.json() : null;
        if (d && d.persistent && typeof d.count === "number") { waitTotal = Math.max(waitTotal, Number(d.count)); localStorage.setItem(LS_TOTAL, String(waitTotal)); bumpCounts(); }
      } catch {}
    };
    $("#confirmWait")?.addEventListener("click", join);

    // "Entrar grátis" no card do hero -> desce pra escolha de plano (grátis x membro)
    $("#launchJoin")?.addEventListener("click", () => {
      const sec = $("#membros");
      sec?.scrollIntoView({ behavior: "smooth" });
      sec?.classList.add("flash");
      setTimeout(() => sec?.classList.remove("flash"), 1400);
    });
  }

  function bumpCounts() {
    setWaitCount(waitTotal);
    ["#waitBar", "#launchBar"].forEach(s => { const b = $(s); if (b) b.style.width = pct() + "%"; });
    if ($("#waitPct")) $("#waitPct").textContent = pct() + "%";
  }

  function setupShare() {
    $("#shareSite")?.addEventListener("click", async () => {
      const data = { title: "RELO", text: "Olha esse jogo online de pipa em desenvolvimento no Brasil 🪁", url: location.origin + location.pathname };
      try {
        if (navigator.share && (navigator.maxTouchPoints > 0 || /Android|iPhone|iPad/i.test(navigator.userAgent))) {
          await navigator.share(data); return;
        }
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(data.url);
        toast("Link copiado! Manda pra galera 🚀");
      } catch { toast("Copie o link do navegador e compartilhe."); }
    });
  }

  function setupExternalLinks() {
    [["#communityWhatsapp", LINKS.whatsapp], ["#supportWhatsapp", LINKS.whatsapp_apoiadores]].forEach(([sel, href]) => {
      const el = $(sel); if (!el) return;
      if (href && href !== "#") {
        el.href = href; el.target = "_blank"; el.rel = "noopener";
      } else {
        el.addEventListener("click", e => { e.preventDefault(); toast("Link do WhatsApp ainda não configurado. (Luan: cole em js/config.js)"); });
      }
    });
    $("#pixButton")?.addEventListener("click", async () => {
      const pix = String(LINKS.pix || "39845365-60d9-4783-be50-a7fb9562d3a7");
      try {
        if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(pix); toast("PIX copiado (chave aleatória) — R$ 10/mês 💛"); }
        else toast("PIX: " + pix);
      } catch { toast("PIX: " + pix); }
    });
  }

  function syncWaiting() {
    fetch(waitingUrl).then(r => r.ok ? r.json() : null).then(d => {
      if (!d || !d.persistent || typeof d.count !== "number") return;
      // usa o número global do servidor (Upstash) como fonte da verdade
      waitTotal = Math.max(waitTotal, Number(d.count)); localStorage.setItem(LS_TOTAL, String(waitTotal)); bumpCounts();
    }).catch(() => {});
  }

  /* ---------- LIGHTBOX ---------- */
  function setupLightbox() {
    $("#lbClose")?.addEventListener("click", closeLightbox);
    $("#lightbox")?.addEventListener("click", e => { if (e.target.id === "lightbox") closeLightbox(); });
    addEventListener("keydown", e => { if (e.key === "Escape") closeLightbox(); });
  }
  function openLightbox(html) {
    const lb = $("#lightbox"), inner = $("#lbInner");
    if (!lb || !inner) return;
    inner.innerHTML = html; lb.classList.add("open"); lb.setAttribute("aria-hidden", "false");
  }
  function closeLightbox() {
    const lb = $("#lightbox"), inner = $("#lbInner");
    if (!lb) return;
    lb.classList.remove("open"); lb.setAttribute("aria-hidden", "true");
    if (inner) inner.innerHTML = "";
  }

  /* ---------- MINI CONFETTI (pipas) ---------- */
  function confetti() {
    const cols = ["#ffd15a", "#3ee7ff", "#ff5db1", "#52f28f", "#ff7a2f"];
    for (let i = 0; i < 26; i++) {
      const p = document.createElement("span");
      p.style.cssText = `position:fixed;left:50%;top:40%;width:10px;height:13px;z-index:170;pointer-events:none;
        background:${cols[i % cols.length]};clip-path:polygon(50% 0,100% 45%,50% 100%,0 45%);
        transform:translate(-50%,-50%)`;
      document.body.appendChild(p);
      const ang = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 220;
      const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 60;
      p.animate([
        { transform: `translate(-50%,-50%) rotate(0)`, opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) rotate(${Math.random() * 720 - 360}deg)`, opacity: 0 }
      ], { duration: 1100 + Math.random() * 500, easing: "cubic-bezier(.1,.7,.3,1)" }).onfinish = () => p.remove();
    }
  }

  let toastTimer;
  function toast(msg) {
    const el = $("#toast"); if (!el) return;
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3400);
  }
  function esc(s) { return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
})();
