// Genera tarjeta_presentacion_23nov.html (reutiliza el CSS de la tarjeta del 27/10)
// y su PDF A4 con Edge headless.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const BASE = join(import.meta.dirname, "..");
const OLD = readFileSync(join(BASE, "tarjeta_presentacion.html"), "utf8");
const prefix = OLD.slice(0, OLD.indexOf("<body>"))
  .replace(/<title>.*?<\/title>/s, "<title>Tarjeta de presentación · Club Pingüí · 23/11/2026</title>");

const body = `<body>
<div class="sheet">

  <header class="top">
    <div>
      <div class="brand">Club Pingüí · Tarjeta de presentación</div>
      <h1>Guion de bolsillo · 13 diapositivas</h1>
      <div class="who"><b>Luis Javier Tovar Segura</b> · Versión estable · 14–15 min + preguntas</div>
    </div>
    <div class="stamp"><b>23 · NOV · 2026</b>Versión estable · tag v0.2<br>Demo: recorrido + Ciudad C1–C2</div>
  </header>

  <section class="strip">
    <div class="num"><div class="l">Modalidades</div><div class="v">6/6</div><div class="n">portales live en la isla</div></div>
    <div class="num"><div class="l">Ciudad</div><div class="v">C1–C2</div><div class="n">distrito + economía</div></div>
    <div class="num"><div class="l">Suites</div><div class="v">14/14</div><div class="n">test-all.ps1 en verde</div></div>
    <div class="num am"><div class="l">Carga</div><div class="v">60/60</div><div class="n">p95 132 ms · 0 caídas</div></div>
    <div class="num"><div class="l">Riesgos</div><div class="v">4 altos</div><div class="n">9 medidas con métrica</div></div>
  </section>

  <div class="cols">

    <section>
      <h2>Recorrido · una frase por diapositiva</h2>
      <div class="run">
        <div class="row"><div class="k">1</div><div class="t"><b>Portada.</b> “Del documento al producto ejecutable.” <span>23/11/2026 · Luis Javier Tovar Segura.</span></div></div>
        <div class="row hot"><div class="k">2</div><div class="t"><b>Punto de partida.</b> Retomo el “todavía incompleto” del 27/10. <em>Faltan acta O1, tuner O4 y aceptación O6.</em></div></div>
        <div class="row"><div class="k">3</div><div class="t"><b>Ruta.</b> Cuatro bloques con evidencia. <span>Prácticas · riesgos · factibilidad · demo.</span></div></div>
        <div class="row"><div class="k">4</div><div class="t"><b>Prácticas 1–3.</b> Fases, tecnología y arquitectura. <span>15 actividades · Three.js · módulos de reglas.</span></div></div>
        <div class="row"><div class="k">5</div><div class="t"><b>Prácticas 4–5.</b> Objetivos y estimación. <span>SPI 1.13 · CPI 1.04 · 85.17 d · 88 %.</span></div></div>
        <div class="row"><div class="k">6</div><div class="t"><b>Práctica 6.</b> “$3,025 es lo que se gasta; $21,025 es lo que vale.” <span>160 h base.</span></div></div>
        <div class="row hot"><div class="k">7</div><div class="t"><b>Riesgos ocurridos.</b> crystalTick apagó el servidor; 15 bugs móviles. <em>0 regresiones tras el fix.</em></div></div>
        <div class="row"><div class="k">8</div><div class="t"><b>Matriz prospectiva.</b> Probabilidad × impacto. <span>R1, R2, R3 y R4 en nivel alto.</span></div></div>
        <div class="row"><div class="k">9</div><div class="t"><b>Medidas.</b> Acción, plazo y métrica de salida. <span>Solo R4 pendiente para el 15/12.</span></div></div>
        <div class="row"><div class="k">10</div><div class="t"><b>Factibilidad técnica.</b> “El stack ya sostiene el producto.” <span>Three.js · Socket.IO · SQLite.</span></div></div>
        <div class="row"><div class="k">11</div><div class="t"><b>Impactos.</b> Viable dentro del corte académico. <em>C3–C5 quedan fuera.</em></div></div>
        <div class="row hot"><div class="k">12</div><div class="t"><b>Demo recorrido.</b> Isla → seis portales → Pares, TNT, Karts, Coliseo, Escondite.</div></div>
        <div class="row hot"><div class="k">13</div><div class="t"><b>Demo Ciudad.</b> FP, recogida y tienda. <em>wallet.collected > 0 · C1–C2 cerradas.</em> Cierra con “Quedo atento a preguntas”.</div></div>
      </div>
    </section>

    <aside class="side">

      <div class="box">
        <h3>Frases ancla · dilas tal cual</h3>
        <div class="quote">“No subo un objetivo a 100 % sin la evidencia que su indicador exige.”</div>
        <div class="quote">“El valor ganado es del <b>06/10</b>; el estado técnico es del <b>23/11</b>.”</div>
        <div class="quote">“No prometo 50 jugadores medidos: prometo celdas y la prueba de 30 bots + 2 humanos.”</div>
        <div class="quote">“C1 y C2 están cerradas; C3 a C5 no están en esta versión.”</div>
      </div>

      <div class="box warm">
        <h3>Si preguntan · respuesta en una línea</h3>
        <dl>
          <div class="qa"><dt>¿O1 al 95 % con 60/60 bots?</dt><dd>Falta el acta con 2+ clientes; no hay acta real en docs/.</dd></div>
          <div class="qa"><dt>¿Ya hay 50 jugadores en Ciudad?</dt><dd>No. El contrato los declara; lo medido son 60 sesiones totales.</dd></div>
          <div class="qa"><dt>¿Se entregó todo el plan?</dt><dd>No. Seis modos y C1–C2; C3–C5 son posteriores al 02/12.</dd></div>
          <div class="qa"><dt>¿Por qué no migrar de motor?</dt><dd>Migrar cuesta alto y el stack actual sostiene lo medido; los spikes quedaron documentados.</dd></div>
          <div class="qa"><dt>¿Las capturas son reales?</dt><dd>Se tomaron con Edge headless; los logs registran 0 errores y contenido verificado.</dd></div>
        </dl>
      </div>

      <div class="box tint">
        <h3>10 minutos antes</h3>
        <ul class="check">
          <li>Servidor y proxy arriba: <b>/healthz</b> y <b>localhost:3000</b>.</li>
          <li>Navegador con sesión iniciada y sala probada.</li>
          <li>Notificaciones apagadas; pestañas extra cerradas.</li>
          <li>HTML en <b>#1</b>; PDF de respaldo abierto.</li>
          <li>Plan B: capturas de las diapositivas 12 y 13.</li>
          <li>Botella de agua fuera de cuadro. Respirar.</li>
        </ul>
      </div>

      <div class="blank">
        <b>Si te quedas en blanco:</b> mira el número más grande de la diapositiva y di su lectura. Después conecta con la siguiente: “y eso se traduce en…”. Nunca improvises una cifra.
      </div>

      <div class="box">
        <h3>Versión de 8 minutos</h3>
        <div class="plan">Mantén <b>1, 3, 4, 6, 7, 8, 10, 12 y 13</b>. Comprime 2, 5, 9 y 11 a una frase.</div>
      </div>

    </aside>
  </div>

  <footer class="foot">
    <span><b>Archivos:</b> presentacion_23nov.html · presentacion_23nov.pdf · presentacion_23nov.pptx · guion_presentacion_23nov.md · guia_presentacion_23nov.docx</span>
    <span>Club Pingüí · 23/11/2026</span>
  </footer>

</div>
</body>
</html>
`;

const HTML = join(BASE, "tarjeta_presentacion_23nov.html");
const PDF = join(BASE, "tarjeta_presentacion_23nov.pdf");
writeFileSync(HTML, prefix + body, "utf8");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9371;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PROFILE = join(process.env.TEMP || "C:\\Windows\\Temp", "cp_pres_tarjeta_23nov");
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

try {
  let v = null;
  for (let i = 0; i < 60 && !v; i++) {
    try { v = await (await fetch(BASE_URL + "/json/version")).json(); } catch { await sleep(250); }
  }
  if (!v) throw new Error("sin CDP de Edge");
  const target = await (await fetch(BASE_URL + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" })).json();
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
  await cdp("Page.navigate", { url: pathToFileURL(HTML).href });
  await sleep(1200);
  const pdf = await cdp("Page.printToPDF", {
    printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false,
    marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
  });
  writeFileSync(PDF, Buffer.from(pdf.data, "base64"));
  console.log(`Tarjeta generada · HTML + PDF · ${Math.round(Buffer.from(pdf.data, "base64").length / 1024)} KB`);
} finally {
  browser.kill();
}
