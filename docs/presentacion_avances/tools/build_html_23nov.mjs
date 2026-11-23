// Compone presentacion_23nov.html reutilizando el CSS, la navegación y el script
// de la presentación del 27/10; solo sustituye el contenido de las diapositivas.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = join(import.meta.dirname, "..");
const original = readFileSync(join(BASE, "presentacion.html"), "utf8");
const slides = readFileSync(join(import.meta.dirname, "slides_23nov.part.html"), "utf8");

const start = original.indexOf('<section class="slide cover active">');
const navStart = original.indexOf('<div class="nav">');
if (start < 0 || navStart < 0) throw new Error("no se encontraron los límites del deck original");
const deckEnd = original.lastIndexOf("</div>", navStart);

const prefix = original.slice(0, start).replace(
  /<title>.*?<\/title>/s,
  "<title>Club Pingüí · Presentación de avances · 23/11/2026</title>",
);
const suffix = original.slice(deckEnd).replace("1 / 18", "1 / 13");
const out = prefix + slides.trimEnd() + "\n" + suffix;
writeFileSync(join(BASE, "presentacion_23nov.html"), out, "utf8");

const count = (out.match(/<section class="slide/g) || []).length;
const imgs = [...out.matchAll(/src="img\/([^"]+)"/g)].map((m) => m[1]);
const missing = [...new Set(imgs)].filter((name) => {
  try { readFileSync(join(BASE, "img", name)); return false; } catch { return true; }
});
console.log(`HTML generado · ${count} diapositivas · ${imgs.length} referencias de imagen · faltantes: ${missing.length ? missing.join(", ") : "ninguna"}`);
if (count !== 13 || missing.length) process.exitCode = 1;
