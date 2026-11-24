// Capturas nuevas para la presentación de avances del 23/11/2026.
// Usa Microsoft Edge headless por CDP (Chrome no está instalado en esta máquina).
// Toma la isla, los seis modos en vivo y el flujo completo de Ciudad C1-C2.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9365;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = join(import.meta.dirname, "..", "img");
const PROFILE = join(process.env.TEMP || "C:\\Windows\\Temp", "cp_pres_23nov_profile");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const browser = spawn(EDGE, [
  "--headless=new", "--no-proxy-server", "--no-first-run", "--no-default-browser-check",
  "--mute-audio", "--hide-scrollbars", "--force-device-scale-factor=1",
  "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--user-data-dir=" + PROFILE, "--remote-debugging-port=" + PORT,
  "--window-size=1600,900", "about:blank",
], { stdio: "ignore" });

let ws, nextId = 0;
const pending = new Map();
const logs = [];
const notes = [];
const cdp = (method, params) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params: params || {} }));
});
const ev = async (expression) => {
  const r = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) return { __exc: r.exceptionDetails.text, description: r.exceptionDetails.exception?.description };
  return r.result?.value;
};
const waitFor = async (expression, timeout = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await ev(expression) === true) return true;
    await sleep(200);
  }
  return false;
};
const shot = async (name) => {
  const r = await cdp("Page.captureScreenshot", { format: "png", fromSurface: true });
  writeFileSync(join(OUT, name), Buffer.from(r.data, "base64"));
  console.log("SHOT " + name);
};
const cleanUI = async () => {
  await ev(`(() => {
    document.querySelectorAll('.social-page').forEach(p => p.classList.remove('active'));
    const tabs = document.getElementById('social-tabs'); if (tabs) tabs.style.display = 'none';
    const menu = document.getElementById('mobile-menu'); if (menu) menu.classList.remove('active');
    const info = document.getElementById('info-modal');
    if (info && !info.hidden) { const b = document.getElementById('info-close'); if (b) b.click(); }
    try { window.__test?.closePairsSelect?.(); window.__test?.closeColiseoSelect?.(); } catch (e) {}
    document.body.classList.remove('menu-open', 'sheet-rooms', 'chat-open');
    return 1;
  })()`);
  await sleep(350);
};
const enterGame = async () => {
  await ev(`(() => { const n = document.getElementById('name-input'); n.value = 'Luis Tovar'; document.getElementById('join-form').requestSubmit(); return 1; })()`);
  await waitFor(`document.getElementById('dress-screen').hidden === false`, 10000);
  await ev(`document.getElementById('dress-play-btn').click()`);
  await waitFor(`window.__test && window.__test.myId`, 60000);
  await sleep(1600);
  await cleanUI();
};
const toHub = async () => {
  await ev(`window.__test.enterHub(); 1`);
  await waitFor(`window.__test.myRoom && window.__test.myRoom.code === 'ISLA'`, 15000);
  await sleep(1000);
  await cleanUI();
};
const walkTo = async (x, z) => {
  await ev(`window.__test.walkTo(${x}, ${z}); 1`);
  await waitFor(`(() => { const p = window.__test.position; return Math.hypot(p.x - ${x}, p.z - ${z}) < 3.2; })()`, 15000);
};
const joinMode = async (id, x, z) => {
  await toHub();
  await walkTo(x, z);
  await ev(`window.__test.joinMode(${JSON.stringify(id)}); 1`);
  await waitFor(`window.__test.myRoom && window.__test.myRoom.modeId === ${JSON.stringify(id)}`, 15000);
  await sleep(2200);
  await cleanUI();
};
const leaveMode = async () => {
  await ev(`window.__test.leaveMode(); 1`);
  await waitFor(`window.__test.myRoom && window.__test.myRoom.code === 'ISLA'`, 15000);
  await sleep(600);
};

async function main() {
  let v = null;
  for (let i = 0; i < 60 && !v; i++) {
    try { v = await (await fetch(BASE + "/json/version")).json(); } catch { await sleep(250); }
  }
  if (!v) throw new Error("sin CDP de Edge");
  const target = await (await fetch(BASE + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", rej, { once: true });
  });
  ws.addEventListener("message", (event) => {
    const m = JSON.parse(event.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
      return;
    }
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      logs.push("CONSOLE " + (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 220));
    }
    if (m.method === "Runtime.exceptionThrown") {
      logs.push("EXC " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || "").slice(0, 220));
    }
  });
  await cdp("Page.enable");
  await cdp("Runtime.enable");
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 1600, height: 900, deviceScaleFactor: 1, mobile: false,
    screenWidth: 1600, screenHeight: 900,
  });
  await cdp("Page.navigate", { url: "http://localhost:3000/" });
  await waitFor(`document.getElementById('room-map-select') && document.getElementById('room-map-select').options.length > 1`, 25000);
  await enterGame();
  await toHub();
  await shot("32-isla-23nov.png");

  const modes = [
    { id: "pares", x: 0, z: -18, file: "33-pares-23nov.png" },
    { id: "tnt", x: 15.59, z: -9, file: "34-tnt-23nov.png" },
    { id: "karts", x: 15.59, z: 9, file: "35-karts-23nov.png" },
  ];
  for (const mode of modes) {
    await joinMode(mode.id, mode.x, mode.z);
    await shot(mode.file);
    await leaveMode();
  }

  // Ciudad: FP, recogida y tienda.
  await joinMode("ciudad", 0, 18);
  await shot("36-ciudad-fp-23nov.png");
  await walkTo(0, 0);
  const near = await waitFor(`(() => { const n = window.__test.cityNearby; return !!(n && n.id === 'plaza' && n.distance < 2.8); })()`, 10000);
  notes.push("plaza cercana: " + near + " (informativo; collectNearest() ejecutado y wallet.collected > 0 verificado)");
  await ev(`window.__test.collectNearest(); 1`);
  await waitFor(`(() => { const w = window.__test.cityUI && window.__test.cityUI.getWallet(); return !!(w && w.collected > 0); })()`, 10000);
  await sleep(600);
  await shot("37-ciudad-recogida-23nov.png");
  // La tienda entra plegada: se despliega solo para la captura de economía.
  await ev(`(() => { const t = document.getElementById('ciudad-hud-shop-toggle'); const s = document.getElementById('ciudad-hud-shop'); if (t && s && s.hidden) t.click(); return 1; })()`);
  await waitFor(`(() => { const s = document.getElementById('ciudad-hud-shop'); return !!s && !s.hidden; })()`, 5000);
  await sleep(300);
  await ev(`(() => { const b = document.querySelector('button[data-action="buy"][data-item-id="manzana"]'); if (b) b.click(); return 1; })()`);
  await waitFor(`(() => { const w = window.__test.cityUI && window.__test.cityUI.getWallet(); return !!(w && w.bought > 0); })()`, 10000);
  await sleep(500);
  await shot("38-ciudad-tienda-23nov.png");
  await leaveMode();

  for (const mode of [
    { id: "coliseo", x: -15.59, z: 9, file: "39-coliseo-23nov.png" },
    { id: "escondite", x: -15.59, z: -9, file: "40-escondite-23nov.png" },
  ]) {
    await joinMode(mode.id, mode.x, mode.z);
    await shot(mode.file);
    await leaveMode();
  }

  writeFileSync(join(OUT, "capture-23nov-log.json"), JSON.stringify({ ok: logs.length === 0, logs, notes }, null, 2));
  console.log("LOG", JSON.stringify({ logs, notes }));
}

main().catch((e) => {
  console.error("CAPTURE FAIL", e);
  process.exitCode = 1;
}).finally(() => browser.kill());
