// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { t } from '../i18n';
import type { NumberBadge } from '../db/registry';
import { readableOn } from '../sim/colour';

const GOLD = '#d4af37';
const SILVER = '#c0c0c8';
/** The plate used when a number has no garage colour to sit on. */
const NEUTRAL = '#f1f3f5';

/** A thin outline round the digits, in the border colour (a text shadow, so it follows the glyphs). */
const outline = (colour: string) =>
  `1px 0 0 ${colour}, -1px 0 0 ${colour}, 0 1px 0 ${colour}, 0 -1px 0 ${colour}, 1px 1px 0 ${colour}, -1px -1px 0 ${colour}, 1px -1px 0 ${colour}, -1px 1px 0 ${colour}`;

/**
 * A race number as it appears on the car. The plate is the garage's main colour with white or black
 * digits, whichever reads better. The border belongs to the number itself: a gold outline round the
 * digits for anyone who has reached a final, a silver one for a Junior Series points scorer, and for
 * the reigning champion the number also sits in a black box. These colours are race content and stay
 * the same in every theme.
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
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-block rounded-sm text-center ${
        large ? 'min-w-14 px-2 py-1' : 'min-w-8 px-1 py-0.5'
      }`}
      style={{ backgroundColor: plate, boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.35)' }}
    >
      <span
        aria-hidden="true"
        className={`lc-num block rounded-sm font-bold ${
          large ? 'px-2 text-2xl leading-8' : 'px-1 text-xs leading-4'
        }`}
        style={{
          color: digits,
          backgroundColor: black ? '#000000' : 'transparent',
          textShadow: border ? outline(border) : undefined,
        }}
      >
        {number}
      </span>
    </span>
  );
}
