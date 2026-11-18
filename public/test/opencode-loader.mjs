import path from "node:path";
import { fileURLToPath } from "node:url";

// Raíz del proyecto calculada desde la ubicación de este loader
// (public/test/opencode-loader.mjs -> raíz del proyecto).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const THREE_BUILD = path.join(ROOT, "node_modules", "three", "build", "three.module.js");
const ROOT_PREFIX = path.normalize(ROOT + path.sep).toLowerCase();

const toFileUrl = (abs) => "file:///" + abs.split(path.sep).join("/");

function mapUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "file:") return null;
  const file = fileURLToPath(u);
  const local = path.normalize(file).toLowerCase();
  if (!local.startsWith(ROOT_PREFIX)) return null;
  const rel = decodeURIComponent(path.relative(ROOT, file)).split(path.sep).join("/");
  if (rel === "vendor/three/three.module.js") {
    return toFileUrl(THREE_BUILD) + u.search + u.hash;
  }
  return null;
}

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("/vendor/")) {
    return { url: toFileUrl(THREE_BUILD), shortCircuit: true };
  }
  const mapped = mapUrl(specifier);
  if (mapped) return { url: mapped, shortCircuit: true };
  return nextResolve(specifier, context);
}

export function getFormat(url, context, nextGetFormat) {
  let mapped = mapUrl(url);
  if (mapped) return { format: "module" };
  return nextGetFormat(url, context);
}

export function load(url, context, nextLoad) {
  const mapped = mapUrl(url);
  if (mapped) return nextLoad(mapped, context);
  return nextLoad(url, context);
}
