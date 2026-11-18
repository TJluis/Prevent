# -*- coding: utf-8 -*-
"""Genera presentacion.pptx nativa (texto y figuras editables) para Club Pingui."""
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(BASE, "img")
OUT = os.path.join(BASE, "presentacion.pptx")

W, H = 13.333, 7.5
BG = RGBColor(0x06, 0x0B, 0x14)
CARD = RGBColor(0x10, 0x1C, 0x2F)
CARD2 = RGBColor(0x16, 0x26, 0x3F)
LINE = RGBColor(0x1E, 0x33, 0x50)
TEXT = RGBColor(0xE9, 0xF2, 0xFC)
MUTED = RGBColor(0x8E, 0xA8, 0xC6)
DIM = RGBColor(0x5F, 0x7A, 0x99)
CYAN = RGBColor(0x22, 0xD3, 0xEE)
BLUE = RGBColor(0x3B, 0x82, 0xF6)
AMBER = RGBColor(0xFB, 0xBF, 0x24)
CORAL = RGBColor(0xFB, 0x71, 0x85)
GREEN = RGBColor(0x34, 0xD3, 0x99)
VIOLET = RGBColor(0xA7, 0x8B, 0xFA)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

CHIP = {
    "ok":   (RGBColor(0x10, 0x32, 0x2A), GREEN),
    "wip":  (RGBColor(0x33, 0x29, 0x0F), AMBER),
    "plan": (RGBColor(0x12, 0x27, 0x44), RGBColor(0x7C, 0xB3, 0xFF)),
    "cy":   (RGBColor(0x0E, 0x2E, 0x3A), CYAN),
    "vi":   (RGBColor(0x25, 0x20, 0x3C), VIOLET),
    "co":   (RGBColor(0x3A, 0x18, 0x20), CORAL),
}

prs = Presentation()
prs.slide_width = Inches(W)
prs.slide_height = Inches(H)
BLANK = prs.slide_layouts[6]


def slide():
    s = prs.slides.add_slide(BLANK)
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = BG
    return s


def shape(s, kind, x, y, w, h, fill=None, line=None, lw=0.75, radius=None):
    shp = s.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    shp.shadow.inherit = False
    if radius is not None and kind == MSO_SHAPE.ROUNDED_RECTANGLE:
        shp.adjustments[0] = radius
    if fill is None:
        shp.fill.background()
    else:
        shp.fill.solid()
        shp.fill.fore_color.rgb = fill
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line
        shp.line.width = Pt(lw)
    shp.text_frame.word_wrap = True
    return shp


def card(s, x, y, w, h, fill=CARD, line=LINE, radius=0.055):
    shp = shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h, fill, line, 0.75, radius)
    return shp


def tb(s, x, y, w, h, txt, size=10, color=TEXT, bold=False, align=PP_ALIGN.LEFT,
       anchor=MSO_ANCHOR.TOP, spacing=1.0, italic=False, font="Segoe UI"):
    box = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    lines = txt.split("\n")
    for i, ln in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = spacing
        r = p.add_run()
        r.text = ln
        r.font.name = font
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.italic = italic
        r.font.color.rgb = color
    return box


def bullets(s, x, y, w, h, items, size=9.5, color=MUTED, bullet_color=CYAN, gap=5):
    box = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.line_spacing = 1.05
        p.space_after = Pt(gap)
        b = p.add_run()
        b.text = "▪  "
        b.font.name = "Segoe UI"
        b.font.size = Pt(size)
        b.font.color.rgb = bullet_color
        b.font.bold = True
        if isinstance(item, tuple):
            head, rest = item
            r1 = p.add_run()
            r1.text = head
            r1.font.name = "Segoe UI"
            r1.font.size = Pt(size)
            r1.font.bold = True
            r1.font.color.rgb = TEXT
            r2 = p.add_run()
            r2.text = rest
            r2.font.name = "Segoe UI"
            r2.font.size = Pt(size)
            r2.font.color.rgb = color
        else:
            r = p.add_run()
            r.text = item
            r.font.name = "Segoe UI"
            r.font.size = Pt(size)
            r.font.color.rgb = color
    return box


def chip(s, x, y, label, kind="cy", w=None, h=0.22, size=7.5):
    bg, fg = CHIP[kind]
    if w is None:
        w = max(0.72, len(label) * 0.056 + 0.18)
    shp = shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h, bg, fg, 0.5, 0.5)
    tf = shp.text_frame
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = label
    r.font.name = "Segoe UI"
    r.font.size = Pt(size)
    r.font.bold = True
    r.font.color.rgb = fg
    return shp


def header(s, kicker, title, sub=None, tsize=24):
    tb(s, 0.55, 0.33, 12.2, 0.22, kicker.upper(), 8.5, CYAN, True)
    tb(s, 0.55, 0.56, 12.2, 0.62, title, tsize, TEXT, True, spacing=0.95)
    if sub:
        tb(s, 0.55, 1.16, 12.1, 0.42, sub, 9.5, MUTED, spacing=1.05)


def footer(s, n, label):
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 7.03, 12.23, 0.008, LINE, None)
    tb(s, 0.55, 7.1, 9.0, 0.2, label, 7.5, DIM)
    tb(s, 10.4, 7.1, 2.38, 0.2, "%02d / 18" % n, 7.5, MUTED, True, PP_ALIGN.RIGHT)


def kpi(s, x, y, w, h, label, value, note, color=CYAN, vsize=19):
    card(s, x, y, w, h, RGBColor(0x10, 0x1D, 0x33), LINE)
    tb(s, x + 0.13, y + 0.11, w - 0.26, 0.2, label.upper(), 7.2, MUTED, True)
    tb(s, x + 0.13, y + 0.32, w - 0.26, 0.4, value, vsize, color, True)
    tb(s, x + 0.13, y + 0.72, w - 0.26, 0.28, note, 7.2, DIM, spacing=0.95)


def table(s, x, y, w, data, widths, header_row=True, fs=8.0, hfs=7.0,
          row_h=0.34, head_h=0.28, aligns=None, colors=None, bolds=None):
    rows, cols = len(data), len(data[0])
    shp = s.shapes.add_table(rows, cols, Inches(x), Inches(y), Inches(w), Inches(head_h + row_h * (rows - 1)))
    tbl = shp.table
    tbl.first_row = header_row
    tbl.horz_banding = False
    for i, cw in enumerate(widths):
        tbl.columns[i].width = Inches(cw)
    tbl.rows[0].height = Inches(head_h)
    for r in range(1, rows):
        tbl.rows[r].height = Inches(row_h)
    for r in range(rows):
        for c in range(cols):
            cell = tbl.cell(r, c)
            cell.margin_left = Inches(0.06)
            cell.margin_right = Inches(0.05)
            cell.margin_top = Inches(0.03)
            cell.margin_bottom = Inches(0.03)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            is_head = header_row and r == 0
            if is_head:
                cell.fill.solid()
                cell.fill.fore_color.rgb = RGBColor(0x0B, 0x15, 0x25)
            else:
                cell.fill.solid()
                cell.fill.fore_color.rgb = RGBColor(0x10, 0x1C, 0x2F) if r % 2 else RGBColor(0x0E, 0x19, 0x2B)
            tf = cell.text_frame
            tf.word_wrap = True
            tf.text = str(data[r][c])
            for p in tf.paragraphs:
                p.line_spacing = 0.95
                p.alignment = PP_ALIGN.LEFT if (aligns is None or aligns[c] == "l") else PP_ALIGN.RIGHT
                for run in p.runs:
                    run.font.name = "Segoe UI"
                    run.font.size = Pt(hfs if is_head else fs)
                    run.font.bold = is_head or (bolds and bolds.get((r, c), False))
                    if is_head:
                        run.font.color.rgb = MUTED
                    elif colors and (r, c) in colors:
                        run.font.color.rgb = colors[(r, c)]
                    else:
                        run.font.color.rgb = TEXT if c == 0 else MUTED
    return tbl


def bar(s, x, y, w, pct, color=CYAN, h=0.055):
    shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h, RGBColor(0x0A, 0x14, 0x24), LINE, 0.5, 0.5)
    shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, x, y, max(0.04, w * pct / 100.0), h, color, None, 0.5, 0.5)


def pic(s, path, x, y, w, h):
    s.shapes.add_picture(path, Inches(x), Inches(y), Inches(w), Inches(h))


# ============================================================ 1 PORTADA
s = slide()
for i, (cx, cy, d) in enumerate([(11.35, 2.55, 3.9), (11.35, 2.55, 2.8), (11.35, 2.55, 1.7)]):
    shape(s, MSO_SHAPE.OVAL, cx - d / 2, cy - d / 2, d, d, None, RGBColor(0x12, 0x33, 0x48), 0.75)
tb(s, 0.7, 0.62, 7.6, 0.2,
   "UNIVERSIDAD TECNOLÓGICA DEL NORTE DE COAHUILA", 8.5, MUTED, True)
tb(s, 0.7, 0.86, 7.6, 0.3,
   "Ingeniería en Tecnologías de la Información e Innovación Digital", 8.5, CYAN, True)
tb(s, 0.66, 1.42, 8.0, 0.9, "Club Pingüí", 46, TEXT, True, spacing=0.9)
tb(s, 0.66, 2.3, 8.0, 0.7, "Presentación de avances", 33, CYAN, True, spacing=0.95)
tb(s, 0.7, 3.12, 6.9, 0.7,
   "Juego multijugador 3D que corre en el navegador: avatares, salas privadas, 17 armas, 8 mapas y un servidor en tiempo real.",
   11, MUTED, spacing=1.15)
tb(s, 0.7, 4.02, 6.0, 0.25, "Materia:  Formulación de Proyectos de Tecnología (7A)", 9, MUTED)
tb(s, 0.7, 4.3, 6.0, 0.25, "Docente:  Mtro. Domingo Fraga Hernández", 9, MUTED)
tb(s, 0.7, 4.58, 6.0, 0.25, "Avance:  Parcial octubre · Fase 1 y desarrollo", 9, MUTED)
tb(s, 0.7, 4.86, 6.0, 0.25, "Lugar:  Piedras Negras, Coahuila", 9, MUTED)
shape(s, MSO_SHAPE.RECTANGLE, 0.7, 5.42, 6.6, 0.008, LINE, None)
tb(s, 0.7, 5.58, 5.4, 0.34, "Luis Javier Tovar Segura", 17, TEXT, True)
tb(s, 0.7, 5.94, 5.4, 0.22, "ALUMNO · LÍDER DE PROYECTO Y DESARROLLADOR", 7.5, DIM, True)
tb(s, 9.55, 5.58, 3.2, 0.3, "27 de octubre de 2026", 12.5, AMBER, True, PP_ALIGN.RIGHT)
tb(s, 9.55, 5.9, 3.2, 0.22, "CORTE DE LA PRESENTACIÓN", 7.5, DIM, True, PP_ALIGN.RIGHT)

# pinguino
shape(s, MSO_SHAPE.OVAL, 10.62, 1.86, 2.5, 3.65, RGBColor(0x10, 0x1F, 0x36), CYAN, 1.0)
shape(s, MSO_SHAPE.OVAL, 11.06, 2.42, 1.62, 2.55, RGBColor(0xE8, 0xF1, 0xFB), None)
shape(s, MSO_SHAPE.OVAL, 10.42, 3.02, 0.34, 1.15, RGBColor(0x0D, 0x1A, 0x2D), CYAN, 0.6)
shape(s, MSO_SHAPE.OVAL, 12.98, 3.02, 0.34, 1.15, RGBColor(0x0D, 0x1A, 0x2D), CYAN, 0.6)
shape(s, MSO_SHAPE.OVAL, 11.2, 2.42, 0.44, 0.44, WHITE, None)
shape(s, MSO_SHAPE.OVAL, 11.78, 2.42, 0.44, 0.44, WHITE, None)
shape(s, MSO_SHAPE.OVAL, 11.31, 2.53, 0.22, 0.22, RGBColor(0x06, 0x0B, 0x14), None)
shape(s, MSO_SHAPE.OVAL, 11.89, 2.53, 0.22, 0.22, RGBColor(0x06, 0x0B, 0x14), None)
shape(s, MSO_SHAPE.ISOSCELES_TRIANGLE, 11.54, 2.86, 0.56, 0.34, AMBER, None).rotation = 180
shape(s, MSO_SHAPE.OVAL, 10.72, 5.28, 0.72, 0.24, AMBER, None)
shape(s, MSO_SHAPE.OVAL, 12.05, 5.28, 0.72, 0.24, AMBER, None)
shape(s, MSO_SHAPE.ISOSCELES_TRIANGLE, 11.62, 1.52, 0.5, 0.42, AMBER, None)
for i, t in enumerate(["17 armas", "8 mapas", "3 tuners", "160 h base"]):
    chip(s, 9.62 + i * 0.86, 6.42, t, "cy", w=0.8, h=0.2, size=6.4)


# ============================================================ 2 RESUMEN
s = slide()
header(s, "Ruta de la presentación", "Qué se construyó, cómo se mide y qué falta",
       "Las cuatro prácticas del parcial, los objetivos actualizados, la demostración de los módulos y los instrumentos de programación.")
kw = 2.32
for i, (lab, val, note, col) in enumerate([
        ("SPI", "1.13", "Cronograma adelantado", GREEN),
        ("CPI", "1.04", "Costo bajo control", GREEN),
        ("Valor ganado", "145.2 h", "de 160 h de línea base", CYAN),
        ("Armas", "17/17", "0 fallos de estructura", TEXT),
        ("Mapas", "8/8", "Sin errores de JavaScript", TEXT)]):
    kpi(s, 0.55 + i * (kw + 0.115), 1.62, kw, 0.98, lab, val, note, col, 17)

card(s, 0.55, 2.78, 6.0, 3.95)
tb(s, 0.7, 2.9, 5.7, 0.25, "Contenido", 10.5, TEXT, True)
items = ["Organización de fases · 4 fases, 15 actividades",
         "Seguimiento y validación de objetivos · O1–O6, OKR y valor ganado",
         "Estimación PERT · duración, varianza y probabilidad",
         "Gestión de recursos · presupuesto, roles y KPIs",
         "Demostración de módulos funcionando",
         "Gantt, PERT y cierre con próximos pasos"]
for i, it in enumerate(items):
    yy = 3.26 + i * 0.46
    tb(s, 0.72, yy, 0.4, 0.25, "%02d" % (i + 1), 9, CYAN, True)
    tb(s, 1.12, yy, 5.25, 0.3, it, 9, MUTED)

card(s, 6.68, 2.78, 6.1, 1.72)
tb(s, 6.84, 2.9, 5.8, 0.25, "Mensaje central", 10.5, TEXT, True)
tb(s, 6.84, 3.22, 5.78, 1.15,
   "El proyecto no se presenta con promesas: cada objetivo tiene una prueba que lo respalda y cada cifra proviene de un corte documentado. El corte de valor ganado es del 06/10/2026; el estado técnico se verificó el 27/10/2026.",
   9, MUTED, spacing=1.1)

card(s, 6.68, 4.62, 6.1, 2.11)
tb(s, 6.84, 4.74, 5.8, 0.25, "Validación en sala · 27/10/2026", 10.5, TEXT, True)
for i, t in enumerate(["connected", "avatar", "inRoom", "inventario", "recarga 16→14→16"]):
    chip(s, 6.84 + (i % 3) * 1.42, 5.08 + (i // 3) * 0.3, t, "ok", w=1.34, size=6.8)
tb(s, 6.84, 5.75, 5.78, 0.8,
   "Servidor node server/index.js activo · /healthz responde {\"ok\":true,\"sessions\":2} · 0 errores JS en consola.",
   8.5, MUTED, spacing=1.1)
footer(s, 2, "Club Pingüí · Presentación de avances · 27/10/2026")


# ============================================================ 3 FASES
s = slide()
header(s, "Práctica 1 · Organización de fases", "Cuatro fases para ordenar 15 actividades",
       "Agrupadas por el tipo de trabajo que producen, no por el orden en que se ocurrieron.")
fw = 2.98
fases = [
    ("1", "Inicio y Análisis", "A1 – A4", "Alcance, investigación, arquitectura y diseño preliminar de UI, personaje y escenarios.", "Diseño del proyecto y base técnica aprobada."),
    ("2", "Desarrollo", "A5 – A9", "Modelado 3D, base de datos, servidor en tiempo real, cliente 3D e interactividad.", "Juego jugable de extremo a extremo."),
    ("3", "Pruebas", "A10 – A11", "Integración, pruebas funcionales, concurrencia y carga con varios clientes.", "Evidencia PASS/FAIL y 0 regresiones."),
    ("4", "Cierre y Entrega", "A12 – A15", "Despliegue, documentación técnica, manual, avance del parcial y presentación.", "Versión publicada y aceptada."),
]
for i, (num, name, rng, desc, prod) in enumerate(fases):
    x = 0.55 + i * (fw + 0.1)
    card(s, x, 1.6, fw, 2.22)
    shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, x + 0.14, 1.72, 0.3, 0.3, RGBColor(0x0E, 0x2E, 0x3A), CYAN, 0.75, 0.25)
    tb(s, x + 0.14, 1.76, 0.3, 0.22, num, 9, CYAN, True, PP_ALIGN.CENTER)
    tb(s, x + 0.53, 1.75, fw - 0.65, 0.26, name, 10.5, TEXT, True)
    tb(s, x + 0.14, 2.1, fw - 0.28, 0.22, rng, 8, CYAN, True)
    tb(s, x + 0.14, 2.38, fw - 0.28, 0.85, desc, 8.2, MUTED, spacing=1.08)
    shape(s, MSO_SHAPE.RECTANGLE, x + 0.14, 3.3, fw - 0.28, 0.006, LINE, None)
    tb(s, x + 0.14, 3.4, fw - 0.28, 0.34, "Producto: " + prod, 7.6, DIM, spacing=1.02)

card(s, 0.55, 3.98, 12.23, 2.78)
tb(s, 0.72, 4.1, 6.0, 0.25, "Línea base del cronograma e hitos", 10.5, TEXT, True)
hitos = [("15/09/2026", "Línea base v1.0", "Plan y fechas aprobadas"),
         ("09–15/09", "A2 en curso", "Investigación de tecnologías"),
         ("26–30/10", "Avance del parcial", "Diseño · esta presentación"),
         ("06/11/2026", "Prototipo funcional", "Servidor + cliente 3D"),
         ("23/11/2026", "Versión estable", "Carga y correcciones"),
         ("02/12/2026", "Entrega final", "Juego + documentación")]
shape(s, MSO_SHAPE.RECTANGLE, 0.95, 4.72, 11.3, 0.012, RGBColor(0x2A, 0x4A, 0x6B), None)
for i, (d, t, sub) in enumerate(hitos):
    x = 0.95 + i * 1.9
    col = AMBER if i >= 2 else CYAN
    shape(s, MSO_SHAPE.OVAL, x - 0.05, 4.66, 0.13, 0.13, BG, col, 1.5)
    tb(s, x, 4.9, 1.75, 0.22, d, 8, AMBER if i >= 2 else MUTED, True)
    tb(s, x, 5.12, 1.75, 0.22, t, 8.5, TEXT, True)
    tb(s, x, 5.36, 1.7, 0.4, sub, 7.2, DIM, spacing=1.0)
tb(s, 0.72, 6.05, 11.9, 0.55,
   "Lectura: la línea base fija las fechas comprometidas; el seguimiento semanal registra fechas reales y recalcula el pronóstico. El avance del parcial se concentra en la Fase 1, pero el proyecto ya ejecutó trabajo de las fases 2 y 3.",
   7.8, DIM, spacing=1.05)
footer(s, 3, "Práctica 1 · Organización de fases")


# ============================================================ 4 OBJETIVOS
s = slide()
header(s, "Práctica 2 · Seguimiento y validación", "Seis objetivos, cada uno con indicador y evidencia",
       "SMART, con meta y objetivo diferenciados. Estado al 06/10/2026, actualizado con la verificación técnica del 27/10/2026.")
data = [
    ["Objetivo actualizado", "Indicador medible", "Plazo", "Estado"],
    ["O1. Desarrollar el núcleo multijugador: salas, emparejamiento y sincronización en el navegador.",
     "Suites de servidor, autenticación y lógica sin errores; una sesión conecta, entra a sala y sincroniza posiciones.",
     "25/10/2026", "95 % · validado en sala. Falta acta con 2+ clientes."],
    ["O2. Modelar y animar las 17 armas en primera persona, con estructura de piezas y agarre.",
     "17 de 17 armas pasan la suite de estructura con 0 fallos; sin alterar las medidas base.",
     "30/09/2026", "Cumplido · 17/17"],
    ["O3. Construir los 8 mapas con ambiente, relieve, paleta de colores y objetos colocados.",
     "Los 8 mapas construyen escena completa sin errores de JavaScript ni diferencias geométricas.",
     "04/10/2026", "Cumplido · 8/8"],
    ["O4. Producir tres tuners (aletas, armas y mapas) para ajustar sin editar código a mano.",
     "Cada tuner exporta bloques aplicables y envía su estado al lector local; los tres cargan sin errores.",
     "06/10/2026", "Cumplido · 3/3. Reserva: repetir revisión de mapatune."],
    ["O5. Mantener una validación automatizada de regresión contra funcionalidad ya entregada.",
     "Las suites se ejecutan en cada entrega y reportan PASS/FAIL; 0 regresiones desde la línea base.",
     "Continuo al 15/12", "Cumplido al corte"],
    ["O6. Entregar el juego completo con su documentación antes del cierre del cuatrimestre.",
     "Versión jugable publicada y aceptada por el docente en la revisión de cierre.",
     "15/12/2026", "En proceso · depende de los hitos de noviembre"],
]
colors = {(1, 3): AMBER, (2, 3): GREEN, (3, 3): GREEN, (4, 3): GREEN, (5, 3): GREEN, (6, 3): RGBColor(0x7C, 0xB3, 0xFF)}
table(s, 0.55, 1.62, 12.23, data, [4.15, 4.45, 1.15, 2.48], fs=8.1, row_h=0.70, head_h=0.3,
      aligns=["l", "l", "l", "l"], colors=colors, bolds={(r, 0): True for r in range(1, 7)})
tb(s, 0.55, 6.3, 12.2, 0.55,
   "Por qué O1 cambió de 75 % a 95 %: la verificación del 27/10 confirmó conexión, avatar, sala, inventario y recarga con 0 errores. El 5 % restante no es técnico: es la prueba formal con dos o más clientes y su acta. No se declara cumplido un objetivo sin la evidencia que su indicador exige.",
   7.8, DIM, spacing=1.08)
footer(s, 4, "Práctica 2 · Objetivos actualizados y justificados")


# ============================================================ 5 OKR + EVM
s = slide()
header(s, "Práctica 2 · OKR y valor ganado", "El avance se mide con resultados clave, no con horas trabajadas")
card(s, 0.55, 1.36, 6.0, 5.4)
tb(s, 0.72, 1.48, 5.7, 0.25, "Objetivo general y resultados clave (corte 06/10/2026)", 9.5, TEXT, True)
tb(s, 0.72, 1.76, 5.65, 0.5,
   "Entregar un juego multijugador 3D jugable antes del 15/12/2026, con 17 armas, 8 mapas y documentación.",
   8.2, MUTED, spacing=1.05)
okr = [("RK1 · 17 armas con estructura validada", 100, "100 %", GREEN),
       ("RK2 · 8 mapas construidos y verificados", 100, "100 %", GREEN),
       ("RK3 · 3 tuners operativos y exportables", 95, "95 %", CYAN),
       ("RK4 · sesiones multijugador estables", 95, "75 → 95 %", AMBER),
       ("RK5 · 0 regresiones en las suites", 100, "100 %", GREEN)]
for i, (lab, pct, txt, col) in enumerate(okr):
    y = 2.38 + i * 0.72
    tb(s, 0.72, y, 4.3, 0.22, lab, 8.6, MUTED)
    tb(s, 5.1, y, 1.25, 0.22, txt, 8.6, col, True, PP_ALIGN.RIGHT)
    bar(s, 0.72, y + 0.3, 5.63, pct, col, 0.07)
tb(s, 0.72, 6.08, 5.65, 0.55,
   "RK4 se actualiza con la verificación del 27/10. La tasa objetivo de Doerr (70 %) se supera en los cinco resultados; RK1, RK2 y RK5 se reevalúan porque ya están al 100 %.",
   7.4, DIM, spacing=1.05)

card(s, 6.68, 1.36, 6.1, 5.4)
tb(s, 6.84, 1.48, 5.8, 0.25, "Valor ganado · línea base de 160 h", 9.5, TEXT, True)
evm = [["Indicador", "Valor", "Lectura"],
       ["PV · valor planeado", "128.0 h", "80 % de 160 h"],
       ["EV · valor ganado", "145.2 h", "90.75 % real"],
       ["AC · costo real", "140.0 h", "Horas invertidas"],
       ["SV · variación de cronograma", "+17.2 h", "Adelanto"],
       ["CV · variación de costo", "+5.2 h", "Bajo lo presupuestado"],
       ["SPI · índice de cronograma", "1.13", "> 1: adelantado"],
       ["CPI · índice de costo", "1.04", "≈ 1: conforme"]]
colors = {(2, 1): CYAN, (4, 1): GREEN, (5, 1): GREEN, (6, 1): GREEN, (7, 1): GREEN}
table(s, 6.84, 1.8, 5.78, evm, [2.45, 1.05, 2.28], fs=8.2, row_h=0.37, head_h=0.28,
      aligns=["l", "r", "l"], colors=colors, bolds={(r, 1): True for r in range(1, 8)})
card(s, 6.84, 5.15, 5.78, 0.72, RGBColor(0x0C, 0x18, 0x2A), LINE)
tb(s, 6.96, 5.24, 5.55, 0.18, "PONDERACIÓN DEL AVANCE", 7, MUTED, True)
tb(s, 6.96, 5.44, 5.55, 0.3, "Armas 30 % · Mapas 25 % · Multijugador 25 % · Tuners 12 % · Documentación 8 %",
   7.6, TEXT)
tb(s, 6.84, 6.0, 5.8, 0.62,
   "Nota metodológica: las cifras corresponden al corte del 06/10/2026 y no se recalculan al 27/10 para no inventar avance. Lo que sí se actualiza es el estado técnico, verificado en sala.",
   7.4, DIM, spacing=1.05)
footer(s, 5, "Práctica 2 · OKR, línea base y control")


# ============================================================ 6 PERT
s = slide()
header(s, "Práctica 3 · Técnicas de estimación", "PERT convierte la incertidumbre en una fecha con probabilidad")
card(s, 0.55, 1.36, 4.1, 0.98)
tb(s, 0.7, 1.46, 3.8, 0.18, "DURACIÓN ESPERADA", 7, MUTED, True)
tb(s, 0.7, 1.64, 3.8, 0.3, "TE = (O + 4M + P) / 6", 15, TEXT, True)
tb(s, 0.7, 2.0, 3.8, 0.2, "σ² = ((P − O) / 6)²", 9, CYAN, True)
kw = 1.95
for i, (lab, val, note, col) in enumerate([
        ("Σ TE de las 15 actividades", "111.85 d", "Si todo fuera secuencial", CYAN),
        ("Ruta crítica", "85.17 d", "17.03 semanas de trabajo", AMBER),
        ("σ del proyecto", "4.02 d", "Varianza de la ruta: 16.19", TEXT),
        ("Probabilidad ≤ 90 d", "88 %", "Z = 1.20", GREEN)]):
    kpi(s, 4.78 + i * (kw + 0.1), 1.36, kw, 0.98, lab, val, note, col, 17)

card(s, 0.55, 2.5, 6.3, 4.3)
tb(s, 0.7, 2.62, 6.0, 0.25, "Actividades con mayor incertidumbre", 9.5, TEXT, True)
data = [["ID", "Actividad", "O", "M", "P", "TE", "σ"],
        ["A8", "Cliente 3D: mundo, avatares y cámara", "10", "15", "22", "15.33", "2.00"],
        ["A9", "Interactividad: chat, salas y juego", "8", "13", "20", "13.33", "2.00"],
        ["A7", "Servidor y comunicación en tiempo real", "8", "12", "18", "12.33", "1.67"],
        ["A5", "Modelado 3D de personaje y escenarios", "8", "12", "18", "12.33", "1.67"],
        ["A4", "Diseño preliminar (UI y escenarios)", "6", "9", "13", "9.17", "1.17"],
        ["A15", "Presentación final", "1", "2", "3", "2.00", "0.33"]]
colors = {(1, 6): CORAL, (2, 6): CORAL, (3, 6): AMBER, (4, 6): AMBER}
table(s, 0.7, 2.95, 6.0, data, [0.45, 3.15, 0.45, 0.45, 0.45, 0.6, 0.45], fs=8.2,
      row_h=0.42, head_h=0.27, aligns=["l", "l", "r", "r", "r", "r", "r"],
      colors=colors, bolds={(r, 0): True for r in range(1, 7)})
tb(s, 0.7, 6.05, 6.0, 0.55,
   "A8 es la actividad más larga y la de mayor varianza; está en la ruta crítica, por eso concentra atención y recursos.",
   7.6, DIM, spacing=1.05)

card(s, 7.0, 2.5, 5.78, 2.05)
tb(s, 7.15, 2.62, 5.5, 0.25, "Lectura probabilística", 9.5, TEXT, True)
tb(s, 7.15, 2.95, 1.3, 0.5, "88 %", 30, GREEN, True)
tb(s, 8.45, 3.02, 4.2, 0.25, "de terminar en ≤ 90 días", 8.5, MUTED)
bar(s, 8.45, 3.32, 4.1, 88, GREEN, 0.08)
tb(s, 8.45, 3.48, 4.1, 0.22, "Z = (90 − 85.17) / 4.02 = 1.20 → P ≈ 0.88", 7.6, DIM)
tb(s, 7.15, 3.78, 5.45, 0.65,
   "La estimación no es un solo número: es una distribución. Con 85.17 días de media y σ = 4.02, el compromiso de 90 días tiene 88 % de probabilidad de cumplirse.",
   8.2, MUTED, spacing=1.08)
card(s, 7.0, 4.7, 5.78, 2.1)
tb(s, 7.15, 4.82, 5.5, 0.25, "Actividades con holgura", 9.5, TEXT, True)
for i, (t, v) in enumerate([("A6", "44.0 d"), ("A7", "24.5 d"), ("A13", "2.17 d"), ("A14", "57.5 d")]):
    chip(s, 7.15 + i * 1.36, 5.16, t + " · " + v, "cy", w=1.28, size=7)
tb(s, 7.15, 5.56, 5.45, 1.05,
   "Pueden retrasarse hasta su margen sin mover la fecha final. A13 es la más frágil: solo 2.17 días de holgura. A14 no tiene sucesora y su LF se toma del fin del proyecto.",
   8.2, MUTED, spacing=1.1)
footer(s, 6, "Práctica 3 · Estimación por tres valores (PERT)")


# ============================================================ 7 RECURSOS
s = slide()
header(s, "Práctica 4 · Gestión de recursos", "Un proyecto individual con presupuesto, roles y límites claros",
       "Recursos identificados, asignados y monitoreados. Cifras estimadas en pesos mexicanos para un proyecto escolar.")
kw = 2.96
for i, (lab, val, note, col) in enumerate([
        ("Desembolso nuevo", "$3,025", "MXN · lo que realmente se gasta", AMBER),
        ("Valor total de recursos", "$21,025", "MXN · incluye equipo disponible", TEXT),
        ("Esfuerzo de línea base", "160 h", "Base del valor ganado", CYAN),
        ("Reserva de contingencia", "10 %", "$275 sobre $2,750", TEXT)]):
    kpi(s, 0.55 + i * (kw + 0.11), 1.6, kw, 0.98, lab, val, note, col, 19)

card(s, 0.55, 2.72, 6.0, 4.05)
tb(s, 0.7, 2.84, 5.7, 0.25, "Presupuesto de desembolso", 9.5, TEXT, True)
data = [["Concepto", "Tipo", "MXN"],
        ["Hospedaje / VPS para Node.js y Socket.IO", "Variable · 4 meses", "$900.00"],
        ["Dominio para publicar la plataforma", "Fijo · 1 año", "$300.00"],
        ["Internet (parte proporcional)", "Fijo · 4 meses", "$1,200.00"],
        ["Energía eléctrica (prorrateada)", "Variable · 4 meses", "$350.00"],
        ["Reserva de contingencia", "Reserva", "$275.00"],
        ["Subtotal", "", "$3,025.00"]]
table(s, 0.7, 3.2, 5.7, data, [3.0, 1.7, 1.0], fs=8.0, row_h=0.4, head_h=0.27,
      aligns=["l", "l", "r"], colors={(6, 2): AMBER}, bolds={(6, 0): True, (6, 2): True})
tb(s, 0.7, 6.12, 5.7, 0.5,
   "El equipo de cómputo ($18,000) y el software open source ($0) ya están disponibles: suman valor, pero no desembolso.",
   7.4, DIM, spacing=1.05)

card(s, 6.68, 2.72, 6.1, 4.05)
tb(s, 6.84, 2.84, 5.8, 0.25, "Roles y dedicación", 9.5, TEXT, True)
data = [["Rol", "Responsable", "Horas"],
        ["Líder de proyecto", "Luis Javier Tovar Segura", "—"],
        ["Desarrollador full-stack", "Luis Javier Tovar Segura", "95"],
        ["Diseñador 3D y UX", "Luis Javier Tovar Segura", "35"],
        ["Aseguramiento de calidad", "Luis Javier Tovar Segura", "20"],
        ["Documentación y cierre", "Luis Javier Tovar Segura", "10"],
        ["Asesor y validación", "Mtro. Domingo Fraga Hernández", "2 h / quincena"],
        ["Usuarios de prueba", "Compañeros del grupo", "5 × 1 h"]]
table(s, 6.84, 3.2, 5.78, data, [1.85, 2.85, 1.08], fs=7.8, row_h=0.36, head_h=0.27,
      aligns=["l", "l", "r"])
tb(s, 6.84, 6.02, 5.8, 0.6,
   "Control: RACI con responsable único por entregable y revisión del asesor en cada gate. KPIs: horas reales vs. planeadas, desviación de costo y disponibilidad del servidor.",
   7.4, DIM, spacing=1.05)
footer(s, 7, "Práctica 4 · Recursos financieros, humanos y materiales")


# ============================================================ 8 TÉCNICAS
s = slide()
header(s, "Técnicas investigadas y cómo se aplicaron", "Ocho técnicas, ocho decisiones concretas",
       "No se citan como teoría: cada una dejó un artefacto verificable en el proyecto.")
tec = [
    ("MBO · Drucker", "Administración por objetivos", "Meta y objetivos con responsable único.", "O1–O6 con indicador y fecha.", "vi"),
    ("SMART · Doran", "Criterios SMART", "Específico, medible, alcanzable, relevante y con plazo.", "“17/17 armas, 0 fallos, 30/09”.", "cy"),
    ("OKR · Doerr", "Objetivos y resultados clave", "Un objetivo ambicioso con 3–5 resultados medibles.", "RK1–RK5 con % de avance.", "ok"),
    ("PMBOK", "Línea base y control", "Recolectar, comparar, decidir y reportar.", "Alcance congelado y control de cambios.", "plan"),
    ("EVM", "Valor ganado", "PV, EV, AC, SV, CV, SPI y CPI sobre 160 h.", "SPI 1.13 y CPI 1.04 al 06/10.", "wip"),
    ("Scrum", "Iteraciones con DoD", "Cada entrega cumple una Definición de Hecho.", "Suites PASS antes de integrar.", "vi"),
    ("Stage-Gate", "Revisión por etapas", "Un gate no se abre si el criterio no se cumple.", "Cuatro gates con evidencia.", "co"),
    ("Validación", "Validación de alcance", "El alcance se acepta con evidencia, no con percepciones.", "Pruebas en sala y capturas reales.", "cy"),
]
cw, ch = 2.98, 2.18
for i, (tag, title, desc, app, kind) in enumerate(tec):
    x = 0.55 + (i % 4) * (cw + 0.1)
    y = 1.5 + (i // 4) * (ch + 0.12)
    card(s, x, y, cw, ch)
    chip(s, x + 0.14, y + 0.13, tag, kind, w=1.3, size=6.4)
    tb(s, x + 0.14, y + 0.44, cw - 0.28, 0.3, title, 9.8, TEXT, True)
    tb(s, x + 0.14, y + 0.8, cw - 0.28, 0.7, desc, 7.8, MUTED, spacing=1.05)
    shape(s, MSO_SHAPE.RECTANGLE, x + 0.14, y + 1.55, cw - 0.28, 0.006, LINE, None)
    tb(s, x + 0.14, y + 1.65, cw - 0.28, 0.42, "→ " + app, 7.4, CYAN, spacing=1.02)

card(s, 0.55, 6.12, 12.23, 0.68, RGBColor(0x0B, 0x17, 0x28), RGBColor(0x16, 0x3A, 0x4C))
shape(s, MSO_SHAPE.RECTANGLE, 0.55, 6.12, 0.035, 0.68, CYAN, None)
tb(s, 0.75, 6.2, 11.85, 0.52,
   "La técnica sirve cuando cambia una decisión. El valor ganado no adornó una tabla: fue el argumento para mantener la fecha de O6. El Stage-Gate evitó declarar cerrado el tuner de mapas sin repetir su verificación.",
   8.2, MUTED, spacing=1.08)
footer(s, 8, "Marco metodológico aplicado")


# ============================================================ 9 OBJETIVOS 27/10
s = slide()
header(s, "Objetivos actualizados · estado al 27/10/2026", "Qué está cerrado, qué está validado y qué falta")
objs = [
    ("O1 · Núcleo multijugador", "95 %", 95, AMBER, "wip",
     "Conexión, avatar, sala y sincronización verificados en sala. Falta: prueba formal con 2+ clientes y acta.", "Era 75 % al 06/10. El avance es técnico."),
    ("O2 · 17 armas", "100 %", 100, GREEN, "ok",
     "17/17 armas pasan la suite de estructura con 0 fallos. Piezas, agarre y morro validados por tipo.", "Evidencia: suite de estructura y tuner."),
    ("O3 · 8 mapas", "100 %", 100, GREEN, "ok",
     "8/8 mapas construyen escena completa sin errores de JavaScript ni diferencias geométricas.", "Evidencia: suites de mundo y capturas."),
    ("O4 · 3 tuners", "100 %*", 100, CYAN, "ok",
     "Aletas, armas y mapas cargan y exportan bloques aplicables. Reserva: repetir verificación de mapatune.", "*Cumplido con reserva documentada."),
    ("O5 · Regresión", "100 %", 100, GREEN, "ok",
     "0 regresiones desde la línea base. Las suites se ejecutan antes de integrar cada cambio.", "Evidencia: PASS/FAIL por entrega."),
    ("O6 · Entrega final", "En proceso", 70, BLUE, "plan",
     "Depende del prototipo (06/11), la versión estable (23/11) y la aceptación del docente (15/12).", "SPI 1.13 respalda mantener la fecha."),
]
cw, ch = 3.96, 2.2
for i, (title, val, pct, col, kind, desc, note) in enumerate(objs):
    x = 0.55 + (i % 3) * (cw + 0.17)
    y = 1.42 + (i // 3) * (ch + 0.14)
    card(s, x, y, cw, ch)
    tb(s, x + 0.16, y + 0.14, cw - 1.2, 0.25, title, 10, TEXT, True)
    chip(s, x + cw - 1.06, y + 0.13, val, kind, w=0.9, size=6.8)
    bar(s, x + 0.16, y + 0.52, cw - 0.32, pct, col, 0.07)
    tb(s, x + 0.16, y + 0.7, cw - 0.32, 0.9, desc, 7.8, MUTED, spacing=1.06)
    shape(s, MSO_SHAPE.RECTANGLE, x + 0.16, y + 1.68, cw - 0.32, 0.006, LINE, None)
    tb(s, x + 0.16, y + 1.78, cw - 0.32, 0.34, note, 7.0, DIM, spacing=1.0)

card(s, 0.55, 6.15, 12.23, 0.66, RGBColor(0x0B, 0x17, 0x28), LINE)
tb(s, 0.72, 6.24, 11.9, 0.5,
   "Justificación: O2, O3 y O5 se cierran con evidencia reproducible; O1 y O4 tienen validación técnica pero conservan una condición formal. No se sube un objetivo a 100 % hasta que su indicador se cumple por completo.",
   8.0, MUTED, spacing=1.05)
footer(s, 9, "Objetivos · actualización y justificación")


# ============================================================ 10 GATES
s = slide()
header(s, "Validación por etapas · Stage-Gate", "Cuatro puertas y una regla: sin evidencia no se abre",
       "Cada gate tiene criterio de salida explícito y evidencia asociada. Evita declarar terminado lo que solo “se ve bien”.")
gates = [
    ("01", "Diseño y alcance", "ok", "Aprobado · 06/10",
     "Alcance, arquitectura, objetivos y presupuesto definidos y aprobados.",
     "Práctica 1 (fases), Práctica 2 (O1–O6 y EVM), Práctica 4 (recursos) y línea base 15/09."),
    ("02", "Contenido 3D", "ok", "Aprobado · 04/10",
     "17/17 armas y 8/8 mapas construidos sin errores de JavaScript.",
     "Suite de estructura de armas (0 fallos) y suite de mundo (0 diferencias geométricas)."),
    ("03", "Multijugador", "wip", "Aprobado con condición",
     "Sesión estable con sala, avatar, sincronización e inventario.",
     "Verificación del 27/10 con 0 errores JS. Condición: acta con 2+ clientes."),
    ("04", "Cierre y entrega", "plan", "Programado · 15/12",
     "Versión publicada, documentación completa y aceptación del docente.",
     "Pendiente: despliegue final, manual de usuario y acta de aceptación."),
]
for i, (num, title, kind, status, crit, ev) in enumerate(gates):
    x = 0.55 + i * 3.08
    card(s, x, 1.55, 2.96, 3.6)
    tb(s, x + 2.0, 1.73, 0.82, 0.18, "GATE " + num, 7.0, RGBColor(0x35, 0x62, 0x7D), True, PP_ALIGN.RIGHT)
    chip(s, x + 0.15, 1.68, status, kind, w=1.75, size=6.3)
    tb(s, x + 0.15, 2.02, 2.66, 0.3, title, 10.5, TEXT, True)
    tb(s, x + 0.15, 2.4, 2.66, 0.22, "CRITERIO DE SALIDA", 6.6, MUTED, True)
    tb(s, x + 0.15, 2.6, 2.66, 0.85, crit, 7.6, MUTED, spacing=1.06)
    shape(s, MSO_SHAPE.RECTANGLE, x + 0.15, 4.12, 2.66, 0.006, LINE, None)
    tb(s, x + 0.15, 4.2, 2.66, 0.9, ev, 7.2, DIM, spacing=1.05)

card(s, 0.55, 5.35, 6.0, 1.42)
tb(s, 0.72, 5.45, 5.7, 0.22, "Lo que un gate detuvo", 9.5, TEXT, True)
bullets(s, 0.72, 5.72, 5.65, 0.95, [
    ("Declarar cerrado O4 ", "sin repetir la verificación de mapatune."),
    ("Publicar la versión estable ", "antes de las pruebas de concurrencia (A11).")], 7.8, AMBER, AMBER, 3)

card(s, 6.68, 5.35, 6.1, 1.42)
tb(s, 6.84, 5.45, 5.8, 0.22, "Lo que un gate habilitó", 9.5, TEXT, True)
bullets(s, 6.84, 5.72, 5.78, 0.95, [
    ("Demostrar en sala ", "con evidencia verificable y 0 errores."),
    ("Mantener la fecha de O6 ", "con el argumento del SPI (1.13).")], 7.8, MUTED, GREEN, 3)
footer(s, 10, "Stage-Gate · criterios de salida y evidencia")


# ============================================================ 11 DEMO NÚCLEO
s = slide()
header(s, "Demostración 1 · Núcleo multijugador", "El jugador entra, aparece y sincroniza")
pic(s, os.path.join(IMG, "11-lobby-nevado.png"), 0.55, 1.42, 7.55, 4.25)
shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, 0.55, 5.70, 7.55, 0.32, RGBColor(0x08, 0x10, 0x1C), LINE, 0.5, 0.2)
tb(s, 0.7, 5.77, 7.25, 0.2, "Pueblo Nevado · avatar propio en tercera persona, HUD y mundo cargado en el navegador.", 7.4, MUTED)

card(s, 8.32, 1.42, 4.46, 2.72)
tb(s, 8.48, 1.54, 4.15, 0.22, "Verificación del 27/10/2026", 9.5, TEXT, True)
bullets(s, 8.48, 1.84, 4.1, 2.2, [
    ("connected · ", "socket activo contra Node.js."),
    ("avatar · ", "modelo del pingüino con apariencia guardada."),
    ("inRoom · ", "sala privada creada y jugador dentro."),
    ("sync · ", "posición y estado replicados por Socket.IO."),
    ("0 errores JS ", "en consola durante la sesión.")], 7.6, MUTED, GREEN, 5)

card(s, 8.32, 4.3, 4.46, 1.57)
tb(s, 8.48, 4.42, 4.1, 0.22, "Servidor en ejecución", 9.5, TEXT, True)
shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, 8.48, 4.7, 4.13, 0.72, RGBColor(0x08, 0x10, 0x1C), LINE, 0.5, 0.06)
tb(s, 8.6, 4.78, 3.9, 0.6, "$ node server/index.js\nGET /healthz → {\"ok\":true,\"sessions\":2}", 7.6, RGBColor(0x9F, 0xE8, 0xFF), font="Consolas", spacing=1.1)
tb(s, 8.48, 5.52, 4.1, 0.25, "PID 12932 · Express 5 + Socket.IO 4 · puerto 3000", 6.8, DIM)

card(s, 0.55, 6.08, 12.23, 0.78, RGBColor(0x0B, 0x17, 0x28), LINE)
tb(s, 0.72, 6.18, 11.9, 0.6,
   "Resultado: la sesión se establece, el avatar se renderiza y la sala se sincroniza. El núcleo multijugador queda validado técnicamente; la evidencia formal pendiente es el acta con dos o más clientes.",
   8.2, MUTED, spacing=1.08)
footer(s, 11, "Módulo funcionando · núcleo multijugador")


# ============================================================ 12 DEMO MUNDO
s = slide()
header(s, "Demostración 2 · Cliente 3D", "Ocho mapas y dos cámaras sobre el mismo mundo",
       "La escena se construye en Three.js con relieve, vegetación instanciada, iluminación y colisiones. La cámara cambia sin recargar.")
pic(s, os.path.join(IMG, "12-pradera-tercera.png"), 0.55, 1.58, 6.0, 3.38)
pic(s, os.path.join(IMG, "13-pradera-primera.png"), 6.78, 1.58, 6.0, 3.38)
shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, 0.55, 4.98, 6.0, 0.3, RGBColor(0x08, 0x10, 0x1C), LINE, 0.5, 0.2)
tb(s, 0.7, 5.04, 5.75, 0.2, "Pradera de Flores · tercera persona, armas y HUD de sala.", 7.4, MUTED)
shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, 6.78, 4.98, 6.0, 0.3, RGBColor(0x08, 0x10, 0x1C), LINE, 0.5, 0.2)
tb(s, 6.93, 5.04, 5.75, 0.2, "Misma partida · primera persona con viewmodel del arma.", 7.4, MUTED)
kw = 2.96
for i, (lab, val, note, col) in enumerate([
        ("Mapas construidos", "8/8", "Sin errores de JavaScript", CYAN),
        ("Cámara", "3ª ↔ 1ª", "Alterna sin recargar", TEXT),
        ("Controles", "PC + móvil", "Teclado, ratón y táctil", TEXT),
        ("Colisiones", "Activas", "Mundo y obstáculos", GREEN)]):
    kpi(s, 0.55 + i * (kw + 0.11), 5.55, kw, 1.0, lab, val, note, col, 17)
footer(s, 12, "Módulo funcionando · mundo 3D y cámaras")


# ============================================================ 13 DEMO INVENTARIO
s = slide()
header(s, "Demostración 3 · Armas, inventario y móvil", "Del arma en la mano al inventario táctil")
pic(s, os.path.join(IMG, "14-pradera-inventario.png"), 0.55, 1.42, 7.1, 3.99)
shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, 0.55, 5.43, 7.1, 0.3, RGBColor(0x08, 0x10, 0x1C), LINE, 0.5, 0.2)
tb(s, 0.7, 5.49, 6.8, 0.2, "Inventario en escritorio · objetos, munición y ranuras de uso rápido.", 7.4, MUTED)
pic(s, os.path.join(IMG, "17-movil-inventario.png"), 7.86, 1.42, 4.92, 2.27)
shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, 7.86, 3.70, 4.92, 0.3, RGBColor(0x08, 0x10, 0x1C), LINE, 0.5, 0.2)
tb(s, 8.0, 3.76, 4.65, 0.2, "Inventario en móvil · 844 × 390, interfaz táctil.", 7.4, MUTED)
card(s, 7.86, 4.12, 4.92, 1.72)
tb(s, 8.0, 4.23, 4.6, 0.22, "Comportamiento verificado", 9.5, TEXT, True)
for i, t in enumerate(["abre / cierra", "recarga 16→14→16", "uso de objeto"]):
    chip(s, 8.0 + i * 1.55, 4.55, t, "ok", w=1.44, size=6.2)
tb(s, 8.0, 4.92, 4.62, 0.8,
   "17 armas · 9 tipos de pieza · 4 ranuras de inventario · controles táctiles visibles solo dentro de sala.",
   7.6, MUTED, spacing=1.06)
card(s, 0.55, 5.78, 7.1, 1.0, RGBColor(0x0B, 0x17, 0x28), LINE)
tb(s, 0.72, 5.9, 6.8, 0.75,
   "El inventario se abre y cierra sin salir de la partida; la recarga consume munición y la devuelve al terminar. La misma lógica responde a teclado y a toque.",
   8.2, MUTED, spacing=1.08)
footer(s, 13, "Módulo funcionando · combate, inventario y responsive")


# ============================================================ 14 TUNER
s = slide()
header(s, "Herramienta de producción · Tuner de armas", "17 armas editables sin tocar el código a mano",
       "Evidencia secundaria: demuestra la herramienta, no la calidad artística del juego. El escenario es oscuro a propósito para resaltar la geometría.")
pic(s, os.path.join(IMG, "19-tuner-sniper-lado.png"), 0.55, 1.58, 5.95, 3.35)
pic(s, os.path.join(IMG, "20-tuner-maza.png"), 6.83, 1.58, 5.95, 3.35)
shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, 0.55, 4.93, 5.95, 0.3, RGBColor(0x08, 0x10, 0x1C), LINE, 0.5, 0.2)
tb(s, 0.7, 4.99, 5.7, 0.2, "Tuner · rifle de francotirador con piezas y controles de posición/rotación.", 7.4, MUTED)
shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, 6.83, 4.93, 5.95, 0.3, RGBColor(0x08, 0x10, 0x1C), LINE, 0.5, 0.2)
tb(s, 6.98, 4.99, 5.7, 0.2, "Tuner · maza, un arma de cuerpo a cuerpo con geometría distinta.", 7.4, MUTED)

card(s, 0.55, 5.38, 6.0, 1.45)
tb(s, 0.72, 5.48, 5.7, 0.22, "Qué permite editar", 9.5, TEXT, True)
for i, t in enumerate(["9 tipos de pieza", "x / y / z", "rx / ry / rz", "escala", "material", "visibilidad"]):
    chip(s, 0.72 + (i % 3) * 1.85, 5.78 + (i // 3) * 0.32, t, "cy", w=1.72, size=6.4)
tb(s, 0.72, 6.45, 5.65, 0.3, "Servidor de assets del proyecto · three.js 0.185", 6.8, DIM)

card(s, 6.83, 5.38, 5.95, 1.45)
tb(s, 6.98, 5.48, 5.65, 0.22, "Resultado de la verificación", 9.5, TEXT, True)
tb(s, 6.98, 5.76, 5.65, 0.95,
   "9/9 tipos de pieza disponibles · 17/17 armas cargan · exportación de WEAPON_PARTS con sintaxis JavaScript válida · 0 errores en consola.",
   8.0, MUTED, spacing=1.08)
footer(s, 14, "O4 · Tuner de estructura de armas")


# ============================================================ 15 GANTT
s = slide()
header(s, "Programación · Diagrama de Gantt", "Quince actividades en 18 semanas de trabajo",
       "Barras calculadas con la duración esperada (TE) de PERT y las precedencias reales. Escala en semanas de 5 días: 85.17 d = 17.03 semanas.")
pic(s, os.path.join(IMG, "30-gantt.png"), 0.55, 1.52, 12.23, 5.29)
footer(s, 15, "Diagrama de Gantt · 15 actividades · S1–S18")


# ============================================================ 16 PERT
s = slide()
header(s, "Programación · Diagrama de PERT / CPM", "La red muestra dónde no hay margen",
       "Nodos con duración esperada (TE). Las flechas rojas forman la ruta crítica; las azules son dependencias con holgura.")
pic(s, os.path.join(IMG, "31-pert.png"), 0.55, 1.52, 12.23, 5.17)
shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, 0.55, 6.72, 12.23, 0.26, RGBColor(0x0B, 0x17, 0x28), LINE, 0.5, 0.2)
tb(s, 0.7, 6.77, 11.9, 0.18,
   "Ruta crítica: A1 → A2 → A3 → A4 → A5 → A8 → A9 → A10 → A11 → A12 → A15 · 85.17 d · A8 es la actividad más larga (15.33 d).",
   6.9, MUTED)
footer(s, 16, "PERT / CPM · ruta crítica y holguras")


# ============================================================ 17 CIERRE
s = slide()
header(s, "Conclusiones y próximos pasos", "El avance es real, medible y todavía incompleto")
card(s, 0.55, 1.42, 6.0, 2.1)
tb(s, 0.71, 1.53, 5.7, 0.22, "Lo que demuestra el avance", 9.5, TEXT, True)
bullets(s, 0.71, 1.82, 5.65, 1.6, [
    ("Producto ejecutable: ", "servidor, cliente 3D, armas, mapas y móvil."),
    ("Evidencia por objetivo: ", "suite o captura, no percepciones."),
    ("Planeación que funciona: ", "SPI 1.13 y CPI 1.04 al corte.")], 8.0, MUTED, GREEN, 4)

card(s, 0.55, 3.66, 6.0, 1.95)
tb(s, 0.71, 3.77, 5.7, 0.22, "Lo que falta y cómo se cierra", 9.5, TEXT, True)
bullets(s, 0.71, 4.06, 5.65, 1.45, [
    ("O1: ", "acta de prueba con 2+ clientes simultáneos."),
    ("O4: ", "repetir la verificación final del tuner de mapas."),
    ("O6: ", "carga (A11), despliegue (A12) y aceptación docente.")], 8.0, MUTED, AMBER, 4)

card(s, 6.68, 1.42, 6.1, 2.35)
tb(s, 6.84, 1.53, 5.8, 0.22, "Próximos hitos", 9.5, TEXT, True)
hitos = [("06/11", "Prototipo funcional"), ("23/11", "Versión estable"), ("02/12", "Entrega final")]
shape(s, MSO_SHAPE.RECTANGLE, 7.05, 2.02, 5.4, 0.01, RGBColor(0x2A, 0x4A, 0x6B), None)
for i, (d, t) in enumerate(hitos):
    x = 7.05 + i * 1.85
    shape(s, MSO_SHAPE.OVAL, x - 0.05, 1.97, 0.12, 0.12, BG, AMBER, 1.5)
    tb(s, x, 2.15, 1.7, 0.2, d, 7.6, AMBER, True)
    tb(s, x, 2.36, 1.7, 0.5, t, 8.2, TEXT, True, spacing=1.0)
tb(s, 6.84, 3.02, 5.8, 0.6,
   "El prototipo integra servidor y cliente 3D; la versión estable cierra carga y correcciones; la entrega final incluye documentación y aceptación.",
   7.6, MUTED, spacing=1.08)

card(s, 6.68, 3.92, 6.1, 1.69)
tb(s, 6.84, 4.02, 5.8, 0.22, "Riesgos vivos", 9.5, TEXT, True)
data = [["Riesgo", "Mitigación"],
        ["A8 se retrasa", "Es crítica: seguimiento semanal y margen de 4.83 d a 90 días."],
        ["Prueba con 2+ clientes", "Agendar sesión y documentar acta antes del prototipo."]]
table(s, 6.84, 4.32, 5.78, data, [1.7, 4.08], fs=7.2, row_h=0.45, head_h=0.24)
footer(s, 17, "Conclusiones · estado al 27/10/2026")


# ============================================================ 18 ANEXO
s = slide()
header(s, "Anexo · preguntas previsibles y fuentes", "Respuestas cortas con respaldo técnico")
qa = [
    ("¿Por qué 18 semanas si el cuatrimestre es sep–dic?", "El PERT usa días de trabajo (5 d/semana): 85.17 d = 17.03 semanas. S1–S18 es la escala del instrumento; el calendario escolar va en los hitos."),
    ("¿Por qué el valor ganado es del 06/10?", "Es el último corte con PV, EV y AC completos y auditables. Actualizarlo sin recalcular las tres variables sería inventar cifras."),
    ("Si O1 está al 95 %, ¿por qué no al 100 %?", "Su indicador exige prueba con 2+ clientes y acta. La verificación individual no satisface el criterio completo."),
    ("¿Por qué A14 tiene 57.5 d de holgura?", "No tiene sucesora: su LF se toma del fin del proyecto. Es una entrega de avance, no una actividad de la ruta crítica."),
    ("¿El tuner es parte del juego?", "Es una herramienta de producción. Su escenario oscuro no es evidencia visual del juego; demuestra edición y exportación."),
    ("¿Qué pasa si A8 se retrasa?", "Es crítica y la de mayor varianza: su retraso se traslada a la fecha. De ahí el 88 % a 90 días y el seguimiento semanal."),
]
cw, ch = 3.96, 1.55
for i, (q, a) in enumerate(qa):
    x = 0.55 + (i % 3) * (cw + 0.17)
    y = 1.42 + (i // 3) * (ch + 0.13)
    card(s, x, y, cw, ch)
    shape(s, MSO_SHAPE.RECTANGLE, x, y + 0.12, 0.03, ch - 0.24, CYAN, None)
    tb(s, x + 0.14, y + 0.12, cw - 0.28, 0.4, q, 7.8, CYAN, True, spacing=1.02)
    tb(s, x + 0.14, y + 0.56, cw - 0.28, 0.9, a, 7.2, MUTED, spacing=1.04)

card(s, 0.55, 4.78, 7.0, 2.05)
tb(s, 0.71, 4.88, 6.7, 0.22, "Fuentes", 9.5, TEXT, True)
src = ("Cooper, R. G. (2017). Winning at New Products. Stage-Gate.   ·   Doerr, J. (2018). Measure What Matters. OKR.\n"
       "Doran, G. T. (1981). There's a S.M.A.R.T. way to write management's goals and objectives. Management Review.\n"
       "Drucker, P. (1954). The Practice of Management. MBO.   ·   Kerzner, H. (2022). Project Management: A Systems Approach.\n"
       "PMI (2021). PMBOK Guide, 7.ª ed.   ·   Schwaber, K. y Sutherland, J. (2020). The Scrum Guide.")
tb(s, 0.71, 5.18, 6.68, 1.45, src, 7.0, MUTED, spacing=1.12)

card(s, 7.72, 4.78, 5.06, 2.05)
tb(s, 7.88, 4.88, 4.75, 0.22, "Documentos del proyecto", 9.5, TEXT, True)
tb(s, 7.88, 5.18, 4.72, 1.0,
   "Organización de fases · Prácticas 2–4 · Investigaciones 6 y 9 · bitácora de modificaciones · documentación técnica · manual de usuario.",
   7.6, MUTED, spacing=1.1)
for i, t in enumerate(["HTML navegable", "PDF 18 pág.", "PPTX editable"]):
    chip(s, 7.88 + i * 1.52, 6.3, t, "cy", w=1.42, size=6.4)
footer(s, 18, "Anexo · preguntas, fuentes y evidencia")


prs.save(OUT)
print("OK ->", OUT, os.path.getsize(OUT), "bytes")
