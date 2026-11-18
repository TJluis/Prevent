const BODY_COLORS = [
  "#222b3f", "#3a4b8f", "#c0392b", "#2e8b57", "#8e44ad",
  "#d35400", "#1f6f8b", "#c2185b", "#5d4037", "#607d8b",
];

const BELLY_COLORS = [
  "#f4f8fc", "#ffe9c9", "#ccf2ff", "#ffd9e6", "#d9f5e0",
  "#fff2a8", "#e6d6f9",
];

const BEAK_COLORS = ["#ff9f1c", "#f4c430", "#ff6b35", "#e8862e", "#ffd166", "#f472b6"];

const HAT_IDS = ["santa", "tophat", "beanie"];
const SCARF_COLORS = [null, "#e83d54", "#3f7fe0", "#2ec98f", "#f2c94c", "#9a5bb8", "#f472b6"];
const GLASSES_IDS = ["round", "aviator", "wayfarer"];
const SKIN_IDS = [
  "tuxedo", "beach", "developer", "simple", "tactical",
  "volleyball", "strawhat", "pirate", "ninja", "party",
  "hielo", "galaxia", "futbol",
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

export function normalizeAppearance(input) {
  const base = { ...DEFAULT_APPEARANCE };
  if (!input || typeof input !== "object") return base;

  base.body = inList(input.body, BODY_COLORS, DEFAULT_APPEARANCE.body);
  base.belly = inList(input.belly, BELLY_COLORS, DEFAULT_APPEARANCE.belly);
  base.beak = inList(input.beak, BEAK_COLORS, DEFAULT_APPEARANCE.beak);
  base.hat = HAT_IDS.includes(input.hat) ? input.hat : null;
  base.scarf = SCARF_COLORS.includes(input.scarf) ? input.scarf : null;
  base.glasses = GLASSES_IDS.includes(input.glasses) ? input.glasses : null;
  base.skin = SKIN_IDS.includes(input.skin) ? input.skin : null;

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

function inList(value, list, fallback) {
  return typeof value === "string" && list.includes(value) ? value : fallback;
}