// Genera guia_presentacion_23nov.docx: guía breve por diapositiva de la versión de 13 slides.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

const OUT = join(import.meta.dirname, "..", "guia_presentacion_23nov.docx");

const slides = [
  {
    title: "Portada",
    point: "Ubicar qué se presenta, quién lo presenta y con qué corte de fecha.",
    say: "Buenos días. Soy Luis Javier Tovar Segura y presento el avance de Club Pingüí al 23 de noviembre de 2026: pasamos del documento a un producto ejecutable.",
    show: "Nombre, fecha y la tira inferior: 6/6 modos · C1–C2 · 14 suites · 60 bots.",
  },
  {
    title: "Punto de partida",
    point: "Retomar literalmente el cierre del 27/10 y los tres pendientes que quedaban.",
    say: "El 27 de octubre cerramos diciendo: ‘el avance es real, medible y todavía incompleto’. Faltaban el acta de O1, repetir el tuner de O4 y la carga, despliegue y aceptación de O6. Hoy mostramos la versión estable.",
    show: "La cita enmarcada y la línea de hitos: 06/11, 23/11, 02/12 y 15/12.",
  },
  {
    title: "Ruta y KPIs",
    point: "Anunciar los cuatro bloques y los cinco números que resumen el corte.",
    say: "Cuatro bloques: prácticas con capturas, matriz de riesgos, factibilidad y demo. De arriba abajo: seis modos en vivo, catorce suites, sesenta bots con p95 de 132 ms, quince defectos móviles corregidos y Ciudad C1–C2.",
    show: "Los cinco KPIs y la tabla que relaciona la rúbrica con las diapositivas.",
  },
  {
    title: "Prácticas 1–3",
    point: "Mostrar que la planeación, la investigación y la arquitectura dejaron artefactos que hoy se usan.",
    say: "Primero decidimos el qué, el con qué y el cómo: quince actividades en cuatro fases, Three.js por costo cero de migración y una arquitectura que permitió añadir seis modos sin reescribir render, chat ni red.",
    show: "Las tres capturas: documento de fases, diagrama de arquitectura y tuner de armas.",
  },
  {
    title: "Prácticas 4–5",
    point: "Explicar que el avance se mide y que la fecha se calculó con tres valores.",
    say: "La práctica 4 dejó seis objetivos con indicador, SPI 1.13 y CPI 1.04 al 06/10. La práctica 5 calculó 85.17 días de ruta crítica, sigma 4.02 y 88 % de probabilidad en 90 días. El Stage-Gate frenó dos cierres sin evidencia.",
    show: "El documento de seguimiento y, al lado, el Gantt y el PERT.",
  },
  {
    title: "Práctica 6",
    point: "Separar gasto real de valor de recursos para justificar la sostenibilidad.",
    say: "El desembolso real son $3,025; el valor total es $21,025 porque incluye el equipo que ya tenía. Las 160 horas se reparten en desarrollo, diseño 3D, calidad y documentación.",
    show: "La frase: ‘3,025 es lo que se gasta; 21,025 es lo que vale’.",
  },
  {
    title: "Riesgos ocurridos",
    point: "Listar solo riesgos con evidencia, su impacto y la corrección aplicada.",
    say: "Cinco riesgos ocurrieron de verdad. El crítico fue crystalTick: apagaba el servidor entero y se corrigió con una línea. También 15 defectos móviles en siete viewports, el acta pendiente de O1, el tuner sin repetir y el HUD solapado con el chat. Después: 14 suites en verde y 0 regresiones.",
    show: "La fila de crystalTick y la fila de O1; después el balance inferior.",
  },
  {
    title: "Matriz prospectiva",
    point: "Priorizar con probabilidad × impacto, no con una lista de deseos.",
    say: "La escala es 1 a 3 en ambos ejes. Cuatro riesgos quedan altos: rendimiento de Ciudad, techo de 60 sesiones, extensión de C3–C5 y falta de acta y despliegue. Tres quedan medios: WebGL en gama baja, regresiones y moderación.",
    show: "La columna de nivel; detenerse en R1 y R4.",
  },
  {
    title: "Medidas",
    point: "Cada riesgo tiene acción, plazo y métrica de salida; no solo intención.",
    say: "R1 ya tiene culling por celdas y etiquetas cortas. R3 se controló con la congelación y el tag v0.2. R5 y R6 se cubren con el arnés móvil y las catorce suites. Lo que sigue pendiente es R4: acta, publicación y aceptación del 15 de diciembre.",
    show: "Las columnas Estado y Métrica de salida.",
  },
  {
    title: "Factibilidad tecnológica",
    point: "Justificar el stack por evidencia, no por moda.",
    say: "El stack ya sostiene el producto: Three.js conserva el render propio, Node y Socket.IO sostienen 60 sesiones y 132 ms de p95, SQLite da persistencia sin otro servidor y el contrato de modo permite seis modos compartiendo red y HUD. Rapier y Colyseus quedan diferidos con spikes documentados.",
    show: "La columna de evidencia de cada tecnología.",
  },
  {
    title: "Factibilidad e impactos",
    point: "Cerrar la viabilidad en los ámbitos económico, académico, operativo y social.",
    say: "Es viable dentro del corte académico: $3,025 de gasto real, $21,025 de valor, 160 horas y catorce suites verdes. El impacto llega al usuario en navegador y móvil, y a la materia en seis prácticas con artefactos. C3 a C5 quedan fuera del corte.",
    show: "La tabla de ámbitos y la frase de veredicto.",
  },
  {
    title: "Demo · recorrido del sistema",
    point: "Probar en vivo que los seis portales son jugables, no solo decorativos.",
    say: "Entro con un invitado, paso por el vestidor y llego a la isla. Los seis portales responden ‘live’: Pares, TNT, Karts, Coliseo y Escondite. El combate solo se habilita en Coliseo y cada modo guarda estadísticas en user_stats.",
    show: "Las seis capturas. Si falla la demo en vivo, usarlas como plan B.",
  },
  {
    title: "Demo · Ciudad C1–C2",
    point: "Profundizar en el avance más grande desde octubre y marcar su límite honesto.",
    say: "Ciudad tiene cámara en primera persona bloqueada y sin combate. En C2 recojo un objeto —sube wallet.collected— y compro en la tienda; ambos datos persisten en SQLite. El interés por celdas mantiene etiquetas solo a menos de 15 metros. C1 y C2 están cerradas; C3 a C5 no.",
    show: "Las tres capturas: primera persona, recogida y tienda. Después decir: ‘Quedo atento a preguntas’.",
  },
];

function linea(etiqueta, valor) {
  return new Paragraph({
    spacing: { after: 70 },
    children: [
      new TextRun({ text: etiqueta + ": ", bold: true, color: "0E7490" }),
      new TextRun({ text: valor, color: "1E293B" }),
    ],
  });
}

const children = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: "Guía para la presentación · Club Pingüí", bold: true, size: 30, color: "0F172A" })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 220 },
    children: [new TextRun({ text: "23 de noviembre de 2026 · Luis Javier Tovar Segura · 13 diapositivas", size: 20, color: "475569" })],
  }),
  new Paragraph({
    spacing: { after: 220 },
    children: [new TextRun({ text: "Uso rápido: cada entrada da el punto de la diapositiva, una frase para decir y qué señalar. No leer literalmente; usarlo como apoyo.", italics: true, color: "475569" })],
  }),
];

slides.forEach((slide, i) => {
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: i === 0 ? 0 : 220, after: 90 },
    children: [new TextRun(`${i + 1}. ${slide.title}`)],
  }));
  children.push(linea("Punto clave", slide.point));
  children.push(linea("Di", `“${slide.say}”`));
  children.push(linea("Señala", slide.show));
});

children.push(new Paragraph({
  spacing: { before: 280, after: 0 },
  children: [new TextRun({ text: "Al terminar la diapositiva 13: “Quedo atento a preguntas”.", bold: true, color: "0F172A" })],
}));

const doc = new Document({
  creator: "Luis Javier Tovar Segura",
  title: "Guía para la presentación · Club Pingüí · 23/11/2026",
  description: "Guía breve por diapositiva para la presentación de avances.",
  styles: { default: { document: { run: { font: "Calibri", size: 21 } } } },
  sections: [{
    properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
    children,
  }],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync(OUT, buffer);
console.log(`DOCX generado · ${slides.length} diapositivas · ${Math.round(buffer.length / 1024)} KB · ${OUT}`);
