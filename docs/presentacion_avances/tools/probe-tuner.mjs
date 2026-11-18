import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9362;
const BASE = `http://127.0.0.1:${PORT}`;
const PROFILE = join(process.env.TEMP || "C:\\Windows\\Temp", "cp_probe_tuner");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const chrome = spawn(CHROME, ["--headless=new", "--no-proxy-server", "--no-first-run", "--no-default-browser-check", "--mute-audio", "--hide-scrollbars", "--force-device-scale-factor=1", "--user-data-dir=" + PROFILE, "--remote-debugging-port=" + PORT, "--window-size=1600,900", "about:blank"], { stdio: "ignore" });
let ws, nextId = 0; const pending = new Map(); const logs = [];
const cdp = (method, params) => new Promise((res, rej) => { const id = ++nextId; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params: params || {} })); });
const ev = async (expression) => { const r = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); return r.exceptionDetails ? { exc: r.exceptionDetails.exception?.description || r.exceptionDetails.text } : r.result?.value; };
const waitFor = async (expr, t = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (await ev(expr) === true) return true; await sleep(250); } return false; };
async function main() {
  let v = null; for (let i = 0; i < 50 && !v; i++) { try { v = await (await fetch(BASE + "/json/version")).json(); } catch { await sleep(250); } }
  const target = await (await fetch(BASE + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener("open", res, { once: true }); ws.addEventListener("error", rej, { once: true }); });
  ws.addEventListener("message", e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); return; }
    if (m.method === "Runtime.consoleAPICalled") logs.push("LOG " + (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 300));
    if (m.method === "Runtime.exceptionThrown") logs.push("EXC " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || "").slice(0, 300));
  });
  await cdp("Page.enable"); await cdp("Runtime.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 900 });
  await cdp("Page.navigate", { url: "http://localhost:3000/debug/weapontune.html" });
  await waitFor("!!window.__tuner", 20000);
  await sleep(3000);
  const probe = await ev(`(() => {
    const c = document.querySelector('#stage canvas');
    const stage = document.getElementById('stage');
    const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
    return {
      tuner: !!window.__tuner,
      state: window.__tuner && window.__tuner.state(),
      canvas: c ? { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight, rect: c.getBoundingClientRect().toJSON() } : null,
      stage: { cw: stage.clientWidth, ch: stage.clientHeight, rect: stage.getBoundingClientRect().toJSON() },
      gl: gl ? { ok: true, renderer: gl.getParameter(gl.RENDERER), vendor: gl.getParameter(gl.VENDOR) } : { ok: false },
      diag: document.getElementById('diag').textContent,
      out: document.getElementById('out').value.slice(0, 200),
      weapon: document.getElementById('weapon').value,
      parts: document.getElementById('parts').children.length
    };
  })()`);
  const shot = await cdp("Page.captureScreenshot", { format: "png", fromSurface: true });
  writeFileSync(join(process.env.TEMP, "opencode", "tuner-probe.png"), Buffer.from(shot.data, "base64"));
  writeFileSync(join(process.env.TEMP, "opencode", "tuner-probe.json"), JSON.stringify({ probe, logs }, null, 2));
  console.log(JSON.stringify({ probe, logs }, null, 2));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
