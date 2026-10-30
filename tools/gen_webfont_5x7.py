#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Kitten Rack: the FM-1's 5x7 LCD type (firmware/src/font5x7.c, FONT5X7) as a web font for the rack editor, so its small
labels read as the rack page on the FM-1 does: web/public/fonts/FM1-5x7.ttf (and .woff2 when brotli is there).

One dot = 100 units, an em = 800 (a character cell 6 dots wide, 7 dots high plus one below): at 8 px a dot is one pixel,
at 16 px two. Lower case draws as upper case (as on the FM-1); accented letters as their plain letter (the editor's
Spanish labels). Needs fontTools (pip install fonttools).

Run from the repository root:  python3 tools/gen_webfont_5x7.py
"""
import re
import unicodedata
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "firmware/src/font5x7.c"
OUT = ROOT / "web/public/fonts/FM1-5x7.ttf"
DOT, ADV, ASC, DESC = 100, 600, 700, 100

rows = re.findall(r"\{(0x[0-9A-F]{2}(?:, 0x[0-9A-F]{2}){4})\}", SRC.read_text())
cols = {0x20 + i: [int(v, 16) for v in r.split(", ")] for i, r in enumerate(rows)}
# the FM-1 leaves a few signs blank; the editor shows some of them
cols[ord('"')] = [0x00, 0x07, 0x00, 0x07, 0x00]
cols[ord(";")] = [0x00, 0x56, 0x36, 0x00, 0x00]
cols[ord("_")] = [0x40, 0x40, 0x40, 0x40, 0x40]
cols[ord("[")] = [0x00, 0x7F, 0x41, 0x41, 0x00]
cols[ord("]")] = [0x00, 0x41, 0x41, 0x7F, 0x00]
cols[ord("|")] = [0x00, 0x00, 0x7F, 0x00, 0x00]
cols[0x2026] = [0x40, 0x00, 0x40, 0x00, 0x40]          # …
cols[0x25B6] = [0x7F, 0x3E, 0x1C, 0x08, 0x00]          # ▶
cols[0x2212] = cols[ord("-")]                          # −
cols[0xB7] = [0x00, 0x00, 0x08, 0x00, 0x00]            # ·


def glyph(c):
    pen = TTGlyphPen(None)
    for x, col in enumerate(c):
        for y in range(8):
            if col >> y & 1:
                x0, y1 = x * DOT, ASC - y * DOT
                pen.moveTo((x0, y1 - DOT))
                pen.lineTo((x0, y1))
                pen.lineTo((x0 + DOT, y1))
                pen.lineTo((x0 + DOT, y1 - DOT))
                pen.closePath()
    return pen.glyph()


cmap, glyphs, order = {}, {".notdef": glyph([0x7F, 0x41, 0x41, 0x41, 0x7F])}, [".notdef"]
for cp, c in sorted(cols.items()):
    name = f"u{cp:04X}"
    glyphs[name] = glyph(c)
    order.append(name)
    cmap[cp] = name
for cp in range(ord("a"), ord("z") + 1):
    cmap[cp] = cmap[cp - 32]
for cp in range(0xC0, 0x180):                          # Á É Í Ñ Ó Ú ü ... as their plain letter
    base = unicodedata.normalize("NFD", chr(cp))[0].upper()
    if len(base) == 1 and ord(base) in cmap and cp not in cmap:
        cmap[cp] = cmap[ord(base)]

fb = FontBuilder(800, isTTF=True)
fb.setupGlyphOrder(order)
fb.setupCharacterMap(cmap)
fb.setupGlyf(glyphs)
fb.setupHorizontalMetrics({n: (ADV, 0) for n in order})
fb.setupHorizontalHeader(ascent=ASC, descent=-DESC)
fb.setupNameTable({"familyName": "FM1 5x7", "styleName": "Regular", "copyright": "GPL-3.0-only, from Modular-1's font5x7.c (morgulbrut)"})
fb.setupOS2(sTypoAscender=ASC, sTypoDescender=-DESC, usWinAscent=ASC, usWinDescent=DESC)
fb.setupPost()
fb.save(OUT)
print("wrote", OUT.relative_to(ROOT), len(order), "glyphs")
try:
    from fontTools.ttLib import TTFont
    f = TTFont(OUT)
    f.flavor = "woff2"
    f.save(OUT.with_suffix(".woff2"))
    print("wrote", OUT.with_suffix(".woff2").relative_to(ROOT))
except ImportError:
    pass
