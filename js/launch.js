/* RELO — interações do site de lançamento (pensado primeiro pro celular) */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const M = "media/";
  const calmo = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const celular = innerWidth < 760;
  const leve = celular || (navigator.connection && navigator.connection.saveData);
  const CFG = window.RELO_CONFIG || {};
  const LOJAS = CFG.LOJAS || {};
  const cssLinha = () => getComputedStyle(document.documentElement).getPropertyValue("--linha").trim() || "#ffd15a";

  const toast = msg => {
    const el = $("#toast"); if (!el) return;
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 3400);
  };
  const guarda = {
    ler(k, p) { try { return localStorage.getItem(k) ?? p; } catch { return p; } },
    salvar(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  setTimeout(() => $("#preloader")?.classList.add("hide"), 1100);

  /* ---------- RABIOLA: corrente de pontos que segue a pipa ---------- */
  function criaRabiola(n, seg) { return { seg, p: Array.from({ length: n }, () => ({ x: -999, y: -999, ox: -999, oy: -999 })) }; }
  function passoRabiola(r, ax, ay, vento, dt) {
    const p = r.p;
    if (p[0].x === -999) p.forEach((q, i) => { q.x = q.ox = ax; q.y = q.oy = ay + i * r.seg; });
    p[0].x = ax; p[0].y = ay;
    for (let i = 1; i < p.length; i++) {
      const q = p[i], vx = (q.x - q.ox) * .94, vy = (q.y - q.oy) * .94;
      q.ox = q.x; q.oy = q.y;
      q.x += vx + vento * dt; q.y += vy + .32 * dt;
    }
    for (let k = 0; k < 3; k++) for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - r.seg) / d;
      b.x -= dx * f; b.y -= dy * f;
    }
  }
  function desenhaRabiola(g, r, cor, larg) {
    const p = r.p; g.lineCap = "round"; g.lineWidth = larg;
    for (let i = 1; i < p.length; i++) {
      g.strokeStyle = i % 2 ? "#0d0f1a" : cor;
      g.beginPath(); g.moveTo(p[i - 1].x, p[i - 1].y); g.lineTo(p[i].x, p[i].y); g.stroke();
    }
  }
  const img = n => { const i = new Image(); i.src = M + "pipas/" + n + ".webp"; return i; };
  const cruza = (a, b, c, d) => {
    const s = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x); if (!s) return null;
    const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / s, u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / s;
    return t > 0 && t < 1 && u > 0 && u < 1 ? { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t } : null;
  };

  /* ---------- HERO ---------- */
  const hero = $("#heroVideo");
  if (hero) {
    if (leve) hero.poster = hero.dataset.pm;
    if (calmo) hero.removeAttribute("autoplay");
    else { hero.src = leve ? hero.dataset.sd : hero.dataset.hd; hero.play().catch(() => {}); }
  }

  /* ---------- VÍDEOS SOB DEMANDA: só baixa perto da tela e pausa fora dela ---------- */
  function observarVideo(v) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) {
        if (v.dataset.lazy && !v.src) { v.src = v.dataset.lazy; v.load(); }
        if (!calmo) v.play().catch(() => {});
      } else v.pause();
    }), { rootMargin: "120px", threshold: 0.2 });
    io.observe(v);
  }

  /* ---------- NÚMEROS ---------- */
  const ioNum = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    ioNum.unobserve(e.target);
    const fim = Number(e.target.dataset.n), ini = performance.now();
    (function passo(t) {
      const p = Math.min(1, (t - ini) / 900), q = 1 - Math.pow(1 - p, 3);
      e.target.textContent = Math.round(fim * q);
      if (p < 1) requestAnimationFrame(passo);
    })(ini);
  }), { threshold: .6 });
  if (!calmo) $$(".num b").forEach(b => ioNum.observe(b));

  /* ---------- REELS ---------- */
  const rt = $("#reelsTrack");
  if (rt) {
    const nomes = ["reel_corte", "reel_corrida", "reel_aparo", "reel_rabiola", "reel_dano", "reel_pipa", "reel_atrito", "reel_faisca"];
    const lista = celular ? nomes.concat(nomes) : nomes.concat(nomes, nomes, nomes);
    rt.innerHTML = lista.map(n => `<div class="reel"><video data-lazy="${M}${n}.mp4" poster="${M}${n}.jpg" muted loop playsinline></video></div>`).join("");
  }

  /* ---------- TRAILER: prévia muda, toque abre com som ---------- */
  const tv = $("#trailerVideo"), tbox = $("#trailerBox");
  const abreTrailer = () => {
    const lb = $("#lightbox"), inn = $("#lbInner"); if (!lb) return;
    inn.className = "lb-inner lb-trailer";
    inn.innerHTML = `<video src="${M}${leve ? "trailer-m" : "trailer"}.mp4" poster="${M}trailer.jpg" controls autoplay playsinline></video>`;
    lb.classList.add("open"); lb.setAttribute("aria-hidden", "false");
    inn.querySelector("video").play().catch(() => {});
    if (tv) tv.pause();
  };
  if (tv && tbox) {
    if (!leve) tv.dataset.lazy = M + "trailer.mp4";
    tbox.addEventListener("click", abreTrailer);
    tbox.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abreTrailer(); } });
  }
  $("#heroTrailer")?.addEventListener("click", abreTrailer);
  new MutationObserver(() => { const lb = $("#lightbox"); if (lb && !lb.classList.contains("open")) $("#lbInner").className = "lb-inner"; }).observe($("#lightbox"), { attributes: true, attributeFilter: ["class"] });

  /* ---------- MODOS: a escolhida cresce e abre em forma de pipa ---------- */
  const mods = $$("#modos2 .modo2");
  if (mods.length) {
    const ativa = m => {
      if (m.classList.contains("active") && !celular) return;
      mods.forEach(x => x.classList.toggle("active", x === m));
      m.classList.remove("abre"); void m.offsetWidth; m.classList.add("abre");
      document.body.dataset.ceu = m.dataset.ceu;
    };
    mods.forEach(m => {
      m.addEventListener("click", () => ativa(m));
      if (!celular) m.addEventListener("mouseenter", () => ativa(m));
    });
    const box = $("#modos2");
    if (celular) {
      const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) ativa(e.target); }), { root: box, threshold: .6 });
      mods.forEach(m => io.observe(m));
    }
    new IntersectionObserver(es => es.forEach(e => {
      document.body.dataset.ceu = e.isIntersecting ? ($(".modo2.active", box)?.dataset.ceu || "dia") : "dia";
    }), { threshold: .35 }).observe(box);
  }

  /* ---------- SKINS ---------- */
  const SKINS = {
    especial: [["ninja_cone", "Ninja Cone"], ["dj_colmeia", "DJ Colmeia"], ["astronauta_disco", "Astronauta Disco"], ["bobo_pescador", "Bobo Pescador"], ["salsicha_noir", "Salsicha Noir"], ["mestre_geladeira", "Mestre Geladeira"], ["fugitivo_galactico", "Fugitivo Galáctico"], ["mariachi_mecanico", "Mariachi Mecânico"], ["trapaceiro_neon", "Trapaceiro Neon"], ["rei_dos_pombos", "Rei dos Pombos"]],
    anime: [["kitsune", "Kitsune Rubro"], ["oni_rubro", "Oni Rubro"], ["tengu", "Tengu Carmesim"], ["imperatriz", "Imperatriz Glacial"], ["oni_dourado", "Oni Dourado"], ["jade", "Soberano Jade"], ["raijin", "Raijin"], ["oni_mares", "Oni das Marés"], ["vanguarda", "Vanguarda Rubra"]],
    mandrake: [["dourado", "Mandrake Dourado"], ["rebelde", "Rebelde da Laje"], ["poeira", "Poeira da Rua"], ["andarilho", "Andarilho"], ["tatuado", "Cria Tatuado"], ["estrada", "Longa Estrada"], ["inabalavel", "Inabalável"], ["urbano", "Cria Urbano"], ["veterano", "Veterano"]],
  };
  const CORCAT = { especial: "#ff7a2f", anime: "#ff4f6d", mandrake: "#ffd15a" };
  const st = $("#skinsTrack");
  if (st) {
    let raf = 0;
    const desenha = () => {
      raf = 0;
      const c = st.getBoundingClientRect().left + st.clientWidth / 2, passo = celular ? 230 : 300;
      $$(".skin", st).forEach(s => {
        const r = s.getBoundingClientRect();
        const d = (r.left + r.width / 2 - c) / passo;
        const a = Math.min(Math.abs(d), 3);
        s.style.transform = `rotateY(${Math.max(-46, Math.min(46, -d * 30))}deg) scale(${1.08 - a * .2}) translateZ(${-a * 60}px)`;
        s.style.opacity = Math.max(.22, 1 - a * .3);
      });
    };
    const pede = () => { if (!raf) raf = requestAnimationFrame(desenha); };
    function monta(cat) {
      const prefixo = cat === "anime" ? "anime_" : cat === "mandrake" ? "mandrake_" : "especial_";
      st.innerHTML = SKINS[cat].map(([id, n]) => `<article class="skin" style="--cat:${CORCAT[cat]}"><div class="sk-fundo"><img src="${M}skins/${prefixo}${id}.webp" alt="${n}" loading="lazy" draggable="false"></div><h3>${n}</h3><span>450 PP</span></article>`).join("");
      st.scrollLeft = 0;
      requestAnimationFrame(() => { const k = $$(".skin", st)[2]; st.scrollLeft = k ? Math.max(0, k.offsetLeft - st.clientWidth / 2 + k.clientWidth / 2) : 0; pede(); });
    }
    monta("especial");
    st.addEventListener("scroll", pede, { passive: true });
    addEventListener("resize", pede);
    $$("#skinFiltros .chip").forEach(c => c.addEventListener("click", () => {
      $$("#skinFiltros .chip").forEach(x => x.classList.remove("active"));
      c.classList.add("active"); monta(c.dataset.f);
    }));
    let px = 0, ls = 0, puxando = false;
    st.addEventListener("pointerdown", e => { if (e.pointerType !== "mouse") return; puxando = true; px = e.clientX; ls = st.scrollLeft; st.classList.add("drag"); });
    addEventListener("pointermove", e => { if (puxando) st.scrollLeft = ls - (e.clientX - px); });
    addEventListener("pointerup", () => { puxando = false; st.classList.remove("drag"); });
  }

  /* ---------- CONTAGEM: 1º de dezembro de 2026, 00:00 de Brasília ---------- */
  const cont = $("#contagem");
  if (cont) {
    const ALVO = Date.parse("2026-12-01T00:00:00-03:00");
    const nov = (k, v) => { const e = $(`[data-c="${k}"]`, cont); if (e) e.textContent = String(v).padStart(2, "0"); };
    const tic = () => {
      const r = Math.max(0, ALVO - Date.now());
      if (!r) { const bloco = cont.closest(".drop-copy"); bloco.querySelector("h3").textContent = "Ninja Cone, DJ Colmeia e o Passe já estão no ar."; cont.remove(); clearInterval(id); return; }
      nov("d", Math.floor(r / 864e5)); nov("h", Math.floor(r / 36e5) % 24); nov("m", Math.floor(r / 6e4) % 60); nov("s", Math.floor(r / 1e3) % 60);
    };
    const id = setInterval(tic, 1000); tic();
  }

  /* ---------- ARSENAL ---------- */
  const COR = [["amarela", "Amarela", "#ffd15a"], ["azul", "Azul", "#3e8bff"], ["laranja", "Laranja", "#ff7a2f"], ["rosa", "Rosa", "#ff5db1"], ["roxo", "Roxa", "#9b5cff"], ["verde", "Verde", "#7dff4f"], ["vermelha", "Vermelha", "#ff4f4f"]];
  const al = $("#arsLinhas");
  if (al) {
    al.innerHTML = COR.map(([a, n, c], i) => `<button class="linha-b ${i ? "" : "active"}" style="--c:${c}" data-c="${c}" type="button"><img src="${M}linhas/${a}.webp" alt="Linha ${n}" loading="lazy"><b>${n}</b></button>`).join("");
    $$(".linha-b", al).forEach(b => b.addEventListener("click", () => {
      $$(".linha-b", al).forEach(x => x.classList.remove("active")); b.classList.add("active");
      document.documentElement.style.setProperty("--linha", b.dataset.c);
    }));
  }
  const CARS = ["n_relo_amarela", "n_mand_laranja", "c1laranja", "n_relo_azul", "n_relo_rosa", "c2azul", "n_relo_verde", "n_mand_roxa"];
  const ac = $("#arsCar");
  if (ac) {
    ac.innerHTML = CARS.map(n => `<img src="${M}carretilhas/${n}.webp" alt="Carretilha" loading="lazy" draggable="false" data-car="${n}">`).join("");
    ac.addEventListener("click", e => {
      const n = e.target.dataset.car; if (!n) return;
      e.target.classList.add("gira"); setTimeout(() => e.target.classList.remove("gira"), 900);
      const r = $("#pvReel img"); if (r) r.src = `${M}carretilhas/${n}.webp`;
    });
  }
  const PIPAS = ["cafifa_1", "cafifa_3", "peixinho_4", "peixinho_quadriculado", "peixinho_caveira", "peixinho_bra", "peixinho_x", "peixinho_pb", "pipa1_1", "pipa1_2", "pipa1_aguia", "pipa1_dragao", "pipa1_estrela", "pipa1_fogo", "pipa1_olhos", "pipa1_raposa", "pipa1_tigre", "pipa1_cifrao", "pipa1_color", "pipa1_ceifador", "pipao_2", "pipao_4", "pipao_coroa", "pipao_flecha", "pipao_laminado", "pipao_quadriculado"];
  const pt = $("#pipasTrack");
  if (pt) pt.innerHTML = PIPAS.concat(PIPAS).map(n => `<img src="${M}pipas/${n}.webp" alt="" loading="lazy">`).join("");

  /* ---------- GALERIA ---------- */
  const gt = $("#galTrack");
  if (gt) {
    const fs = ["01_favela", "02_ceu", "03_loja", "04_mergulho", "05_campinho", "06_morro"];
    gt.innerHTML = fs.concat(fs).map(n => `<img src="${M}lojas/${n}.webp" alt="Cena do RELO" loading="lazy" data-g="${n}">`).join("");
    gt.addEventListener("click", e => {
      const g = e.target.dataset.g; if (!g) return;
      const lb = $("#lightbox"), inn = $("#lbInner");
      inn.innerHTML = `<img src="${M}lojas/${g}.webp" alt="Cena do RELO">`; lb.classList.add("open"); lb.setAttribute("aria-hidden", "false");
    });
  }

  $$("video[data-lazy]").forEach(observarVideo);
  if (tv && tv.dataset.lazy) observarVideo(tv);

  /* ---------- LOJAS ---------- */
  $$("[data-loja]").forEach(a => {
    const url = LOJAS[a.dataset.loja];
    if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener"; return; }
    a.addEventListener("click", e => { e.preventDefault(); toast("Tá chegando nessa loja. Entra no grupo que a gente avisa primeiro!"); });
  });

  /* ---------- PIPA VIVA: a linha sai da carretilha no pé da tela ---------- */
  (function pipaViva() {
    const c = $("#pipaViva"), reel = $("#pvReel"), dica = $("#pvDica"), placar = $("#pvPlacar");
    if (!c || calmo) { reel?.remove(); return; }
    const g = c.getContext("2d");
    const dpr = Math.min(devicePixelRatio || 1, celular ? 1.5 : 2);
    let W = 0, H = 0;
    const med = () => { W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
    med(); addEventListener("resize", med);
    const SK = ["pipa1_aguia", "pipa1_dragao", "pipa1_fogo", "pipa1_tigre", "pipa1_raposa", "pipa1_estrela", "peixinho_bra", "pipa1_color", "pipao_coroa"].map(img);
    const RIV = ["pipa1_ceifador", "peixinho_caveira", "pipa1_olhos", "pipao_flecha", "cafifa_3"].map(img);
    const S = celular ? 62 : 84;
    const k = { x: W * .75, y: H * .3, vx: 0, vy: 0, a: 0, va: 0, spr: SK[0], rab: criaRabiola(16, celular ? 7 : 9) };
    let modo = "voa", tModo = 0, linhaLen = 1, solta = null, t = 0, arrasto = null, ultScroll = scrollY, velS = 0, oculta = false, relos = Number(guarda.ler("relo_site_relos", 0)) || 0;
    let rival = null, proxRival = performance.now() + 9000, giro = 0, sparks = [], textos = [];
    const O = () => ({ x: W / 2, y: H - (celular ? 34 : 38) });
    if (relos) { placar.textContent = relos + (relos === 1 ? " relo" : " relos"); placar.classList.add("show"); }

    if (!guarda.ler("relo_pv_dica", "")) {
      const mostra = () => {
        if (scrollY < innerHeight * .8) return;
        removeEventListener("scroll", mostra);
        dica.classList.add("show"); guarda.salvar("relo_pv_dica", "1");
        setTimeout(() => dica.classList.remove("show"), 6500);
      };
      addEventListener("scroll", mostra, { passive: true });
    }

    // esconde perto do mini jogo e com o lightbox aberto
    let perto = false;
    const jb = $("#jogoBox");
    if (jb) new IntersectionObserver(es => es.forEach(e => { perto = e.isIntersecting; }), { threshold: .15 }).observe(jb);

    function desbica() {
      if (modo !== "voa") return;
      modo = "desbica"; tModo = 0; k.va = (k.x > W / 2 ? -1 : 1) * .55; k.vy += 9;
      dica.classList.remove("show");
    }
    function soltar() {
      if (modo === "voa" || modo === "desbica") {
        modo = "solta"; tModo = 0; solta = { x: k.x, y: k.y };
        k.vx = (k.x > W / 2 ? 1 : -1) * 1.5; k.vy = -2.4; k.va = .06;
        reel.setAttribute("aria-label", "Subir outra pipa");
        dica.classList.remove("show");
      } else if (modo === "fora") sobe();
    }
    function sobe() {
      modo = "sobe"; tModo = 0; linhaLen = 0;
      k.spr = SK[(SK.indexOf(k.spr) + 1) % SK.length];
      const o = O(); k.x = o.x; k.y = o.y - 20; k.vx = 0; k.vy = -6; k.a = 0; k.va = 0;
      k.rab.p.forEach(q => { q.x = q.ox = o.x; q.y = q.oy = o.y; });
      reel.setAttribute("aria-label", "Soltar a pipa");
    }
    reel.addEventListener("click", soltar);

    // toque e mouse em cima da pipa: arrasta ou desbica
    const bloqueia = el => el && el.closest && el.closest("a,button,input,select,textarea,.jogo,.skins,.lightbox,.gestos,.modos2,.ars-linhas,.car-row");
    const perto2 = (x, y) => (modo === "voa" || modo === "desbica") && !oculta && Math.hypot(x - k.x, y - k.y) < S * .75;
    const ini = (x, y, e) => {
      if (!perto2(x, y) || bloqueia(e.target)) return false;
      arrasto = { x, y, ox: x, oy: y, t: performance.now(), mexeu: false };
      return true;
    };
    const mov = (x, y) => { if (!arrasto) return; arrasto.x = x; arrasto.y = y; if (Math.hypot(x - arrasto.ox, y - arrasto.oy) > 8) arrasto.mexeu = true; };
    const fim = () => { if (!arrasto) return; const toque = !arrasto.mexeu && performance.now() - arrasto.t < 380; arrasto = null; if (toque) desbica(); };
    addEventListener("mousedown", e => { if (ini(e.clientX, e.clientY, e)) e.preventDefault(); });
    addEventListener("mousemove", e => {
      mov(e.clientX, e.clientY);
      document.documentElement.style.cursor = (arrasto ? "grabbing" : perto2(e.clientX, e.clientY) && !bloqueia(e.target) ? "grab" : "");
    });
    addEventListener("mouseup", fim);
    addEventListener("touchstart", e => { const p = e.touches[0]; if (e.touches.length === 1 && ini(p.clientX, p.clientY, e)) e.preventDefault(); }, { passive: false });
    addEventListener("touchmove", e => { if (!arrasto) return; e.preventDefault(); mov(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
    addEventListener("touchend", fim);
    addEventListener("touchcancel", () => { arrasto = null; });

    function novoRival() {
      const lado = Math.random() < .5 ? -1 : 1;
      rival = { lado, x: lado < 0 ? -60 : W + 60, y: H * (.12 + Math.random() * .22), vx: -lado * (celular ? 1.5 : 2.1), f: Math.random() * 7, atr: 0, spr: RIV[(Math.random() * RIV.length) | 0], base: { x: lado < 0 ? W * .04 : W * .96, y: H + 10 }, rab: criaRabiola(10, 8), cai: false, vy: 0, a: 0 };
    }

    let ult = performance.now();
    function quadro(agora) {
      const dt = Math.min(2.2, (agora - ult) / 16.7 || 1); ult = agora; t += .016 * dt; tModo += dt;
      const lb = $("#lightbox")?.classList.contains("open");
      const deve = perto || lb;
      if (deve !== oculta) { oculta = deve; c.classList.toggle("some", oculta); reel.classList.toggle("some", oculta); }
      const o = O();
      velS += (Math.max(-40, Math.min(40, scrollY - ultScroll)) - velS) * .15; ultScroll = scrollY;
      const cor = cssLinha();
      g.clearRect(0, 0, W, H);
      if (oculta) { requestAnimationFrame(quadro); return; }

      // alvo: a pipa passeia pelo alto da tela e reage à rolagem
      const prog = scrollY / Math.max(1, document.documentElement.scrollHeight - H);
      let tx = W * (celular ? .74 : .8) + Math.sin(t * .45 + prog * 9) * W * (celular ? .12 : .08);
      let ty = H * (.2 + .1 * Math.sin(t * .6 + prog * 12));
      if (arrasto) { tx = arrasto.x; ty = Math.min(arrasto.y, H - 120); }
      const vento = Math.sin(t * .8) * .25 + .15;

      if (modo === "voa" || modo === "desbica") {
        const kk = arrasto ? .02 : .006;
        k.vx += ((tx - k.x) * kk + vento * .4 - velS * .01) * dt;
        k.vy += ((ty - k.y) * kk + velS * .025) * dt;
        k.vx *= Math.pow(arrasto ? .82 : .93, dt); k.vy *= Math.pow(arrasto ? .82 : .93, dt);
        if (modo === "desbica") {
          k.a += k.va * dt; k.va *= Math.pow(.97, dt);
          if (tModo > 14) k.vy -= .9 * dt;
          if (tModo > 46) { modo = "voa"; k.va = 0; }
        } else {
          const alvoA = Math.atan2(k.x - o.x, o.y - k.y) * .45 + k.vx * .03 + Math.sin(t * 2.2) * .05;
          k.a += (alvoA - k.a) * .12 * dt;
          k.a = ((k.a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        }
        linhaLen = Math.min(1, linhaLen + .04 * dt);
      } else if (modo === "sobe") {
        k.vy += ((ty - k.y) * .012) * dt; k.vx += ((tx - k.x) * .008) * dt;
        k.vx *= .92; k.vy *= .92; k.a += (0 - k.a) * .1;
        linhaLen = Math.min(1, linhaLen + .03 * dt);
        if (tModo > 70) modo = "voa";
      } else if (modo === "solta" || modo === "fora") {
        k.vx += (vento * .5 + .02) * dt; k.vy += (.035 + Math.sin(t * 3) * .02) * dt; k.vy *= .985;
        k.a += k.va * dt + Math.sin(t * 4) * .02;
        linhaLen = Math.max(0, linhaLen - .035 * dt);
        if (modo === "solta" && (k.x < -120 || k.x > W + 120 || k.y > H + 120 || k.y < -200)) { modo = "fora"; tModo = 0; }
        if (modo === "fora" && tModo > 150) sobe();
      }
      k.x += k.vx * dt; k.y += k.vy * dt;
      if (modo === "voa" || modo === "desbica") { k.x = Math.max(S * .6, Math.min(W - S * .6, k.x)); k.y = Math.max(70, Math.min(H - 110, k.y)); }

      // carretilha gira quando a linha anda
      giro += (Math.abs(k.vx) + Math.abs(k.vy)) * .02 * dt + (modo === "solta" ? .5 : modo === "sobe" ? .3 : 0) * dt;
      reel.firstElementChild.style.transform = `rotate(${giro}rad)`;

      // linha (sai da carretilha)
      const pontaLinha = modo === "solta" || modo === "fora" ? { x: o.x + (solta.x - o.x) * linhaLen, y: o.y + (solta.y - o.y) * linhaLen } : { x: k.x, y: k.y + S * .1 };
      if (linhaLen > .01) {
        const folga = modo === "solta" ? 120 : arrasto ? 10 : 44;
        g.strokeStyle = cor; g.lineWidth = celular ? 1.4 : 1.6; g.globalAlpha = .9;
        if (!celular) { g.shadowColor = cor; g.shadowBlur = 8; }
        g.beginPath(); g.moveTo(o.x, o.y);
        g.quadraticCurveTo((o.x + pontaLinha.x) / 2 + (k.x > o.x ? folga : -folga) * .5, (o.y + pontaLinha.y) / 2 + folga, pontaLinha.x, pontaLinha.y); g.stroke();
        g.shadowBlur = 0; g.globalAlpha = 1;
      }

      // rival corta o céu de vez em quando: se a linha dele cruzar a sua, é relo
      if (!rival && agora > proxRival && modo === "voa" && scrollY > 200) novoRival();
      if (rival) {
        const r = rival;
        if (!r.cai) { r.x += r.vx * dt; r.f += .05 * dt; r.y += Math.sin(r.f) * .6 * dt; }
        else { r.vy += .12 * dt; r.y += r.vy * dt; r.x += r.vx * .3 * dt; r.a += .08 * dt; }
        if (!r.cai) {
          g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(r.base.x, r.base.y); g.lineTo(r.x, r.y + 10); g.stroke();
          const hit = (modo === "voa" || modo === "desbica") && cruza(o, { x: k.x, y: k.y }, r.base, { x: r.x, y: r.y });
          if (hit) {
            r.atr += dt * (arrasto ? 1.8 : 1) * (modo === "desbica" ? 2 : 1);
            for (let i = 0; i < 2; i++) sparks.push({ x: hit.x, y: hit.y, vx: (Math.random() - .5) * 7, vy: (Math.random() - .7) * 6, v: 1 });
            if (Math.random() < .12 * dt) textos.push({ x: hit.x + 14, y: hit.y - 10, s: "-" + (4 + Math.random() * 7).toFixed(1).replace(".", ","), v: 1, cor: "#ff4f4f", tam: celular ? 18 : 22 });
            if (r.atr > 34) {
              r.cai = true; r.vy = -1;
              relos++; guarda.salvar("relo_site_relos", relos);
              placar.textContent = relos + (relos === 1 ? " relo" : " relos"); placar.classList.add("show");
              textos.push({ x: hit.x, y: hit.y - 30, s: "RELÔ!", v: 1.4, cor: "#52f28f", tam: celular ? 34 : 46, grande: true });
            }
          }
        }
        passoRabiola(r.rab, r.x, r.y + 16, vento, dt);
        desenhaRabiola(g, r.rab, "#ff4f6d", 3);
        g.save(); g.translate(r.x, r.y); g.rotate(r.a + Math.sin(r.f) * .2);
        if (r.spr.complete && r.spr.naturalWidth) g.drawImage(r.spr, -S * .42, -S * .42, S * .84, S * .84);
        g.restore();
        if (r.x < -140 || r.x > W + 140 || r.y > H + 140) { rival = null; proxRival = agora + 16000 + Math.random() * 14000; }
      }

      // rabiola + pipa
      const cos = Math.cos(k.a), sin = Math.sin(k.a);
      passoRabiola(k.rab, k.x - sin * S * .42, k.y + cos * S * .42, vento * .6 - k.vx * .05, dt);
      desenhaRabiola(g, k.rab, cor, celular ? 3.2 : 4);
      g.save(); g.translate(k.x, k.y); g.rotate(k.a);
      if (k.spr.complete && k.spr.naturalWidth) g.drawImage(k.spr, -S / 2, -S / 2, S, S);
      g.restore();

      sparks.forEach(s => { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += .3 * dt; s.v -= .05 * dt; g.globalAlpha = Math.max(0, s.v); g.fillStyle = "#ffe08a"; g.fillRect(s.x, s.y, 3, 3); });
      sparks = sparks.filter(s => s.v > 0).slice(-120);
      textos.forEach(x => {
        x.v -= .016 * dt; x.y -= (x.grande ? .5 : .8) * dt;
        g.globalAlpha = Math.max(0, Math.min(1, x.v)); g.fillStyle = x.cor;
        g.font = `700 ${x.tam}px Oswald, Impact, sans-serif`; g.textAlign = "center";
        g.strokeStyle = "rgba(8,8,18,.85)"; g.lineWidth = 4; g.strokeText(x.s, x.x, x.y); g.fillText(x.s, x.x, x.y);
      });
      g.globalAlpha = 1; textos = textos.filter(x => x.v > 0);
      requestAnimationFrame(quadro);
    }
    requestAnimationFrame(quadro);
  })();

  /* ---------- MINI JOGO: DÁ UM RELO ---------- */
  (function jogo() {
    const cv = $("#jogoCanvas"), box = $("#jogoBox"); if (!cv) return;
    const retrato = innerWidth < 760;
    const W = retrato ? 720 : 1280, H = retrato ? 1000 : 640;
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    const U = retrato ? 1.15 : 1;
    const SPR = ["pipa1_dragao", "pipa1_fogo", "pipa1_tigre", "pipa1_raposa", "peixinho_caveira", "pipa1_color", "cafifa_3", "pipa1_ceifador", "peixinho_x"].map(img);
    const BOSS = img("pipao_coroa");
    const minha = img("pipa1_aguia");
    const REC = "relo_recorde_v2";
    let rec = Number(guarda.ler(REC, 0)) || 0, rodando = false, pts = 0, fim = 0, rivais = [], quedas = [], aparando = [], sparks = [], textos = [], cortes = [];
    let px = W / 2, py = H * .35, kx = px, ky = py, kvx = 0, kvy = 0, ka = 0, visivel = false, ult = 0, laco = false, vida = 1, caiu = 0, desbico = 0, ultDesb = 0, cortesTotal = 0, t = 0;
    const rab = criaRabiola(18, 10 * U);
    const ORIG = { x: W / 2, y: H - 70 * U };
    $("#jgRec").textContent = rec;

    // fundo: céu, nuvens e o morro
    const fundo = document.createElement("canvas"); fundo.width = W; fundo.height = H;
    (function () {
      const f = fundo.getContext("2d");
      const gr = f.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#2465c8"); gr.addColorStop(.6, "#7cb8ea"); gr.addColorStop(1, "#ffd3a1");
      f.fillStyle = gr; f.fillRect(0, 0, W, H);
      let s = 7; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
      f.fillStyle = "#5c7a44"; f.beginPath(); f.moveTo(0, H);
      for (let x = 0; x <= W; x += 20) f.lineTo(x, H * .8 - Math.sin(x / W * 3.1) * H * .08 - rnd() * 6);
      f.lineTo(W, H); f.fill();
      const cores = ["#e9b46a", "#e5785a", "#f2d27a", "#8fc7b5", "#d98fb8", "#c9c3b8", "#6fa0d8"];
      for (let i = 0; i < 70; i++) {
        const x = rnd() * W, w = 18 + rnd() * 34, h = 16 + rnd() * 30, y = H * .86 - Math.sin(x / W * 3.1) * H * .07 + rnd() * H * .12;
        f.fillStyle = cores[(rnd() * cores.length) | 0]; f.fillRect(x, y - h, w, h);
        f.fillStyle = "rgba(0,0,0,.25)"; f.fillRect(x + w * .3, y - h * .6, w * .18, h * .25);
        if (rnd() < .4) { f.fillStyle = "#2f5fb8"; f.fillRect(x + w * .6, y - h - 7, 9, 7); }
      }
    })();
    const nuvens = Array.from({ length: 6 }, (_, i) => ({ x: Math.random() * W, y: 40 + Math.random() * H * .4, s: .6 + Math.random() * .8, v: .15 + Math.random() * .25 }));

    const pos = e => {
      const r = cv.getBoundingClientRect();
      const toque = e.pointerType === "touch" ? 90 * U : 0;
      px = (e.clientX - r.left) / r.width * W; py = Math.min(H * .84, (e.clientY - r.top) / r.height * H - toque);
    };
    cv.addEventListener("pointermove", pos);
    cv.addEventListener("pointerdown", e => {
      pos(e);
      if (!rodando) return;
      const agora = performance.now();
      if (agora - ultDesb > 500 && !caiu) {   // desbico: arranco curto que dobra o dano
        ultDesb = agora; desbico = 28;
        const dx = px - kx, dy = py - ky, d = Math.hypot(dx, dy) || 1;
        kvx += dx / d * 16; kvy += dy / d * 16;
      }
    });
    const novo = (boss) => {
      const lado = Math.random() < .5 ? -1 : 1;
      const s = (boss ? 130 : 62 + Math.random() * 30) * U;
      return { x: W / 2 + lado * (W * .62), y: 70 + Math.random() * (H * (retrato ? .46 : .5)), dx: -lado * (boss ? 1.1 : 1.3 + Math.random() * 2) * (retrato ? .8 : 1), fase: Math.random() * 7, off: -W * .12 + Math.random() * W * .24, hp: boss ? 380 : 130, max: boss ? 380 : 130, img: boss ? BOSS : SPR[(Math.random() * SPR.length) | 0], s, boss, rab: criaRabiola(boss ? 16 : 10, 9 * U), ultTxt: 0 };
    };
    const grito = (txt, cls) => { const e = $("#jgGrito"); e.textContent = txt; e.className = "jogo-grito " + (cls || ""); void e.offsetWidth; e.classList.add("go"); };
    function corta(r) {
      const ganho = r.boss ? 3 : 1;
      pts += ganho; cortesTotal++; $("#jgPts").textContent = pts;
      quedas.push({ x: r.x, y: r.y, vy: -1.5, vx: r.dx * .3, a: 0, va: (Math.random() - .5) * .08, img: r.img, s: r.s, rab: r.rab, f: Math.random() * 6 });
      const ag = performance.now(); cortes = cortes.filter(t => ag - t < 1900); cortes.push(ag);
      if (r.boss) grito("PIPÃO NO CHÃO! +3", "ouro");
      else if (cortes.length === 2) grito("DOUBLE CUT!"); else if (cortes.length === 3) grito("TRIPLE CUT!"); else if (cortes.length >= 4) grito("DOMINANDO O CÉU!");
      else textos.push({ x: r.x, y: r.y - 40, s: "RELÔ!", v: 1.2, cor: "#52f28f", tam: 40 * U });
      vida = Math.min(1, vida + .12);
    }
    function inicia() {
      pts = 0; $("#jgPts").textContent = 0; rivais = [novo(), novo(), novo()]; quedas = []; aparando = []; sparks = []; cortes = []; textos = []; vida = 1; caiu = 0; cortesTotal = 0;
      fim = performance.now() + 30000; rodando = true; $("#jgIni").style.display = "none"; box.classList.add("jogando");
    }
    function encerra() {
      rodando = false; box.classList.remove("jogando");
      if (pts > rec) { rec = pts; guarda.salvar(REC, rec); $("#jgRec").textContent = rec; }
      $("#jgTit").textContent = pts + (pts === 1 ? " relo" : " relos");
      $("#jgMsg").textContent = pts >= 14 ? "Dominou o céu. No jogo é com gente de verdade." : pts >= 7 ? "Mandou bem. Apara as mandadas pra subir mais." : "Segura o atrito mais um pouco e desbica na hora de cruzar.";
      $("#jgBtn").innerHTML = '<svg><use href="#i-kite"/></svg> Mais uma';
      $("#jgIni").style.display = "";
    }
    $("#jgBtn").addEventListener("click", inicia);
    new IntersectionObserver(es => es.forEach(e => { visivel = e.isIntersecting; if (visivel && !laco) { laco = true; ult = 0; requestAnimationFrame(quadro); } }), { threshold: .1 }).observe(box);
    function pipa(im, x, y, s, a) {
      g.save(); g.translate(x, y); g.rotate(a || 0);
      if (im.complete && im.naturalWidth) g.drawImage(im, -s / 2, -s / 2, s, s);
      g.restore();
    }
    const distSeg = (p, a, b) => {
      const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy || 1;
      const u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l));
      return { d: Math.hypot(p.x - a.x - dx * u, p.y - a.y - dy * u), u };
    };
    function quadro(tm) {
      if (!visivel) { laco = false; return; }
      const dt = Math.min(2, (tm - ult) / 16.7 || 1); ult = tm; t += .016 * dt;
      g.drawImage(fundo, 0, 0);
      g.fillStyle = "rgba(255,255,255,.75)";
      nuvens.forEach(n => { n.x += n.v * dt; if (n.x > W + 160) n.x = -160; g.beginPath(); g.ellipse(n.x, n.y, 70 * n.s, 22 * n.s, 0, 0, 7); g.ellipse(n.x + 40 * n.s, n.y - 12 * n.s, 46 * n.s, 20 * n.s, 0, 0, 7); g.fill(); });
      const cor = cssLinha();
      const vento = Math.sin(t * .9) * .3 + .1;

      // minha pipa: mola com inércia, o desbico dá o arranco
      if (caiu) {
        caiu -= dt; kvy += .35 * dt; ka += .15 * dt;
        if (caiu <= 0) { caiu = 0; kx = ORIG.x; ky = ORIG.y - 60; kvx = kvy = 0; ka = 0; vida = 1; }
      } else {
        kvx += (px - kx) * .045 * dt; kvy += (py - ky) * .045 * dt;
        kvx *= Math.pow(.8, dt); kvy *= Math.pow(.8, dt);
        ka += ((kvx * .035) - ka) * .2 * dt;
      }
      kx += kvx * dt; ky += kvy * dt;
      if (desbico > 0) { desbico -= dt; ka += .5 * dt; }
      const vel = Math.hypot(kvx, kvy);

      if (rodando) {
        const rest = Math.max(0, fim - tm);
        $("#jgTempo").textContent = Math.ceil(rest / 1000);
        if (!rest) encerra();
        const quer = 3 + Math.min(3, (pts / 4) | 0);
        while (rivais.filter(r => !r.boss).length < quer) rivais.push(novo());
        if (cortesTotal && cortesTotal % 6 === 0 && !rivais.some(r => r.boss) && !quedas.some(q => q.boss)) { rivais.push(novo(true)); cortesTotal++; grito("CHEGOU UM PIPÃO!", "ouro"); }
      }
      const eu = { x: kx, y: ky };
      let travado = false;
      rivais.forEach(r => {
        r.x += r.dx * dt; r.fase += .035 * dt;
        const ry = r.y + Math.sin(r.fase) * 24;
        r.px = r.x; r.py = ry;
        const base = { x: r.x + r.off, y: H + 10 }, topo = { x: r.x, y: ry };
        g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = 1.6 * U; g.beginPath(); g.moveTo(base.x, base.y); g.lineTo(topo.x, topo.y); g.stroke();
        passoRabiola(r.rab, r.x, ry + r.s * .4, vento, dt);
        desenhaRabiola(g, r.rab, r.boss ? "#ffd15a" : "#ff4f6d", (r.boss ? 5 : 3) * U);
        pipa(r.img, r.x, ry, r.s, Math.sin(r.fase) * .22);
        if (r.hp < r.max) {
          g.fillStyle = "rgba(0,0,0,.4)"; g.fillRect(r.x - r.s * .4, ry - r.s * .7, r.s * .8, 6);
          g.fillStyle = r.hp / r.max > .4 ? "#52f28f" : "#ff4f4f"; g.fillRect(r.x - r.s * .4, ry - r.s * .7, r.s * .8 * r.hp / r.max, 6);
        }
        if (rodando && !caiu) {
          const hit = cruza(ORIG, eu, base, topo);
          if (hit) {
            travado = true;
            const dano = (.75 + Math.min(1.3, vel * .07)) * (desbico > 0 ? 2 : 1) * dt;
            r.hp -= dano;
            vida -= (r.boss ? .0075 : .0042) * dt;
            for (let i = 0; i < 2; i++) sparks.push({ x: hit.x, y: hit.y, vx: (Math.random() - .5) * 8, vy: (Math.random() - .7) * 7, v: 1 });
            if (tm - r.ultTxt > 230) { r.ultTxt = tm; textos.push({ x: hit.x + 20 * U, y: hit.y - 8, s: "-" + (dano * 4.2 / dt).toFixed(1).replace(".", ","), v: 1, cor: "#ff4f4f", tam: 26 * U }); }
            if (r.hp <= 0) { r.morta = true; r.y = ry; corta(r); }
          }
        }
      });
      rivais = rivais.filter(r => !r.morta && r.x > -200 && r.x < W + 200);
      if (!rodando) while (rivais.length < 3) rivais.push(novo());
      if (!travado) vida = Math.min(1, vida + .0012 * dt);
      if (rodando && vida <= 0 && !caiu) { caiu = 70; vida = 0; grito("VOCÊ TOMOU RELÔ", "ruim"); fim -= 3000; }
      $("#jgVida").style.width = (Math.max(0, vida) * 100) + "%";

      // mandadas caem balançando: encosta a linha que gruda (aparo)
      quedas.forEach(q => {
        q.f += .05 * dt; q.vy = Math.min(1.4 * U, q.vy + .05 * dt); q.y += q.vy * dt; q.x += (q.vx + Math.sin(q.f) * 1.2) * dt; q.a = Math.sin(q.f) * .5;
        passoRabiola(q.rab, q.x, q.y + q.s * .4, vento, dt);
        desenhaRabiola(g, q.rab, "#ff4f6d", 3 * U);
        pipa(q.img, q.x, q.y, q.s * .9, q.a);
        if (rodando && !caiu) {
          const ds = distSeg({ x: q.x, y: q.y }, ORIG, eu);
          if (ds.d < 34 * U && ds.u > .05) { q.morta = true; aparando.push({ u: ds.u, img: q.img, s: q.s, a: q.a }); pts += 1; $("#jgPts").textContent = pts; grito("APAROU! +1", "ouro"); fim += 1000; }
        }
      });
      quedas = quedas.filter(q => !q.morta && q.y < H + 120);

      // minha linha e minha pipa
      g.strokeStyle = cor; g.lineWidth = 2.8 * U; g.shadowColor = cor; g.shadowBlur = 10;
      g.beginPath(); g.moveTo(ORIG.x, ORIG.y); g.lineTo(kx, ky); g.stroke(); g.shadowBlur = 0;
      // aparadas descendo pela linha até a mão
      aparando.forEach(a => {
        a.u -= .012 * dt;
        const x = ORIG.x + (kx - ORIG.x) * a.u, y = ORIG.y + (ky - ORIG.y) * a.u;
        pipa(a.img, x, y, a.s * .8, a.a + Math.sin(t * 6) * .2);
      });
      aparando = aparando.filter(a => a.u > 0);
      passoRabiola(rab, kx - Math.sin(ka) * 40 * U, ky + Math.cos(ka) * 40 * U, vento - kvx * .04, dt);
      desenhaRabiola(g, rab, cor, 4.5 * U);
      pipa(minha, kx, ky, 90 * U, ka);
      // quem segura a linha
      g.fillStyle = "#151827"; g.beginPath(); g.arc(ORIG.x, ORIG.y + 18 * U, 20 * U, 0, 7); g.fill();
      g.fillRect(ORIG.x - 18 * U, ORIG.y + 30 * U, 36 * U, 60 * U);
      g.fillStyle = cor; g.beginPath(); g.arc(ORIG.x + 22 * U, ORIG.y + 4, 9 * U, 0, 7); g.fill();

      sparks.forEach(s => { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += .3 * dt; s.v -= .045 * dt; g.globalAlpha = Math.max(0, s.v); g.fillStyle = "#ffe08a"; g.fillRect(s.x, s.y, 3 * U, 3 * U); });
      sparks = sparks.filter(s => s.v > 0).slice(-180);
      g.textAlign = "center";
      textos.forEach(x => {
        x.v -= .02 * dt; x.y -= .9 * dt;
        g.globalAlpha = Math.max(0, Math.min(1, x.v)); g.fillStyle = x.cor; g.font = `700 ${x.tam}px Oswald, Impact, sans-serif`;
        g.strokeStyle = "rgba(8,8,18,.8)"; g.lineWidth = 4; g.strokeText(x.s, x.x, x.y); g.fillText(x.s, x.x, x.y);
      });
      textos = textos.filter(x => x.v > 0);
      g.globalAlpha = 1;
      requestAnimationFrame(quadro);
    }
  })();
})();
