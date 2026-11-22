// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { t } from '../i18n';
import type { Span } from '../sim/capfog';
import type { Reading } from '../sim/scouting';

/** What the bar of a range is drawn against: the lowest and highest value a bar can show (0 to 100 by default). */
export interface BarScale {
  min: number;
  max: number;
}

const PERCENT_SCALE: BarScale = { min: 0, max: 100 };

/** Where a range sits in its bar, as a share of the bar's width: always inside the bar. */
export function barPlacement(
  low: number,
  high: number,
  scale: BarScale,
): { left: number; width: number } {
  const span = Math.max(1e-9, scale.max - scale.min);
  const left = Math.min(98, Math.max(0, ((low - scale.min) / span) * 100));
  const width = Math.min(100 - left, Math.max(2, ((high - low) / span) * 100));
  return { left, width };
}

/**
 * A hidden number as the player reads it (see "Scouting and fog of war"): a word, a range drawn as a
 * bar, or the exact value. Hovering shows the knowledge score and what would clear the fog.
 * `confirmed` marks an exact value that came through the fog (as against one the player owns).
 */
export function FogValue({
  reading,
  knowledge,
  confirmed = false,
  scale = PERCENT_SCALE,
}: {
  reading: Reading;
  /** What the range bar is drawn against, for a number that is not a score out of 100 (a weight, a width). */
  scale?: BarScale;
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
          style={{
            left: `${barPlacement(reading.low, reading.high, scale).left}%`,
            width: `${barPlacement(reading.low, reading.high, scale).width}%`,
          }}
        />
      </span>
    </span>
  );
}

const percent = (x: number): string => `${Math.round(x * 1000) / 10}%`;

/**
 * A share of a whole (a stake, a vote, a premium) as the player reads it: one figure when it is exact,
 * otherwise a band drawn as a bar, like `FogValue`. The band always holds the truth and narrows as
 * knowledge of the garage grows.
 */
export function FogShare({ span, knowledge }: { span: Span; knowledge?: number }) {
  if (span.low === span.high) return <span className="lc-num">{percent(span.low)}</span>;
  const score = knowledge === undefined ? '' : `${t('fog.knowledge', { score: knowledge })}. `;
  return (
    <span className="lc-num" title={`${score}${t('fog.hint.range')}`}>
      {t('fog.range', { low: percent(span.low), high: percent(span.high) })}
      <span
        aria-hidden="true"
        className="relative ml-1 inline-block h-1.5 w-12 bg-lc-line align-middle"
      >
        <span
          className="absolute inset-y-0 bg-lc-accent"
          style={{
            left: `${span.low * 100}%`,
            width: `${Math.max(2, (span.high - span.low) * 100)}%`,
          }}
        />
      </span>
    </span>
  );
}
