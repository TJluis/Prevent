// Genera guia_presentacion_23nov.docx con el guion LITERAL de las 13 diapositivas.
// La fuente es guion_presentacion_23nov.md, para que las palabras habladas sean exactamente las mismas.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

const BASE = join(import.meta.dirname, "..");
const MD = join(BASE, "guion_presentacion_23nov.md");
const OUT = join(BASE, "guia_presentacion_23nov.docx");

const md = readFileSync(MD, "utf8");
const lines = md.split(/\r?\n/);

// Tiempos del "Mapa rápido".
const times = new Map();
for (const line of lines) {
  const m = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([0-9:]+)\s*\|/);
  if (m) times.set(Number(m[1]), m[3].trim());
}

const clean = (value) => value.trim().replace(/^[“”"]/, "").replace(/[“”"]$/, "").trim();

// Diapositivas y sus bloques **Etiqueta:** valor.
const slides = [];
let current = null;
for (const line of lines) {
  const h = line.match(/^###\s+(\d+)\s*·\s*(.+)$/);
  if (h) {
    current = {
      num: Number(h[1]),
      title: h[2].trim(),
      time: times.get(Number(h[1])) || "",
      objetivo: "",
      di: "",
      senala: "",
      support: [],
      transicion: "",
    };
    slides.push(current);
    continue;
  }
  if (!current) continue;
  if (/^##\s/.test(line) || /^---\s*$/.test(line)) {
    current = null;
    continue;
  }
  const field = line.match(/^\*\*([^*]+):\*\*\s*(.+)$/);
  if (!field) continue;
  const key = field[1].trim().replace(/:$/, "");
  const value = clean(field[2]);
  if (key === "Objetivo") current.objetivo = value;
  else if (key === "Di") current.di = value;
  else if (key === "Señala") current.senala = value;
  else if (key === "Transición") current.transicion = value;
  else if (["Dato clave", "Frase honesta", "Si preguntan por 50 jugadores"].includes(key)) {
    current.support.push({ key, text: value });
  }
}

if (slides.length !== 13 || slides.some((s) => !s.di)) {
  throw new Error(`se esperaban 13 diapositivas con texto literal; se encontraron ${slides.length}`);
}

// Preguntas previsibles con respuesta literal.
const qa = [];
let inQA = false;
for (const line of lines) {
  if (/^## Preguntas previsibles/.test(line)) {
    inQA = true;
    continue;
  }
  if (inQA && /^##\s/.test(line)) break;
  if (!inQA) continue;
  const m = line.match(/^-\s+\*\*(.+?)\*\*\s+(.+)$/);
  if (m) qa.push({ q: clean(m[1]), a: clean(m[2]) });
}

// Checklist previo y nota de rescate.
const antes = [];
let inAntes = false;
for (const line of lines) {
  if (/^## 10 minutos antes/.test(line)) {
    inAntes = true;
    continue;
  }
  if (inAntes && /^##\s/.test(line)) break;
  if (inAntes && /^-\s+/.test(line)) antes.push(clean(line.replace(/^-\s+/, "")));
}
const rescate = (() => {
  const i = lines.findIndex((l) => /^## Si te quedas en blanco/.test(l));
  return i >= 0 ? lines.slice(i + 1).find((l) => l.trim() && !/^---/.test(l))?.trim() || "" : "";
})();

function linea(etiqueta, valor, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 80 },
    indent: opts.indent ? { left: 260 } : undefined,
    children: [
      new TextRun({ text: etiqueta, bold: true, color: "0E7490" }),
      new TextRun({ text: valor, color: "1E293B", italics: !!opts.italic }),
    ],
  });
}

const children = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: "Guía literal para la presentación · Club Pingüí", bold: true, size: 30, color: "0F172A" })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: "23 de noviembre de 2026 · Luis Javier Tovar Segura · 13 diapositivas · 14–15 min", size: 20, color: "475569" })],
  }),
  new Paragraph({
    spacing: { after: 220 },
    children: [new TextRun({
      text: "Forma de uso: di en voz alta exactamente el párrafo que aparece en “Dilo así”. Las frases de apoyo y las transiciones también están escritas literalmente. “Señala” es solo apoyo visual; no se lee en voz alta.",
      italics: true,
      color: "475569",
    })],
  }),
];

slides.forEach((s, i) => {
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: i === 0 ? 0 : 240, after: 100 },
    children: [new TextRun(`${s.num}. ${s.title}${s.time ? `  ·  ${s.time}` : ""}`)],
  }));

  if (s.objetivo) children.push(linea("Objetivo: ", s.objetivo, { after: 60 }));
  children.push(linea("Dilo así: ", s.di, { after: 120, indent: true }));
  if (s.senala) children.push(linea("Señala: ", s.senala, { after: 70 }));

  if (s.support.length) {
    children.push(new Paragraph({
      spacing: { before: 40, after: 50 },
      children: [new TextRun({ text: "Frases de apoyo (dilas también):", bold: true, color: "0E7490" })],
    }));
    for (const item of s.support) {
      children.push(linea(`${item.key}: `, item.text, { after: 55, indent: true }));
    }
  }

  if (s.transicion) children.push(linea("Transición (dila): ", s.transicion, { after: 110 }));
});

children.push(new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 300, after: 120 },
  children: [new TextRun("Cierre y preguntas")],
}));
children.push(linea("Cierre final: ", "Quedo atento a preguntas.", { after: 130, indent: true }));

for (const item of qa) {
  children.push(linea(`${item.q} `, item.a, { after: 70 }));
}

if (antes.length) {
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 100 },
    children: [new TextRun("Antes de empezar")],
  }));
  for (const item of antes) children.push(linea("•  ", item, { after: 50 }));
}

if (rescate) {
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 100 },
    children: [new TextRun("Si te quedas en blanco")],
  }));
  children.push(linea("", rescate, { after: 80, indent: true, italic: true }));
}

children.push(new Paragraph({
  spacing: { before: 200, after: 0 },
  children: [new TextRun({ text: "Versión de 8 minutos: mantener 1, 3, 4, 6, 7, 8, 10, 12 y 13; comprimir 2, 5, 9 y 11 a una frase cada una.", bold: true, color: "0F172A" })],
}));

const doc = new Document({
  creator: "Luis Javier Tovar Segura",
  title: "Guía literal para la presentación · Club Pingüí · 23/11/2026",
  description: "Guion exacto por diapositiva para la presentación de avances.",
  styles: { default: { document: { run: { font: "Calibri", size: 21 } } } },
  sections: [{
    properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
    children,
  }],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync(OUT, buffer);
console.log(`DOCX generado · ${slides.length} diapositivas · ${qa.length} preguntas · ${Math.round(buffer.length / 1024)} KB · ${OUT}`);
