# -*- coding: utf-8 -*-
"""Inspecciona el PPTX: conteo, imagenes y estimacion de desborde de texto."""
import os
from pptx import Presentation
from pptx.util import Emu

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(BASE, "presentacion.pptx")
prs = Presentation(P)
print("slides:", len(prs.slides))
print("size in:", prs.slide_width / 914400, "x", prs.slide_height / 914400)

def est_lines(text, width_in, pt):
    # ancho medio de caracter para Segoe UI ~0.5 em; margen conservador 0.52
    cpl = max(1, int(width_in * 72 / (pt * 0.52)))
    n = 0
    for ln in text.split("\n"):
        n += max(1, -(-len(ln) // cpl))
    return n

total_pics = 0
warn = []
for idx, s in enumerate(prs.slides, 1):
    pics = [sh for sh in s.shapes if sh.shape_type == 13]
    total_pics += len(pics)
    for sh in s.shapes:
        if not sh.has_text_frame:
            continue
        tf = sh.text_frame
        txt = tf.text
        if not txt.strip():
            continue
        w = Emu(sh.width).inches
        h = Emu(sh.height).inches
        # margenes internos
        ml = Emu(tf.margin_left).inches if tf.margin_left is not None else 0
        mr = Emu(tf.margin_right).inches if tf.margin_right is not None else 0
        mt = Emu(tf.margin_top).inches if tf.margin_top is not None else 0
        mb = Emu(tf.margin_bottom).inches if tf.margin_bottom is not None else 0
        usable_w = max(0.1, w - ml - mr)
        usable_h = max(0.1, h - mt - mb)
        need = 0.0
        for p in tf.paragraphs:
            pt = None
            for r in p.runs:
                if r.font.size is not None:
                    pt = r.font.size.pt
                    break
            pt = pt or 18.0
            ls = p.line_spacing if isinstance(p.line_spacing, float) else 1.0
            line_txt = "".join(r.text for r in p.runs)
            lines = est_lines(line_txt, usable_w, pt)
            need += lines * pt * 1.22 * ls / 72.0
            if p.space_after is not None:
                need += p.space_after.pt / 72.0
        if need > usable_h + 0.06:
            warn.append((idx, round(need, 2), round(usable_h, 2), txt.strip().replace("\n", " | ")[:70]))

print("pictures:", total_pics)
print("text overflow candidates:", len(warn))
for w in warn:
    print("  s%02d need=%.2f have=%.2f :: %s" % w)

print("\nper-slide shapes:")
for idx, s in enumerate(prs.slides, 1):
    print("  %02d  shapes=%d pics=%d text=%d" % (
        idx, len(s.shapes),
        len([sh for sh in s.shapes if sh.shape_type == 13]),
        len([sh for sh in s.shapes if sh.has_text_frame and sh.text_frame.text.strip()])))
