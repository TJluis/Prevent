// Línea base de la geometría de las armas: mide cada modelo tal y como está
// hoy (caja envolvente, cantidad de mallas, puntos de agarre y morro).
// Se usa para comprobar que el refactor a WEAPON_PARTS no altera la forma.
import { WEAPON_LIST } from "../js/weaponDefs.js";
import { buildWeaponGroup } from "../js/viewmodel.js";

function stubCanvas() {
  const ctx2d = new Proxy(
    {},
    { get: (t, k) => (k === "measureText" ? () => ({ width: 40 }) : () => {}), set: () => true }
  );
  globalThis.document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }),
  };
  globalThis.window = globalThis;
}
stubCanvas();

const THREE = await import("/vendor/three/three.module.js");

const out = {};
for (const w of WEAPON_LIST) {
  const g = buildWeaponGroup(w);
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  let meshes = 0;
  g.traverse((o) => {
    if (o.isMesh) meshes++;
  });
  out[w.id] = {
    size: [size.x, size.y, size.z].map((n) => +n.toFixed(4)),
    center: [center.x, center.y, center.z].map((n) => +n.toFixed(4)),
    min: [box.min.x, box.min.y, box.min.z].map((n) => +n.toFixed(4)),
    max: [box.max.x, box.max.y, box.max.z].map((n) => +n.toFixed(4)),
    meshes,
    grips: g.userData.grips,
    muzzle: g.userData.muzzle ? +g.userData.muzzle.position.z.toFixed(4) : null,
  };
}

console.log(JSON.stringify(out, null, 1));
