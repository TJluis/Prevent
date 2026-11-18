import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9361;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = "C:\\xampp\\htdocs\\Proyecto_ClubPingui\\docs\\presentacion_avances\\img";
const PROFILE = join(process.env.TEMP || "C:\\Windows\\Temp", "cp_shot_profile");
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
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params: params || {} }));
});
const evaluate = async (expression) => {
  const res = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (res.exceptionDetails) return { __exc: res.exceptionDetails.text, description: res.exceptionDetails.exception?.description };
  return res.result?.value;
};
const waitFor = async (expression, timeout = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await evaluate(expression) === true) return true;
    await sleep(200);
  }
  return false;
};
async function shot(name, extra = {}) {
  const res = await cdp("Page.captureScreenshot", { format: "png", fromSurface: true, ...extra });
  writeFileSync(join(OUT, name), Buffer.from(res.data, "base64"));
  console.log("SHOT " + name);
}
async function hidePanels() {
  await evaluate(`(() => {
    document.querySelectorAll('.social-page').forEach(p => p.classList.remove('active'));
    const tabs = document.getElementById('social-tabs'); if (tabs) tabs.style.display = 'none';
    const menu = document.getElementById('mobile-menu'); if (menu) menu.classList.remove('active');
    document.body.classList.remove('menu-open', 'sheet-rooms', 'chat-open');
    return 1;
  })()`);
}
async function closeInfo() {
  await evaluate(`(() => { const m=document.getElementById('info-modal'); if (m && !m.hidden) { document.getElementById('info-close').click(); return 1; } return 0; })()`);
}
async function createRoom(name, mapId) {
  await evaluate(`(() => {
    const sel = document.getElementById('room-map-select');
    if (sel) sel.value = ${JSON.stringify(mapId)};
    const n = document.getElementById('room-name-input');
    n.value = ${JSON.stringify(name)};
    document.getElementById('room-create-form').requestSubmit();
    return 1;
  })()`);
  return waitFor(`document.body.classList.contains('in-room')`, 20000);
}
async function leaveRoom() {
  await evaluate(`(() => { const b=document.getElementById('room-leave-btn'); if (b && !b.hidden) b.click(); return 1; })()`);
  await waitFor(`!document.body.classList.contains('in-room')`, 10000);
}

async function main() {
  let version = null;
  for (let i = 0; i < 50 && !version; i++) {
    try { version = await (await fetch(BASE + "/json/version")).json(); } catch { await sleep(250); }
  }
  if (!version) throw new Error("sin CDP");
  const target = await (await fetch(BASE + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener("open", res, { once: true }); ws.addEventListener("error", rej, { once: true }); });
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message)); else p.resolve(msg.result);
      return;
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      logs.push((msg.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 200));
    }
    if (msg.method === "Runtime.exceptionThrown") {
      logs.push("EXC " + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text || "").slice(0, 200));
    }
  });
  await cdp("Page.enable"); await cdp("Runtime.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 900 });

  // 1. Landing
  await cdp("Page.navigate", { url: "http://localhost:3000/" });
  await waitFor(`document.getElementById('room-map-select') && document.getElementById('room-map-select').options.length > 1`, 20000);
  await sleep(900);
  await shot("01-lobby.png");

  // 2. Join + dressing room
  await evaluate(`(() => { const n=document.getElementById('name-input'); n.value='Luis Tovar'; document.getElementById('join-form').requestSubmit(); return 1; })()`);
  await waitFor(`document.getElementById('dress-screen').hidden === false`, 10000);
  await sleep(1200);
  await shot("02-vestidor.png");
  await evaluate(`document.getElementById('dress-play-btn').click()`);
  await waitFor(`window.__test && window.__test.myId`, 60000);
  await sleep(1800);
  await closeInfo();
  await sleep(1200);
  await hidePanels();
  await sleep(300);
  await shot("03-lobby-mundo.png");

  // 3. Room Ciudad Neón (third person, weapon)
  console.log("room ciudad:", await createRoom("SALA152", "ciudad"));
  await sleep(4500);
  await closeInfo();
  await hidePanels();
  await evaluate(`window.__test.combat.setWeapon('assault')`);
  await sleep(1200);
  await shot("04-sala-ciudad.png");

  // 4. First person with viewmodel
  await evaluate(`document.getElementById('fp-toggle').click()`);
  await sleep(1500);
  await shot("05-primera-persona.png");

  // 5. Inventory
  await evaluate(`document.getElementById('t-inv').click()`);
  await sleep(700);
  await shot("06-inventario.png");
  await evaluate(`document.getElementById('t-inv').click()`);

  // 6. Cordillera map
  await leaveRoom();
  console.log("room cordillera:", await createRoom("CORDILLERA", "cordillera"));
  await sleep(6000);
  await hidePanels();
  await evaluate(`window.__test.combat.setWeapon('sniper')`);
  await sleep(1200);
  await shot("07-cordillera.png");

  // 7. Mobile HUD (touch)
  await cdp("Emulation.setDeviceMetricsOverride", { width: 844, height: 390, deviceScaleFactor: 2, mobile: true, screenWidth: 844, screenHeight: 390 });
  await cdp("Page.addScriptToEvaluateOnNewDocument", { source: "window.__forceTouch = true;" });
  await cdp("Page.navigate", { url: "http://localhost:3000/" });
  await waitFor(`document.getElementById('room-map-select') && document.getElementById('room-map-select').options.length > 1`, 20000);
  await evaluate(`(() => { const n=document.getElementById('name-input'); n.value='Luis Tovar'; document.getElementById('join-form').requestSubmit(); return 1; })()`);
  await waitFor(`document.getElementById('dress-screen').hidden === false`, 10000);
  await evaluate(`document.getElementById('dress-play-btn').click()`);
  await waitFor(`window.__test && window.__test.myId`, 60000);
  await sleep(1500);
  await closeInfo();
  console.log("room movil:", await createRoom("MOVIL", "gruta"));
  await sleep(4000);
  await closeInfo();
  await evaluate(`(() => { document.body.classList.remove('sheet-rooms','menu-open','chat-open'); return 1; })()`);
  await evaluate(`window.__test.combat.setWeapon('shotgun')`);
  await sleep(1000);
  await shot("08-movil-hud.png");
  await evaluate(`document.getElementById('t-inv').click()`);
  await sleep(600);
  await shot("09-movil-inventario.png");

  // 8. Tuner de armas (desktop)
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 900 });
  await cdp("Page.navigate", { url: "http://localhost:3000/debug/weapontune.html" });
  await waitFor(`document.getElementById('weapon') && document.getElementById('weapon').options.length > 1`, 20000);
  await evaluate(`(() => { const s=document.getElementById('weapon'); s.value='sniper'; s.dispatchEvent(new Event('change',{bubbles:true})); return 1; })()`);
  await sleep(2200);
  await shot("10-tuner-armas.png");

  const out = { ok: true, logs: [...new Set(logs)].slice(0, 20) };
  writeFileSync(join(OUT, "capture-log.json"), JSON.stringify(out, null, 2), "utf8");
  console.log("DONE " + JSON.stringify(out));
  process.exit(0);
}
main().catch((err) => { console.error("FATAL " + (err.stack || err)); process.exit(1); });
