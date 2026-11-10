/* RELO — interações do site de lançamento (celular e computador) */
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
  // aviso no mesmo formato do HUD do jogo (cartão preto no canto)
  function aviso(el, titulo, sub, ms) {
    if (!el) return;
    el.querySelector("b").textContent = titulo; el.querySelector("span").textContent = sub;
    el.classList.add("show"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), ms || 1700);
  }

  setTimeout(() => $("#preloader")?.classList.add("hide"), 1100);

  /* =====================================================================
     MOTOR DA PIPA 2D — mesma regra do FisicaDaPipa do jogo:
       puxar  -> a pipa abre (envergadura) e anda pra onde o bico aponta
       soltar -> ela murcha: o bico roda (cada puxada inverte o lado) e ela cai
       dar linha -> descarrega: o bico cai a favor do vento e a pipa mergulha
       os dois -> desbico: avanço em zigue-zague (carioquinha a cada 0,45 s)
     Linha cruzou linha: as duas dobram em V no ponto de contato e só soltam no relo.
     ===================================================================== */
  const TAU = Math.PI * 2;
  const angDif = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  const img = n => { const i = new Image(); i.src = M + "pipas/" + n + ".webp"; return i; };
  const cruza = (a, b, c, d) => {
    const s = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x); if (!s) return null;
    const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / s, u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / s;
    return t > 0 && t < 1 && u > 0 && u < 1 ? { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t } : null;
  };

  function criaRabiola(n, seg) { return { seg, p: Array.from({ length: n }, () => ({ x: -999, y: -999 })) }; }
  // rabiola pendurada: cada gomo segue o anterior com peso e vento, sem guardar velocidade (não chicoteia)
  function passoRabiola(r, ax, ay, vento, dt) {
    const p = r.p;
    if (p[0].x === -999) p.forEach((q, i) => { q.x = ax; q.y = ay + i * r.seg; });
    p[0].x = ax; p[0].y = ay;
    const k = Math.min(1, .72 * dt);
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], q = p[i];
      let dx = q.x - a.x, dy = q.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      r.f = (r.f || 0) + .0025 * dt;
      const tremor = Math.sin(r.f * 60 - i * .7) * .09 * (i / p.length);
      dx = dx / d * .94 + vento * .05 + tremor; dy = dy / d * .94 + .045;
      const n = Math.hypot(dx, dy) || 1;
      q.x += (a.x + dx / n * r.seg - q.x) * k; q.y += (a.y + dy / n * r.seg - q.y) * k;
    }
  }
  // gomos pretos espaçados, como a rabiola do jogo
  function desenhaRabiola(g, r, larg) {
    const p = r.p; g.lineCap = "butt"; g.strokeStyle = "#0b0c14";
    for (let i = 1; i < p.length; i += 2) {
      g.lineWidth = larg * (1 - i / p.length * .5);
      g.beginPath(); g.moveTo(p[i - 1].x, p[i - 1].y); g.lineTo(p[i].x, p[i].y); g.stroke();
    }
  }

  function novaPipa(o) {
    const p = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, a: 0, vis: 0, env: 1, esc: 1, giro: 1, tSolta: 0, tPuxa: 0, fase: 0, puxa: false, da: false, ant: false, s: 80, U: 1, vp: 5, lmax: 400, lmin: 200, lmaxMax: 900, spr: null, vida: 1, ia: "mira", tIA: 0, agr: 1, estado: "roda", engate: null }, o);
    p.rab = criaRabiola(Math.round((o.nRab || 16) * 1.35), (o.U || 1) * (o.segRab || 9) * .75);
    return p;
  }
  function passoPipa(p, dt, mundo) {
    const desb = p.puxa && p.da, VP = p.vp;
    const clique = (p.puxa || desb) && !p.ant; p.ant = p.puxa || desb;
    if (clique) { p.giro = -p.giro; p.tSolta = 0; }
    let avx = mundo.vento * .25 * p.U, avy = 0, env = 1, laco = .1;
    if (desb) {
      p.fase += dt / 27;
      const lado = (Math.floor(p.fase) % 2) ? 1 : -1;
      const rumo = p.a + lado * .8;
      avx = Math.sin(rumo) * VP; avy = -Math.cos(rumo) * VP;
      p.vis += (lado * .5 - p.vis) * .25 * dt; p.estado = "desbica";
    } else if (p.puxa) {
      p.tPuxa += dt;
      const k = Math.min(1, .25 + p.tPuxa / 30);
      avx = Math.sin(p.a) * VP * k; avy = -Math.cos(p.a) * VP * k;
      p.lmax = Math.max(p.lmin, p.lmax - .08 * p.U * dt);
      p.vis *= .8; p.estado = "puxa";
    } else if (p.da) {
      avx = Math.sin(p.a) * VP * .45; avy = -Math.cos(p.a) * VP * .45 + .12 * p.U;
      p.lmax = Math.min(p.lmaxMax, p.lmax + 2.2 * p.U * dt);
      p.vis *= .85; p.estado = "da"; env = 0;
    } else {
      p.tPuxa = 0; p.tSolta += dt;
      if (p.tSolta < 180) {   // solta: murcha e roda em órbita (o bico gira e a pipa anda junto, desenhando um O)
        const w = .058 * (p.tSolta < 120 ? 1 : 1 - (p.tSolta - 120) / 60);
        p.a += p.giro * w * dt;
        avx = Math.sin(p.a) * VP * .5; avy = -Math.cos(p.a) * VP * .5 + .14 * p.U;
        env = 0; p.estado = "roda"; laco = .22;
      } else { p.a += angDif(p.a, Math.sin(mundo.t * 1.3) * .12) * .02 * dt; avy = .06 * p.U; env = 0; p.estado = "parada"; }
      p.vis *= .9;
    }
    p.env += (env - p.env) * (env > p.env ? .35 : .2) * dt;   // enche na hora que puxa, murcha quando solta
    p.folga = (p.folga || 0) + ((env ? 0 : 1) - (p.folga || 0)) * .08 * dt;
    p.vx += (avx - p.vx) * laco * dt; p.vy += (avy - p.vy) * laco * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    const dx = p.x - p.ancora.x, dy = p.y - p.ancora.y, d = Math.hypot(dx, dy) || 1;
    if (d > p.lmax) {
      const nx = dx / d, ny = dy / d;
      p.x = p.ancora.x + nx * p.lmax; p.y = p.ancora.y + ny * p.lmax;
      const vr = p.vx * nx + p.vy * ny; if (vr > 0) { p.vx -= vr * nx; p.vy -= vr * ny; }
    }
    restringe(p, mundo);
  }
  function restringe(p, mundo) {
    const m = p.s * p.esc * .45;
    if (p.x < m) { p.x = m; p.vx = Math.abs(p.vx) * .3; if (Math.sin(p.a) < 0) p.a = -p.a; }
    if (p.x > mundo.W - m) { p.x = mundo.W - m; p.vx = -Math.abs(p.vx) * .3; if (Math.sin(p.a) > 0) p.a = -p.a; }
    if (p.y < mundo.teto + m) { p.y = mundo.teto + m; p.vy = Math.abs(p.vy) * .3; if (Math.cos(p.a) > 0) p.a = Math.PI - p.a; }
    if (p.y > mundo.chao) { p.y = mundo.chao; p.vy = -Math.abs(p.vy) * .3; p.a += angDif(p.a, 0) * .25; }
    p.a = angDif(0, p.a);
    if (mundo.prof) p.esc = mundo.prof(p.y) * (1 - .3 * Math.max(0, Math.min(1, (p.lmax - p.lmin) / Math.max(1, p.lmaxMax - p.lmin))));
    rabiolaNaPonta(p, mundo.vento - p.vx * .06, 1);
  }
  // rabiola presa na ponta de baixo da pipa (acompanha giro, desbico e envergadura)
  function rabiolaNaPonta(p, vento, dt) {
    const ang = p.a + p.vis, s = p.s * p.esc * (.9 + .1 * p.env) * .48;
    passoRabiola(p.rab, p.x - Math.sin(ang) * s, p.y + Math.cos(ang) * s, vento, dt);
  }
  // pontos da linha: estica reta quando tensa, faz barriga quando folgada; no engate vira V
  function linhaDe(p, n) {
    n = n || 10;
    const ax = p.ancora.x, ay = p.ancora.y, bx = p.x, by = p.y + p.s * p.esc * .08;
    if (p.engate) {
      const v = p.engate.pt, pts = [];
      for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push({ x: ax + (v.x - ax) * t, y: ay + (v.y - ay) * t + Math.sin(Math.PI * t) * 8 * p.U }); }
      for (let i = 1; i <= 4; i++) { const t = i / 4; pts.push({ x: v.x + (bx - v.x) * t, y: v.y + (by - v.y) * t }); }
      return pts;
    }
    const d = Math.hypot(bx - ax, by - ay), folga = Math.max(0, p.lmax - d);
    const sag = Math.min(folga * .5, 170 * p.U) + (6 + 46 * (p.folga || 0)) * p.U * Math.min(1, d / (300 * p.U));
    const cx = (ax + bx) / 2 + (bx > ax ? sag * .25 : -sag * .25), cy = (ay + by) / 2 + sag;
    const pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; pts.push({ x: u * u * ax + 2 * u * t * cx + t * t * bx, y: u * u * ay + 2 * u * t * cy + t * t * by }); }
    return pts;
  }
  function cruzaLinhas(A, B) {
    for (let i = 1; i < A.length; i++) for (let j = 1; j < B.length; j++) {
      const h = cruza(A[i - 1], A[i], B[j - 1], B[j]); if (h) return h;
    }
    return null;
  }
  function distLinha(pt, L) {
    let best = { d: 1e9, u: 0 };
    for (let i = 1; i < L.length; i++) {
      const a = L[i - 1], b = L[i], dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy || 1;
      const u = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / l));
      const d = Math.hypot(pt.x - a.x - dx * u, pt.y - a.y - dy * u);
      if (d < best.d) best = { d, u: (i - 1 + u) / (L.length - 1) };
    }
    return best;
  }
  const pontoNaLinha = (L, u) => { const f = u * (L.length - 1), i = Math.min(L.length - 2, Math.floor(f)), k = f - i; return { x: L[i].x + (L[i + 1].x - L[i].x) * k, y: L[i].y + (L[i + 1].y - L[i].y) * k }; };
  const acao = p => (p.puxa && p.da ? 2 : p.da ? 1.5 : p.puxa ? 1 : .25) * Math.max(.4, Math.min(1.2, Math.hypot(p.vx, p.vy) / p.vp));

  // engate em V: o ponto de contato desliza com a briga e prende as duas pipas até o relo
  function novoEngate(A, B, hit) { const e = { A, B, pt: { x: hit.x, y: hit.y }, t: 0 }; A.engate = B.engate = e; return e; }
  function passoEngate(e, dt, mundo) {
    const A = e.A, B = e.B; e.t += dt;
    const baixo = Math.max(A.y, B.y), base = Math.min(A.ancora.y, B.ancora.y);
    const puxaA = acao(A), puxaB = acao(B);
    const tx = (A.x * puxaB + B.x * puxaA) / (puxaA + puxaB), ty = baixo + (base - baixo) * .2;
    e.pt.x += (tx - e.pt.x) * .025 * dt; e.pt.y += (ty - e.pt.y) * .025 * dt;
    [A, B].forEach(p => {
      const la = Math.hypot(e.pt.x - p.ancora.x, e.pt.y - p.ancora.y);
      const resto = Math.max(50 * p.U, p.lmax - la);
      const dx = p.x - e.pt.x, dy = p.y - e.pt.y, d = Math.hypot(dx, dy) || 1;
      if (d > resto) {
        const nx = dx / d, ny = dy / d; p.x = e.pt.x + nx * resto; p.y = e.pt.y + ny * resto;
        const vr = p.vx * nx + p.vy * ny; if (vr > 0) { p.vx -= vr * nx; p.vy -= vr * ny; }
      }
      restringe(p, mundo);
    });
  }
  const soltaEngate = e => { if (!e) return; e.A.engate = null; e.B.engate = null; };

  // piloto: solta pra rodar até o bico mirar no alvo e aí puxa (é assim que se joga)
  function piloto(b, alvo, dt, mundo) {
    b.lento = Math.hypot(b.vx, b.vy) < b.vp * .15 ? (b.lento || 0) + dt : 0;
    if (b.lento > 45) { b.lento = 0; b.ia = "mira"; b.giro = -b.giro; b.tSolta = 0; b.a += b.giro * .6; }
    if (mundo.alto && alvo.y > mundo.alto) alvo = { x: alvo.x, y: mundo.alto - 30 * b.U };   // pipa boa fica no alto
    const rumo = Math.atan2(alvo.x - b.x, b.y - alvo.y);
    const err = angDif(b.a, rumo);
    if (b.ia === "mira") {
      b.puxa = false; b.da = false;
      if (b.estado === "parada" || b.y > mundo.chao - 70 * b.U) { b.ia = "puxa"; b.tIA = 6; }
      else if (Math.abs(err) < .3) { b.ia = "puxa"; b.tIA = 16 + Math.random() * 28; }
    } else if (b.ia === "puxa") {
      b.puxa = true; b.da = false; b.tIA -= dt;
      if (b.tIA <= 0 || Math.abs(err) > 1.4) b.ia = "mira";
      if (b.engate && Math.random() < .035 * dt * b.agr) { b.ia = Math.random() < .5 ? "desb" : "da"; b.tIA = 24 + Math.random() * 30; }
    } else if (b.ia === "desb" || b.ia === "da") {
      b.puxa = b.ia === "desb"; b.da = true; b.tIA -= dt; if (b.tIA <= 0) b.ia = "mira";
    }
    if (b.y > mundo.chao - 40 * b.U && Math.abs(angDif(b.a, 0)) < .9) { b.puxa = true; b.da = false; }
  }
  // alvo de caça: do outro lado da linha do rival, pra cruzar por cima dela
  function alvoDeCaca(b, L) {
    const P = pontoNaLinha(L, .6 + Math.sin(b.semente) * .18), a = L[0], z = L[L.length - 1];
    let nx = -(z.y - a.y), ny = z.x - a.x; const n = Math.hypot(nx, ny) || 1; nx /= n; ny /= n;
    const lado = Math.sign(nx * (b.x - P.x) + ny * (b.y - P.y)) || 1;
    return { x: P.x - lado * nx * 140 * b.U, y: P.y - lado * ny * 140 * b.U };
  }

  function desenhaPipa(g, p, alpha) {
    desenhaRabiola(g, p.rab, (p.grande ? 4 : 2.6) * p.U * Math.max(.6, p.esc));
    const s = p.s * p.esc;
    g.save(); g.translate(p.x, p.y); g.rotate(p.a + p.vis);
    const treme = (1 - p.env) * Math.sin(performance.now() * .03 + p.x * .05) * .06;
    g.scale(.72 + .28 * p.env + treme, .9 + .1 * p.env);
    if (alpha != null) g.globalAlpha = alpha;
    if (p.spr && p.spr.complete && p.spr.naturalWidth) g.drawImage(p.spr, -s / 2, -s / 2, s, s);
    g.restore(); g.globalAlpha = 1;
  }
  // linha mais grossa perto da mão e fininha lá em cima (profundidade)
  function desenhaLinha(g, L, cor, larg, brilho, fina) {
    g.strokeStyle = cor; g.lineCap = "round";
    if (brilho) { g.shadowColor = cor; g.shadowBlur = brilho; }
    if (fina) {
      for (let i = 1; i < L.length; i++) { g.lineWidth = larg * (1 - (i / L.length) * (1 - fina)); g.beginPath(); g.moveTo(L[i - 1].x, L[i - 1].y); g.lineTo(L[i].x, L[i].y); g.stroke(); }
    } else { g.lineWidth = larg; g.beginPath(); g.moveTo(L[0].x, L[0].y); for (let i = 1; i < L.length; i++) g.lineTo(L[i].x, L[i].y); g.stroke(); }
    g.shadowBlur = 0;
  }
  // gritos do HUD do jogo (verde) e faíscas do atrito
  function desenhaTextos(g, lista, dt) {
    g.textAlign = "center"; g.lineJoin = "round";
    lista.forEach(x => {
      x.v -= (x.vel || .018) * dt; x.y -= (x.sobe ?? .7) * dt;
      g.globalAlpha = Math.max(0, Math.min(1, x.v * 1.6));
      g.font = `${x.peso || 800} ${x.tam}px Arial, Helvetica, sans-serif`;
      g.strokeStyle = x.borda || "rgba(0,40,0,.75)"; g.lineWidth = x.tam * .14; g.strokeText(x.s, x.x, x.y);
      g.fillStyle = x.cor; g.fillText(x.s, x.x, x.y);
    });
    g.globalAlpha = 1;
    return lista.filter(x => x.v > 0);
  }
  const gritoVerde = (x, y, s, U) => ({ x, y, s, v: 1.5, cor: "#41f04a", tam: 46 * U, borda: "rgba(0,40,0,.75)", sobe: .25, vel: .02, peso: 700 });
  function faiscas(lista, pt, U, n) { for (let i = 0; i < n; i++) lista.push({ x: pt.x, y: pt.y, vx: (Math.random() - .5) * 7 * U, vy: (Math.random() - .7) * 6 * U, v: 1 }); }
  function desenhaFaiscas(g, lista, dt, tam) {
    lista.forEach(s => { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += .3 * dt; s.v -= .05 * dt; g.globalAlpha = Math.max(0, s.v); g.fillStyle = "#ffe08a"; g.fillRect(s.x, s.y, tam, tam); });
    g.globalAlpha = 1;
    return lista.filter(s => s.v > 0).slice(-180);
  }
  // mandada: cai murcha, balançando, com o pedaço de linha cortada pendurado
  function passoMandada(m, dt, mundo, U, queda) {
    const p = m.p; m.t += dt;
    p.vx += (mundo.vento * .9 * U + Math.sin(m.t * .05) * .7 - p.vx) * .05 * dt; p.vy += (queda * U - p.vy) * .04 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.a += (m.va + Math.sin(m.t * .04) * .012) * dt; p.vis *= .95; p.env += (.55 - p.env) * .05 * dt;
    if (mundo.prof) p.esc = mundo.prof(p.y);
    rabiolaNaPonta(p, mundo.vento, dt);
    passoRabiola(m.linha, p.x, p.y + p.s * p.esc * .08, mundo.vento * .5, dt);
  }
  function desenhaMandada(g, m, U) {
    g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 1.2 * U; g.beginPath();
    m.linha.p.forEach((q, i) => i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); g.stroke();
    desenhaPipa(g, m.p);
  }
  function desenhaRestos(g, restos, dt, U) {
    restos.forEach(r => { r.t -= .02 * dt; r.pts.forEach((q, i) => { q.y += (1 - r.t) * 2 * dt * (i / r.pts.length); }); g.globalAlpha = Math.max(0, r.t) * .85; if (r.pts.length > 1) desenhaLinha(g, r.pts, "#ffffff", 1.3 * U); g.globalAlpha = 1; });
    return restos.filter(r => r.t > 0);
  }
  // corta quem perdeu o engate: a parte de cima vira mandada, a de baixo cai
  function cortaNoEngate(e, perdedor, mandadas, restos, U, dono) {
    const L = linhaDe(perdedor);
    restos.push({ pts: L.slice(0, 7), t: 1 });
    mandadas.push({ p: perdedor, linha: criaRabiola(8, Math.max(8, Math.hypot(perdedor.x - e.pt.x, perdedor.y - e.pt.y) / 8)), t: 0, va: (Math.random() - .5) * .04, dono });
    soltaEngate(e);
  }

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

  /* ---------- PIPA VIVA: a sua pipa no céu do site, com relo de verdade ---------- */
  (function pipaViva() {
    const c = $("#pipaViva"), reel = $("#pvReel"), dica = $("#pvDica"), placar = $("#pvPlacar"), avisoEl = $("#pvAviso");
    if (!c || calmo) { reel?.remove(); return; }
    const g = c.getContext("2d");
    const dpr = Math.min(devicePixelRatio || 1, celular ? 1.5 : 2);
    let W = 0, H = 0;
    const med = () => { W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
    med(); addEventListener("resize", med);
    const U = celular ? .78 : 1;
    const SK = ["pipa1_aguia", "pipa1_dragao", "pipa1_fogo", "pipa1_tigre", "pipa1_raposa", "pipa1_estrela", "peixinho_bra", "pipa1_color", "pipao_coroa"].map(img);
    const RIV = ["pipa1_ceifador", "peixinho_caveira", "pipa1_olhos", "pipao_flecha", "cafifa_3", "pipa1_2"].map(img);
    const mundo = { W, H, teto: celular ? 80 : 70, chao: H * .62, vento: .3, t: 0, prof: y => .55 + .5 * Math.max(0, Math.min(1, y / (H * .7))) };
    const O = () => ({ x: W / 2, y: H - (celular ? 34 : 38) });
    let eu = null, rival = null, engate = null, mandadas = [], restos = [], sparks = [], textos = [], aparadas = [];
    // pipas da vizinhança lá longe, pra dar profundidade ao céu
    const longe = (celular ? [.1, .9] : [.08, .3, .7, .93]).map((f, i) => {
      const p = novaPipa({ x: W * f, y: H * .3, a: (f < .5 ? .4 : -.4), s: 58 * U, U, vp: Math.max(2, W * .0026), ancora: { x: W * f, y: H + 6 }, lmax: H * .95, lmin: H * .6, lmaxMax: H * 1.1, spr: img(["pipa1_1", "peixinho_4", "cafifa_1", "pipa1_cifrao"][i % 4]), semente: i * 2.3, nRab: 12, segRab: 7 });
      p.alvoX = f; return p;
    });
    let proxRival = performance.now() + 7000, giroReel = 0, oculta = false, arrasto = null, ordem = 0, cortes = [], renasce = 0;
    let relos = Number(guarda.ler("relo_site_relos", 0)) || 0;
    const marca = () => { placar.textContent = relos + (relos === 1 ? " relo" : " relos"); placar.classList.add("show"); };
    if (relos) marca();

    function nasce() {
      const o = O();
      eu = novaPipa({ x: o.x, y: o.y - 30, a: 0, s: 70 * U, U, vp: Math.max(2.2, W * .0026), ancora: o, lmax: H * .7, lmin: H * .35, lmaxMax: H * 1.1, spr: SK[(Math.random() * SK.length) | 0], agr: 1.1, semente: Math.random() * 9 });
      eu.ia = "puxa"; eu.tIA = 40;
    }
    nasce();

    if (!guarda.ler("relo_pv_dica", "")) {
      const mostra = () => {
        if (scrollY < innerHeight * .8) return;
        removeEventListener("scroll", mostra);
        dica.classList.add("show"); guarda.salvar("relo_pv_dica", "1");
        setTimeout(() => dica.classList.remove("show"), 6500);
      };
      addEventListener("scroll", mostra, { passive: true });
    }

    let perto = false;
    const jb = $("#jogoBox");
    if (jb) new IntersectionObserver(es => es.forEach(e => { perto = e.isIntersecting; }), { threshold: .1 }).observe(jb);

    function soltar() {
      if (!eu) return;
      if (engate) { soltaEngate(engate); engate = null; }
      mandadas.push({ p: eu, linha: criaRabiola(7, 16 * U), t: 0, va: (Math.random() - .5) * .04, dono: "eu" });
      eu = null; renasce = 140; dica.classList.remove("show");
      aviso(avisoEl, "PIPA SOLTA", "A linha foi junto. Subindo a próxima.", 1500);
    }
    reel.addEventListener("click", soltar);

    const bloqueia = el => el && el.closest && el.closest("a,button,input,select,textarea,.jogo,.skins,.lightbox,.gestos,.modos2,.ars-linhas,.car-row");
    const naPipa = (x, y) => eu && !oculta && Math.hypot(x - eu.x, y - eu.y) < Math.max(44, eu.s * .85);
    const ini = (x, y, e) => { if (!naPipa(x, y) || bloqueia(e.target)) return false; arrasto = { x, y, ox: x, oy: y, t: performance.now(), mexeu: false }; return true; };
    const mov = (x, y) => { if (!arrasto) return; arrasto.x = x; arrasto.y = y; if (Math.hypot(x - arrasto.ox, y - arrasto.oy) > 6) arrasto.mexeu = true; };
    const fim = () => {
      if (!arrasto) return;
      const toque = !arrasto.mexeu && performance.now() - arrasto.t < 380; arrasto = null;
      if (toque && eu) {   // desbico na hora, com arranco
        eu.ia = "desb"; eu.tIA = 44; ordem = 44; eu.puxa = eu.da = true;
        eu.vx += Math.sin(eu.a) * eu.vp * 1.6; eu.vy -= Math.cos(eu.a) * eu.vp * 1.6;
        dica.classList.remove("show");
      }
    };
    addEventListener("mousedown", e => { if (ini(e.clientX, e.clientY, e)) e.preventDefault(); });
    addEventListener("mousemove", e => { mov(e.clientX, e.clientY); document.documentElement.style.cursor = arrasto ? "grabbing" : naPipa(e.clientX, e.clientY) && !bloqueia(e.target) ? "grab" : ""; });
    addEventListener("mouseup", fim);
    addEventListener("touchstart", e => { const p = e.touches[0]; if (e.touches.length === 1 && ini(p.clientX, p.clientY, e)) e.preventDefault(); }, { passive: false });
    addEventListener("touchmove", e => { if (!arrasto) return; e.preventDefault(); mov(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
    addEventListener("touchend", fim);
    addEventListener("touchcancel", () => { arrasto = null; });

    function novoRival() {
      const lado = Math.random() < .5 ? -1 : 1, base = { x: lado < 0 ? W * .03 : W * .97, y: H + 6 };
      rival = novaPipa({ x: base.x - lado * 40, y: H * .3, a: lado * -.6, s: 70 * U, U, vp: Math.max(2.2, W * .003), ancora: base, lmax: H * .95, lmin: H * .5, lmaxMax: H * 1.2, spr: RIV[(Math.random() * RIV.length) | 0], agr: .8, semente: Math.random() * 9 });
      rival.entrando = 70;
    }

    let ult = performance.now();
    function quadro(agora) {
      const dt = Math.min(2.2, (agora - ult) / 16.7 || 1); ult = agora;
      mundo.W = W; mundo.H = H; mundo.chao = H * .62; mundo.t += .016 * dt; mundo.vento = .25 + Math.sin(mundo.t * .5) * .2;
      const lb = $("#lightbox")?.classList.contains("open");
      const deve = perto || lb;
      if (deve !== oculta) { oculta = deve; c.classList.toggle("some", oculta); reel.classList.toggle("some", oculta); }
      g.clearRect(0, 0, W, H);
      if (oculta) { requestAnimationFrame(quadro); return; }
      const o = O(), cor = cssLinha();

      if (!eu && (renasce -= dt) <= 0) nasce();
      if (!rival && eu && agora > proxRival && scrollY > 150) novoRival();

      if (eu) {
        eu.ancora = o;
        if (arrasto) {   // arrastando: a pipa vai direto pro dedo, com o bico virando pro movimento
          const tx = arrasto.x, ty = Math.min(arrasto.y, H - 120);
          const nvx = (tx - eu.x) * .28, nvy = (ty - eu.y) * .28;
          eu.vx = nvx; eu.vy = nvy; eu.x += nvx * dt; eu.y += nvy * dt;
          if (Math.hypot(nvx, nvy) > .8) eu.a += angDif(eu.a, Math.atan2(nvx, -nvy)) * .25 * dt;
          eu.env += (1 - eu.env) * .2; eu.puxa = true; eu.da = false; eu.estado = "puxa";
          eu.lmax = Math.max(eu.lmax, Math.hypot(eu.x - o.x, eu.y - o.y));
          restringe(eu, mundo);
        } else {
          let alvo;
          if (rival && !rival.entrando) alvo = alvoDeCaca(eu, linhaDe(rival, 8));
          else alvo = { x: W * (celular ? .74 : .8) + Math.sin(mundo.t * .4) * W * .1, y: H * (celular ? .16 : .22) + Math.sin(mundo.t * .55) * H * .06 };
          if (ordem > 0) ordem -= dt; else piloto(eu, alvo, dt, mundo);
          passoPipa(eu, dt, mundo);
        }
      }
      if (rival) {
        if (rival.entrando) { rival.entrando = Math.max(0, rival.entrando - dt); rival.puxa = true; rival.da = false; }
        else if (eu) piloto(rival, alvoDeCaca(rival, linhaDe(eu, 8)), dt, mundo);
        else { rival.ia = "mira"; piloto(rival, { x: W * .5, y: H * .2 }, dt, mundo); }
        passoPipa(rival, dt, mundo);
      }

      // linha cruzou: engancha em V e só solta no relo
      if (eu && rival && !engate) {
        const hit = cruzaLinhas(linhaDe(eu), linhaDe(rival));
        if (hit) { engate = novoEngate(eu, rival, hit); aviso(avisoEl, "LINHAS ENGANCHADAS", "Contato contínuo confirmado. Controle tensão e ângulo.", 1500); }
      }
      if (engate) {
        passoEngate(engate, dt, mundo);
        if (Math.random() < .6) faiscas(sparks, engate.pt, U, 1);
        rival.vida -= (.0032 + acao(eu) * .0085) * dt;
        eu.vida -= (.0032 + acao(rival) * .006) * dt;
        if (rival.vida <= 0) {
          const pt = engate.pt; cortaNoEngate(engate, rival, mandadas, restos, U); engate = null; rival = null;
          proxRival = agora + 14000 + Math.random() * 12000;
          relos++; guarda.salvar("relo_site_relos", relos); marca();
          const ag = performance.now(); cortes = cortes.filter(t => ag - t < 25000); cortes.push(ag);
          aviso(avisoEl, "RELÔ!", "Corte confirmado pelo jogo. Continue a sequência.", 2000);
          textos.push(gritoVerde(pt.x, pt.y - 40 * U, cortes.length >= 3 ? "TRIPLE CUT!" : cortes.length === 2 ? "DOUBLE CUT!" : "RELÔ!", U * .85));
          faiscas(sparks, pt, U, 26);
        } else if (eu.vida <= 0) {
          faiscas(sparks, engate.pt, U, 26);
          cortaNoEngate(engate, eu, mandadas, restos, U); engate = null; eu = null; renasce = 170;
          aviso(avisoEl, "VOCÊ TOMOU RELÔ", "A pipa entrou no ciclo de queda. Prepare a próxima.", 2200);
        }
      } else if (eu) eu.vida = Math.min(1, eu.vida + .003 * dt);
      if (rival && !engate && (rival.x < -200 || rival.x > W + 200)) rival = null;

      longe.forEach(p => { p.ancora.x = W * p.alvoX; p.ancora.y = H + 6; piloto(p, { x: W * (p.alvoX * .7 + .15) + Math.sin(mundo.t * .3 + p.semente) * W * .08, y: H * .14 + Math.sin(mundo.t * .4 + p.semente) * H * .05 }, dt, mundo); passoPipa(p, dt, mundo); p.esc *= .62; });
      const minhaL = eu ? linhaDe(eu) : null;
      mandadas.forEach(m => {
        passoMandada(m, dt, mundo, U, .75);
        if (m.dono !== "eu" && minhaL && m.t > 20) {   // encostou na sua linha: aparo
          const d = distLinha({ x: m.p.x, y: m.p.y }, minhaL);
          if (d.d < 26 * U && d.u > .08 && d.u < .97) {
            m.fora = true; aparadas.push({ p: m.p, u: d.u });
            relos++; guarda.salvar("relo_site_relos", relos); marca();
            aviso(avisoEl, "APARO", "A mandada grudou na sua linha. Recolhendo.", 1700);
            textos.push(gritoVerde(m.p.x, m.p.y - 40 * U, "APAROU!", U * .8));
          }
        }
      });
      mandadas = mandadas.filter(m => !m.fora && m.p.y < H + 160 && m.p.x > -200 && m.p.x < W + 200);

      giroReel += eu ? (Math.abs(eu.vx) + Math.abs(eu.vy)) * .03 * dt + (eu.estado === "da" ? .4 : 0) : .25 * dt;
      reel.firstElementChild.style.transform = `rotate(${giroReel}rad)`;

      longe.forEach(p => { g.globalAlpha = .7; desenhaLinha(g, linhaDe(p, 8), "rgba(255,255,255,.6)", .7); desenhaPipa(g, p, .8); });
      restos = desenhaRestos(g, restos, dt, U);
      mandadas.forEach(m => desenhaMandada(g, m, U));
      if (minhaL) {
        aparadas.forEach(a => { a.u -= .016 * dt; const q = pontoNaLinha(minhaL, Math.max(0, a.u)); a.p.x = q.x; a.p.y = q.y; rabiolaNaPonta(a.p, mundo.vento, dt); desenhaPipa(g, a.p); });
        aparadas = aparadas.filter(a => a.u > 0);
      } else aparadas = [];
      if (rival) { desenhaLinha(g, linhaDe(rival), "rgba(255,255,255,.85)", 1.1); desenhaPipa(g, rival); }
      if (eu) { desenhaLinha(g, linhaDe(eu), cor, celular ? 1.4 : 1.6, celular ? 0 : 6); desenhaPipa(g, eu); }
      sparks = desenhaFaiscas(g, sparks, dt, 2.5);
      textos = desenhaTextos(g, textos, dt);
      requestAnimationFrame(quadro);
    }
    requestAnimationFrame(quadro);
  })();

  /* ---------- MINI JOGO: DÁ UM RELO (mesmos comandos do jogo, câmera atrás do personagem) ---------- */
  (function jogo() {
    const cv = $("#jogoCanvas"), box = $("#jogoBox"); if (!cv) return;
    const retrato = innerWidth < 760;
    const W = retrato ? 720 : 1280, H = retrato ? 940 : 640;
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    const U = retrato ? 1.25 : 1;
    const avisoEl = $("#jgAviso");
    const SPR = ["pipa1_dragao", "pipa1_fogo", "pipa1_tigre", "pipa1_raposa", "peixinho_caveira", "pipa1_color", "cafifa_3", "pipa1_ceifador", "peixinho_x", "pipa1_olhos"].map(img);
    const BOSS = img("pipao_coroa"), MINHA = img("pipa1_aguia");
    const costas = new Image(); costas.src = M + "jogo_costas.webp";
    const REC = "relo_recorde_v3", DUR = 45000;
    const HOR = H * (retrato ? .7 : .72);                 // linha do horizonte
    const CW = (retrato ? 330 : 300) * U * (retrato ? .8 : 1), CH = CW * 446 / 520;   // personagem de costas
    const MAO = { x: W / 2 + CW * .08, y: H - CH * .92 };
    const mundo = { W, H, teto: (retrato ? 120 : 46) * U, chao: HOR - 24 * U, alto: HOR * .58, vento: .3, t: 0, prof: y => .42 + .5 * Math.max(0, Math.min(1, (y - 40) / (HOR - 40))) };
    const BASES = [.06, .94, .2, .8, .33, .67].map(f => ({ x: W * f, y: HOR + 6 * U + Math.abs(f - .5) * 26 * U }));
    let rec = Number(guarda.ler(REC, 0)) || 0, rodando = false, visivel = false, laco = false, ult = 0;
    let pts = 0, fim = 0, eu = null, bots = [], engate = null, mandadas = [], aparadas = [], restos = [], sparks = [], textos = [], cortes = [], renasce = 0, proxBot = 0, relosTotal = 0;
    const cmd = { puxa: false, da: false };
    $("#jgRec").textContent = rec;

    // fundo em camadas: céu, morro ao longe, favela no horizonte e casas perto
    const fundo = document.createElement("canvas"); fundo.width = W; fundo.height = H;
    (function () {
      const f = fundo.getContext("2d");
      const gr = f.createLinearGradient(0, 0, 0, HOR); gr.addColorStop(0, "#1f5fc7"); gr.addColorStop(.7, "#6aaee6"); gr.addColorStop(1, "#cfe6f5");
      f.fillStyle = gr; f.fillRect(0, 0, W, H);
      let s = 7; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
      // morro low poly ao fundo (como o do mapa)
      const pico = [[.5, 0], [.58, .07], [.63, .15], [.68, .22], [.73, .27], [.77, .28], [.81, .24], [.86, .17], [.92, .1], [1, .06]].map(([x, y]) => [W * x, HOR - H * y]);
      f.fillStyle = "#8c6c52"; f.beginPath(); f.moveTo(W * .5, HOR); pico.forEach(([x, y]) => f.lineTo(x, y)); f.lineTo(W, HOR); f.fill();
      f.fillStyle = "#a9845f";   // faces claras do lado do sol
      for (let i = 1; i < 6; i++) { f.beginPath(); f.moveTo(pico[i - 1][0], pico[i - 1][1]); f.lineTo(pico[i][0], pico[i][1]); f.lineTo(pico[i][0] + W * .015, HOR); f.lineTo(pico[i - 1][0] + W * .03, HOR); f.fill(); }
      f.fillStyle = "rgba(255,255,255,.08)"; f.beginPath(); f.moveTo(pico[4][0], pico[4][1]); f.lineTo(pico[5][0], pico[5][1]); f.lineTo(pico[6][0], pico[6][1]); f.lineTo(pico[5][0], HOR); f.fill();
      f.fillStyle = "#6f8f52"; f.beginPath(); f.moveTo(0, HOR); for (let x = 0; x <= W; x += 24) f.lineTo(x, HOR - 18 * U - Math.sin(x / W * 5) * 10 * U); f.lineTo(W, HOR); f.fill();
      const cores = ["#e9b46a", "#e5785a", "#f2d27a", "#8fc7b5", "#d98fb8", "#c9c3b8", "#6fa0d8", "#c96d4c"];
      const casa = (x, y, w, h, k) => {
        f.fillStyle = cores[(rnd() * cores.length) | 0]; f.fillRect(x, y - h, w, h);
        f.fillStyle = "rgba(0,0,0," + (.18 + k * .1) + ")"; f.fillRect(x + w * .62, y - h, w * .38, h);
        f.fillStyle = "rgba(20,20,30,.55)"; f.fillRect(x + w * .2, y - h * .62, w * .16, h * .22);
        if (rnd() < .45) { f.fillStyle = "#2f5fb8"; f.fillRect(x + w * .55, y - h - w * .18, w * .2, w * .18); }
      };
      // camada distante (pequena) e próxima (grande), dando profundidade
      for (let i = 0; i < 120; i++) { const x = rnd() * W, w = (8 + rnd() * 12) * U, y = HOR + rnd() * H * .05; casa(x, y, w, w * (.8 + rnd() * .6), 0); }
      for (let i = 0; i < 46; i++) { const x = rnd() * W, w = (22 + rnd() * 26) * U, y = HOR + H * .06 + rnd() * H * .1; casa(x, y, w, w * (.7 + rnd() * .5), .5); }
      for (let i = 0; i < 16; i++) { const lado = i % 2 ? rnd() * W * .3 : W - rnd() * W * .3, w = (60 + rnd() * 60) * U; casa(lado - w / 2, H + 4, w, w * (.7 + rnd() * .5), 1); }
      const nb = f.createLinearGradient(0, HOR - 30, 0, HOR + 20); nb.addColorStop(0, "rgba(220,235,250,0)"); nb.addColorStop(1, "rgba(220,235,250,.35)");
      f.fillStyle = nb; f.fillRect(0, HOR - 30, W, 50);
    })();
    const nuvens = Array.from({ length: 6 }, () => ({ x: Math.random() * W, y: 40 + Math.random() * HOR * .55, s: (.6 + Math.random() * .8) * U, v: .12 + Math.random() * .2 }));

    function nasceEu() {
      eu = novaPipa({ x: MAO.x, y: MAO.y - 40 * U, a: 0, s: 78 * U, U, vp: W * .0031, ancora: MAO, lmax: H * .8, lmin: H * .42, lmaxMax: H * 1.25, spr: MINHA, nRab: 18, segRab: 10, semente: 1 });
      eu.subindo = 40;
    }
    function nasceBot(pipao) {
      const base = BASES[(Math.random() * BASES.length) | 0];
      const b = novaPipa({ x: base.x, y: base.y - 50 * U, a: (base.x < W / 2 ? .5 : -.5), s: (pipao ? 120 : 66 + Math.random() * 12) * U, U, vp: W * (pipao ? .0024 : .003), ancora: base, lmax: H * .8, lmin: H * .4, lmaxMax: H * 1.1, spr: pipao ? BOSS : SPR[(Math.random() * SPR.length) | 0], agr: pipao ? .6 : .7 + Math.random() * .6, semente: Math.random() * 9, nRab: pipao ? 22 : 14, segRab: pipao ? 13 : 9 });
      b.pipao = pipao; b.grande = pipao; b.vida = pipao ? 2.6 : 1; b.entrando = 50;
      bots.push(b);
    }
    function reinicia(demo) {
      bots = []; mandadas = []; aparadas = []; restos = []; sparks = []; textos = []; cortes = []; pts = 0; relosTotal = 0; engate = null;
      nasceEu(); for (let i = 0; i < 2; i++) nasceBot(false);
      $("#jgPts").textContent = 0;
      if (!demo) { fim = performance.now() + DUR; rodando = true; box.classList.add("jogando"); $("#jgIni").style.display = "none"; aviso(avisoEl, "PREPARE A PIPA", "Segura pra puxar. Solta que ela murcha e roda.", 1800); }
    }
    function encerra() {
      rodando = false; box.classList.remove("jogando"); cmd.puxa = cmd.da = false; marcaBotoes();
      if (pts > rec) { rec = pts; guarda.salvar(REC, rec); $("#jgRec").textContent = rec; }
      $("#jgTit").textContent = pts + (pts === 1 ? " relo" : " relos");
      $("#jgMsg").textContent = pts >= 10 ? "Dominou o céu. No jogo é com gente de verdade." : pts >= 5 ? "Mandou bem. Enganchou? Desbica ou descarrega pra cortar mais rápido." : "Solta, espera o bico mirar no rival, puxa e cruza na linha dele.";
      $("#jgBtn").innerHTML = '<svg><use href="#i-kite"/></svg> Mais uma';
      $("#jgIni").style.display = "";
    }
    $("#jgBtn").addEventListener("click", () => reinicia(false));
    reinicia(true);

    // comandos: mouse, teclado e botões grandes (celular)
    const botoes = $$("#jgCmd .cmd");
    function marcaBotoes() {
      botoes.forEach(b => { const k = b.dataset.cmd; b.classList.toggle("on", k === "desb" ? cmd.puxa && cmd.da : k === "puxa" ? cmd.puxa : cmd.da); });
    }
    const liga = (k, v) => { if (k === "desb") { cmd.puxa = v; cmd.da = v; } else cmd[k] = v; marcaBotoes(); };
    botoes.forEach(b => {
      b.addEventListener("pointerdown", e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch {} if (!rodando) return; liga(b.dataset.cmd, true); });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach(ev => b.addEventListener(ev, () => liga(b.dataset.cmd, false)));
    });
    const tela = $(".jogo-tela", box);
    tela.addEventListener("contextmenu", e => e.preventDefault());
    $("#jgCmd").addEventListener("contextmenu", e => e.preventDefault());
    tela.addEventListener("pointerdown", e => { if (!rodando || e.target.closest("button")) return; e.preventDefault(); try { tela.setPointerCapture(e.pointerId); } catch {} const k = e.button === 2 ? "da" : "puxa"; liga(k, true); tela._k = k; });
    ["pointerup", "pointercancel"].forEach(ev => tela.addEventListener(ev, () => { if (tela._k) liga(tela._k, false); tela._k = null; }));
    const tecla = (e, v) => {
      if (!rodando || !visivel) return;
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup" || k === "j") { liga("puxa", v); e.preventDefault(); }
      else if (k === "s" || k === "arrowdown" || k === "k") { liga("da", v); e.preventDefault(); }
      else if (k === " ") { liga("desb", v); e.preventDefault(); }
    };
    addEventListener("keydown", e => tecla(e, true));
    addEventListener("keyup", e => tecla(e, false));

    new IntersectionObserver(es => es.forEach(e => { visivel = e.isIntersecting; if (visivel && !laco) { laco = true; ult = 0; requestAnimationFrame(quadro); } }), { threshold: .1 }).observe(box);

    function quadro(tm) {
      if (!visivel) { laco = false; return; }
      const dt = Math.min(2, (tm - ult) / 16.7 || 1); ult = tm;
      mundo.t += .016 * dt; mundo.vento = .25 + Math.sin(mundo.t * .45) * .25;
      g.drawImage(fundo, 0, 0);
      g.fillStyle = "rgba(255,255,255,.72)";
      nuvens.forEach(n => { n.x += n.v * dt; if (n.x > W + 160) n.x = -160; g.beginPath(); g.ellipse(n.x, n.y, 70 * n.s, 22 * n.s, 0, 0, 7); g.ellipse(n.x + 40 * n.s, n.y - 12 * n.s, 46 * n.s, 20 * n.s, 0, 0, 7); g.fill(); });
      const cor = cssLinha();

      if (rodando) {
        const rest = Math.max(0, fim - tm);
        $("#jgTempo").textContent = Math.ceil(rest / 1000);
        if (!rest) encerra();
      }
      if (!eu && (renasce -= dt) <= 0) nasceEu();
      const quer = 2 + Math.min(1, (pts / 5) | 0);
      if (bots.filter(b => !b.pipao).length < quer && (proxBot -= dt) <= 0) { nasceBot(false); proxBot = 160; }
      if (relosTotal >= 5 && !bots.some(b => b.pipao)) { relosTotal = 0; nasceBot(true); if (rodando) aviso(avisoEl, "CHEGOU UM PIPÃO", "Linha grossa. Engancha e desbica em cima dele.", 2000); }

      if (eu) {
        if (eu.subindo > 0) { eu.subindo -= dt; eu.puxa = true; eu.da = false; }
        else if (rodando) { eu.puxa = cmd.puxa; eu.da = cmd.da; }
        else { const alvo = bots[0] ? alvoDeCaca(eu, linhaDe(bots[0], 8)) : { x: W / 2, y: H * .25 }; piloto(eu, alvo, dt, mundo); }
        passoPipa(eu, dt, mundo);
      }
      const minhaL0 = eu ? linhaDe(eu) : null;
      bots.forEach(b => {
        if (b.entrando > 0) { b.entrando -= dt; b.puxa = true; b.da = false; }
        else if (minhaL0 && (!engate || engate.B === b)) piloto(b, alvoDeCaca(b, minhaL0), dt, mundo);
        else { b.ia = b.ia === "puxa" ? b.ia : "mira"; piloto(b, { x: b.ancora.x < W / 2 ? W * .3 : W * .7, y: H * .22 }, dt, mundo); }
        passoPipa(b, dt, mundo);
      });

      // linha cruzou: engancha em V e não solta até ter relo
      if (eu && !engate) {
        for (const b of bots) {
          if (b.entrando > 0) continue;
          const hit = cruzaLinhas(minhaL0, linhaDe(b));
          if (hit) { engate = novoEngate(eu, b, hit); if (rodando) aviso(avisoEl, "LINHAS ENGANCHADAS", "Contato contínuo confirmado. Controle tensão e ângulo.", 1500); break; }
        }
      }
      if (engate) {
        const b = engate.B;
        passoEngate(engate, dt, mundo);
        if (Math.random() < .7) faiscas(sparks, engate.pt, U, 1);
        b.vida -= (.0028 + acao(eu) * .0082) * dt / (b.pipao ? 2 : 1);
        if (rodando) eu.vida -= (.0028 + acao(b) * .0052) * dt * (b.pipao ? 1.3 : 1);
        if (b.vida <= 0) {
          const pt = { ...engate.pt };
          cortaNoEngate(engate, b, mandadas, restos, U, "bot"); engate = null; bots = bots.filter(x => x !== b);
          faiscas(sparks, pt, U, 30);
          if (rodando) { pts += b.pipao ? 3 : 1; relosTotal++; $("#jgPts").textContent = pts; }
          const ag = performance.now(); cortes = cortes.filter(t => ag - t < 6000); cortes.push(ag);
          const n = cortes.length;
          textos.push(gritoVerde(W / 2, H * .3, b.pipao ? "PIPÃO NO CHÃO!" : n >= 4 ? "DOMINANDO O CÉU!" : n === 3 ? "TRIPLE CUT!" : n === 2 ? "DOUBLE CUT!" : "RELÔ!", U * 1.1));
          if (rodando) aviso(avisoEl, "RELÔ!", "Corte confirmado pelo jogo. Continue a sequência.", 1600);
          eu.vida = Math.min(1, eu.vida + .25);
        } else if (eu.vida <= 0) {
          faiscas(sparks, engate.pt, U, 30);
          cortaNoEngate(engate, eu, mandadas, restos, U, "eu"); engate = null; eu = null; renasce = 90; cortes = [];
          aviso(avisoEl, "VOCÊ TOMOU RELÔ", "A pipa entrou no ciclo de queda. Prepare a próxima.", 2200);
        }
      } else if (eu) eu.vida = Math.min(1, eu.vida + .002 * dt);
      const minhaL = eu ? linhaDe(eu) : null;

      // mandadas caem murchas; encostou a sua linha, gruda e desce até a mão (aparo)
      mandadas.forEach(m => {
        passoMandada(m, dt, mundo, U, 1.05);
        if (m.dono === "bot" && minhaL && m.t > 20) {
          const d = distLinha({ x: m.p.x, y: m.p.y }, minhaL);
          if (d.d < 30 * U && d.u > .08 && d.u < .97) {
            m.fora = true; aparadas.push({ p: m.p, u: d.u });
            if (rodando) { pts += 1; $("#jgPts").textContent = pts; aviso(avisoEl, "APARO", "A mandada grudou na sua linha. Recolhendo.", 1600); }
            textos.push(gritoVerde(m.p.x, m.p.y - 50 * U, "APAROU!", U));
          }
        }
      });
      mandadas = mandadas.filter(m => !m.fora && m.p.y < H + 160 && m.p.x > -220 && m.p.x < W + 220);

      // desenho, do fundo pra frente
      restos = desenhaRestos(g, restos, dt, U);
      bots.forEach(b => {
        g.fillStyle = "#1b1e2e"; g.beginPath(); g.arc(b.ancora.x, b.ancora.y - 9 * U, 4.5 * U, 0, 7); g.fill(); g.fillRect(b.ancora.x - 3 * U, b.ancora.y - 5 * U, 6 * U, 9 * U);
        desenhaLinha(g, linhaDe(b), "rgba(255,255,255,.9)", (b.pipao ? 1.8 : 1.2) * U);
        desenhaPipa(g, b);
      });
      mandadas.forEach(m => desenhaMandada(g, m, U));
      if (eu && minhaL) {
        aparadas.forEach(a => { a.u -= .014 * dt; const q = pontoNaLinha(minhaL, Math.max(0, a.u)); a.p.x = q.x; a.p.y = q.y; a.p.esc = mundo.prof(q.y); passoRabiola(a.p.rab, q.x, q.y + a.p.s * a.p.esc * .3, mundo.vento, dt); desenhaPipa(g, a.p); });
        aparadas = aparadas.filter(a => a.u > 0);
        desenhaLinha(g, minhaL, cor, 4.2 * U, 8, .3);
        desenhaPipa(g, eu);
      }
      sparks = desenhaFaiscas(g, sparks, dt, 3 * U);
      // o seu personagem, de costas, em primeiro plano
      if (costas.complete && costas.naturalWidth) g.drawImage(costas, W / 2 - CW / 2, H - CH, CW, CH);
      textos = desenhaTextos(g, textos, dt);
      if (rodando && eu) {
        const EST = { puxa: ["PUXANDO", "#3ee7ff"], roda: ["LINHA ESTÁVEL", "#ffffff"], parada: ["LINHA ESTÁVEL", "#ffffff"], da: ["DANDO LINHA", "#41f04a"], desbica: ["DESBICANDO", "#ffd15a"] }[eu.estado] || ["", "#fff"];
        const txt = engate ? ["ATRITO CONFIRMADO", "#ffd15a"] : EST;
        g.font = `800 ${14 * U}px Arial, Helvetica, sans-serif`; g.textAlign = "center";
        const w = (retrato ? 170 : 220) * U, x = retrato ? 12 * U : W - w - 16 * U, y = H - 48 * U;
        g.fillStyle = "rgba(10,14,26,.85)"; g.fillRect(x, y, w, 32 * U); g.strokeStyle = "rgba(255,255,255,.15)"; g.lineWidth = 1; g.strokeRect(x, y, w, 32 * U);
        g.fillStyle = txt[1]; g.fillText(txt[0], x + w / 2, y + 21 * U);
      }
      requestAnimationFrame(quadro);
    }
  })();
})();
