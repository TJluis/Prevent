import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";

process.env.DB_PATH = path.join(os.tmpdir(), "pingui-auth-" + Date.now() + ".db");

// Raíz del proyecto calculada desde la ubicación de este archivo.
const PROJ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const url = (rel) => pathToFileURL(path.join(PROJ, rel)).href;
const require = createRequire(url("server/index.js"));

const results = [];
async function run(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, extra: e.message });
    console.log("FAIL: " + name + " | " + e.message);
  }
}

const express = require("express");
console.error("[t-auth] express ok, creando router...");
const { authRouter } = await import(url("server/auth.js"));
console.error("[t-auth] auth importado");
const { closeDb } = await import(url("server/db.js"));

const app = express();
app.use(express.json());
app.use("/api", authRouter());
const server = app.listen(0);
console.error("[t-auth] listening request...");
await new Promise((r) => server.on("listening", r));
console.error("[t-auth] listening en " + server.address().port);
const base = `http://127.0.0.1:${server.address().port}/api`;

let token = null;

async function req(method, ep, body, bearer) {
  const res = await fetch(base + ep, {
    method,
    headers: { "content-type": "application/json", ...(bearer ? { authorization: "Bearer " + bearer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

await run("registrar usuario nuevo", async () => {
  const r = await req("POST", "/register", { username: "Ana", password: "clave123" });
  if (r.status !== 201 || !r.json.token) throw new Error(`status ${r.status}`);
  token = r.json.token;
});

await run("login insensible a mayúsculas", async () => {
  const r = await req("POST", "/login", { username: "ana", password: "clave123" });
  if (r.status !== 200 || !r.json.token) throw new Error(`status ${r.status}`);
});

await run("registro duplicado rechazado (distinta grafía)", async () => {
  const r = await req("POST", "/register", { username: "aNa", password: "clave123" });
  if (r.status !== 409) throw new Error(`status ${r.status}, esperado 409`);
});

await run("login incorrecto es 401", async () => {
  const r = await req("POST", "/login", { username: "ana", password: "mal" });
  if (r.status !== 401) throw new Error(`status ${r.status}, esperado 401`);
});

await run("me devuelve la cuenta", async () => {
  const r = await req("GET", "/me", null, token);
  if (r.status !== 200 || r.json.user.username !== "Ana")
    throw new Error(`status ${r.status} u=${r.json && r.json.user && r.json.user.username}`);
});

await run("me/appearance normaliza y persiste", async () => {
  const r = await req(
    "PUT",
    "/me/appearance",
    { appearance: { body: "#c0392b", number: "x", jerseyName: "   A  B   " } },
    token
  );
  if (r.status !== 200) throw new Error(`status ${r.status}`);
  const a = r.json.user.appearance;
  if (a.number !== null || a.jerseyName !== "A B" || a.body !== "#c0392b")
    throw new Error(`mal normalizado: ${JSON.stringify(a)}`);
});

await run("logout invalida el token", async () => {
  const r = await req("POST", "/logout", { token }, token);
  if (r.status !== 200) throw new Error(`status ${r.status}`);
  const me = await req("GET", "/me", null, token);
  if (me.status !== 401) throw new Error(`me tras logout: ${me.status}`);
});

server.close();
closeDb();

const total = results.length;
const ok = results.filter((r) => r.ok).length;
console.log(`\nRESULTADO auth: ${ok}/${total} ok`);
if (ok !== total) process.exitCode = 1;
setTimeout(() => process.exit(ok !== total ? 1 : 0), 200);