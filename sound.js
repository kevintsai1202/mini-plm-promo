/* =====================================================================
 * 宣傳頁音效引擎：配樂與介面音效全部用 Web Audio 即時合成（不載入任何音檔）。
 * 瀏覽器規定要使用者互動後才能出聲，所以 AudioContext 在第一次按下聲音鍵或播放鍵時才建立。
 * 對外提供 window.Sound：enable()／disable()／on／sfx.*／levels()
 * ===================================================================== */
window.Sound = (() => {
  /** 共用 AudioContext 與匯流排 */
  let ctx = null, master = null, musicBus = null, sfxBus = null, analyser = null, delay = null;
  /** 配樂是否在播、排程計時器、下一格時間、目前第幾個 16 分音符 */
  let playing = false, timer = null, nextTime = 0, step = 0;
  const BPM = 98, STEP = 60 / BPM / 4;
  // 和弦進行：Cmaj9 → Am9 → Fmaj9 → G6/9，每個和弦兩小節
  const CHORDS = [
    { root: 48, notes: [60, 64, 67, 71, 74] },
    { root: 45, notes: [57, 60, 64, 67, 71] },
    { root: 41, notes: [57, 60, 64, 65, 69] },
    { root: 43, notes: [59, 62, 64, 67, 69] },
  ];
  const ARP = [0, 2, 4, 1, 3, 4, 2, 1];          // 琶音取和弦音的順序
  const PENTA = [72, 74, 76, 79, 81, 84, 86];   // 能力模組亮起時的上行五聲音階
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /** 建立音訊圖：master → 壓縮器 → 分析器 → 輸出；配樂另接 feedback delay 營造空間感 */
  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    analyser = ctx.createAnalyser(); analyser.fftSize = 256;
    master.connect(comp); comp.connect(analyser); analyser.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0;
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55;
    delay = ctx.createDelay(1); delay.delayTime.value = STEP * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const dlp = ctx.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 2400;
    delay.connect(dlp); dlp.connect(fb); fb.connect(delay); dlp.connect(musicBus);
    musicBus.connect(master); sfxBus.connect(master);
    return ctx;
  }

  /** 白噪音 buffer（hi-hat、刷聲、衝擊共用） */
  let noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  /** 單一音：振盪器 + 包絡，可選低通與送 delay */
  function tone(t, { f, type = "sine", a = 0.005, d = 0.3, g = 0.2, bus = musicBus, lp = 0, send = 0, glideTo = 0 }) {
    const o = ctx.createOscillator(), v = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + d);
    v.gain.setValueAtTime(0.0001, t);
    v.gain.exponentialRampToValueAtTime(g, t + a);
    v.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    let out = v;
    if (lp) { const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = lp; v.connect(fl); out = fl; }
    o.connect(v); out.connect(bus);
    if (send) { const s = ctx.createGain(); s.gain.value = send; out.connect(s); s.connect(delay); }
    o.start(t); o.stop(t + a + d + 0.05);
  }

  /** 噪音打擊：濾波後的短噪音 */
  function hit(t, { type = "highpass", f = 7000, q = 0.7, d = 0.05, g = 0.08, bus = musicBus, sweepTo = 0 }) {
    const s = ctx.createBufferSource(); s.buffer = noise();
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (sweepTo) fl.frequency.exponentialRampToValueAtTime(sweepTo, t + d);
    const v = ctx.createGain();
    v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t + Math.min(0.01, d / 3));
    v.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(fl); fl.connect(v); v.connect(bus); s.start(t); s.stop(t + d + 0.05);
  }

  /** 墊音：兩個微失諧鋸齒波過低通，長音 */
  function pad(t, notes, len) {
    notes.slice(0, 4).forEach((m) => {
      [-6, 6].forEach((det) => {
        const o = ctx.createOscillator(), v = ctx.createGain(), fl = ctx.createBiquadFilter();
        o.type = "sawtooth"; o.frequency.value = hz(m); o.detune.value = det;
        fl.type = "lowpass"; fl.frequency.setValueAtTime(500, t); fl.frequency.linearRampToValueAtTime(1400, t + len * 0.5); fl.frequency.linearRampToValueAtTime(600, t + len);
        v.gain.setValueAtTime(0.0001, t); v.gain.linearRampToValueAtTime(0.022, t + 0.8); v.gain.setValueAtTime(0.022, t + len - 0.6); v.gain.linearRampToValueAtTime(0.0001, t + len + 0.2);
        o.connect(fl); fl.connect(v); v.connect(musicBus); o.start(t); o.stop(t + len + 0.3);
      });
    });
  }

  /** 排一個 16 分音符格的所有聲部 */
  function schedule(i, t) {
    const bar = Math.floor(i / 16), s = i % 16;
    const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length];
    const section = Math.floor(bar / 8) % 2;       // 每 8 小節切換一次編制，避免單調
    if (s === 0 && bar % 2 === 0) pad(t, chord.notes, STEP * 32);
    if (s % 4 === 0 && bar >= 2) tone(t, { f: 120, glideTo: 42, a: 0.002, d: 0.28, g: 0.55 });                 // 大鼓
    if ((s === 4 || s === 12) && bar >= 4) hit(t, { type: "bandpass", f: 1500, q: 0.9, d: 0.12, g: 0.13 });    // 拍手
    if (s % 2 === 0 && bar >= 2) hit(t, { f: 8000, d: s % 4 === 2 ? 0.09 : 0.035, g: s % 4 === 2 ? 0.05 : 0.025 }); // hi-hat
    if (s % 2 === 0) tone(t, { f: hz(chord.root + ((s === 6 || s === 14) ? 12 : 0)), type: "triangle", a: 0.005, d: STEP * 1.6, g: 0.22, lp: 600 }); // 低音
    if (bar >= 1 && (section === 1 || s % 2 === 0)) tone(t, { f: hz(chord.notes[ARP[s % ARP.length]] + 12), type: "triangle", a: 0.003, d: 0.22, g: 0.05, lp: 3200, send: 0.45 }); // 琶音
    if (s === 0 && bar % 4 === 3) tone(t, { f: hz(chord.notes[4] + 12), a: 0.01, d: 1.6, g: 0.05, send: 0.6 });   // 鐘聲點綴
  }

  /** lookahead 排程器：每 25ms 檢查一次，把未來 120ms 內的音排進去 */
  function tick() { while (nextTime < ctx.currentTime + 0.12) { schedule(step, nextTime); nextTime += STEP; step++; } }
  function startMusic() {
    if (!ensure() || playing) return;
    ctx.resume(); playing = true; step = 0; nextTime = ctx.currentTime + 0.08;
    musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 1.5);
    timer = setInterval(tick, 25); tick();
  }
  function stopMusic() {
    if (!ctx || !playing) return;
    playing = false; clearInterval(timer);
    musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
  }

  let sfxOn = false;
  /** 介面音效（只在聲音開啟時出聲） */
  const sfx = {
    hover() { if (!sfxOn) return; tone(ctx.currentTime, { f: 2600, a: 0.002, d: 0.035, g: 0.04, bus: sfxBus }); },
    click() { if (!sfxOn) return; const t = ctx.currentTime; tone(t, { f: 660, glideTo: 220, type: "triangle", a: 0.002, d: 0.09, g: 0.25, bus: sfxBus }); hit(t, { type: "bandpass", f: 3000, d: 0.03, g: 0.05, bus: sfxBus }); },
    whoosh() { if (!sfxOn) return; hit(ctx.currentTime, { type: "bandpass", f: 400, sweepTo: 4200, q: 1.4, d: 0.55, g: 0.1, bus: sfxBus }); },
    chime() { if (!sfxOn) return; const t = ctx.currentTime; tone(t, { f: 1318.5, a: 0.004, d: 0.7, g: 0.08, bus: sfxBus }); tone(t + 0.08, { f: 1975.5, a: 0.004, d: 0.9, g: 0.06, bus: sfxBus }); },
    blip() { if (!sfxOn) return; tone(ctx.currentTime, { f: 1760, type: "triangle", a: 0.002, d: 0.06, g: 0.06, bus: sfxBus }); },
    tickSfx() { if (!sfxOn) return; tone(ctx.currentTime, { f: 1800, type: "square", a: 0.001, d: 0.012, g: 0.02, bus: sfxBus, lp: 4000 }); },
    note(i) { if (!sfxOn) return; const t = ctx.currentTime, m = PENTA[i % PENTA.length]; tone(t, { f: hz(m), a: 0.004, d: 0.9, g: 0.09, bus: sfxBus, send: 0.4 }); tone(t, { f: hz(m + 12), a: 0.004, d: 0.5, g: 0.03, bus: sfxBus }); },
    glitch() { if (!sfxOn) return; const t = ctx.currentTime; for (let k = 0; k < 5; k++) hit(t + k * 0.07 + Math.random() * 0.03, { type: "bandpass", f: 600 + Math.random() * 3000, q: 6, d: 0.04, g: 0.07, bus: sfxBus }); },
    impact() {
      if (!sfxOn) return; const t = ctx.currentTime;
      tone(t, { f: 90, glideTo: 30, a: 0.003, d: 1.2, g: 0.8, bus: sfxBus });
      hit(t, { type: "lowpass", f: 1800, sweepTo: 120, d: 1.1, g: 0.35, bus: sfxBus });
      tone(t, { f: hz(72), a: 0.01, d: 2.2, g: 0.06, bus: sfxBus }); tone(t, { f: hz(79), a: 0.01, d: 2.4, g: 0.05, bus: sfxBus });
    },
    riser(dur) {
      if (!sfxOn) return; const t = ctx.currentTime;
      hit(t, { type: "bandpass", f: 200, sweepTo: 6000, q: 2, d: dur, g: 0.1, bus: sfxBus });
      tone(t, { f: 110, glideTo: 880, type: "sawtooth", a: dur * 0.9, d: 0.1, g: 0.03, bus: sfxBus, lp: 2000 });
    },
  };

  const buf = new Uint8Array(128);
  /** 讀目前頻譜（EQ 圖示與節拍發光用）；沒出聲時回傳 null */
  function levels() { if (!analyser || (!playing && !sfxOn)) return null; analyser.getByteFrequencyData(buf); return buf; }

  return {
    get on() { return sfxOn; },
    enable() { if (!ensure()) return false; ctx.resume(); sfxOn = true; startMusic(); return true; },
    disable() { sfxOn = false; stopMusic(); },
    sfx, levels,
  };
})();
