// Movimiento vertical y stamina (Fase 4): salto, sprint y deslizamiento.
// Módulo puro y sin DOM para poder probarlo con node. La física horizontal y
// las colisiones siguen en main.js (2D): el salto es cosmético y NO esquiva
// balas, porque el combate también es 2D.

export const MOTION = {
  gravity: 22,
  jumpV: 7.2,
  sprintMult: 1.55,
  slideMult: 1.8,
  slideMs: 550,
  slideCooldownMs: 800,
  staminaMax: 100,
  sprintDrain: 18,
  regen: 14,
  regenDelayMs: 600,
  slideCost: 25,
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export function createMotionState() {
  return {
    time: 0,
    y: 0,
    vy: 0,
    grounded: true,
    stamina: MOTION.staminaMax,
    slideUntil: 0,
    slideCooldownUntil: 0,
    regenAt: 0,
  };
}

// state: resultado de createMotionState() (se muta y se devuelve resumido).
// input: { move, sprint, jump, slide, blocked }. `jump` y `slide` deben llegar
// como pulsaciones puntuales (edge), no como tecla mantenida. `blocked` indica
// que el movimiento del frame anterior chocó y no avanzó (pared/borde): así
// correr contra una pared no gasta stamina.
export function stepMotion(state, input = {}, dt = 0) {
  const s = state;
  const step = clamp(Number(dt) || 0, 0, 0.1);
  s.time += step * 1000;
  const now = s.time;

  const move = !!input.move;
  const wantSprint = !!input.sprint && move && !input.blocked;
  const wasSliding = now < s.slideUntil;

  // Salto: sólo desde el suelo y nunca en el aire (sin doble salto).
  if (input.jump && s.grounded) {
    s.vy = MOTION.jumpV;
    s.grounded = false;
    s.slideUntil = 0; // saltar cancela el deslizamiento
  }

  if (!s.grounded) {
    s.vy -= MOTION.gravity * step;
    s.y += s.vy * step;
    if (s.y <= 0) {
      s.y = 0;
      s.vy = 0;
      s.grounded = true;
    }
  } else {
    s.y = 0;
    s.vy = 0;
  }

  // Deslizamiento: sólo si se está sprintando, en el suelo, con stamina y
  // fuera de cooldown. Cuesta 25 de stamina al empezar.
  if (
    !wasSliding &&
    input.slide &&
    s.grounded &&
    wantSprint &&
    now >= s.slideCooldownUntil &&
    s.stamina >= MOTION.slideCost
  ) {
    s.slideUntil = now + MOTION.slideMs;
    s.slideCooldownUntil = now + MOTION.slideCooldownMs;
    s.stamina = Math.max(0, s.stamina - MOTION.slideCost);
    s.regenAt = now + MOTION.regenDelayMs;
  }

  const sliding = now < s.slideUntil;
  let sprinting = false;
  if (!sliding && wantSprint && s.stamina > 0) {
    sprinting = true;
    s.stamina = Math.max(0, s.stamina - MOTION.sprintDrain * step);
    s.regenAt = now + MOTION.regenDelayMs;
  }

  // Regeneración: hace falta soltar sprint y esperar regenDelayMs.
  if (!sprinting && !sliding && !wantSprint && now >= s.regenAt) {
    s.stamina = Math.min(MOTION.staminaMax, s.stamina + MOTION.regen * step);
  }

  let speedMult = 1;
  if (sliding) speedMult = MOTION.slideMult;
  else if (sprinting) speedMult = MOTION.sprintMult;

  return {
    y: s.y,
    vy: s.vy,
    speedMult,
    sprinting,
    sliding,
    jumping: !s.grounded,
    stamina: s.stamina,
  };
}
