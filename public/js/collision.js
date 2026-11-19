import { getMapBoundary, getMapObstacles } from "./world.js";
import { COLISEO_MAP_ID, COLISEO_PLAY_RADIUS } from "./coliseoDefs.js";

export const PLAYER_RADIUS = 0.45;

export function moveWithCollisions(x, z, mapId = "nevado") {
  const limit = getMapBoundary(mapId) - PLAYER_RADIUS;
  let nx = Math.max(-limit, Math.min(limit, x));
  let nz = Math.max(-limit, Math.min(limit, z));

  // El Coliseo es circular: el muro de la arena sustituye al borde cuadrado.
  if (mapId === COLISEO_MAP_ID) {
    const dist = Math.hypot(nx, nz);
    const ring = COLISEO_PLAY_RADIUS - PLAYER_RADIUS;
    if (dist > ring && dist > 0) {
      nx = (nx / dist) * ring;
      nz = (nz / dist) * ring;
    }
  }

  for (const obstacle of getMapObstacles(mapId)) {
    if (obstacle.type === "box") {
      const halfW = obstacle.w / 2 + PLAYER_RADIUS - 0.05;
      const halfD = obstacle.d / 2 + PLAYER_RADIUS - 0.05;
      const inside =
        nx > obstacle.x - halfW &&
        nx < obstacle.x + halfW &&
        nz > obstacle.z - halfD &&
        nz < obstacle.z + halfD;
      if (!inside) continue;

      const pushX = (nx < obstacle.x ? obstacle.x - halfW : obstacle.x + halfW) - nx;
      const pushZ = (nz < obstacle.z ? obstacle.z - halfD : obstacle.z + halfD) - nz;
      if (Math.abs(pushX) < Math.abs(pushZ)) {
        nx += pushX;
      } else {
        nz += pushZ;
      }
    } else if (obstacle.type === "circle") {
      const dx = nx - obstacle.x;
      const dz = nz - obstacle.z;
      const dist = Math.hypot(dx, dz);
      const minDist = obstacle.r + PLAYER_RADIUS - 0.05;
      if (dist >= minDist || dist === 0) continue;
      const push = minDist - dist;
      nx += (dx / dist) * push;
      nz += (dz / dist) * push;
    }
  }

  return { x: nx, z: nz };
}