// RegresiÃ³n del AGARRE del arma en 3Âª persona (FV6.1): las DOS aletas del
// pingÃ¼ino deben sujetar el arma y no quedar colgando en vertical.
//
// Comprueba, para las 18 armas, que tras animateAvatar() con el arma equipada:
//   Â· la punta de cada aleta queda junto a su punto de agarre del arma,
//   Â· las dos aletas sujetan (no una en vertical y la otra suelta),
//   Â· las puntas quedan por delante del pecho (no se meten dentro del torso),
//   Â· las puntas quedan por debajo de la cara (no tapan la vista),
//   Â· y al quitar el arma las aletas vuelven exactamente a su hombro.
//
// Uso:  node public/test/runner.mjs public/test/t-aletas.mjs

import { WEAPON_LIST } from "../js/weaponDefs.js";
import { buildWeaponGroup } from "../js/viewmodel.js";
import { solveWeaponHold } from "../js/combat.js";
import { createAvatar, animateAvatar, setAvatarWeapon } from "../js/avatar.js";
import { surfaceFrontZAt } from "../js/garments.js";

// avatar.js pinta el cartel de nombre con un canvas 2D; en Node se stubea lo
// justo para poder construir el avatar y medir sus aletas.
function stubCanvas() {
  const ctx2d = new Proxy(
    {},
    {
      get: (t, k) => {
        if (k === "measureText") return () => ({ width: 40 });
        if (k === "roundRect" || k === "beginPath" || k === "closePath") return () => {};
        return () => {};
      },
      set: () => true,
    }
  );
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ctx2d,
      style: {},
    }),
  };
  globalThis.window = globalThis;
}
stubCanvas();

const HEAD_Y = 1.32;        // centro de la cabeza
const HEAD_R = 0.34;        // radio de la cabeza
const TIP_Y = -0.42;        // punta de la aleta en su espacio local
const MAX_TIP_TO_GRIP = 0.13; // holgura tolerada entre punta y agarre
const MAX_STRETCH = 1.5;

let pass = 0;
let fail = 0;
const failures = [];

function check(id, ok, msg) {
  if (ok) {
    pass++;
  } else {
    fail++;
    failures.push(`${id}: ${msg}`);
  }
}

function tipWorld(wing) {
  const p = wing.userData.tipPos.clone();
  return p.applyMatrix4(wing.matrixWorld);
}

for (const weapon of WEAPON_LIST) {
  const id = weapon.id;

  // Avatar + arma con la misma colocaciÃ³n que usa combat.makeOwnWeapon.
  const avatar = createAvatar("TEST", "#4c84ff");
  const gun = buildWeaponGroup(weapon);
  const hold = solveWeaponHold(gun.userData.grips);
  gun.rotation.y = Math.PI;
  gun.scale.setScalar(hold.scale);
  gun.position.set(hold.x, hold.y, hold.z);
  avatar.add(gun);
  setAvatarWeapon(avatar, gun);

  const { leftWing, rightWing } = avatar.userData.limbs;

  // 60 frames para que el agarre termine (ARM_EASE = 7).
  let now = 1000;
  for (let i = 0; i < 60; i++) {
    now += 16;
    animateAvatar(avatar, now, 0.016, false);
  }
  avatar.updateMatrixWorld(true);

  // Puntas en espacio de avatar (el avatar estÃ¡ en el origen, sin rotaciÃ³n).
  const grips = gun.userData.grips;
  const gR = new (gun.position.constructor)(...grips.right).applyMatrix4(gun.matrix);
  const gL = new (gun.position.constructor)(...grips.left).applyMatrix4(gun.matrix);
  const flip = gR.x < gL.x;
  const pair = flip
    ? [
        { wing: rightWing, grip: gR, tag: "der" },
        { wing: leftWing, grip: gL, tag: "izq" },
      ]
    : [
        { wing: rightWing, grip: gL, tag: "der" },
        { wing: leftWing, grip: gR, tag: "izq" },
      ];

  for (const { wing, grip, tag } of pair) {
    const tip = tipWorld(wing);
    const d = tip.distanceTo(grip);
    check(id, d <= MAX_TIP_TO_GRIP, `aleta ${tag} a ${d.toFixed(3)} del agarre (max ${MAX_TIP_TO_GRIP})`);
  }

  // Las dos aletas deben agarrar: misma distancia al agarre y no superpuestas.
  const dDer = tipWorld(rightWing).distanceTo(flip ? gR : gL);
  const dIzq = tipWorld(leftWing).distanceTo(flip ? gL : gR);
  check(id, Math.abs(dDer - dIzq) < 0.14, `agarre desigual der=${dDer.toFixed(3)} izq=${dIzq.toFixed(3)}`);

  const tDer = tipWorld(rightWing);
  const tIzq = tipWorld(leftWing);
  const sep = Math.abs(tDer.x - tIzq.x);
  check(id, sep >= 0.1, `aletas solapadas (separacion ${sep.toFixed(3)})`);

  // Nada de aletas en vertical colgando: ambas apuntan hacia delante (+Z).
  for (const [tag, t] of [["der", tDer], ["izq", tIzq]]) {
    check(id, t.z > 0.3, `aleta ${tag} no llega al frente (z=${t.z.toFixed(3)})`);
  }

  // No se meten dentro del torso: la punta queda por delante del pecho.
  for (const [tag, t] of [["der", tDer], ["izq", tIzq]]) {
    check(id, t.z >= surfaceFrontZAt(t.y) - 0.02,
      `aleta ${tag} dentro del pecho (z=${t.z.toFixed(3)} vs superficie ${surfaceFrontZAt(t.y).toFixed(3)})`);
  }

  // No tapan la cara: por debajo de la cabeza.
  for (const [tag, t] of [["der", tDer], ["izq", tIzq]]) {
    check(id, t.y < HEAD_Y - HEAD_R * 0.5, `aleta ${tag} tapa la cara (y=${t.y.toFixed(3)})`);
  }

  // Estiramiento dentro del rango cartoon.
  for (const [tag, w] of [["der", rightWing], ["izq", leftWing]]) {
    check(id, w.scale.y <= MAX_STRETCH, `aleta ${tag} estirada de mas (${w.scale.y.toFixed(3)})`);
  }

  // Al quitar el arma, las aletas vuelven a su hombro de reposo.
  setAvatarWeapon(avatar, null);
  for (let i = 0; i < 60; i++) {
    now += 16;
    animateAvatar(avatar, now, 0.016, false);
  }
  for (const [tag, w] of [["der", rightWing], ["izq", leftWing]]) {
    const home = w.userData.home;
    check(id, w.position.distanceTo(home) < 1e-6, `aleta ${tag} no vuelve al hombro`);
    check(id, Math.abs(w.scale.y - 1) < 1e-6, `aleta ${tag} queda estirada sin arma`);
  }

  // Y en reposo (sin arma) la aleta debe quedar colgando, no agarrando.
  check(id, rightWing.rotation.z > 0 && leftWing.rotation.z < 0, "aletas no vuelven a reposo");
}

console.log(`\naletas: ${pass} ok, ${fail} fail`);
if (failures.length) {
  console.log("\nfallos:");
  for (const f of failures.slice(0, 40)) console.log("  - " + f);
}
process.exit(fail === 0 ? 0 : 1);
