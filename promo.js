/* =====================================================================
 * 宣傳頁互動：Hero 3D 敘事、捲動驅動的整合地圖、3D 畫面環、平台爆炸視圖、燈箱。
 * 依賴：three.js r128、GSAP 3.12 + ScrollTrigger（cdnjs）、sound.js（window.Sound）
 * ===================================================================== */
const Sound = window.Sound;
const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
const HAS_GSAP = !!(window.gsap && window.ScrollTrigger);
if (HAS_GSAP) gsap.registerPlugin(ScrollTrigger);

/* ===== 聲音開關 ===== */
const soundBtn = document.getElementById("soundBtn"), soundLbl = document.getElementById("soundLbl");
/** 同步按鈕外觀與偏好（偏好存 localStorage，只記住開或關） */
function setSound(on) {
  if (on) { if (!Sound.enable()) return; } else Sound.disable();
  soundBtn.setAttribute("aria-pressed", String(on));
  soundLbl.textContent = on ? "聲音 ON" : "聲音 OFF";
  try { localStorage.setItem("miniplm-promo-sound", on ? "1" : "0"); } catch (e) { /* 無痕模式等情況略過 */ }
}
soundBtn.addEventListener("click", () => { setSound(!Sound.on); if (Sound.on) Sound.sfx.click(); });

/** 目前節拍強度（0..1），3D 場景與 CSS 共用 */
let beatLevel = 0;
const eqBars = soundBtn.querySelectorAll(".eq i");
(function eqLoop() {
  const lv = Sound.levels();
  if (lv) {
    [2, 6, 14, 30].forEach((b, i) => { eqBars[i].style.height = (3 + lv[b] / 255 * 11) + "px"; });
    beatLevel = lv[2] / 255;
  } else { eqBars.forEach((b) => (b.style.height = "3px")); beatLevel = 0; }
  document.documentElement.style.setProperty("--beat", beatLevel.toFixed(3));
  requestAnimationFrame(eqLoop);
})();
document.addEventListener("pointerover", (e) => { const el = e.target.closest("a,button"); if (el && !el.contains(e.relatedTarget)) Sound.sfx.hover(); });
document.addEventListener("click", (e) => { if (e.target.closest("a[href^='#'],.chip,.replay,.thumbs button")) Sound.sfx.click(); });

/* =====================================================================
 * Hero 3D：三章敘事
 *   01 為什麼需要：散落的資料碎片（Excel、Email、紙本…）在空間中亂飄，紅線互相牽扯
 *   02 一個資料核心：碎片被吸進中央核心，核心成形並發出衝擊波
 *   03 串起每個能力：六個能力模組在核心周圍的軌道上逐一亮起，脈衝在核心與模組之間流動
 * ===================================================================== */
const Hero3D = (() => {
  const stage = document.getElementById("heroStage"), cv = document.getElementById("hero3d");
  const chips = [...document.querySelectorAll(".chip")], caps = [...document.querySelectorAll(".caps p")];
  /** 切換章節：字幕與章節籤 */
  function setChapter(i) {
    caps.forEach((p, k) => p.classList.toggle("on", k === i));
    chips.forEach((c, k) => {
      c.classList.toggle("on", k === i);
      c.classList.toggle("done", k < i);
      if (k > i) c.querySelector("i").style.transform = "scaleX(0)";
    });
  }
  const noop = { play() { setChapter(2); }, jump(i) { setChapter(i); } };
  if (!window.THREE) { setChapter(2); return noop; }

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: "high-performance" }); }
  catch (e) { setChapter(2); return noop; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050a14, 0.04);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  camera.position.set(0, 1.4, 13);
  /** world：所有物件的容器；寬螢幕時整組往右移，讓左側文字不被擋 */
  const world = new THREE.Group(); scene.add(world);

  /* ---- 貼圖工具 ---- */
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  const FONT_T = '"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif';
  const FONT_M = '"IBM Plex Mono",Consolas,monospace';
  /** 玻璃卡貼圖：tone = bad（紅，資料碎片）或 ok（青，能力模組） */
  function cardTex({ k, t, s, tone }) {
    const c = document.createElement("canvas"); c.width = 640; c.height = 300;
    const g = c.getContext("2d");
    const bad = tone === "bad";
    const bg = g.createLinearGradient(0, 0, 640, 300);
    bg.addColorStop(0, bad ? "rgba(58,18,30,.92)" : "rgba(10,44,52,.94)");
    bg.addColorStop(1, bad ? "rgba(24,10,18,.9)" : "rgba(8,20,36,.94)");
    rr(g, 8, 8, 624, 284, 30); g.fillStyle = bg; g.fill();
    g.lineWidth = 5; g.strokeStyle = bad ? "rgba(255,107,122,.9)" : "rgba(34,211,197,.95)"; g.stroke();
    rr(g, 8, 8, 624, 284, 30); g.save(); g.clip();
    const hl = g.createLinearGradient(0, 0, 0, 120); hl.addColorStop(0, "rgba(255,255,255,.14)"); hl.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = hl; g.fillRect(0, 0, 640, 120); g.restore();
    g.fillStyle = bad ? "#FF9AA5" : "#22D3C5"; g.font = `600 26px ${FONT_M}`; g.fillText(k, 44, 70);
    if (bad) {
      g.beginPath(); g.arc(578, 62, 22, 0, Math.PI * 2); g.fillStyle = "#FF6B7A"; g.fill();
      g.fillStyle = "#2A0A12"; g.font = `800 30px ${FONT_M}`; g.textAlign = "center"; g.fillText("!", 578, 73); g.textAlign = "left";
    } else { g.beginPath(); g.arc(578, 62, 12, 0, Math.PI * 2); g.fillStyle = "#46D39A"; g.fill(); }
    g.fillStyle = "#E6EEF8"; g.font = `800 60px ${FONT_T}`; g.fillText(t, 44, 160);
    g.fillStyle = bad ? "#E2A3AC" : "#93A6C2"; g.font = `500 30px ${FONT_M}`; g.fillText(s, 44, 230);
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); return tex;
  }
  /** 放射狀光暈貼圖 */
  function glowTex() {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d"), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
  }
  /** 核心下方的文字標籤 */
  function labelTex(lines) {
    const c = document.createElement("canvas"); c.width = 512; c.height = 128; const g = c.getContext("2d");
    g.textAlign = "center"; g.fillStyle = "#E6EEF8"; g.font = `700 52px ${FONT_M}`; g.fillText(lines[0], 256, 60);
    g.fillStyle = "#22D3C5"; g.font = `500 26px ${FONT_M}`; g.fillText(lines[1], 256, 104);
    return new THREE.CanvasTexture(c);
  }
  const GLOW = glowTex();

  /* ---- 場景：地板格線、光池、粒子 ---- */
  const grid = new THREE.GridHelper(90, 90, 0x22d3c5, 0x13304a);
  grid.material.transparent = true; grid.material.opacity = 0.28; grid.position.y = -3.1; scene.add(grid);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshBasicMaterial({ map: GLOW, color: 0x22d3c5, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = -3.05; world.add(pool);
  const PN = 1400, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(PN * 3);
  for (let i = 0; i < PN; i++) { pPos[i * 3] = (Math.random() - 0.5) * 60; pPos[i * 3 + 1] = Math.random() * 16 - 3; pPos[i * 3 + 2] = (Math.random() - 0.5) * 50 - 6; }
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x7fe8e0, size: 0.05, transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(particles);

  /* ---- 核心 ---- */
  const core = new THREE.Group(); world.add(core);
  const shell = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.25, 1)), new THREE.LineBasicMaterial({ color: 0x22d3c5, transparent: true, opacity: 0.85 }));
  const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.78, 2), new THREE.MeshBasicMaterial({ color: 0x0e8c85, transparent: true, opacity: 0.55 }));
  const innerWire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.8, 0)), new THREE.LineBasicMaterial({ color: 0xbffcf6, transparent: true, opacity: 0.6 }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0x22d3c5, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(6, 6, 1);
  core.add(halo, inner, innerWire, shell);
  const rings = [
    { r: 2.0, c: 0x22d3c5, rx: 1.2, ry: 0.2, sp: 0.35 },
    { r: 2.35, c: 0x3b8cff, rx: 0.4, ry: 1.1, sp: -0.25 },
    { r: 2.7, c: 0xffb547, rx: 1.57, ry: 0, sp: 0.18 },
  ].map((o) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(o.r, 0.014, 8, 200), new THREE.MeshBasicMaterial({ color: o.c, transparent: true, opacity: 0.8 }));
    m.rotation.set(o.rx, o.ry, 0); m.userData.sp = o.sp; core.add(m); return m;
  });
  const coreLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(["MINI PLM", "DATA CORE"]), transparent: true, depthWrite: false }));
  coreLabel.scale.set(3.2, 0.8, 1); coreLabel.position.y = -2.25; core.add(coreLabel);
  /** 核心成形時的衝擊波環 */
  const shock = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 96), new THREE.MeshBasicMaterial({ color: 0x7cf3e8, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  shock.rotation.x = -Math.PI / 2 + 0.25; world.add(shock);

  /* ---- 第一章：散落的資料碎片 ---- */
  const FRAG = [
    { k: "EXCEL", t: "Excel BOM", s: "BOM_v7_final(2).xlsx" },
    { k: "EMAIL", t: "Email 簽核", s: "RE: RE: FW: 請核准" },
    { k: "PAPER", t: "紙本 ECN", s: "等主管蓋章中…" },
    { k: "LEGACY", t: "舊 Agile PLM", s: "歷史資料鎖在舊系統" },
    { k: "SHARE", t: "共用資料夾", s: "\\\\eng\\drawings\\新版" },
    { k: "VERBAL", t: "口頭交辦", s: "「上次會議有講過」" },
    { k: "SPEC", t: "承認書", s: "哪一版才算數？" },
    { k: "ACL", t: "權限", s: "誰改了這個欄位？" },
  ];
  const frags = FRAG.map((f, i) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.08), new THREE.MeshBasicMaterial({ map: cardTex({ ...f, tone: "bad" }), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    const a = (i / FRAG.length) * Math.PI * 2 + 0.3;
    const home = new THREE.Vector3(Math.cos(a) * (4.2 + (i % 3) * 1.1), -0.6 + ((i * 37) % 5) * 0.9, Math.sin(a) * 3.2 - 0.5);
    world.add(mesh);
    return { mesh, home, base: home.clone(), sc: { v: 1 }, ph: Math.random() * 10, spin: (Math.random() - 0.5) * 0.5 };
  });
  /** 碎片之間的紅色牽扯線 */
  const PAIRS = [[0, 3], [1, 4], [2, 6], [5, 7], [0, 5], [3, 6], [1, 2], [4, 7], [2, 5]];
  const tangleGeo = new THREE.BufferGeometry();
  tangleGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PAIRS.length * 6), 3));
  const tangle = new THREE.LineSegments(tangleGeo, new THREE.LineDashedMaterial({ color: 0xff6b7a, dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: 0.55 }));
  world.add(tangle);

  /* ---- 第三章：能力模組 ---- */
  const SAT = [
    { k: "MODULE 01", t: "簽核流程", s: "Workflow · 條件路由" },
    { k: "MODULE 02", t: "Trigger 自動化", s: "5 觸發點 · 自動加簽" },
    { k: "MODULE 03", t: "料號·BOM·AML", s: "多階結構 · 版次" },
    { k: "MODULE 04", t: "權限治理", s: "RBAC · 權限診斷" },
    { k: "MODULE 05", t: "Agile 移轉", s: "暫存審閱 · 對帳" },
    { k: "MODULE 06", t: "即時監控", s: "SSE · Top SQL" },
  ];
  const orbit = new THREE.Group(); orbit.rotation.x = 0.32; world.add(orbit);
  const R = 3.9;
  const sats = SAT.map((s, i) => {
    const a = (i / SAT.length) * Math.PI * 2;
    const holder = new THREE.Group(); holder.position.set(Math.cos(a) * R, 0, Math.sin(a) * R); orbit.add(holder);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.25, 1.05), new THREE.MeshBasicMaterial({ map: cardTex({ ...s, tone: "ok" }), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    mesh.scale.setScalar(0.001); holder.add(mesh);
    const node = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0x22d3c5, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    node.scale.set(1.2, 1.2, 1); holder.add(node);
    const pulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xbffcf6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    pulse.scale.set(0.45, 0.45, 1); orbit.add(pulse);
    return { holder, mesh, node, pulse, t: Math.random() };
  });
  /** 核心到模組的連線與軌道環 */
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SAT.length * 6), 3));
  const links = new THREE.LineSegments(linkGeo, new THREE.LineBasicMaterial({ color: 0x22d3c5, transparent: true, opacity: 0 }));
  orbit.add(links);
  const orbitRing = new THREE.Mesh(new THREE.TorusGeometry(R, 0.01, 6, 240), new THREE.MeshBasicMaterial({ color: 0x3b8cff, transparent: true, opacity: 0 }));
  orbitRing.rotation.x = Math.PI / 2; orbit.add(orbitRing);

  /** 動畫狀態（GSAP 補間的對象） */
  const st = { chaos: 1, tangle: 0.55, link: 0, ringOp: 0, flash: 0, shock: 0, orbitSp: 0.06 };
  /** 回到第一章的初始狀態 */
  function reset() {
    frags.forEach((f) => { f.base.copy(f.home); f.sc.v = 1; f.mesh.visible = true; });
    core.scale.setScalar(0.001);
    sats.forEach((s) => { s.mesh.scale.setScalar(0.001); s.node.material.opacity = 0; });
    Object.assign(st, { chaos: 1, tangle: 0.55, link: 0, ringOp: 0, flash: 0, shock: 0 });
  }
  /** 直接擺成最終狀態（沒有 GSAP 或偏好減少動態時） */
  function finalState() {
    frags.forEach((f) => (f.mesh.visible = false)); core.scale.setScalar(1);
    sats.forEach((s) => { s.mesh.scale.setScalar(1); s.node.material.opacity = 0.9; });
    Object.assign(st, { chaos: 0, tangle: 0, link: 0.55, ringOp: 0.45, flash: 0, shock: 0 });
    setChapter(2); chips.forEach((c) => c.classList.add("done"));
  }

  let tl = null;
  const CH = [0, 5.2, 9.6];   // 各章起始秒數
  /** 建立整段敘事時間軸 */
  function build() {
    if (tl) tl.kill();
    reset();
    tl = gsap.timeline({ paused: true });
    tl.addLabel("ch0", 0).call(() => { setChapter(0); Sound.sfx.glitch(); }, null, 0);
    tl.fromTo(chips[0].querySelector("i"), { scaleX: 0 }, { scaleX: 1, duration: CH[1], ease: "none" }, 0);
    tl.call(() => Sound.sfx.glitch(), null, 2.6);
    // 第二章：碎片被吸入核心
    tl.addLabel("ch1", CH[1]).call(() => { setChapter(1); Sound.sfx.riser(1.5); }, null, CH[1]);
    tl.fromTo(chips[1].querySelector("i"), { scaleX: 0 }, { scaleX: 1, duration: CH[2] - CH[1], ease: "none", immediateRender: false }, CH[1]);
    tl.to(st, { chaos: 0, tangle: 0, duration: 1.0, ease: "power2.in" }, CH[1]);
    frags.forEach((f, i) => {
      tl.to(f.base, { x: 0, y: 0, z: 0, duration: 1.3, ease: "power3.in" }, CH[1] + 0.1 + i * 0.05);
      tl.to(f.sc, { v: 0.02, duration: 1.3, ease: "power3.in" }, CH[1] + 0.1 + i * 0.05);
    });
    const pop = CH[1] + 1.65;
    tl.call(() => { Sound.sfx.impact(); frags.forEach((f) => (f.mesh.visible = false)); }, null, pop);
    tl.fromTo(core.scale, { x: 0.001, y: 0.001, z: 0.001 }, { x: 1, y: 1, z: 1, duration: 1.4, ease: "elastic.out(1,0.45)", immediateRender: false }, pop);
    tl.fromTo(st, { flash: 1 }, { flash: 0, duration: 1.4, ease: "power2.out", immediateRender: false }, pop);
    tl.fromTo(st, { shock: 0 }, { shock: 1, duration: 1.6, ease: "power2.out", immediateRender: false }, pop);
    // 第三章：能力模組逐一亮起
    tl.addLabel("ch2", CH[2]).call(() => setChapter(2), null, CH[2]);
    tl.fromTo(chips[2].querySelector("i"), { scaleX: 0 }, { scaleX: 1, duration: 4.4, ease: "none", immediateRender: false }, CH[2]);
    tl.to(st, { ringOp: 0.45, duration: 1, ease: "power1.out" }, CH[2]);
    sats.forEach((s, i) => {
      const at = CH[2] + 0.3 + i * 0.55;
      tl.call(() => Sound.sfx.note(i), null, at);
      tl.fromTo(s.mesh.scale, { x: 0.001, y: 0.001, z: 0.001 }, { x: 1, y: 1, z: 1, duration: 0.7, ease: "back.out(1.8)", immediateRender: false }, at);
      tl.fromTo(s.node.material, { opacity: 0 }, { opacity: 0.9, duration: 0.4, immediateRender: false }, at);
    });
    tl.to(st, { link: 0.55, duration: 1.2 }, CH[2] + 0.4);
    tl.call(() => { chips.forEach((c) => c.classList.add("done")); Sound.sfx.chime(); }, null, CH[2] + 4.4);
    return tl;
  }
  /** 從頭播放 */
  function play() { if (!HAS_GSAP || REDUCE) { finalState(); return; } build(); tl.play(0); }
  /** 跳到某一章 */
  function jump(i) {
    if (!HAS_GSAP || REDUCE) { finalState(); return; }
    if (!tl) build();
    tl.play("ch" + i, false);
  }

  /* ---- 版面：寬螢幕時整組放右邊並依寬度縮放 ---- */
  const wideMQ = matchMedia("(min-width: 1200px)");   // 與 promo.css 的 hero 斷點一致
  function layout() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const halfH = Math.tan((camera.fov / 2) * Math.PI / 180) * camera.position.z, halfW = halfH * camera.aspect;
    // 寬螢幕：核心放在右側，縮放讓軌道左緣不超過畫面中線（左半邊留給文字）
    if (wideMQ.matches) { world.position.set(halfW * 0.5, 0.1, 0); world.scale.setScalar(Math.max(0.55, Math.min(0.9, halfW / 11.8))); }
    // 堆疊版面（3D 在文字上方）：依畫布寬度放大，軌道左右各留一點邊
    else { world.position.set(0, 0.5, 0); world.scale.setScalar(Math.max(0.6, Math.min(1.3, halfW / 5.9))); }
  }
  new ResizeObserver(layout).observe(stage);
  layout();

  /* ---- 滑鼠視差 ---- */
  let mx = 0, my = 0;
  addEventListener("pointermove", (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });

  /* ---- 算圖迴圈（hero 不在畫面內時暫停） ---- */
  let visible = true;
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(stage);
  const clock = new THREE.Clock();
  const q = new THREE.Quaternion();
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
    if (!visible) return;
    camera.position.x += (mx * 1.6 - camera.position.x) * 0.04;
    camera.position.y += (1.4 - my * 1.0 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
    particles.rotation.y = t * 0.01;
    grid.position.z = (t * 0.6) % 1;
    // 碎片：亂飄＋自轉（chaos 趨近 0 時停止）
    frags.forEach((f, i) => {
      const c = st.chaos;
      f.mesh.position.set(f.base.x + Math.sin(t * 0.7 + f.ph) * 0.35 * c, f.base.y + Math.sin(t * 1.1 + f.ph * 2) * 0.28 * c, f.base.z + Math.cos(t * 0.6 + f.ph) * 0.3 * c);
      f.mesh.rotation.set(Math.sin(t * 0.4 + i) * 0.35 * c + f.spin * c, Math.sin(t * 0.3 + f.ph) * 0.6 * c, Math.sin(t * 0.5 + f.ph) * 0.12 * c);
      f.mesh.scale.setScalar(f.sc.v);
    });
    const tp = tangleGeo.attributes.position.array;
    PAIRS.forEach(([a, b], k) => { const A = frags[a].mesh.position, B = frags[b].mesh.position; tp.set([A.x, A.y, A.z, B.x, B.y, B.z], k * 6); });
    tangleGeo.attributes.position.needsUpdate = true; tangle.computeLineDistances();
    tangle.material.opacity = st.tangle * (0.6 + 0.4 * Math.sin(t * 9));
    // 核心：自轉、隨節拍脈動
    const beat = beatLevel;
    shell.rotation.y += dt * 0.3; shell.rotation.x += dt * 0.12;
    innerWire.rotation.y -= dt * 0.5;
    inner.scale.setScalar(1 + beat * 0.18 + Math.sin(t * 2) * 0.03);
    halo.material.opacity = 0.55 + st.flash * 0.45 + beat * 0.3;
    halo.scale.setScalar(5.5 + st.flash * 6 + beat * 1.5);
    rings.forEach((r) => { r.rotation.z += dt * r.userData.sp; });
    shock.scale.setScalar(1 + st.shock * 7);
    shock.material.opacity = st.shock > 0 && st.shock < 1 ? (1 - st.shock) * 0.8 : 0;
    // 模組軌道：卡片永遠面向鏡頭，脈衝沿連線從核心流向模組
    orbit.rotation.y += dt * st.orbitSp;
    orbitRing.material.opacity = st.ringOp;
    orbit.getWorldQuaternion(q); q.invert().multiply(camera.quaternion);
    const lp = linkGeo.attributes.position.array;
    sats.forEach((s, i) => {
      s.mesh.quaternion.copy(q);
      s.holder.position.y = Math.sin(t * 0.8 + i) * 0.18;
      const P = s.holder.position;
      lp.set([0, 0, 0, P.x, P.y, P.z], i * 6);
      s.t = (s.t + dt * 0.45) % 1;
      s.pulse.position.set(P.x * s.t, P.y * s.t, P.z * s.t);
      s.pulse.material.opacity = st.link * 1.4 * Math.sin(s.t * Math.PI);
    });
    linkGeo.attributes.position.needsUpdate = true;
    links.material.opacity = st.link;
    renderer.render(scene, camera);
  }

  // 等字型載好再畫卡片貼圖（中文字型才會正確）；最多等 1.5 秒
  const ready = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]);
  ready.then(() => {
    frags.forEach((f, i) => { f.mesh.material.map.dispose(); f.mesh.material.map = cardTex({ ...FRAG[i], tone: "bad" }); });
    sats.forEach((s, i) => { s.mesh.material.map.dispose(); s.mesh.material.map = cardTex({ ...SAT[i], tone: "ok" }); });
    frame();
    play();
  });
  return { play, jump };
})();
document.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => Hero3D.jump(+c.dataset.ch)));
document.getElementById("replay").addEventListener("click", () => Hero3D.play());
document.getElementById("playHero").addEventListener("click", () => { setSound(true); Hero3D.play(); });
document.getElementById("playHero2").addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" }); setSound(true); setTimeout(() => Hero3D.play(), 500);
});

/* ===== 數字跳動（進入視窗時從 0 數到目標；靜止時已是最終值） ===== */
function countUp(el) {
  const target = +el.dataset.count, dur = 1200, t0 = performance.now();
  let last = 0;
  (function step(t) {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(target * e).toLocaleString("en-US");
    if (t - last > 80 && k < 1) { Sound.sfx.tickSfx(); last = t; }
    if (k < 1) requestAnimationFrame(step); else el.textContent = target.toLocaleString("en-US");
  })(t0);
}
const countIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { countIO.unobserve(e.target); countUp(e.target); } }), { threshold: 0.6 });
document.querySelectorAll("[data-count]").forEach((el) => countIO.observe(el));

/* =====================================================================
 * 旅程：捲動驅動的整合地圖
 *   左側 sticky 舞台：系統地圖（token 沿主幹移動、藍色串接線在兩端都走過時亮起）＋ 3D 翻面螢幕
 *   右側：九個步驟，捲到哪一步，地圖與螢幕就切到哪一步
 * ===================================================================== */
const Journey = (() => {
  const steps = [...document.querySelectorAll(".j-step")];
  /** 地圖節點：座標沿主幹路線排三列 */
  const NODES = [
    { x: 80, y: 46, name: "Agile 移轉" }, { x: 320, y: 46, name: "表單設計器" }, { x: 560, y: 46, name: "待辦通知" },
    { x: 560, y: 150, name: "簽核流程" }, { x: 320, y: 150, name: "Trigger" }, { x: 80, y: 150, name: "料號·BOM" },
    { x: 80, y: 254, name: "權限治理" }, { x: 320, y: 254, name: "進階搜尋" }, { x: 560, y: 254, name: "系統監控" },
  ];
  /** 模組之間的自動串接：[起點, 終點, 說明, 彎曲量（可省略）] */
  const XL = [
    [0, 5, "匯入料號/BOM"], [0, 3, "匯入流程"], [1, 6, "欄位權限"], [4, 2, "加簽通知"],
    [3, 5, "發行 → 升版", 90], [5, 7, "料號可搜尋"], [3, 8, "效能與 SSE"],
  ];
  const svgNS = "http://www.w3.org/2000/svg";
  const gNodes = document.getElementById("nodes"), gX = document.getElementById("xlinks");
  const path = document.getElementById("jPath"), done = document.getElementById("jPathDone"), token = document.getElementById("token");
  const len = path.getTotalLength();
  done.style.strokeDasharray = len; done.style.strokeDashoffset = len;
  /** 畫節點 */
  const nodeEls = NODES.map((n, i) => {
    const g = document.createElementNS(svgNS, "g"); g.setAttribute("class", "nd");
    g.innerHTML = `<circle class="ring" cx="${n.x}" cy="${n.y}" r="17"></circle><circle class="dot" cx="${n.x}" cy="${n.y}" r="5"></circle>
      <text class="no" x="${n.x}" y="${n.y - 24}" text-anchor="middle">${String(i + 1).padStart(2, "0")}</text>
      <text x="${n.x}" y="${n.y + 34}" text-anchor="middle">${n.name}</text>`;
    gNodes.appendChild(g); return g;
  });
  /** 畫串接弧線（往路線外側彎，避免壓到主幹） */
  const xlEls = XL.map(([a, b, label, bendOverride]) => {
    const A = NODES[a], B = NODES[b];
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
    const bend = bendOverride ?? Math.min(70, L * 0.28);   // 同列相距遠的弧線要彎高一點，才不會壓到中間節點的標籤
    const cx = mx - dy / L * bend, cy = my + dx / L * bend;
    const p = document.createElementNS(svgNS, "path");
    p.setAttribute("d", `M${A.x},${A.y} Q${cx},${cy} ${B.x},${B.y}`); p.setAttribute("class", "xl");
    const t = document.createElementNS(svgNS, "text");
    t.setAttribute("x", (mx + cx) / 2); t.setAttribute("y", (my + cy) / 2); t.setAttribute("text-anchor", "middle"); t.setAttribute("class", "xl-label");
    t.textContent = label;
    gX.appendChild(p); gX.appendChild(t); return { a, b, p, t };
  });
  /** 各節點在主幹上的位置（路徑長度） */
  const nodeLen = NODES.map((n) => {
    let best = 0, bd = Infinity;
    for (let l = 0; l <= len; l += 2) { const p = path.getPointAtLength(l); const d = (p.x - n.x) ** 2 + (p.y - n.y) ** 2; if (d < bd) { bd = d; best = l; } }
    return best;
  });

  /* ---- 3D 螢幕：預先放好每一步的媒體層 ---- */
  const card = document.getElementById("jCard"), layers = document.getElementById("jLayers"), urlEl = document.getElementById("jUrl");
  const media = steps.map((s) => {
    const src = s.dataset.media;
    let el;
    if (src.endsWith(".mp4")) {
      el = document.createElement("video"); el.muted = true; el.loop = true; el.playsInline = true; el.preload = "none"; el.setAttribute("muted", ""); el.src = src;
    } else { el = document.createElement("img"); el.alt = ""; el.src = src; }   // 舞台圖層透明度為 0，不能用 lazy，否則不會載入
    layers.appendChild(el); return el;
  });
  const tState = document.getElementById("tState"), tRev = document.getElementById("tRev");
  // 透視由外層 .j-screen 的 perspective 提供，這裡只設角度（兩邊都給會變成雙重透視而變形）
  if (HAS_GSAP) gsap.set(card, { rotationY: -7, rotationX: 3 });

  let cur = -1;
  /** 切到第 k 步：節點、串接線、票卡狀態、螢幕翻面換畫面 */
  function setStep(k) {
    if (k === cur) return;
    const prev = cur; cur = k;
    nodeEls.forEach((g, i) => g.setAttribute("class", "nd" + (i < k ? " done" : i === k ? " cur" : "")));
    // 兩端都走過的串接線亮起；說明文字只標「這一步剛接上」的那幾條，避免地圖太擠
    xlEls.forEach((x) => { const on = x.a <= k && x.b <= k; x.p.classList.toggle("on", on); x.t.classList.toggle("on", on && Math.max(x.a, x.b) === k); });
    steps.forEach((s, i) => s.classList.toggle("is-cur", i === k));
    tState.textContent = steps[k].dataset.state;
    const rev = k >= 5 ? "REV B" : "REV A";
    if (tRev.textContent !== rev) {
      tRev.textContent = rev; tRev.classList.add("bump"); setTimeout(() => tRev.classList.remove("bump"), 700);
      if (rev === "REV B") Sound.sfx.chime();
    }
    const swap = () => {
      media.forEach((m, i) => {
        m.classList.toggle("on", i === k);
        if (m.tagName === "VIDEO") { if (i === k) m.play().catch(() => {}); else m.pause(); }
      });
      urlEl.textContent = steps[k].dataset.url;
    };
    if (prev < 0 || !HAS_GSAP || REDUCE) { swap(); return; }
    Sound.sfx.whoosh();
    const dir = k > prev ? 1 : -1;
    gsap.killTweensOf(card);
    gsap.timeline()
      .to(card, { rotationY: -7 - 70 * dir, opacity: 0.35, duration: 0.22, ease: "power2.in" })
      .call(swap)
      .fromTo(card, { rotationY: -7 + 70 * dir }, { rotationY: -7, opacity: 1, duration: 0.55, ease: "power3.out" });
  }
  /** 依捲動進度（0..n-1 的浮點數）移動 token 與完成線 */
  let lastNode = 0;
  function setProgress(p) {
    const n = NODES.length;
    p = Math.max(0, Math.min(n - 1, p));
    const i = Math.min(n - 2, Math.floor(p)), f = p - i;
    const L = nodeLen[i] + (nodeLen[i + 1] - nodeLen[i]) * f;
    const pt = path.getPointAtLength(L);
    token.setAttribute("transform", `translate(${pt.x},${pt.y})`);
    done.style.strokeDashoffset = len - L;
    const k = Math.round(p);
    if (k !== lastNode) { lastNode = k; Sound.sfx.blip(); }
    setStep(k);
  }
  setProgress(0);
  if (HAS_GSAP) {
    ScrollTrigger.create({
      trigger: steps[0], start: "center 55%", endTrigger: steps[steps.length - 1], end: "center 55%",
      onUpdate: (self) => setProgress(self.progress * (NODES.length - 1)),
      onRefresh: (self) => setProgress(self.progress * (NODES.length - 1)),
    });
  }
  // 手機版：步驟內嵌影片進入畫面才播
  const vio = new IntersectionObserver((es) => es.forEach((e) => { const v = e.target; if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }), { threshold: 0.4 });
  document.querySelectorAll(".j-inline video").forEach((v) => vio.observe(v));
  return { setProgress };
})();

/* =====================================================================
 * 3D 畫面環：十二張實機截圖排成圓柱，捲動時旋轉（頁面釘住），正面那張亮起
 * ===================================================================== */
(() => {
  const ring = document.getElementById("wallRing");
  const SHOTS = [
    ["my-actions", "My Actions · 待簽核"], ["visual-designer", "Form Designer · Visual"], ["form-workflow", "Form · Workflow 進度"],
    ["trigger-modal", "Trigger · IMPORT_APPROVER"], ["trigger-list", "Trigger Config"], ["item-aml", "Item · AML"],
    ["saved-search", "Advanced Search"], ["perm-diagnosis", "Permission Diagnosis"], ["approver-matrix", "Approver Matrix"],
    ["agile-reconcile", "Agile Data Import · 對帳"], ["monitor", "System Monitor"], ["wf-doc", "Workflow Document"],
  ];
  const N = SHOTS.length, STEP = 360 / N, W = 400, GAP = 34;
  /** 圓柱半徑：讓相鄰卡片之間留 GAP 的距離 */
  const RADIUS = Math.round((W / 2 + GAP) / Math.tan(Math.PI / N));
  const cards = SHOTS.map(([f, cap]) => {
    const fig = document.createElement("figure"); fig.className = "wcard";
    fig.innerHTML = `<img src="assets/${f}.webp" alt="${cap}" loading="lazy"><figcaption>${cap}</figcaption>`;
    ring.appendChild(fig); return fig;
  });
  const mq = matchMedia("(min-width: 761px)");
  let rot = 0, front = -1;
  /** 套用旋轉並標出正面卡 */
  function apply() {
    if (!mq.matches) { ring.style.transform = ""; cards.forEach((c) => (c.style.transform = "")); return; }
    ring.style.transform = `translateZ(${-RADIUS}px) rotateY(${rot}deg)`;
    cards.forEach((c, i) => (c.style.transform = `rotateY(${i * STEP}deg) translateZ(${RADIUS}px)`));
    const f = ((Math.round(-rot / STEP) % N) + N) % N;
    if (f !== front) { front = f; cards.forEach((c, i) => c.classList.toggle("front", i === f)); Sound.sfx.tickSfx(); }
  }
  apply();
  mq.addEventListener("change", apply);
  if (HAS_GSAP) {
    ScrollTrigger.matchMedia({
      "(min-width: 761px)": () => {
        const o = { r: 0 };
        const tw = gsap.to(o, {
          r: -STEP * (N - 1), ease: "none",
          scrollTrigger: { trigger: "#wallPin", pin: true, start: "top top+=60", end: "+=" + (N * 170), scrub: 0.6 },
          onUpdate: () => { rot = o.r; apply(); },
        });
        return () => { tw.scrollTrigger && tw.scrollTrigger.kill(); tw.kill(); rot = 0; apply(); };
      },
    });
  }
})();

/* ===== 平台爆炸視圖：捲動時三層拉開，滑鼠移動時整座微轉 ===== */
(() => {
  const xs = document.getElementById("xstack"), xv = document.getElementById("xview");
  if (!HAS_GSAP || REDUCE) return;
  const o = { g: 26 };
  // 手機上層板較小，拉開的距離也縮小，整座才放得進 .xview
  const maxGap = matchMedia("(max-width: 600px)").matches ? 78 : 118;
  gsap.to(o, {
    g: maxGap, ease: "none",
    scrollTrigger: { trigger: "#xview", start: "top 85%", end: "center 45%", scrub: 0.5 },
    onUpdate: () => xs.style.setProperty("--gap", o.g + "px"),
  });
  xv.addEventListener("pointermove", (e) => {
    const r = xv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    xs.style.transform = `translate(-50%,-50%) rotateX(${56 - y * 10}deg) rotateZ(${-34 + x * 14}deg)`;
  });
  xv.addEventListener("pointerleave", () => (xs.style.transform = ""));
})();

/* ===== 燈箱 ===== */
const lb = document.getElementById("lightbox"), lbImg = document.getElementById("lbImg"), lbCap = document.getElementById("lbCap");
function openLb(src, cap) { lbImg.src = src; lbImg.alt = cap || ""; lbCap.textContent = cap || ""; lb.hidden = false; Sound.sfx.whoosh(); }
document.querySelectorAll(".thumbs button").forEach((b) => b.addEventListener("click", () => openLb(b.dataset.lb, b.getAttribute("aria-label").replace("放大：", ""))));
document.getElementById("wallRing").addEventListener("click", (e) => { const f = e.target.closest(".wcard"); if (f) { const img = f.querySelector("img"); openLb(img.src, img.alt); } });
lb.addEventListener("click", () => (lb.hidden = true));
addEventListener("keydown", (e) => { if (e.key === "Escape") lb.hidden = true; });

/* 圖片與字型載入後重新計算捲動位置 */
addEventListener("load", () => HAS_GSAP && ScrollTrigger.refresh());

/* 上次開過聲音的訪客：第一次點頁面時自動恢復 */
try {
  if (localStorage.getItem("miniplm-promo-sound") === "1") {
    addEventListener("pointerdown", function resume(e) {
      removeEventListener("pointerdown", resume);
      if (!Sound.on && !e.target.closest("#soundBtn")) setSound(true);
    });
  }
} catch (e) { /* 無法讀取偏好時維持靜音 */ }
