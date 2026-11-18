# -*- coding: utf-8 -*-
"""Comprueba geometria del PPTX: limites, colisiones y altura real necesaria en tablas."""
import os
from pptx import Presentation
from pptx.util import Emu

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(BASE, "presentacion.pptx")
prs = Presentation(P)
SW, SH = prs.slide_width / 914400, prs.slide_height / 914400


def emu_in(v):
    return Emu(v).inches if v is not None else 0.0


def cpl(width_in, pt):
    return max(1, int(width_in * 72 / (pt * 0.5)))


def text_height(txt, width_in, pt, ls=1.0):
    n = 0
    for ln in str(txt).split("\n"):
        n += max(1, -(-len(ln) // cpl(width_in, pt)))
    return n * pt * 1.22 * ls / 72.0


print("slide %.3f x %.3f" % (SW, SH))
for idx, s in enumerate(prs.slides, 1):
    issues = []
    boxes = []
    for sh in s.shapes:
        x, y = emu_in(sh.left), emu_in(sh.top)
        w, h = emu_in(sh.width), emu_in(sh.height)
        if sh.has_table:
            tbl = sh.table
            need_h = 0.0
            for r_i, row in enumerate(tbl.rows):
                row_need = 0.0
                for c_i, cell in enumerate(row.cells):
                    cw = emu_in(tbl.columns[c_i].width) - emu_in(cell.margin_left) - emu_in(cell.margin_right)
                    pt = 8.0
                    for p in cell.text_frame.paragraphs:
                        for run in p.runs:
                            if run.font.size:
                                pt = run.font.size.pt
                                break
                    row_need = max(row_need, text_height(cell.text_frame.text, max(0.2, cw), pt))
                declared = emu_in(row.height)
                need_h += max(row_need + emu_in(cell.margin_top) + emu_in(cell.margin_bottom) + 0.02, declared)
            real_h = need_h
            if real_h > h + 0.02:
                issues.append("tabla crece: declarado %.2f, necesario %.2f (y=%.2f -> %.2f)" % (h, real_h, y, y + real_h))
            h = max(h, real_h)
        if x < -0.01 or y < -0.01 or x + w > SW + 0.01 or y + h > SH + 0.01:
            issues.append("fuera de lienzo: %s x=%.2f y=%.2f w=%.2f h=%.2f" % (sh.shape_type, x, y, w, h))
        if sh.has_text_frame and sh.text_frame.text.strip() and y + h > 7.02 and y < 7.05:
            issues.append("invade pie: '%s' y+h=%.2f" % (sh.text_frame.text.strip()[:40], y + h))
        if sh.has_text_frame and sh.text_frame.text.strip() and y < 7.02:
            boxes.append((x, y, w, h, sh.text_frame.text.strip()[:34]))

    # colisiones entre cajas de texto no contenidas
    col = []
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            ax, ay, aw, ah, at = boxes[i]
            bx, by, bw, bh, bt = boxes[j]
            ox = min(ax + aw, bx + bw) - max(ax, bx)
            oy = min(ay + ah, by + bh) - max(ay, by)
            if ox > 0.06 and oy > 0.06:
                area = ox * oy
                if area > 0.02:
                    col.append("solape %.2f in2: '%s' <> '%s'" % (area, at, bt))
    if col:
        issues.extend(col[:6])
    if issues:
        print("\n-- slide %02d" % idx)
        for it in issues:
            print("   " + it)
print("\nfin")
