// Efectos de sonido del TNT Run.
//
// WebAudio puro, sin ficheros: un chasquido de mecha, un trueno de bloque que
// cae y un silbido de caída al vacío. Se inicializa tarde (como en combat.js)
// para cumplir con la política de autoplay del navegador.

let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      audioCtx = null;
    }
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone({ freq, end, dur, type = "square", gain = 0.2, when = 0 }) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + when);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, end), ctx.currentTime + when + dur);
  g.gain.setValueAtTime(gain, ctx.currentTime + when);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(ctx.currentTime + when);
  osc.stop(ctx.currentTime + when + dur + 0.02);
}

function noise({ dur = 0.15, gain = 0.2, freq = 800, type = "lowpass" }) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  src.start(ctx.currentTime);
}

export function playTntFuse() {
  tone({ freq: 1100, end: 700, dur: 0.05, type: "square", gain: 0.07 });
}

export function playTntFall() {
  tone({ freq: 150, end: 38, dur: 0.34, type: "sawtooth", gain: 0.16 });
  noise({ dur: 0.28, gain: 0.16, freq: 620 });
}

export function playTntEliminated() {
  tone({ freq: 720, end: 90, dur: 0.55, type: "triangle", gain: 0.18 });
  noise({ dur: 0.4, gain: 0.12, freq: 1100, type: "bandpass" });
}
