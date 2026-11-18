import { SKIN_IDS, SKIN_DEFS } from "./skinDefs.js";

export const BODY_COLORS = [
  "#222b3f", "#3a4b8f", "#c0392b", "#2e8b57", "#8e44ad",
  "#d35400", "#1f6f8b", "#c2185b", "#5d4037", "#607d8b",
];

export const BELLY_COLORS = [
  "#f4f8fc", "#ffe9c9", "#ccf2ff", "#ffd9e6", "#d9f5e0",
  "#fff2a8", "#e6d6f9",
];

export const BEAK_COLORS = [
  "#ff9f1c", "#f4c430", "#ff6b35", "#e8862e", "#ffd166", "#f472b6",
];

export const HATS = [
  { id: null, label: "Ninguno" },
  { id: "santa", label: "Santa" },
  { id: "tophat", label: "De copa" },
  { id: "beanie", label: "Gorro" },
];

export const SCARF_COLORS = [
  null, "#e83d54", "#3f7fe0", "#2ec98f", "#f2c94c", "#9a5bb8", "#f472b6",
];

export const GLASSES = [
  { id: null, label: "Ninguno" },
  { id: "round", label: "Redondos" },
  { id: "aviator", label: "Aviador" },
  { id: "wayfarer", label: "Clásicos" },
];

export const SKINS = [
  { id: null, label: "Clásico" },
  ...SKIN_IDS.map((id) => ({ id, label: SKIN_DEFS[id].label })),
];

export const DEFAULT_APPEARANCE = {
  body: "#222b3f",
  belly: "#f4f8fc",
  beak: "#ff9f1c",
  hat: null,
  scarf: null,
  glasses: null,
  skin: null,
  number: null,
  jerseyName: "",
};

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function randomAppearance() {
  return {
    body: pickRandom(BODY_COLORS),
    belly: pickRandom(BELLY_COLORS),
    beak: pickRandom(BEAK_COLORS),
    hat: Math.random() < 0.35 ? pickRandom(HATS.filter((h) => h.id !== null)).id : null,
    scarf: Math.random() < 0.35 ? pickRandom(SCARF_COLORS.filter((s) => s !== null)) : null,
    glasses: Math.random() < 0.25 ? pickRandom(GLASSES.filter((g) => g.id !== null)).id : null,
    skin: Math.random() < 0.4 ? pickRandom(SKINS.filter((s) => s.id !== null)).id : null,
    number: String(Math.floor(Math.random() * 100)),
    jerseyName: "",
  };
}

export function normalizeAppearance(input) {
  const base = { ...DEFAULT_APPEARANCE };
  if (!input || typeof input !== "object") return base;

  base.body = pickColor(input.body, BODY_COLORS, DEFAULT_APPEARANCE.body);
  base.belly = pickColor(input.belly, BELLY_COLORS, DEFAULT_APPEARANCE.belly);
  base.beak = pickColor(input.beak, BEAK_COLORS, DEFAULT_APPEARANCE.beak);

  base.hat = HATS.some((h) => h.id === input.hat) ? input.hat : DEFAULT_APPEARANCE.hat;
  base.scarf = SCARF_COLORS.includes(input.scarf) ? input.scarf : DEFAULT_APPEARANCE.scarf;
  base.glasses = GLASSES.some((g) => g.id === input.glasses)
    ? input.glasses
    : DEFAULT_APPEARANCE.glasses;
  base.skin = SKINS.some((s) => s.id === input.skin) ? input.skin : DEFAULT_APPEARANCE.skin;

  const num = Number(input.number);
  base.number =
    (typeof input.number === "string" || typeof input.number === "number") &&
    String(input.number).trim() !== "" &&
    Number.isInteger(num) &&
    num >= 0 &&
    num <= 99
      ? String(num)
      : DEFAULT_APPEARANCE.number;
  base.jerseyName =
    typeof input.jerseyName === "string"
      ? input.jerseyName.replace(/\s+/g, " ").trim().slice(0, 12)
      : DEFAULT_APPEARANCE.jerseyName;

  return base;
}

function pickColor(value, palette, fallback) {
  return typeof value === "string" && palette.includes(value) ? value : fallback;
}