// Pruebas de la Fase 4: salto, sprint y deslizamiento (módulo puro).
// Uso: node public/test/runner.mjs public/test/t-movimiento.mjs
import { MOTION, createMotionState, stepMotion } from "../js/motion.js";

const results = [];
function t(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log("ok  : " + name);
  } catch (err) {
    results.push({ name, ok: false, extra: err.message });
    console.log("FAIL: " + name + " | " + err.message);
  }
}
const eq = (a, b, msg) => {
  if (a !== b) throw new Error(`${msg}: espere ${JSON.stringify(b)} pero hay ${JSON.stringify(a)}`);
};
const ok = (v, msg) => {
  if (!v) throw new Error(msg);
};
const near = (a, b, eps, msg) => {
  if (Math.abs(a - b) > eps) throw new Error(`${msg}: espere ~${b} pero hay ${a}`);
};

const FPS = 1 / 60;

function runFrames(state, frames, input) {
  let out = null;
  for (let i = 0; i < frames; i++) out = stepMotion(state, input, FPS);
  return out;
}

t("salto: altura máxima ~1,18 m y aterrizaje sin bajar de 0", () => {
  const s = createMotionState();
  let out = stepMotion(s, { jump: true }, FPS);
  ok(out.jumping, "no despegó");
  let maxY = out.y;
  for (let i = 0; i < 180; i++) {
    out = stepMotion(s, {}, FPS);
    maxY = Math.max(maxY, out.y);
    ok(out.y >= 0, `y negativa: ${out.y}`);
  }
  near(maxY, 1.18, 0.08, "altura máxima");
  eq(out.jumping, false, "no aterrizó");
  eq(out.y, 0, "y al aterrizar");
});

t("no hay doble salto", () => {
  const s = createMotionState();
  let out = stepMotion(s, { jump: true }, FPS);
  let maxY = out.y;
  for (let i = 0; i < 20; i++) {
    out = stepMotion(s, {}, FPS);
    maxY = Math.max(maxY, out.y);
  }
  // Intentar saltar en el aire: se ignora.
  out = stepMotion(s, { jump: true }, FPS);
  for (let i = 0; i < 180; i++) {
    out = stepMotion(s, {}, FPS);
    maxY = Math.max(maxY, out.y);
  }
  near(maxY, 1.18, 0.08, "el segundo salto no debe subir más");
  eq(out.jumping, false, "debería haber aterrizado");
});

t("sprint: ×1,55, consume 18/s y regenera tras 600 ms", () => {
  const s = createMotionState();
  let out = null;
  for (let i = 0; i < 60; i++) {
    out = stepMotion(s, { move: true, sprint: true }, FPS);
    eq(out.speedMult, MOTION.sprintMult, "multiplicador de sprint");
    eq(out.sprinting, true, "debería estar sprintando");
  }
  near(out.stamina, 82, 0.5, "stamina tras 1 s de sprint");

  // 0,5 s parado: aún no regenera (delay 600 ms).
  for (let i = 0; i < 30; i++) out = stepMotion(s, {}, FPS);
  near(out.stamina, 82, 0.5, "no debe regenerar antes del delay");

  // 1 s más: los primeros 100 ms completan el delay y luego regenera 14/s
  // durante 0,9 s (12,6 puntos).
  for (let i = 0; i < 60; i++) out = stepMotion(s, {}, FPS);
  near(out.stamina, 94.6, 0.7, "stamina tras 1 s de regeneración");
});

t("sprint sin stamina no acelera y no baja de 0", () => {
  const s = createMotionState();
  s.stamina = 1;
  let out = null;
  for (let i = 0; i < 30; i++) out = stepMotion(s, { move: true, sprint: true }, FPS);
  eq(out.stamina, 0, "la stamina no debe quedar negativa");
  eq(out.sprinting, false, "sin stamina no hay sprint");
  eq(out.speedMult, 1, "sin stamina no hay multiplicador");
});

t("deslizamiento: 550 ms a ×1,8, cuesta 25 y respeta 800 ms de cooldown", () => {
  const s = createMotionState();
  let out = null;
  // 0,2 s de sprint antes de deslizarse.
  for (let i = 0; i < 12; i++) out = stepMotion(s, { move: true, sprint: true }, FPS);
  const before = out.stamina;

  out = stepMotion(s, { move: true, sprint: true, slide: true }, FPS);
  eq(out.sliding, true, "no empezó el deslizamiento");
  eq(out.speedMult, MOTION.slideMult, "multiplicador de deslizamiento");
  near(before - out.stamina, MOTION.slideCost, 0.4, "coste del deslizamiento");

  // 550 ms desde el inicio: debe terminar.
  let frames = 0;
  while (out.sliding && frames < 60) {
    out = stepMotion(s, { move: true, sprint: true }, FPS);
    frames++;
  }
  eq(out.sliding, false, "el deslizamiento no terminó");
  ok(frames >= 30 && frames <= 34, `duración inesperada: ${frames} frames`);

  // Justo después sigue en cooldown: no se puede repetir.
  out = stepMotion(s, { move: true, sprint: true, slide: true }, FPS);
  eq(out.sliding, false, "el cooldown no bloqueó el segundo deslizamiento");

  // Avanzar hasta superar los 800 ms desde el inicio del primero.
  for (let i = 0; i < 20; i++) out = stepMotion(s, { move: true, sprint: true }, FPS);
  out = stepMotion(s, { move: true, sprint: true, slide: true }, FPS);
  eq(out.sliding, true, "debería poder deslizarse tras el cooldown");
});

t("deslizamiento sin sprint o sin stamina se ignora", () => {
  const s = createMotionState();
  let out = stepMotion(s, { move: true, sprint: false, slide: true }, FPS);
  eq(out.sliding, false, "sin sprint no debe deslizarse");

  const s2 = createMotionState();
  s2.stamina = 10;
  out = stepMotion(s2, { move: true, sprint: true, slide: true }, FPS);
  eq(out.sliding, false, "sin stamina suficiente no debe deslizarse");
});

t("dt inválido o negativo no rompe ni mueve el tiempo", () => {
  const s = createMotionState();
  const a = stepMotion(s, {}, NaN);
  const b = stepMotion(s, {}, -1);
  eq(a.y, 0, "y con dt inválido");
  eq(b.y, 0, "y con dt negativo");
  eq(s.time, 0, "el tiempo no debe avanzar con dt inválido");
});

t("correr contra una pared no gasta stamina", () => {
  const s = createMotionState();
  // 0,5 s sprintando de verdad: debe gastar stamina.
  let out = runFrames(s, 30, { move: true, sprint: true });
  const drained = MOTION.staminaMax - out.stamina;
  ok(drained > 5, `el sprint normal debería gastar stamina: ${drained}`);

  // 1 s marcado como bloqueado: no debe gastar más (y puede regenerar).
  const before = out.stamina;
  out = runFrames(s, 60, { move: true, sprint: true, blocked: true });
  ok(out.stamina >= before, `bloqueado gastó stamina: ${before} -> ${out.stamina}`);
  eq(out.sprinting, false, "bloqueado no debe reproducir animación de sprint");

  // Al desbloquearse vuelve a correr.
  out = stepMotion(s, { move: true, sprint: true }, FPS);
  eq(out.sprinting, true, "debería volver a sprintar al desbloquearse");
});

const total = results.length;
const passed = results.filter((r) => r.ok).length;
console.log(`\nRESULTADO movimiento: ${passed}/${total} ok`);
if (passed !== total) {
  for (const r of results) {
    if (!r.ok) console.log(`  - ${r.name}: ${r.extra}`);
  }
  process.exitCode = 1;
}
