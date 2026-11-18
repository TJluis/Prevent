# -*- coding: utf-8 -*-
"""Comprueba ajuste real de texto en el PPTX usando metricas de Segoe UI (PIL)."""
import os
from PIL import ImageFont
from pptx import Presentation
from pptx.util import Emu

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(BASE, "presentacion.pptx")
FONTS = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")
REG = os.path.join(FONTS, "segoeui.ttf")
BOLD = os.path.join(FONTS, "segoeuib.ttf")
_cache = {}


def font(path, pt):
    key = (path, round(pt * 4))
    if key not in _cache:
        _cache[key] = ImageFont.truetype(path, max(1, int(round(pt * 4))))
    return _cache[key]


def measure(txt, pt, bold=False, space=3):
    f = font(BOLD if bold else REG, pt)
    return f.getlength(txt) / 4.0 / 72.0  # pulgadas


def wrap_height(paragraphs, width_in):
    """paragraphs: [(text, pt, bold, line_spacing, space_after_pt)]"""
    total = 0.0
    for txt, pt, bold, ls, after in paragraphs:
        words = txt.split()
        if not words:
            total += pt * 1.2 / 72.0
            continue
        lines, cur = 1, ""
        for w in words:
            cand = (cur + " " + w).strip()
            if measure(cand, pt, bold) <= width_in or not cur:
                cur = cand
            else:
                lines += 1
                cur = w
        total += lines * pt * 1.2 * ls / 72.0 + after / 72.0
    return total


def paras_of(tf):
    out = []
    for p in tf.paragraphs:
        txt = "".join(r.text for r in p.runs)
        pt, bold = 18.0, False
        for r in p.runs:
            if r.font.size:
                pt = r.font.size.pt
            if r.font.bold:
                bold = True
        ls = p.line_spacing if isinstance(p.line_spacing, float) else 1.0
        after = p.space_after.pt if p.space_after is not None else 0.0
        out.append((txt, pt, bold, ls, after))
    return out


prs = Presentation(P)
bad = []
for idx, s in enumerate(prs.slides, 1):
    for sh in s.shapes:
        x, y = Emu(sh.left).inches, Emu(sh.top).inches
        w, h = Emu(sh.width).inches, Emu(sh.height).inches
        if sh.has_text_frame and sh.text_frame.text.strip():
            tf = sh.text_frame
            uw = w - Emu(tf.margin_left).inches - Emu(tf.margin_right).inches
            uh = h - Emu(tf.margin_top).inches - Emu(tf.margin_bottom).inches
            need = wrap_height(paras_of(tf), max(0.15, uw))
            if need > uh + 0.04:
                bad.append((idx, "caja", need, uh, tf.text.strip()[:56].replace("\n", " | ")))
        if sh.has_table:
            tbl = sh.table
            need_total = 0.0
            for r_i, row in enumerate(tbl.rows):
                row_need = 0.0
                for c_i, cell in enumerate(row.cells):
                    cw = Emu(tbl.columns[c_i].width).inches
                    cw -= Emu(cell.margin_left).inches + Emu(cell.margin_right).inches
                    row_need = max(row_need, wrap_height(paras_of(cell.text_frame), max(0.15, cw)))
                row_need += Emu(row.cells[0].margin_top).inches + Emu(row.cells[0].margin_bottom).inches
                need_total += max(row_need, Emu(row.height).inches)
            if need_total > h + 0.03:
                bad.append((idx, "tabla", need_total, h, "crece %.2f in (%d filas)" % (need_total - h, len(tbl.rows))))
            # desborde del contenido hacia abajo del slide util
            if y + need_total > 6.98:
                bad.append((idx, "tabla-baja", need_total, 6.98 - y, "llega a y=%.2f" % (y + need_total)))

print("hallazgos:", len(bad))
for b in bad:
    print("  s%02d %-10s need=%.2f have=%.2f :: %s" % b)
