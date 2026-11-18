import http from "node:http";
import net from "node:net";

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const CLUB = { host: "127.0.0.1", port: 3050 };

function menuHtml() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/icon-32.png"/>
<title>Selector de proyectos · localhost:${PORT}</title>
<style>
  :root { --bg:#0b0f19; --panel:#131a2b; --border:#233052; --text:#e6f0ff; --muted:#8fa3c8; --cyan:#00f0ff; --emerald:#10b981; --violet:#8b5cf6; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:radial-gradient(1200px 600px at 50% -10%, #16203a 0%, var(--bg) 55%); color:var(--text); font-family:"Segoe UI",system-ui,sans-serif; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
  .wrap { max-width:860px; width:100%; text-align:center; }
  .topo { font-size:44px; margin-bottom:6px; }
  h1 { font-size:26px; letter-spacing:.5px; margin-bottom:4px; }
  .sub { color:var(--muted); font-size:14px; margin-bottom:34px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  a.card { display:block; text-decoration:none; color:var(--text); background:var(--panel); border:1px solid var(--border); border-radius:16px; padding:28px 20px; transition:transform .15s ease, border-color .15s ease, box-shadow .15s ease; }
  a.card:hover { transform:translateY(-4px); border-color:var(--bc, var(--cyan)); box-shadow:0 10px 30px rgba(0,0,0,.35); }
  a.card .icon { font-size:40px; }
  a.card .name { font-size:20px; font-weight:600; margin:12px 0 6px; }
  a.card .desc { font-size:13px; color:var(--muted); margin-bottom:14px; }
  a.card .go { font-size:13px; font-weight:600; letter-spacing:.4px; }
  .thumb-wrap { position:relative; border-radius:10px; overflow:hidden; border:1px solid var(--border); background:#0b0f19; }
  .thumb { display:block; width:100%; aspect-ratio:16/9; object-fit:cover; }
  .thumb-fallback { display:none; font-size:40px; padding:30px 0; }
  .thumb-wrap.no-thumb .thumb { display:none; }
  .thumb-wrap.no-thumb .thumb-fallback { display:block; }
  .ana { --bc:var(--violet); } .ana .go { color:var(--violet); }
  .pingui { --bc:var(--cyan); } .pingui .go { color:var(--cyan); }
  .note { margin-top:26px; font-size:12px; color:var(--muted); }
  @media (max-width:600px){ .grid{grid-template-columns:1fr;} }
</style>
</head>
<body>
  <div class="wrap">
    <div class="topo">🧭</div>
    <h1>Selector de proyectos</h1>
    <p class="sub">Elige a qué proyecto quieres redirigirte desde este equipo.</p>
    <div class="grid">
      <a class="card pingui" href="/">
        <div class="thumb-wrap">
          <img class="thumb" src="/assets/server-card.jpg" alt="Club Pingüi" loading="lazy" onerror="this.parentNode.classList.add('no-thumb')"/>
          <span class="thumb-fallback">🐧</span>
        </div>
        <div class="name">Club Pingüi</div>
        <div class="desc">Plataforma social 3D multijugador.</div>
        <div class="go">Ir a Club Pingüi →</div>
      </a>
      <a class="card ana" href="http://localhost:3002">
        <div class="icon">🧬</div>
        <div class="name">AnatomyLab</div>
        <div class="desc">Plataforma de estudio anatómico 3D.</div>
        <div class="go">Ir a AnatomyLab →</div>
      </a>
    </div>
    <p class="note">Menú de redireccionamiento · puerto ${PORT}</p>
  </div>
</body>
</html>`;
}

function forward(req, res) {
  const target = http.request(
    {
      host: CLUB.host,
      port: CLUB.port,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: `localhost:${CLUB.port}` },
    },
    (upstream) => {
      res.writeHead(upstream.statusCode || 502, upstream.headers);
      upstream.pipe(res);
    }
  );
  target.on("error", () => {
    res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("502 - Club Pingüi no disponible (server 3050 apagado).");
  });
  req.on("error", () => target.destroy());
  req.pipe(target);
}

const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, proxy: true, club: CLUB.port }));
  }
  if (req.url === "/menu" || req.url === "/menu/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(menuHtml());
  }
  return forward(req, res);
});

server.on("upgrade", (req, socket, head) => {
  const target = net.connect(CLUB.port, CLUB.host, () => {
    let data = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
    for (const k of Object.keys(req.headers)) {
      data += `${k}: ${req.headers[k]}\r\n`;
    }
    data += "\r\n";
    target.write(data);
    if (head && head.length) target.write(head);
  });
  target.on("error", () => socket.destroy());
  socket.on("error", () => target.destroy());
  socket.on("close", () => target.destroy());
  target.on("close", () => socket.destroy());
  target.pipe(socket);
  socket.pipe(target);
});

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`[proxy] El puerto ${PORT} ya está en uso.`);
  } else {
    console.error("[proxy] error HTTP:", err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`[proxy] Puerta 3000 => Club Pingüi ${CLUB.host}:${CLUB.port} (menú en /menu)`);
});