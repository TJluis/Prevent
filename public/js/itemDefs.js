export const INVENTORY_SLOTS = 5;

export const CRYSTAL_WEAPON_WEIGHT = 60;
export const CRYSTAL_FOOD_WEIGHT = 25;
export const CRYSTAL_THROWABLE_WEIGHT = 15;

export const FOODS = {
  pescado_crudo: {
    id: "pescado_crudo",
    name: "Pescado crudo",
    heal: 15,
    weight: 50,
    emoji: "🐟",
    color: 0x9fdcbf,
  },
  pescado_ahumado: {
    id: "pescado_ahumado",
    name: "Pescado ahumado",
    heal: 35,
    weight: 30,
    emoji: "🐠",
    color: 0x5ecf8f,
  },
  pulpo_vapor: {
    id: "pulpo_vapor",
    name: "Pulpo al vapor",
    heal: 60,
    weight: 15,
    emoji: "🐙",
    color: 0x35b56c,
  },
};

export const THROWABLES = {
  bola_nieve: {
    id: "bola_nieve",
    name: "Bola de nieve",
    damage: 12,
    splash: 1.3,
    speed: 20,
    range: 16,
    slowMs: 2000,
    cooldownMs: 700,
    weight: 40,
    emoji: "❄️",
    color: 0xbfe8ff,
  },
  granada: {
    id: "granada",
    name: "Granada",
    damage: 55,
    splash: 4.5,
    speed: 13,
    range: 20,
    cooldownMs: 900,
    weight: 25,
    emoji: "🧨",
    color: 0xff9e55,
  },
};

export function getFood(id) {
  return FOODS[id] || null;
}

export function getThrowable(id) {
  return THROWABLES[id] || null;
}

export function getLootItem(type, id) {
  if (type === "food") return getFood(id);
  if (type === "throwable") return getThrowable(id);
  return null;
}

export function pickWeighted(defs) {
  const entries = Object.values(defs);
  const total = entries.reduce((sum, def) => sum + def.weight, 0);
  let roll = Math.random() * total;
  for (const def of entries) {
    roll -= def.weight;
    if (roll <= 0) return def.id;
  }
  const last = entries[entries.length - 1];
  return last ? last.id : null;
}

export function rollCrystalType() {
  const roll = Math.random() * 100;
  if (roll < CRYSTAL_THROWABLE_WEIGHT) return "throwable";
  if (roll < CRYSTAL_THROWABLE_WEIGHT + CRYSTAL_FOOD_WEIGHT) return "food";
  return "weapon";
}