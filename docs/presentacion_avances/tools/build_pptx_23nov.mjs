// Genera presentacion_23nov.pptx nativa (texto, tablas y figuras editables).
// Equivalente al diseño de presentacion_23nov.html, con Node + pptxgenjs.
import PptxGenJS from "pptxgenjs";
import { join } from "node:path";

const BASE = join(import.meta.dirname, "..");
const IMG = join(BASE, "img");
const OUT = join(BASE, "presentacion_23nov.pptx");

const pptx = new PptxGenJS();
pptx.defineLayout({ name: "CP_WIDE", width: 13.333, height: 7.5 });
pptx.layout = "CP_WIDE";
pptx.author = "Luis Javier Tovar Segura";
pptx.subject = "Presentación de avances · 23/11/2026";
pptx.title = "Club Pingüí · Presentación de avances";
pptx.company = "UTNC · Formulación de Proyectos de Tecnología";

const C = {
  bg: "060B14", card: "101C2F", card2: "16263F", line: "1E3350",
  text: "E9F2FC", muted: "8EA8C6", dim: "5F7A99",
  cy: "22D3EE", blue: "3B82F6", amber: "FBBF24", coral: "FB7185",
  green: "34D399", violet: "A78BFA",
};
const F = "Segoe UI";
const W = 13.333, H = 7.5;
let page = 0;

function bg(slide, color = C.bg) { slide.background = { color }; }

function box(slide, x, y, w, h, opts = {}) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: 0.12,
    fill: { color: opts.fill || C.card, transparency: opts.transparency ?? 0 },
    line: { color: opts.line || C.line, width: 0.8 },
  });
}

function txt(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, {
    x, y, w, h, margin: 0, fontFace: F, fontSize: opts.size || 10.5,
    color: opts.color || C.text, bold: !!opts.bold, italic: !!opts.italic,
    align: opts.align || "left", valign: opts.valign || "top",
    lineSpacingMultiple: opts.ls || 1.08, isTextBox: true,
    paraSpaceAfterPt: opts.after || 0,
  });
}

function bullets(slide, items, x, y, w, h, opts = {}) {
  txt(slide, items.map((t) => "•  " + t).join("\n"), x, y, w, h, {
    size: opts.size || 10, color: opts.color || C.muted, ls: opts.ls || 1.22,
  });
}

function head(kicker, title, sub) {
  const s = pptx.addSlide();
  bg(s);
  page++;
  txt(s, kicker.toUpperCase(), 0.55, 0.28, 12.2, 0.22, { size: 8.5, color: C.cy, bold: true });
  txt(s, title, 0.55, 0.53, 12.2, 0.58, { size: 22, bold: true });
  if (sub) txt(s, sub, 0.55, 1.15, 12.2, 0.38, { size: 9.8, color: C.muted, ls: 1.12 });
  return s;
}

function foot(slide, label) {
  slide.addShape(pptx.ShapeType.line, { x: 0.55, y: 7.02, w: 12.23, h: 0, line: { color: C.line, width: 0.8 } });
  txt(slide, label, 0.55, 7.08, 10.8, 0.22, { size: 7.6, color: C.dim });
  txt(slide, `${String(page).padStart(2, "0")} / 13`, 11.6, 7.08, 1.18, 0.22, { size: 7.6, color: C.muted, bold: true, align: "right" });
}

function cell(text, opts = {}) {
  return { text, options: { color: opts.color || C.muted, bold: !!opts.bold, fontSize: opts.size || 8.2,
    fill: { color: opts.fill || C.card2 }, valign: "mid", margin: 0.05 } };
}
function hcell(text, width) { return { text, options: { color: C.cy, bold: true, fontSize: 8, fill: { color: C.card }, valign: "mid" } }; }

function table(slide, rows, x, y, w, opts = {}) {
  slide.addTable(rows, {
    x, y, w, h: opts.h, colW: opts.colW,
    border: { type: "solid", color: C.line, pt: 0.5 },
    fontFace: F, fontSize: opts.size || 8.2, color: C.muted,
    rowH: opts.rowH, valign: "mid", autoFit: false,
  });
}

function kpis(slide, items, x, y, w, h) {
  const gap = 0.12, each = (w - gap * (items.length - 1)) / items.length;
  items.forEach((it, i) => {
    const bx = x + i * (each + gap);
    box(slide, bx, y, each, h);
    txt(slide, it.label.toUpperCase(), bx + 0.12, y + 0.1, each - 0.24, 0.18, { size: 7.2, color: C.muted, bold: true });
    txt(slide, it.value, bx + 0.12, y + 0.3, each - 0.24, 0.42, { size: 19, bold: true, color: it.color || C.text });
    txt(slide, it.note, bx + 0.12, y + 0.75, each - 0.24, 0.28, { size: 7.2, color: C.dim });
  });
}

function shot(slide, file, x, y, w, h, cap) {
  slide.addImage({ path: join(IMG, file), x, y, w, h, sizing: { type: "cover", w, h } });
  slide.addShape(pptx.ShapeType.rect, { x, y: y + h - 0.32, w, h: 0.32, fill: { color: "04080F", transparency: 18 }, line: { color: "04080F", transparency: 100 } });
  txt(slide, cap, x + 0.1, y + h - 0.27, w - 0.2, 0.2, { size: 7.8, color: C.text, bold: true });
}

/* ------------------------------------------------------------------ 1 */
{
  const s = pptx.addSlide();
  bg(s); page++;
  s.addImage({ path: join(IMG, "32-isla-23nov.png"), x: 7.1, y: 0, w: 6.233, h: 7.5, sizing: { type: "cover", w: 6.233, h: 7.5 } });
  s.addShape(pptx.ShapeType.rect, { x: 7.1, y: 0, w: 6.233, h: 7.5, fill: { color: C.bg, transparency: 42 }, line: { color: C.bg, transparency: 100 } });
  txt(s, "UNIVERSIDAD TECNOLÓGICA DEL NORTE DE COAHUILA", 0.62, 0.55, 6.1, 0.3, { size: 8.5, color: C.muted, bold: true });
  txt(s, "INGENIERÍA EN TECNOLOGÍAS DE LA INFORMACIÓN E INNOVACIÓN DIGITAL", 0.62, 0.82, 6.1, 0.5, { size: 7.5, color: C.cy, bold: true, ls: 1.15 });
  txt(s, "Club Pingüí", 0.62, 1.65, 6.2, 0.85, { size: 42, bold: true });
  txt(s, "Presentación de avances", 0.62, 2.48, 6.2, 0.5, { size: 24, color: C.cy, bold: true });
  txt(s, "Del documento al producto ejecutable: seis modos en vivo, Ciudad C1–C2 y evidencia verificable en pantalla.", 0.62, 3.12, 5.9, 0.7, { size: 11, color: C.muted, ls: 1.2 });
  txt(s, "Materia: Formulación de Proyectos de Tecnología (7A)\nDocente: Mtro. Domingo Fraga Hernández\nAvance: Parcial · Versión estable 23/11/2026\nLugar: Piedras Negras, Coahuila", 0.62, 4.0, 6.0, 1.1, { size: 9.5, color: C.muted, ls: 1.4 });
  s.addShape(pptx.ShapeType.line, { x: 0.62, y: 5.35, w: 5.9, h: 0, line: { color: C.line, width: 1 } });
  txt(s, "Luis Javier Tovar Segura", 0.62, 5.55, 5.9, 0.35, { size: 17, bold: true });
  txt(s, "ALUMNO · LÍDER DE PROYECTO Y DESARROLLADOR", 0.62, 5.92, 5.9, 0.25, { size: 8, color: C.dim, bold: true });
  txt(s, "23 de noviembre de 2026", 0.62, 6.45, 5.9, 0.35, { size: 12, color: C.amber, bold: true });
  txt(s, "6/6 modos  ·  C1–C2  ·  14 suites  ·  60 bots", 7.45, 6.7, 5.5, 0.3, { size: 9, color: C.text, bold: true, align: "center" });
}

/* ------------------------------------------------------------------ 2 */
{
  const s = head("Punto de partida · cierre del 27/10/2026", "Retomamos donde quedó: real, medible y todavía incompleto",
    "Tres condicionantes explícitos: qué se resolvió, qué se construyó y qué sigue pendiente con nombre y fecha.");
  box(s, 0.55, 1.65, 6.0, 4.05);
  txt(s, "FRASE DE CIERRE QUE SE RETOMA", 0.75, 1.85, 5.6, 0.25, { size: 8, color: C.cy, bold: true });
  txt(s, "«El avance es real, medible y todavía incompleto»", 0.75, 2.2, 5.55, 0.8, { size: 17, bold: true, ls: 1.15 });
  s.addShape(pptx.ShapeType.line, { x: 0.75, y: 3.07, w: 5.55, h: 0, line: { color: C.line, width: 1 } });
  txt(s, "PENDIENTES DEL 27/10", 0.75, 3.24, 5.6, 0.25, { size: 8, color: C.cy, bold: true });
  bullets(s, ["O1 · Acta con 2+ clientes para cerrar el núcleo multijugador.",
    "O4 · Repetir la verificación del tuner de mapas.",
    "O6 · Carga, despliegue y aceptación en noviembre."], 0.75, 3.6, 5.55, 1.65, { size: 10.5 });
  box(s, 0.55, 5.85, 6.0, 0.85);
  txt(s, "Ya cerrado: O2 (17/17 armas), O3 (8/8 mapas) y O5 (0 regresiones). Valor ganado al 06/10: SPI 1.13 · CPI 1.04.", 0.75, 6.05, 5.6, 0.55, { size: 9.5, color: C.muted });
  box(s, 6.75, 1.65, 6.03, 5.05);
  txt(s, "HITOS COMPROMETIDOS", 6.98, 1.88, 5.5, 0.28, { size: 9, color: C.cy, bold: true });
  const hitos = [["06/11/2026", "Prototipo funcional", "Cumplido · servidor y cliente integrados."],
    ["23/11/2026", "Versión estable", "Hoy · se presenta con este corte."],
    ["02/12/2026", "Entrega final", "Proyecto y documentación."],
    ["15/12/2026", "Aceptación", "Pendiente · depende del acta."]];
  hitos.forEach((h, i) => {
    const yy = 2.35 + i * 1.0;
    s.addShape(pptx.ShapeType.ellipse, { x: 7.0, y: yy + 0.05, w: 0.16, h: 0.16, fill: { color: i < 2 ? C.cy : C.amber } });
    txt(s, h[0], 7.32, yy, 1.6, 0.24, { size: 9, color: i < 2 ? C.cy : C.amber, bold: true });
    txt(s, h[1], 8.95, yy, 3.6, 0.24, { size: 10, bold: true });
    txt(s, h[2], 7.32, yy + 0.3, 5.2, 0.35, { size: 8.5, color: C.muted });
  });
  foot(s, "Punto de partida · guion de la presentación del 27/10/2026");
}

/* ------------------------------------------------------------------ 3 */
{
  const s = head("Ruta de la presentación", "Qué cambió desde octubre y cómo se demuestra",
    "Cuatro bloques: prácticas con capturas, matriz de riesgos, factibilidad y demostración del avance actual.");
  kpis(s, [
    { label: "Modos en vivo", value: "6/6", note: "anillo completo en la isla", color: C.cy },
    { label: "Suites verdes", value: "14", note: "protocolo, modos y Ciudad", color: C.green },
    { label: "Carga real", value: "60", note: "bots · p95 132 ms", color: C.text },
    { label: "Móvil", value: "15", note: "bugs corregidos y medidos", color: C.text },
    { label: "Ciudad", value: "C1–C2", note: "distrito + economía", color: C.violet },
  ], 0.55, 1.65, 12.23, 1.1);
  box(s, 0.55, 2.95, 6.0, 3.75);
  txt(s, "CRITERIOS DE LA RÚBRICA", 0.75, 3.15, 5.6, 0.25, { size: 9, color: C.cy, bold: true });
  table(s, [
    [hcell("Criterio"), hcell("Diapositivas")],
    [cell("Presentación · 5 pts", { bold: true, color: C.text }), cell("1 · 4–6")],
    [cell("Matriz de riesgos · 10 pts", { bold: true, color: C.text }), cell("7 · 8 · 9")],
    [cell("Factibilidad · 10 pts", { bold: true, color: C.text }), cell("10 · 11")],
    [cell("Penúltimo avance · 10 pts", { bold: true, color: C.text }), cell("12 · 13")],
  ], 0.75, 3.55, 5.6, { colW: [4.1, 1.5], rowH: [0.34, 0.42, 0.42, 0.42, 0.42] });
  box(s, 6.75, 2.95, 6.03, 3.05);
  txt(s, "CAMBIOS VERIFICABLES DESDE EL 27/10", 6.98, 3.15, 5.55, 0.25, { size: 9, color: C.cy, bold: true });
  bullets(s, ["La isla pasó de portales anunciados a seis modos jugables.",
    "Ciudad C1–C2: distrito en FP, coleccionables y economía.",
    "15 defectos táctiles corregidos en siete viewports.",
    "14 suites y corrida de 60 bots sin desconexiones."], 6.98, 3.55, 5.55, 2.25, { size: 9.5 });
  box(s, 6.75, 6.15, 6.03, 0.55);
  txt(s, "Regla: ningún objetivo sube a 100 % sin su evidencia; el acta de 2+ clientes sigue pendiente.", 6.95, 6.28, 5.6, 0.4, { size: 8.8, color: C.amber });
  foot(s, "Ruta · KPIs con corte 23/11/2026");
}

/* ------------------------------------------------------------------ 4 */
{
  const s = head("Prácticas 1–3 · planeación, tecnología y arquitectura", "Primero se decidió qué, con qué y cómo se conectaría",
    "Tres entregas tempranas que fijaron alcance, herramientas y forma cliente-servidor; cada una dejó un artefacto que hoy se usa.");
  const items = [
    ["41-practica1-fases-23nov.png", "Fases y actividades", "15 actividades en 4 fases con entregable por fase y línea base del 15/09/2026."],
    ["44-arquitectura-23nov.png", "Investigación de tecnologías", "Se compararon motores 3D y se conservó Three.js: costo de migración cero."],
    ["10-tuner-armas.png", "Diseño y herramientas", "El tuner edita 17 armas y exporta JSON sin tocar código."],
  ];
  items.forEach((it, i) => {
    const x = 0.55 + i * 4.12;
    shot(s, it[0], x, 1.7, 3.88, 3.0, ["Resultado · organización de fases", "Resultado · arquitectura", "Resultado · herramienta de producción"][i]);
    box(s, x, 4.83, 3.88, 1.55);
    txt(s, it[1], x + 0.16, 5.02, 3.55, 0.3, { size: 11, bold: true, color: C.cy });
    txt(s, it[2], x + 0.16, 5.42, 3.55, 0.75, { size: 9.2, color: C.muted, ls: 1.17 });
  });
  box(s, 0.55, 6.55, 12.23, 0.35);
  txt(s, "Por qué importa hoy: la arquitectura permitió añadir seis modos como módulos de reglas sin reescribir render, chat ni red.", 0.75, 6.61, 11.9, 0.25, { size: 8.8 });
  foot(s, "Prácticas 1–3 · capturas de documentos y herramienta real");
}

/* ------------------------------------------------------------------ 5 */
{
  const s = head("Prácticas 4–5 · seguimiento de objetivos y estimación", "Medir el avance y calcular el riesgo de la fecha",
    "Objetivos con indicadores verificables y duración estimada con tres valores, no con un número único.");
  shot(s, "42-practica4-seguimiento-23nov.png", 0.55, 1.7, 5.95, 3.55, "Práctica 4 · O1–O6, técnicas y reporte");
  box(s, 0.55, 5.38, 5.95, 1.35);
  txt(s, "Seguimiento y validación", 0.75, 5.55, 5.5, 0.28, { size: 11, bold: true, color: C.cy });
  txt(s, "MBO, SMART, OKR, PMBOK, valor ganado y Stage-Gate aplicados. SPI 1.13 · CPI 1.04 al corte del 06/10.", 0.75, 5.9, 5.5, 0.65, { size: 9.2, color: C.muted });
  shot(s, "30-gantt.png", 6.75, 1.7, 2.9, 2.35, "Gantt · 15 actividades");
  shot(s, "31-pert.png", 9.8, 1.7, 2.98, 2.35, "PERT · ruta crítica");
  box(s, 6.75, 4.18, 6.03, 2.55);
  txt(s, "Estimación", 6.98, 4.38, 5.55, 0.28, { size: 11, bold: true, color: C.cy });
  bullets(s, ["Ruta crítica de 85.17 días y sigma 4.02.", "88 % de probabilidad de cerrar en 90 días.", "A8 y A9 concentran la mayor varianza."], 6.98, 4.8, 5.55, 1.5, { size: 9.5 });
  txt(s, "Qué cambió una decisión: el valor ganado sostuvo la fecha de O6; el Stage-Gate impidió cerrar el acta y el tuner sin evidencia.", 6.98, 6.32, 5.55, 0.35, { size: 8.4, color: C.amber });
  foot(s, "Prácticas 4–5 · capturas de resultados y cálculo PERT");
}

/* ------------------------------------------------------------------ 6 */
{
  const s = head("Práctica 6 · gestión de recursos", "Los recursos explican por qué el avance es sostenible",
    "Presupuesto, esfuerzo y herramientas derivados del alcance aprobado; la distinción entre gasto y valor evita inflar la inversión real.");
  shot(s, "43-practica6-recursos-23nov.png", 0.55, 1.7, 5.95, 4.9, "Práctica 6 · financieros, humanos y materiales");
  box(s, 6.75, 1.7, 6.03, 3.9);
  txt(s, "RECURSOS COMPROMETIDOS", 6.98, 1.9, 5.55, 0.28, { size: 9, color: C.cy, bold: true });
  table(s, [
    [hcell("Tipo"), hcell("Detalle"), hcell("Medida")],
    [cell("Financieros", { bold: true, color: C.text }), cell("VPS, dominio, internet, energía y contingencia"), cell("$3,025", { bold: true, color: C.green })],
    [cell("Valor total", { bold: true, color: C.text }), cell("Incluye equipo propio; suma valor, no gasto"), cell("$21,025", { bold: true })],
    [cell("Humanos", { bold: true, color: C.text }), cell("95 h desarrollo · 35 diseño · 20 QA · 10 docs"), cell("160 h", { bold: true })],
    [cell("Materiales", { bold: true, color: C.text }), cell("Three.js, Socket.IO, SQLite, Node.js, Blender"), cell("MIT / Apache")],
  ], 6.98, 2.3, 5.55, { colW: [1.3, 3.15, 1.1], rowH: [0.36, 0.68, 0.68, 0.68, 0.68], size: 8 });
  box(s, 6.75, 5.75, 6.03, 0.95);
  txt(s, "3,025 es lo que se gasta; 21,025 es lo que vale.", 6.98, 5.96, 5.55, 0.35, { size: 13, bold: true, color: C.amber });
  txt(s, "La reserva del 10 % absorbió 15 correcciones móviles sin cambiar el alcance del 23/11.", 6.98, 6.35, 5.55, 0.3, { size: 8.6, color: C.muted });
  foot(s, "Práctica 6 · gestión de recursos del proyecto");
}

/* ------------------------------------------------------------------ 7 */
{
  const s = head("Matriz de riesgos · riesgos que se presentaron", "Lo que sí pasó, su impacto real y cómo se corrigió",
    "Cinco riesgos con evidencia en bitácora, reporte de carga o documentación; no se presentan hipótesis como hechos.");
  table(s, [
    [hcell("Riesgo ocurrido"), hcell("Cuándo"), hcell("Impacto"), hcell("Corrección y evidencia")],
    [cell("Error crítico en crystalTick", { bold: true, color: C.text }), cell("28/09 · smoke"), cell("TDZ apagaba todo el servidor", { color: C.coral }), cell("Renombrar a tickNow (1 línea); luego 60/60 bots")],
    [cell("15 defectos visuales en móvil", { bold: true, color: C.text }), cell("29–30/10"), cell("Login, joystick y HUD inutilizables en 7 viewports", { color: C.coral }), cell("mobilecheck.html: 0 solapes, botones 32–36 px")],
    [cell("O1 sin acta formal", { bold: true, color: C.text }), cell("27/10 → hoy"), cell("95 %: la prueba individual no basta", { color: C.amber }), cell("60/60 admitidos, pero no hay acta en docs/")],
    [cell("Tuner de mapas sin repetir", { bold: true, color: C.text }), cell("27/10 → hoy"), cell("O4 reportado con reserva", { color: C.amber }), cell("Se mantiene la reserva hasta repetir la prueba")],
    [cell("Chat y HUD encimados", { bold: true, color: C.text }), cell("18/11 · BC-02/03"), cell("Panel social tapaba controles táctiles", { color: C.cy }), cell("Menú ☰ y chat circular; 0 errores en consola")],
  ], 0.55, 1.7, 12.23, { colW: [2.5, 1.45, 3.45, 4.83], rowH: [0.4, 0.8, 0.8, 0.72, 0.72, 0.72], size: 8.1 });
  box(s, 0.55, 6.35, 12.23, 0.5);
  txt(s, "Balance: 1 fallo crítico, 15 defectos de interfaz y 2 evidencias formales pendientes. Tras las correcciones: 14 suites en verde y 0 regresiones.", 0.78, 6.47, 11.8, 0.3, { size: 9, bold: true });
  foot(s, "Riesgos ocurridos · Reporte de carga A11 y Bitácora continua 2026");
}

/* ------------------------------------------------------------------ 8 */
{
  const s = head("Matriz de riesgos · riesgos que pueden ocurrir", "Probabilidad × impacto para priorizar las medidas",
    "Escala 1–3 en ambos ejes. Nivel = probabilidad × impacto: ≥ 6 alto · 4–5 medio · ≤ 3 bajo. Evaluación al 23/11.");
  const rows = [
    [hcell("ID"), hcell("Riesgo prospectivo"), hcell("Prob."), hcell("Impacto"), hcell("Nivel"), hcell("Señal de detección temprana")],
    [cell("R1", { bold: true, color: C.cy }), cell("Rendimiento de Ciudad con 30–50 avatares", { color: C.text }), cell("2"), cell("3"), cell("6 · alto", { bold: true, color: C.coral }), cell("FPS y p95 en 30 bots + 2 humanos; etiquetas y animación")],
    [cell("R2", { bold: true, color: C.cy }), cell("Techo de ~60 sesiones por proceso Node", { color: C.text }), cell("2"), cell("3"), cell("6 · alto", { bold: true, color: C.coral }), cell("/healthz, RSS y game:full; 73 reintentos en la carga")],
    [cell("R3", { bold: true, color: C.cy }), cell("Extender C3–C5 antes de la entrega final", { color: C.text }), cell("3"), cell("2"), cell("6 · alto", { bold: true, color: C.coral }), cell("Cambios de alcance posteriores al 23/11")],
    [cell("R4", { bold: true, color: C.cy }), cell("Sin acta de 2+ clientes ni despliegue", { color: C.text }), cell("2"), cell("3"), cell("6 · alto", { bold: true, color: C.coral }), cell("Ausencia de acta en docs/ y aceptación del 15/12")],
    [cell("R5", { bold: true, color: C.cy }), cell("WebGL pesado en gama baja", { color: C.text }), cell("2"), cell("2"), cell("4 · medio", { bold: true, color: C.amber }), cell("Arnés de 7 viewports y FPS por cambio de UI")],
    [cell("R6", { bold: true, color: C.cy }), cell("Regresión al integrar un modo", { color: C.text }), cell("1"), cell("3"), cell("3 · medio", { bold: true, color: C.amber }), cell("14 suites en test-all.ps1 y smoke por commit")],
    [cell("R7", { bold: true, color: C.cy }), cell("Abuso de chat / falta de moderación", { color: C.text }), cell("1"), cell("3"), cell("3 · medio", { bold: true, color: C.amber }), cell("Filtro, límite de velocidad y reportes (parcial)")],
  ];
  table(s, rows, 0.55, 1.7, 12.23, { colW: [0.5, 3.3, 0.65, 0.75, 1.05, 5.98], rowH: [0.36, 0.62, 0.62, 0.58, 0.58, 0.58, 0.58, 0.58], size: 8 });
  box(s, 0.55, 6.65, 12.23, 0.3);
  txt(s, "Lectura: los cuatro riesgos altos concentran rendimiento, techo de sesiones, alcance y aceptación.", 0.75, 6.7, 11.8, 0.22, { size: 8.5, bold: true });
  foot(s, "Matriz prospectiva · plan de modalidades e investigación de herramientas (18/11/2026)");
}

/* ------------------------------------------------------------------ 9 */
{
  const s = head("Matriz de riesgos · medidas a aplicar", "Cada riesgo tiene una acción, un plazo y una métrica",
    "Las medidas ya aplicadas se marcan en verde; las que dependen de noviembre y diciembre se dejan explícitas como pendientes.");
  table(s, [
    [hcell("ID"), hcell("Medida"), hcell("Estado"), hcell("Cuándo"), hcell("Métrica de salida")],
    [cell("R1", { bold: true, color: C.cy }), cell("Culling por celdas de 20 m, etiquetas < 15 m, animación a 15 Hz"), cell("Aplicada en C1", { color: C.green }), cell("20/11"), cell("p95 < 200 ms con 30 bots + 2 humanos")],
    [cell("R2", { bold: true, color: C.cy }), cell("Documentar límite y preparar /city con namespaces o shard"), cell("En diseño", { color: C.amber }), cell("Dic–Feb"), cell("60/60 hoy; RSS < 400 MB y 0 desconexiones")],
    [cell("R3", { bold: true, color: C.cy }), cell("Congelación hasta el 23/11 y tag v0.2; C3–C5 después"), cell("Aplicada", { color: C.green }), cell("18–23/11"), cell("Alcance de hoy = C1–C2, sin cambios")],
    [cell("R4", { bold: true, color: C.cy }), cell("Acta con 2+ clientes, Railway con DB_PATH en volumen y aceptación"), cell("Pendiente", { color: C.coral }), cell("02–15/12"), cell("Acta firmada y /healthz público")],
    [cell("R5", { bold: true, color: C.cy }), cell("LOD / frustumCulled y medición con mobilecheck.html"), cell("Aplicada", { color: C.green }), cell("30/10"), cell("0 solapes en 7 viewports")],
    [cell("R6", { bold: true, color: C.cy }), cell("Ejecutar test-all.ps1 y smoke antes de cada entrega"), cell("Aplicada", { color: C.green }), cell("Continuo"), cell("14 suites, incluidas modos y Ciudad")],
    [cell("R7", { bold: true, color: C.cy }), cell("Filtro de chat, rate limit, reportes y zonas seguras"), cell("Parcial", { color: C.amber }), cell("C5"), cell("Sin mensajes ofensivos sin sanción")],
  ], 0.55, 1.7, 12.23, { colW: [0.5, 4.45, 1.35, 1.05, 4.88], rowH: [0.36, 0.62, 0.62, 0.58, 0.62, 0.58, 0.58, 0.58], size: 8 });
  box(s, 0.55, 6.65, 12.23, 0.3);
  txt(s, "Responsable de seguimiento: Luis Javier Tovar Segura · revisión semanal de los riesgos con nivel 6 hasta el 15/12.", 0.75, 6.7, 11.8, 0.22, { size: 8.5, bold: true });
  foot(s, "Medidas · Plan de modalidades, bitácora y reporte de carga");
}

/* ------------------------------------------------------------------ 10 */
{
  const s = head("Factibilidad · tecnologías seleccionadas", "El stack no es una apuesta: ya sostiene el producto",
    "Cada tecnología se eligió por un costo de adopción medido y una evidencia en el proyecto. Lo que no se necesita hoy queda diferido.");
  table(s, [
    [hcell("Tecnología"), hcell("Por qué se seleccionó"), hcell("Evidencia en el proyecto")],
    [cell("Three.js 0.187 · MIT", { bold: true, color: C.text }), cell("Ya integrado; mantenerlo cuesta cero y conserva ~250 KB de lógica propia", { color: C.muted }), cell("8 mapas, 6 arenas y Ciudad en FP sobre el mismo renderer")],
    [cell("Node + Express + Socket.IO", { bold: true, color: C.text }), cell("Un proceso cubre salas, chat, combate y modos; tiempo real como núcleo", { color: C.muted }), cell("60 sesiones, 619 eventos/s, RTT p95 132 ms")],
    [cell("SQLite · better-sqlite3", { bold: true, color: C.text }), cell("Persistencia WAL sin servidor adicional; suficiente para cuentas y mundo", { color: C.muted }), cell("user_stats, city_collectibles y city_objects sobreviven al reinicio")],
    [cell("Contrato de modo", { bold: true, color: C.text }), cell("Reglas, tick y victoria como módulos; evita un if gigante en game.js", { color: C.muted }), cell("6 modos live comparten red, HUD y movimiento")],
    [cell("Rapier / Colyseus", { bold: true, color: C.text }), cell("Solo si Karts o Ciudad lo exigen; hoy no justifican migrar el servidor", { color: C.muted }), cell("Decisión diferida a los spikes de la investigación (18/11)")],
  ], 0.55, 1.7, 12.23, { colW: [2.35, 5.05, 4.83], rowH: [0.38, 0.85, 0.85, 0.85, 0.85, 0.85], size: 8.4 });
  box(s, 0.55, 6.55, 12.23, 0.35);
  txt(s, "Conclusión: factibilidad técnica demostrada para el alcance actual; el techo de ~60 sesiones está documentado y tiene respuesta prevista.", 0.75, 6.62, 11.85, 0.25, { size: 8.8, bold: true });
  foot(s, "Factibilidad tecnológica · investigación de herramientas y documentación técnica");
}

/* ------------------------------------------------------------------ 11 */
{
  const s = head("Factibilidad · justificación e impactos", "El proyecto es viable dentro del corte académico",
    "La viabilidad no se afirma solo en lo técnico: también depende del dinero, del tiempo de una persona y del impacto real en el usuario.");
  kpis(s, [
    { label: "Desembolso real", value: "$3,025", note: "VPS, dominio e internet", color: C.green },
    { label: "Valor de recursos", value: "$21,025", note: "incluye equipo propio", color: C.text },
    { label: "Línea base", value: "160 h", note: "95 / 35 / 20 / 10 h", color: C.cy },
    { label: "Calidad", value: "14", note: "suites en verde", color: C.green },
  ], 0.55, 1.65, 12.23, 1.1);
  table(s, [
    [hcell("Ámbito"), hcell("Impacto"), hcell("Justificación")],
    [cell("Tecnológico", { bold: true, color: C.text }), cell("Producto jugable en navegador, sin instalación y con persistencia", { color: C.muted }), cell("Stack probado; los modos se añaden sin migrar de motor")],
    [cell("Económico", { bold: true, color: C.text }), cell("Costo operativo bajo: hospedaje y dominio; 86 % del valor es equipo propio", { color: C.muted }), cell("No se requiere infraestructura cara para la demo académica")],
    [cell("Académico", { bold: true, color: C.text }), cell("Seis prácticas con entregable, bitácora y evidencia por objetivo", { color: C.muted }), cell("La rúbrica se atiende con artefactos verificables")],
    [cell("Operativo", { bold: true, color: C.text }), cell("Un desarrollador asistido por IA sostiene el ritmo con hitos y gates", { color: C.muted }), cell("160 h y definición de hecho permiten estimar el trabajo")],
    [cell("Social / usuario", { bold: true, color: C.text }), cell("Salas, chat, seis modos y un distrito accesible en escritorio y móvil", { color: C.muted }), cell("15 defectos táctiles corregidos y FP estricta en Ciudad")],
  ], 0.55, 2.95, 12.23, { colW: [1.65, 5.3, 5.28], rowH: [0.36, 0.68, 0.68, 0.68, 0.68, 0.68], size: 8.4 });
  box(s, 0.55, 6.65, 12.23, 0.3);
  txt(s, "Veredicto: viable para la entrega del 02/12 con C1–C2; casas, trabajos y moderación (C3–C5) quedan fuera del corte académico.", 0.75, 6.7, 11.85, 0.22, { size: 8.5, bold: true });
  foot(s, "Factibilidad · práctica 6, investigación de herramientas y plan de modalidades");
}

/* ------------------------------------------------------------------ 12 */
{
  const s = head("Penúltimo avance · demostración 1 de 2", "Recorrido del sistema: de la isla a los seis modos",
    "En vivo: iniciar sesión → vestidor → isla con anillo de portales → elegir modo → sala oculta MODO-<ID> → volver a la isla.");
  const grid = [
    ["32-isla-23nov.png", "1 · Isla: seis portales en vivo"],
    ["33-pares-23nov.png", "2 · Pares · 1v1 y 2v2"],
    ["34-tnt-23nov.png", "3 · TNT Run · suelo que cae"],
    ["35-karts-23nov.png", "4 · Karts · paddock y circuito"],
    ["39-coliseo-23nov.png", "5 · Coliseo · melee autoritativo"],
    ["40-escondite-23nov.png", "6 · Escondite · roles y fases"],
  ];
  grid.forEach((g, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    shot(s, g[0], 0.55 + col * 4.12, 1.68 + row * 2.38, 3.88, 2.2, g[1]);
  });
  box(s, 0.55, 6.58, 12.23, 0.32);
  txt(s, "Qué mirar: los seis portales responden live; combate solo en Coliseo; cada modo guarda estadísticas en user_stats.", 0.75, 6.64, 11.85, 0.22, { size: 8.5, bold: true });
  foot(s, "Demo 1 · capturas tomadas el 22/11 desde el servidor local");
}

/* ------------------------------------------------------------------ 13 */
{
  const s = head("Penúltimo avance · demostración 2 de 2", "Profundización: Ciudad social C1–C2",
    "Cámara en primera persona bloqueada, distrito procedural, coleccionables persistentes, economía y gestión de interés por celdas.");
  shot(s, "36-ciudad-fp-23nov.png", 0.55, 1.68, 5.95, 2.32, "C1 · distrito en primera persona");
  shot(s, "37-ciudad-recogida-23nov.png", 0.55, 4.12, 5.95, 2.32, "C2 · recogida persistente");
  shot(s, "38-ciudad-tienda-23nov.png", 6.75, 1.68, 6.03, 2.32, "C2 · economía y tienda");
  box(s, 6.75, 4.12, 6.03, 2.32);
  txt(s, "DEFINICIÓN DE HECHO VERIFICADA", 6.98, 4.3, 5.55, 0.25, { size: 8.8, color: C.cy, bold: true });
  bullets(s, ["C1: distrito con cámara FP estricta, sin combate.",
    "C2: wallet.collected > 0 y compra ejecutada.",
    "Persistencia SQLite: objetos y coleccionables.",
    "Interés por celdas: etiquetas < 15 m, animación reducida."], 6.98, 4.65, 5.55, 1.6, { size: 9 });
  box(s, 0.55, 6.58, 12.23, 0.32);
  txt(s, "Límite honesto: C1–C2 están cerradas. Parcelas, trabajos y moderación (C3–C5) no forman parte de esta versión estable.", 0.75, 6.64, 11.85, 0.22, { size: 8.5, bold: true, color: C.amber });
  foot(s, "Demo 2 · Ciudad C1–C2 · commit f1caf59");
}

await pptx.writeFile({ fileName: OUT });
console.log(`PPTX generado · ${page} diapositivas · ${OUT}`);
