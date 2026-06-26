/* RELO - camada de dados da landing oficial (com fallback de demonstração) */
(function () {
  const CFG = window.RELO_CONFIG || {};

  async function call(path) {
    if (!CFG.API_BASE || CFG.USE_MOCK || !path) throw new Error("mock");
    const res = await fetch(CFG.API_BASE + path);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  const M = "css/mov/";

  const MOCK = {
    // meta = objetivo de pessoas na lista de espera (barra de progresso)
    stats: { waiting: 0, goal: 5000, members: 0, slots: 0 },

    gallery: [
      { id: "coringa",  cat: "Especial", title: "Coringa Ultra",      img: M + "2996483c-a975-49ae-b108-f46422856512.JPG", tag: "Lendária" },
      { id: "mascara",  cat: "Especial", title: "Máscara de Rua",      img: M + "70a72622-3f0b-48b7-ae39-b0ca88598b6a.JPG", tag: "Lendária" },
      { id: "xadrez",   cat: "Quadrada", title: "Xadrez Clássica",     img: M + "311a49ea-8f8e-4f7d-829a-9112947c74e2.JPG", tag: "Comum" },
      { id: "geo",      cat: "Quadrada", title: "Geométrica Neon",     img: M + "61fff827-5ec3-48eb-acf5-6daa4c9f310d.JPG", tag: "Rara" },
      { id: "cruzrosa", cat: "Quadrada", title: "Cruz Rosa",           img: M + "70d64614-85b5-42b4-8dae-d24e6873645f.JPG", tag: "Comum" },
      { id: "cruzpreta",cat: "Quadrada", title: "Cruz Sombria",        img: M + "595a6579-187b-40fb-81e1-905822140119.JPG", tag: "Rara" },
      { id: "raia1",    cat: "Raia",     title: "Raia Solar",          img: M + "4b470d7d-941a-449f-820c-cdfef49d4f13.JPG", tag: "Rara" },
      { id: "raia2",    cat: "Raia",     title: "Raia Veneno",         img: M + "7046e7c4-1eac-4e8d-a560-d051ca3ede3a.JPG", tag: "Rara" },
      { id: "triade",   cat: "Raia",     title: "Tríade Púrpura",      img: M + "bc0a799f-3a8f-43f4-9970-7fc3360bf49b.JPG", tag: "Comum" },
      { id: "uk",       cat: "Especial", title: "Union Jack",          img: M + "ed312926-cb58-4589-a7be-0ef086a79b4e.JPG", tag: "Rara" },
    ],

    // VÍDEOS DO JOGO — landscape (tela cheia de PC). mp4, tocam mudos no scroll.
    gameVideos: [
      { title: "Gameplay", text: "O RELO voando de verdade.",        src: M + "gameplay.mp4",  featured: true },
      { title: "Menu & identidade", text: "A cara do jogo.",          src: M + "menugame.mp4",  featured: false },
      { title: "Loja de pipas", text: "Coleção e skins em construção.", src: M + "lojadogame.mp4", featured: false },
    ],

    // BASTIDORES — portrait (gravados no celular).
    // Use H.264 (avc1), NÃO HEVC. Gere com "converter-videos.bat".
    bastidores: [
      { title: "Bastidores 01", src: M + "bastidor1.mp4" },
      { title: "Bastidores 02", src: M + "bastidor2.mp4" },
      { title: "Bastidores 03", src: M + "bastidor3.mp4" },
      { title: "Bastidores 04", src: M + "bastidor4.mp4" },
      { title: "Bastidores 05", src: M + "bastidor5.mp4" },
    ],
  };

  window.ReloAPI = {
    async getStats() {
      try { return await call(CFG.ENDPOINTS && CFG.ENDPOINTS.stats); } catch { return MOCK.stats; }
    },
    async getGallery() { return MOCK.gallery; },
    async getGameVideos() { return MOCK.gameVideos; },
    async getBastidores() { return MOCK.bastidores; },
  };
})();
