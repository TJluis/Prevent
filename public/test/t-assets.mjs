// Verifica los recursos de imagen/identidad del servidor (Fase 6) sin navegador.
// Uso: node public/test/runner.mjs public/test/t-assets.mjs
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const p = (...parts) => path.join(PROJ, ...parts);

const results = [];
function t(name, ok, extra = "") {
  results.push({ name, ok, extra });
  if (!ok) console.log("FAIL: " + name + (extra ? " | " + extra : ""));
  else console.log("ok  : " + name);
}

function read(file) {
  if (!existsSync(file)) throw new Error(`falta ${path.relative(PROJ, file)}`);
  return readFileSync(file);
}

function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error("no es PNG");
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const cardPath = p("public", "assets", "server-card.jpg");
t("server-card.jpg existe y pesa < 300 KB", () => {
  const buf = read(cardPath);
  const kb = statSync(cardPath).size / 1024;
  if (kb >= 300) throw new Error(`${kb.toFixed(1)} KB`);
  if (!(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) throw new Error("no es JPEG");
});

for (const size of [32, 180, 192, 512]) {
  t(`icono ${size}x${size} es PNG de ${size}px`, () => {
    const file = p("public", "assets", "icons", `icon-${size}.png`);
    const dim = pngSize(read(file));
    if (dim.w !== size || dim.h !== size) throw new Error(`mide ${dim.w}x${dim.h}`);
  });
}

const manifestPath = p("public", "manifest.webmanifest");
t("manifest válido y con iconos existentes", () => {
  const m = JSON.parse(read(manifestPath).toString("utf8"));
  if (m.name !== "Club Pingüi") throw new Error(`name: ${m.name}`);
  if (m.display !== "standalone") throw new Error(`display: ${m.display}`);
  if (!Array.isArray(m.icons) || m.icons.length < 2) throw new Error("faltan iconos");
  for (const icon of m.icons) {
    const file = p("public", icon.src.replace(/^\//, ""));
    if (!existsSync(file)) throw new Error(`icono inexistente: ${icon.src}`);
  }
});

const html = read(p("public", "index.html")).toString("utf8");
t("index.html usa banner, iconos y manifest", () => {
  if (!html.includes('id="join-banner"')) throw new Error("sin banner de login");
  if (!html.includes("/assets/server-card.jpg")) throw new Error("sin imagen de tarjeta");
  if (!html.includes('rel="manifest"')) throw new Error("sin manifest");
  if (!html.includes('rel="apple-touch-icon"')) throw new Error("sin apple-touch-icon");
  if (html.includes('href="data:,"')) throw new Error("favicon antiguo todavía presente");
});

t("Open Graph/Twitter con URL absoluta", () => {
  const og = 'content="https://pinguidev.corvet.dpdns.org/assets/server-card.jpg"';
  if (!html.includes(`property="og:image" ${og}`)) throw new Error("og:image ausente o relativa");
  if (!html.includes('property="og:image:width" content="1600"')) throw new Error("sin og:image:width");
  if (!html.includes('property="og:image:height" content="900"')) throw new Error("sin og:image:height");
  if (!html.includes('name="twitter:card" content="summary_large_image"')) throw new Error("sin twitter:card");
  if (!html.includes('name="twitter:image"')) throw new Error("sin twitter:image");
});

t("menú /menu muestra la miniatura", () => {
  const menu = read(p("server", "redirect-server.js")).toString("utf8");
  if (!menu.includes("server-card.jpg")) throw new Error("sin imagen");
  if (!menu.includes("thumb-wrap")) throw new Error("sin contenedor de miniatura");
  if (!menu.includes("thumb-fallback")) throw new Error("sin fallback al emoji");
});

t("solo /assets tiene caché larga", () => {
  const server = read(p("server", "index.js")).toString("utf8");
  if (!/app\.use\(\s*"\/assets"[\s\S]{0,200}maxAge:\s*"7d"/.test(server)) {
    throw new Error("no se encontró la caché de /assets");
  }
});

const total = results.length;
const ok = results.filter((r) => r.ok).length;
console.log(`\nRESULTADO assets: ${ok}/${total} ok`);
if (ok !== total) process.exitCode = 1;
