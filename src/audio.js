// Procedural sound (Web Audio): UI ticks plus continuous machinery that follows the simulation.
var DI = globalThis.DI || (globalThis.DI = {});
(function () {
  let ac = null, master = null, on = true, loops = null, tBell = 0, tBeep = 0;
  function init() {
    if (ac) return true; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { ac = new AC(); } catch (e) { return false; }
    master = ac.createGain(); master.gain.value = on ? 0.5 : 0; master.connect(ac.destination);
    const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = (freq, q, type) => { const s = ac.createBufferSource(); s.buffer = nb; s.loop = true; const f = ac.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q; const g = ac.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(master); s.start(); return g; };
    const osc = (type, freq) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = freq; const g = ac.createGain(); g.gain.value = 0; o.connect(g); g.connect(master); o.start(); return { o, g }; };
    loops = { water: noise(1800, 0.6), fire: noise(500, 0.8, 'lowpass'), pump: osc('sawtooth', 58), pump2: osc('square', 116), comp: osc('square', 31) };
    return true;
  }
  function tone(f, dur, type, vol, slide) { if (!ac || !on) return; const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur); g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02); }
  const set = (g, v) => { g.gain.setTargetAtTime(v, ac.currentTime, 0.15); };
  DI.audio = {
    toggle() { on = !on; if (init()) master.gain.value = on ? 0.5 : 0; return on; },
    play(n) {
      if (!on || !init()) return; if (ac.state === 'suspended') ac.resume();
      if (n === 'click') tone(880, 0.04, 'square', 0.05); else if (n === 'place') { tone(300, 0.07, 'triangle', 0.16, 180); tone(1400, 0.03, 'square', 0.03); }
      else if (n === 'pop') tone(200, 0.09, 'triangle', 0.14, 90); else if (n === 'valve') tone(140, 0.4, 'sawtooth', 0.08, 70);
      else if (n === 'trip') { tone(90, 0.7, 'sawtooth', 0.3, 40); tone(2400, 0.5, 'square', 0.04, 300); } else if (n === 'pass') { tone(660, 0.12, 'triangle', 0.18); setTimeout(() => tone(990, 0.22, 'triangle', 0.18), 110); }
      else if (n === 'fail') tone(220, 0.45, 'sawtooth', 0.16, 110); else if (n === 'spk') tone(3200, 0.12, 'square', 0.07, 900);
    },
    tick(g) {
      if (!ac || !on || !loops) return; const S = g.S, W = g.W; let pump = 0, comp = 0, al = 0, sv = 0;
      for (const p of W.parts.values()) { if ((p.type === 'epump' || p.type === 'dpump') && p.p.spd > pump) pump = p.p.spd; if ((p.type === 'comp' || p.type === 'n2' || p.type === 'jockey') && p.p.on) comp = 1; }
      for (const o of S.sig.values()) { if (o.sup || DI.sigSilenced(W, o)) continue; if (o.type === 'ALARM') al = 1; else sv = 1; }      // a silenced panel keeps its own signals quiet until a new one arrives there
      const quiet = g.speed === 0 || DI.ui.modalOpen ? 0 : 1;
      set(loops.water, quiet * Math.min(0.22, (S.outFlow || 0) / 900)); let q = 0; for (const k of S.fires) q += S.fq[k]; set(loops.fire, quiet * Math.min(0.3, q / 4000));
      set(loops.pump.g, quiet * pump * 0.07); set(loops.pump2.g, quiet * pump * 0.02); loops.pump.o.frequency.value = 20 + 38 * pump; loops.pump2.o.frequency.value = 40 + 76 * pump; set(loops.comp.g, quiet * comp * 0.035);
      if (quiet && al && g.now - tBell > 0.22) { tBell = g.now; tone(1850, 0.18, 'triangle', 0.07); tone(2760, 0.12, 'sine', 0.03); }
      else if (quiet && !al && sv && g.now - tBeep > 2.4) { tBeep = g.now; tone(2900, 0.09, 'square', 0.03); }
    },
  };
  window.addEventListener('mousedown', () => { if (on) init(); }, { once: true });
  DI.bus.on('trip', () => DI.audio.play('trip')); DI.bus.on('spk', () => DI.audio.play('spk')); DI.bus.on('result', (r) => DI.audio.play(r.pass ? 'pass' : 'fail'));
})();
