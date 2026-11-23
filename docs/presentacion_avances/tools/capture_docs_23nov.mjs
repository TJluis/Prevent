// Capturas de los documentos de prácticas para la presentación del 23/11/2026.
// Sirve los HTML por HTTP local (file:// bloquea la navegación CDP en Edge) y
// comprueba que la página tenga contenido antes de capturar.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createReadStream, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, resolve, extname } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const CDP_PORT = 9367;
const WEB_PORT = 9368;
const BASE = `http://127.0.0.1:${CDP_PORT}`;
const PROJ = resolve(import.meta.dirname, "..", "..", "..");
const OUT = join(import.meta.dirname, "..", "img");
const PROFILE = join(process.env.TEMP || "C:\\Windows\\Temp", "cp_pres_docs_23nov");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const MIME = { ".html": "text/html; charset=utf-8", ".pdf": "application/pdf", ".png": "image/png", ".svg": "image/svg+xml" };
const server = createServer((req, res) => {
  const rel = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "");
  const file = join(PROJ, rel || "index.html");
  if (!file.startsWith(PROJ) || !statSync(file, { throwIfNoEntry: false })?.isFile()) {
    res.writeHead(404); res.end("not found"); return;
  }
  res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(WEB_PORT, "127.0.0.1", r));

const browser = spawn(EDGE, [
  "--headless=new", "--no-proxy-server", "--no-first-run", "--no-default-browser-check",
  "--mute-audio", "--hide-scrollbars", "--force-device-scale-factor=1",
  "--user-data-dir=" + PROFILE, "--remote-debugging-port=" + CDP_PORT,
  "--window-size=1600,900", "about:blank",
], { stdio: "ignore" });

let ws, nextId = 0;
const pending = new Map();
const cdp = (method, params) => new Promise((resolveP, reject) => {
  const id = ++nextId; pending.set(id, { resolve: resolveP, reject });
  ws.send(JSON.stringify({ id, method, params: params || {} }));
});
const ev = async (expression) => {
  const r = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r.result?.value;
};
const wait = async (expression, timeout = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await ev(expression) === true) return true;
    await sleep(200);
  }
  return false;
};

async function main() {
  let v = null;
  for (let i = 0; i < 60 && !v; i++) {
    try { v = await (await fetch(BASE + "/json/version")).json(); } catch { await sleep(250); }
  }
  if (!v) throw new Error("sin CDP");
  const target = await (await fetch(BASE + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener("open", res, { once: true }); ws.addEventListener("error", rej, { once: true }); });
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    }
  });
  await cdp("Page.enable");
  await cdp("Runtime.enable");
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 1600, height: 900, deviceScaleFactor: 1, mobile: false,
    screenWidth: 1600, screenHeight: 900,
  });

  const pages = [
    ["docs/Practica_Organizacion_Fases_ClubPingui.html", "41-practica1-fases-23nov.png"],
    ["docs/Practica_4_Seguimiento_Validacion_Objetivos.html", "42-practica4-seguimiento-23nov.png"],
    ["docs/Practica_6_Gestion_Recursos_ClubPingui.html", "43-practica6-recursos-23nov.png"],
    ["docs/arquitectura_club_pingui.svg", "44-arquitectura-23nov.png"],
  ];
  const info = [];
  for (const [rel, name] of pages) {
    const isSvg = rel.endsWith(".svg");
    await cdp("Page.navigate", { url: `http://127.0.0.1:${WEB_PORT}/${rel}` });
    const ready = isSvg
      ? await wait(`document.readyState === 'complete' && !!document.querySelector('svg')`, 20000)
      : await wait(`document.readyState === 'complete' && (document.body?.innerText || '').length > 300`, 20000);
    await sleep(500);
    const textLen = await ev(`(document.body?.innerText || '').length`);
    if (!ready || (!isSvg && textLen < 300)) throw new Error(`página sin contenido: ${rel} (${textLen} chars)`);
    const r = await cdp("Page.captureScreenshot", { format: "png", fromSurface: true });
    const buf = Buffer.from(r.data, "base64");
    const minBytes = isSvg ? 10000 : 40000;
    if (buf.length < minBytes) throw new Error(`captura sospechosa: ${name} (${buf.length} bytes)`);
    writeFileSync(join(OUT, name), buf);
    console.log(`SHOT ${name} · ${textLen} chars · ${Math.round(buf.length / 1024)} KB`);
    info.push({ doc: rel, capture: name, textLen });
  }
  writeFileSync(join(OUT, "capture-docs-23nov-log.json"), JSON.stringify({ ok: true, info }, null, 2));
}

main().catch((e) => { console.error("FAIL", e); process.exitCode = 1; })
  .finally(() => { browser.kill(); server.close(); });
