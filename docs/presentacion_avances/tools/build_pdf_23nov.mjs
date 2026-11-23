// Genera presentacion_23nov.pdf desde el HTML con Edge headless (CSS @page 13.333x7.5 in).
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9369;
const BASE = `http://127.0.0.1:${PORT}`;
const BASE_DIR = join(import.meta.dirname, "..");
const HTML = join(BASE_DIR, "presentacion_23nov.html");
const OUT = join(BASE_DIR, "presentacion_23nov.pdf");
const PROFILE = join(process.env.TEMP || "C:\\Windows\\Temp", "cp_pres_pdf_23nov");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = spawn(EDGE, [
  "--headless=new", "--no-proxy-server", "--no-first-run", "--no-default-browser-check",
  "--mute-audio", "--hide-scrollbars", "--force-device-scale-factor=1",
  "--user-data-dir=" + PROFILE, "--remote-debugging-port=" + PORT,
  "--window-size=1600,900", "about:blank",
], { stdio: "ignore" });

let ws, nextId = 0;
const pending = new Map();
const cdp = (method, params) => new Promise((resolve, reject) => {
  const id = ++nextId; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params: params || {} }));
});

async function main() {
  let v = null;
  for (let i = 0; i < 60 && !v; i++) {
    try { v = await (await fetch(BASE + "/json/version")).json(); } catch { await sleep(250); }
  }
  if (!v) throw new Error("sin CDP de Edge");
  const target = await (await fetch(BASE + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener("open", res, { once: true }); ws.addEventListener("error", rej, { once: true }); });
  ws.addEventListener("message", (event) => {
    const m = JSON.parse(event.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    }
  });
  await cdp("Page.enable");
  await cdp("Page.navigate", { url: pathToFileURL(HTML).href });
  for (let i = 0; i < 60; i++) {
    const r = await cdp("Runtime.evaluate", { expression: "document.readyState + '|' + document.querySelectorAll('.slide').length + '|' + [...document.images].every(i => i.complete && i.naturalWidth > 0)", returnByValue: true });
    if (r.result?.value === "complete|16|true") break;
    await sleep(250);
  }
  const pdf = await cdp("Page.printToPDF", {
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
    marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
  });
  const buf = Buffer.from(pdf.data, "base64");
  writeFileSync(OUT, buf);
  const pages = (buf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length;
  console.log(`PDF generado · ${Math.round(buf.length / 1024)} KB · objetos /Type /Page: ${pages}`);
  if (pages < 16) process.exitCode = 1;
}
main().catch((e) => { console.error("PDF FAIL", e); process.exitCode = 1; }).finally(() => browser.kill());
