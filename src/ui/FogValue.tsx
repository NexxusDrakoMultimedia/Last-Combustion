// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { t } from '../i18n';
import type { Reading } from '../sim/scouting';

/**
 * A hidden number as the player reads it (see "Scouting and fog of war"): a word, a range drawn as a
 * bar, or the exact value. Hovering shows the knowledge score and what would clear the fog.
 * `confirmed` marks an exact value that came through the fog (as against one the player owns).
 */
export function FogValue({
  reading,
  knowledge,
  confirmed = false,
}: {
  reading: Reading;
  /** The knowledge score behind the reading, shown on hover. */
  knowledge?: number;
  confirmed?: boolean;
}) {
  const score = knowledge === undefined ? '' : `${t('fog.knowledge', { score: knowledge })}. `;
  if (reading.kind === 'exact') {
    return (
      <span className="lc-num" title={confirmed ? `${score}${t('fog.hint.exact')}` : undefined}>
        {reading.value}
        {confirmed && <span aria-label={t('fog.confirmed')}>{t('fog.tick')}</span>}
      </span>
    );
  }
  if (reading.kind === 'word') {
    return (
      <span className="italic text-lc-dim" title={`${score}${t('fog.hint.word')}`}>
        {t(`fog.band.${reading.band}` as never)}
      </span>
    );
  }
  return (
    <span className="lc-num" title={`${score}${t('fog.hint.range')}`}>
      {t('fog.range', { low: reading.low, high: reading.high })}
      <span
        aria-hidden="true"
        className="relative ml-1 inline-block h-1.5 w-12 bg-lc-line align-middle"
      >
        <span
          className="absolute inset-y-0 bg-lc-accent"
          style={{ left: `${reading.low}%`, width: `${Math.max(2, reading.high - reading.low)}%` }}
        />
      </span>
    </span>
  );
}
