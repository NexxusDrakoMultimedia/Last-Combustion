# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-FileCopyrightText: Nexxus Drako Multimedia
"""Builds the Last Combustion logo files (assets/brand/*.svg).

The mark is original: a maroon ring (the combustion chamber and the wheel) round a flame. The
wordmark is the game's full name, The Last Combustion of the Petrol Engine: LAST COMBUSTION in
Orbitron Bold, with the smaller THE above it and OF THE PETROL ENGINE below it in Exo 2 SemiBold.
All the lettering is turned into outlines, so it looks the same everywhere without the fonts.
Run from the repository root:

    python3 tools/brand/build_logo.py

Needs fontTools (pip install fonttools).
"""
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / 'brand'
FONTS = ROOT / 'node_modules/@fontsource'
ORBITRON = FONTS / 'orbitron/files/orbitron-latin-700-normal.woff'
EXO = FONTS / 'exo-2/files/exo-2-latin-600-normal.woff'

MAROON = '#a3203a'
INK = '#e6ebf0'
DARK = '#0d1116'
HEADER = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<!-- The Last Combustion logo. The name and logo are trademarks of Nexxus Drako Multimedia (see TRADEMARKS.md). -->\n'
)

# The flame, drawn in a 256 by 256 box.
FLAME = (
    'M128 212 C82 212 60 178 68 146 C74 122 96 110 102 86 C105 72 103 60 96 48 '
    'C132 56 166 86 166 130 C178 122 184 110 184 98 C202 114 212 138 204 164 '
    'C195 194 166 212 128 212 Z'
)
CORE = 'M128 206 C106 206 96 188 100 172 C103 160 114 154 118 142 C132 148 148 160 148 180 C148 194 140 206 128 206 Z'


def mark(ring, flame, core, bg=None, size=256, content_only=False):
    """The mark as an SVG fragment (or a whole file)."""
    inner = ''
    if bg:
        inner += f'<circle cx="128" cy="128" r="124" fill="{bg}"/>'
    inner += f'<circle cx="128" cy="128" r="112" fill="none" stroke="{ring}" stroke-width="16"/>'
    inner += f'<path d="{FLAME}" fill="{flame}"/>'
    inner += f'<path d="{CORE}" fill="{core}"/>'
    if content_only:
        return inner
    return (
        HEADER
        + f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="{size}" height="{size}" role="img" aria-label="Last Combustion">'
        + inner
        + '</svg>\n'
    )


def text_paths(font_file, text, size, tracking, fill):
    """The text as outlined paths, with its width. Glyph units are scaled to `size` pixels."""
    font = TTFont(str(font_file))
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = size / font['head'].unitsPerEm
    x = 0.0
    paths = []
    for ch in text:
        name = cmap.get(ord(ch))
        if name is None:
            continue
        glyph = glyphs[name]
        pen = SVGPathPen(glyphs)
        # Flip y (fonts go up, SVG goes down) and move to the pen position.
        glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, x, 0)))
        d = pen.getCommands()
        if d:
            paths.append(d)
        x += glyph.width * scale + tracking
    width = x - tracking
    return f'<path fill="{fill}" d="{" ".join(paths)}"/>', width


def justified(font_file, text, size, width, fill):
    """Outlined text spread (by its letter spacing) to exactly `width`."""
    _, natural = text_paths(font_file, text, size, 0, fill)
    tracking = (width - natural) / (len(text) - 1)
    return text_paths(font_file, text, size, tracking, fill)[0]


def wordmark(ink, ring, flame, core):
    """The mark beside the full name: THE, LAST COMBUSTION, OF THE PETROL ENGINE."""
    main_size, small_size = 78, 38
    main, main_width = text_paths(ORBITRON, 'LAST COMBUSTION', main_size, 3, ink)
    # THE sits at the left over the main line; the last line is spread to the main line's width.
    the, _ = text_paths(EXO, 'THE', small_size, 12, ink)
    petrol = justified(EXO, 'OF THE PETROL ENGINE', small_size, main_width, ink)
    mark_size = 200
    gap = 38
    top = 44                       # baseline of THE
    main_base = top + 16 + main_size * 0.73
    bottom = main_base + 16 + small_size * 0.72
    total_w = mark_size + gap + main_width
    height = mark_size
    # Centre the text block on the mark vertically.
    block_top = top - small_size * 0.72
    offset = (height - (bottom - block_top)) / 2 - block_top
    x = mark_size + gap
    body = (
        f'<g transform="scale({mark_size / 256:.5f})">{mark(ring, flame, core, content_only=True)}</g>'
        f'<g transform="translate({x:.2f} {top + offset:.2f})">{the}</g>'
        f'<g transform="translate({x:.2f} {main_base + offset:.2f})">{main}</g>'
        f'<g transform="translate({x:.2f} {bottom + offset:.2f})">{petrol}</g>'
    )
    return (
        HEADER
        + f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total_w:.0f} {height}" width="{total_w:.0f}" height="{height}" role="img" aria-label="The Last Combustion of the Petrol Engine">'
        + body
        + '</svg>\n'
    )


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = {
        # The colour mark, for dark backgrounds, and on its own dark disc for places that need one.
        'logo-mark.svg': mark(MAROON, INK, MAROON),
        'logo-mark-disc.svg': mark(MAROON, INK, MAROON, bg=DARK),
        # One-colour marks.
        'logo-mark-black.svg': mark('#000000', '#000000', '#ffffff'),
        'logo-mark-white.svg': mark('#ffffff', '#ffffff', '#000000'),
        # The wordmark, for dark and for light backgrounds, and in one colour.
        'logo-wordmark.svg': wordmark(INK, MAROON, INK, MAROON),
        'logo-wordmark-light.svg': wordmark(DARK, MAROON, DARK, MAROON),
        'logo-wordmark-black.svg': wordmark('#000000', '#000000', '#000000', '#ffffff'),
        'logo-wordmark-white.svg': wordmark('#ffffff', '#ffffff', '#ffffff', '#000000'),
        # The icon the browser tab shows: the mark on a rounded dark square.
        'favicon.svg': (
            HEADER
            + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">'
            + f'<rect width="256" height="256" rx="56" fill="{DARK}"/>'
            + f'<g transform="translate(24 24) scale(0.8125)">{mark(MAROON, INK, MAROON, content_only=True)}</g>'
            + '</svg>\n'
        ),
    }
    for name, svg in files.items():
        (OUT / name).write_text(svg, encoding='utf-8')
        print(name, len(svg))


if __name__ == '__main__':
    main()
