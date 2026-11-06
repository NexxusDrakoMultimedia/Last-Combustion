// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { t } from '../i18n';
import type { Decal } from '../db/registry';

const GOLD = '#d4af37';
const SILVER = '#c0c0c8';

/** A trophy (a race win) or a shield (a championship), gold for the Super Series and silver for the Junior Series. */
export function DecalIcon({ decal }: { decal: Decal }) {
  const colour = decal.series === 'main' ? GOLD : SILVER;
  const label =
    decal.kind === 'shield'
      ? t('decal.shield', { year: decal.year })
      : t('decal.trophy', {
          year: decal.year,
          round: decal.round ?? 0,
          course: decal.course ?? '',
        });
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 20 20"
      width="20"
      height="20"
      className="inline-block"
    >
      <title>{label}</title>
      {decal.kind === 'shield' ? (
        <path
          d="M3 2h14v8c0 4-3 7-7 8-4-1-7-4-7-8z"
          fill={colour}
          stroke="#6b5a1e"
          strokeWidth="1"
        />
      ) : (
        <path
          d="M5 2h10v5c0 3-2 5-5 5S5 10 5 7zM2 3h3v3c0 1-1 2-3 1zM18 3h-3v3c0 1 1 2 3 1zM9 12h2v3h3v2H6v-2h3z"
          fill={colour}
          stroke="#6b5a1e"
          strokeWidth="0.8"
        />
      )}
    </svg>
  );
}

/** A row of a car's or driver's decals, with a count for each kind. */
export function DecalRow({ decals }: { decals: Decal[] }) {
  if (decals.length === 0) return <p className="text-lc-dim">{t('decal.none')}</p>;
  const shields = decals.filter((d) => d.kind === 'shield');
  const trophies = decals.filter((d) => d.kind === 'trophy');
  return (
    <div className="space-y-1">
      <p className="text-lc-dim">
        {t('decal.count', { shields: shields.length, trophies: trophies.length })}
      </p>
      <p className="flex flex-wrap gap-1">
        {[...shields, ...trophies].map((d, i) => (
          <DecalIcon key={`${d.kind}-${d.year}-${d.round ?? 0}-${i}`} decal={d} />
        ))}
      </p>
    </div>
  );
}
