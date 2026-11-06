// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { t } from '../i18n';
import type { NumberBadge } from '../db/registry';

/**
 * A race number as it appears on the car: a gold border for anyone who has reached a final, a silver
 * border for a Junior Series points scorer, and a black box for the reigning champion. These
 * colours are race content and stay the same in every theme.
 */
export function RaceNumber({ number, badge }: { number: number; badge?: NumberBadge }) {
  const gold = badge?.gold === true;
  const silver = !gold && badge?.silver === true;
  const black = badge?.blackBox === true;
  const border = gold ? '#d4af37' : silver ? '#c0c0c8' : 'transparent';
  const label = [
    t('number.label', { number }),
    gold ? t('number.gold') : silver ? t('number.silver') : '',
    black ? t('number.blackBox') : '',
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="lc-num inline-block min-w-8 rounded-sm px-1.5 text-center text-xs font-bold leading-5"
      style={{
        color: black ? '#ffffff' : '#111111',
        backgroundColor: black ? '#000000' : '#f1f3f5',
        border: `2px solid ${border}`,
        boxShadow: black ? 'inset 0 0 0 1px #ffffff' : undefined,
      }}
    >
      <span aria-hidden="true">{number}</span>
    </span>
  );
}
