// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { t } from '../i18n';
import type { NumberBadge } from '../db/registry';
import { contrastRatio, readableOn } from '../sim/colour';

const GOLD = '#d4af37';
const SILVER = '#c0c0c8';
/** The plate used when a number has no garage colour to sit on. */
const NEUTRAL = '#f1f3f5';

/** Below this contrast, a border gets lost against the plate and is set off with a ring of its own. */
const MIN_BORDER_CONTRAST = 3;

/** The text-shadow offsets of a ring `r` pixels out from the glyphs, with the corners of the wider rings cut so they look round. */
function ringOffsets(r: number): [number, number][] {
  const out: [number, number][] = [];
  for (let x = -r; x <= r; x++)
    for (let y = -r; y <= r; y++)
      if (
        Math.max(Math.abs(x), Math.abs(y)) === r &&
        !(r > 1 && Math.abs(x) === r && Math.abs(y) === r)
      )
        out.push([x, y]);
  return out;
}

/** A text shadow that draws rings round the digits: each ring is a colour and the distance it ends at. */
function rings(list: [colour: string, upTo: number][]): string {
  const shadows: string[] = [];
  let r = 1;
  for (const [colour, upTo] of list)
    for (; r <= upTo; r++)
      for (const [x, y] of ringOffsets(r)) shadows.push(`${x}px ${y}px 0 ${colour}`);
  return shadows.join(', ');
}

/**
 * A race number as it appears on the car. The plate is the garage's main colour with white or black
 * digits, whichever reads better. The border belongs to the number itself: a gold outline round the
 * digits for anyone who has reached a final, a silver one for a Junior Series points scorer, and for
 * the reigning champion the number also sits in a black box. These colours are race content and stay
 * the same in every theme. A number has at most 3 digits, so every number is drawn the same width.
 */
export function RaceNumber({
  number,
  badge,
  size = 'normal',
}: {
  number: number;
  badge?: NumberBadge;
  size?: 'normal' | 'large';
}) {
  const gold = badge?.gold === true;
  const silver = !gold && badge?.silver === true;
  const black = badge?.blackBox === true;
  const plate = badge?.colour ?? NEUTRAL;
  const border = gold ? GOLD : silver ? SILVER : null;
  // Digits are white in the black box, otherwise whichever of black or white reads better on the plate.
  const digits = black ? '#ffffff' : readableOn(plate);
  const label = [
    t('number.label', { number }),
    gold ? t('number.gold') : silver ? t('number.silver') : '',
    black ? t('number.blackBox') : '',
  ]
    .filter(Boolean)
    .join(', ');
  const large = size === 'large';
  // A gold or silver border that blends into the plate gets a ring of black or white (opposite to
  // the digits) between it and the number, so the digits and the border both stay readable.
  const offset = border !== null && contrastRatio(plate, border) < MIN_BORDER_CONTRAST;
  const offsetColour = digits === '#ffffff' ? '#000000' : '#ffffff';
  const borderWidth = large ? 2 : 1;
  const offsetWidth = large ? 2 : 1;
  const shadow =
    border === null
      ? undefined
      : offset
        ? rings([
            [offsetColour, offsetWidth],
            [border, offsetWidth + borderWidth],
          ])
        : rings([[border, borderWidth]]);
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-block shrink-0 rounded-sm text-center ${
        large ? 'w-24 px-2 py-1' : 'w-12 px-1 py-0.5'
      }`}
      style={{ backgroundColor: plate, boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.35)' }}
    >
      <span
        aria-hidden="true"
        className={`lc-num block rounded-sm font-bold ${
          large ? 'px-2 text-3xl leading-9' : 'px-1 text-sm leading-5'
        }`}
        style={{
          color: digits,
          backgroundColor: black ? '#000000' : 'transparent',
          textShadow: shadow,
        }}
      >
        {number}
      </span>
    </span>
  );
}
