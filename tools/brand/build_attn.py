# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-FileCopyrightText: Nexxus Drako Multimedia
"""Builds the ATTN pennant (assets/flags/attn.svg), the marker for an attention flag.

An attention flag is raised when the series' computer sees a driver beating the predicted pace by a wide
margin. The marker is a swallow-tailed signal pennant in red with a gold edge and the word ATTN in
Roboto Condensed Bold, turned into outlines so it looks the same everywhere. Run from the repository root:

    python3 tools/brand/build_attn.py

Needs fontTools (pip install fonttools).
"""
from pathlib import Path

from build_logo import FONTS, text_paths

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / 'flags' / 'attn.svg'
FONT = FONTS / 'roboto-condensed/files/roboto-condensed-latin-700-normal.woff'

RED = '#d11a2a'
GOLD = '#ffd400'

# The pennant in a 400 by 300 box: the hoist (left edge) is straight, the fly (right edge) is swallow-tailed.
PENNANT = '12,12 380,74 296,150 380,226 12,288'
SIZE = 90
TRACKING = 6
CAP_HEIGHT = 0.711  # of the font size, for Roboto Condensed

text, width = text_paths(FONT, 'ATTN', SIZE, TRACKING, GOLD)
x = 48
baseline = 150 + SIZE * CAP_HEIGHT / 2
svg = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300" role="img" aria-label="Attention flag">'
    f'<polygon points="{PENNANT}" fill="{RED}" stroke="{GOLD}" stroke-width="20" stroke-linejoin="round"/>'
    f'<g transform="translate({x} {baseline:.1f})">{text}</g>'
    '</svg>\n'
)
OUT.write_text(svg)
print(f'wrote {OUT.relative_to(ROOT)}: text spans {x} to {x + width:.0f}, notch at 296')
