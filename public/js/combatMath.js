import { getWeapon } from "./weaponDefs.js";

// Matemáticas compartidas de combate (servidor y cliente). Sin dependencias de
// Three.js ni del DOM: se pueden probar con Node puro (t-combate.mjs).

export const BLOCK_STAMINA_MAX = 100;

// Configuración de bloqueo del arma (solo el escudo la tiene) o null.
export function getBlockConfig(weaponId) {
  if (!weaponId) return null;
  const weapon = getWeapon(weaponId);
  return (weapon && weapon.block) || null;
}

// Vector frontal del jugador a partir de su yaw. La cámara (1.ª y 3.ª persona)
// mira hacia -Z local, así que el frente es (-sin(yaw), -cos(yaw)); es la misma
// convención que usa main.js en getOwnAim.
export function facingVector(yaw) {
  return { x: -Math.sin(yaw || 0), z: -Math.cos(yaw || 0) };
}

// Coseno mínimo del arco frontal: 2,4 rad => mitad 1,2 rad.
export function blockArcCos(cfg) {
  const arc = Math.min(Math.PI, (cfg && cfg.arc) || 2.4);
  return Math.cos(arc / 2);
}

// ¿El atacante está dentro del arco frontal del escudo?
export function isInBlockArc(target, shooter, cfg) {
  const dx = shooter.x - target.x;
  const dz = shooter.z - target.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-4) return false;
  const facing = facingVector(target.yaw);
  const dot = (dx / dist) * facing.x + (dz / dist) * facing.z;
  return dot >= blockArcCos(cfg);
}

// Daño que realmente entra al objetivo.
// Devuelve { blocked, damage } donde blocked=true implica daño 0 (bloqueo total).
export function computeBlockedDamage(target, shooter, damage, now = Date.now()) {
  const cfg = getBlockConfig(target && target.weaponId);
  if (!cfg) return { blocked: false, damage };
  if (!target.blocking) return { blocked: false, damage };
  if (!(target.blockStamina > 0)) return { blocked: false, damage };
  if (target.blockBrokenUntil && now < target.blockBrokenUntil) {
    return { blocked: false, damage };
  }
  if (!isInBlockArc(target, shooter, cfg)) return { blocked: false, damage };
  const reduction = typeof cfg.reduction === "number" ? cfg.reduction : 1;
  return { blocked: reduction >= 1, damage: damage * (1 - reduction) };
}
