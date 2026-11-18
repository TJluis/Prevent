import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9363;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = "C:\\xampp\\htdocs\\Proyecto_ClubPingui\\docs\\presentacion_avances\\img";
const PROFILE = join(process.env.TEMP || "C:\\Windows\\Temp", "cp_shot2_profile");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new", "--no-proxy-server", "--no-first-run", "--no-default-browser-check",
  "--mute-audio", "--hide-scrollbars", "--force-device-scale-factor=1",
  "--user-data-dir=" + PROFILE, "--remote-debugging-port=" + PORT,
  "--window-size=1600,900", "about:blank",
], { stdio: "ignore" });

let ws, nextId = 0;
const pending = new Map();
const logs = [];
const cdp = (method, params) => new Promise((resolve, reject) => {
  const id = ++nextId; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params: params || {} }));
});
const ev = async (expression) => {
  const r = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) return { __exc: r.exceptionDetails.text, description: r.exceptionDetails.exception?.description };
  return r.result?.value;
};
const waitFor = async (expression, timeout = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { if (await ev(expression) === true) return true; await sleep(200); }
  return false;
};
async function shot(name) {
  const r = await cdp("Page.captureScreenshot", { format: "png", fromSurface: true });
  writeFileSync(join(OUT, name), Buffer.from(r.data, "base64"));
  console.log("SHOT " + name);
}
async function hidePanels() {
  await ev(`(() => {
    document.querySelectorAll('.social-page').forEach(p => p.classList.remove('active'));
    const tabs = document.getElementById('social-tabs'); if (tabs) tabs.style.display = 'none';
    document.body.classList.remove('menu-open', 'sheet-rooms', 'chat-open');
    return 1;
  })()`);
}
async function closeInfo() {
  await ev(`(() => { const m=document.getElementById('info-modal'); if (m && !m.hidden) document.getElementById('info-close').click(); return 1; })()`);
}
async function enter(name) {
  await ev(`(() => { const n=document.getElementById('name-input'); n.value=${JSON.stringify(name)}; document.getElementById('join-form').requestSubmit(); return 1; })()`);
  await waitFor(`document.getElementById('dress-screen').hidden === false`, 10000);
  await ev(`document.getElementById('dress-play-btn').click()`);
  await waitFor(`window.__test && window.__test.myId`, 60000);
  await sleep(1500);
  await closeInfo();
}
async function createRoom(name, mapId) {
  await ev(`(() => {
    const sel=document.getElementById('room-map-select'); if (sel) sel.value=${JSON.stringify(mapId)};
    document.getElementById('room-name-input').value=${JSON.stringify(name)};
    document.getElementById('room-create-form').requestSubmit(); return 1;
  })()`);
  const ok = await waitFor(`document.body.classList.contains('in-room')`, 20000);
  await sleep(5000);
  await closeInfo();
  await hidePanels();
  return ok;
}
async function leaveRoom() {
  await ev(`(() => { const b=document.getElementById('room-leave-btn'); if (b && !b.hidden) b.click(); return 1; })()`);
  await waitFor(`!document.body.classList.contains('in-room')`, 10000);
  await sleep(800);
}

async function main() {
  let v = null;
  for (let i = 0; i < 50 && !v; i++) { try { v = await (await fetch(BASE + "/json/version")).json(); } catch { await sleep(250); } }
  if (!v) throw new Error("sin CDP");
  const target = await (await fetch(BASE + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener("open", res, { once: true }); ws.addEventListener("error", rej, { once: true }); });
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); return; }
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") logs.push("CONSOLE " + (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 220));
    if (m.method === "Runtime.exceptionThrown") logs.push("EXC " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || "").slice(0, 220));
  });
  await cdp("Page.enable"); await cdp("Runtime.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 900 });

  await cdp("Page.navigate", { url: "http://localhost:3000/" });
  await waitFor(`document.getElementById('room-map-select') && document.getElementById('room-map-select').options.length > 1`, 20000);
  await enter("Luis Tovar");
  await sleep(1500);
  await hidePanels();
  await shot("11-lobby-nevado.png");

  console.log("pradera:", await createRoom("PRADERA", "pradera"));
  await ev(`window.__test.combat.setWeapon('assault')`);
  await sleep(1500);
  await shot("12-pradera-tercera.png");

  await ev(`document.getElementById('fp-toggle').click()`);
  await sleep(1500);
  await shot("13-pradera-primera.png");

  await ev(`document.getElementById('t-inv').click()`);
  await sleep(700);
  await shot("14-pradera-inventario.png");
  await ev(`document.getElementById('t-inv').click()`);

  await leaveRoom();
  console.log("selva:", await createRoom("SELVA", "selva"));
  await ev(`window.__test.combat.setWeapon('shotgun')`);
  await sleep(1500);
  await shot("15-selva-tercera.png");

  // Mobile pass on pradera
  await cdp("Emulation.setDeviceMetricsOverride", { width: 844, height: 390, deviceScaleFactor: 2, mobile: true, screenWidth: 844, screenHeight: 390 });
  await cdp("Page.addScriptToEvaluateOnNewDocument", { source: "window.__forceTouch = true;" });
  await cdp("Page.navigate", { url: "http://localhost:3000/" });
  await waitFor(`document.getElementById('room-map-select') && document.getElementById('room-map-select').options.length > 1`, 20000);
  await enter("Luis Tovar");
  console.log("movil pradera:", await createRoom("MOVIL", "pradera"));
  await ev(`window.__test.combat.setWeapon('shotgun')`);
  await sleep(1500);
  await shot("16-movil-pradera.png");
  await ev(`document.getElementById('t-inv').click()`);
  await sleep(700);
  await shot("17-movil-inventario.png");

  // Tuner, zoomed and static
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 900 });
  await cdp("Page.navigate", { url: "http://localhost:3000/debug/weapontune.html" });
  await waitFor(`!!window.__tuner`, 20000);
  await ev(`(() => { const s=document.getElementById('weapon'); s.value='sniper'; s.dispatchEvent(new Event('change',{bubbles:true})); return 1; })()`);
  await sleep(1200);
  await ev(`(() => {
    document.getElementById('autoRotate').checked = false;
    const st = document.getElementById('stage');
    for (let i=0;i<7;i++) st.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,bubbles:true,cancelable:true}));
    return window.__tuner.state();
  })()`);
  await sleep(1200);
  await shot("18-tuner-sniper.png");
  console.log("tuner state:", JSON.stringify(await ev("window.__tuner.state()")));

  writeFileSync(join(OUT, "capture2-log.json"), JSON.stringify({ logs: [...new Set(logs)] }, null, 2), "utf8");
  console.log("DONE logs=" + JSON.stringify([...new Set(logs)]));
  process.exit(0);
}
main().catch((e) => { console.error("FATAL " + (e.stack || e)); process.exit(1); });
