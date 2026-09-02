import { BOUNDARY, CRATES } from "./world.js";

export const PLAYER_RADIUS = 0.45;

export function moveWithCollisions(x, z) {
  const limit = BOUNDARY - PLAYER_RADIUS;
  let nx = Math.max(-limit, Math.min(limit, x));
  let nz = Math.max(-limit, Math.min(limit, z));

  for (const crate of CRATES) {
    const halfW = crate.w / 2 + PLAYER_RADIUS - 0.05;
    const halfD = crate.d / 2 + PLAYER_RADIUS - 0.05;
    const inside = nx > crate.x - halfW && nx < crate.x + halfW && nz > crate.z - halfD && nz < crate.z + halfD;
    if (!inside) continue;

    const pushX = (nx < crate.x ? crate.x - halfW : crate.x + halfW) - nx;
    const pushZ = (nz < crate.z ? crate.z - halfD : crate.z + halfD) - nz;
    if (Math.abs(pushX) < Math.abs(pushZ)) {
      nx += pushX;
    } else {
      nz += pushZ;
    }
  }

  return { x: nx, z: nz };
}