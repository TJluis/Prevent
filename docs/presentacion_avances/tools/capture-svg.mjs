import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9366;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = "C:\\xampp\\htdocs\\Proyecto_ClubPingui\\docs\\presentacion_avances\\img";
const PROFILE = join(process.env.TEMP || "C:\\Windows\\Temp", "cp_svg_capture");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  "--headless=new", "--no-proxy-server", "--no-first-run", "--no-default-browser-check",
  "--mute-audio", "--hide-scrollbars", "--user-data-dir=" + PROFILE,
  "--remote-debugging-port=" + PORT, "--window-size=1280,720", "about:blank",
], { stdio: "ignore" });

let ws, nextId = 0;
const pending = new Map();
const cdp = (method, params) => new Promise((resolve, reject) => {
  const id = ++nextId; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params: params || {} }));
});
const ev = async (script) => {
  const r = await cdp("Runtime.evaluate", { expression: script, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result?.value;
};
const waitFor = async (expr, t = 30000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < t) { if (await ev(expr) === true) return true; await sleep(250); }
  return false;
};

async function captureSlide(index, svgName, outName) {
  await cdp("Page.navigate", { url: `http://127.0.0.1:8099/presentacion.html#${index + 1}` });
  await waitFor("document.readyState === 'complete'");
  await sleep(1200);
  await ev(`(() => {
    document.documentElement.style.setProperty('--scale', '1');
    const slides = [...document.querySelectorAll('.slide')];
    slides.forEach((s, i) => s.classList.toggle('active', i === ${index}));
    document.body.style.background = '#060b14';
    void document.body.offsetHeight;
    return 1;
  })()`);
  await sleep(500);
  const rect = await ev(`(() => {
    const s = document.querySelectorAll('.slide')[${index}];
    const el = s.querySelector('svg.${svgName}');
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  })()`);
  const shot = await cdp("Page.captureScreenshot", {
    format: "png", fromSurface: true, captureBeyondViewport: true,
    clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 },
  });
  writeFileSync(join(OUT, outName), Buffer.from(shot.data, "base64"));
  console.log(`SHOT ${outName} ${JSON.stringify(rect)}`);
}

async function main() {
  let v = null;
  for (let i = 0; i < 60 && !v; i++) { try { v = await (await fetch(BASE + "/json/version")).json(); } catch { await sleep(250); } }
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
  await cdp("Page.enable"); await cdp("Runtime.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 2, mobile: false, screenWidth: 1280, screenHeight: 720 });

  await captureSlide(14, "svgs", "30-gantt.png");
  await captureSlide(15, "svgs", "31-pert.png");
  console.log("OK");
  process.exit(0);
}
main().catch((e) => { console.error("FATAL " + (e.stack || e)); process.exit(1); });
