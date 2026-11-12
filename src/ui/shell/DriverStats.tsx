// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { formatMoney, t } from '../../i18n';
import type { DriverReading } from '../../db/knowledge';
import { DRIVER_STATS } from '../../db/knowledge';
import type { SalaryHint } from '../../db/freeagents';
import { FogValue } from '../FogValue';

/** A driver's rating and six skills as the player reads them: words, ranges or exact values. */
export function DriverStats({ reading }: { reading: DriverReading }) {
  const confirmed = !reading.owned;
  return (
    <span className="lc-num text-xs text-lc-dim">
      {t('fog.stat.rating')}{' '}
      <FogValue reading={reading.rating} knowledge={reading.knowledge} confirmed={confirmed} />
      {DRIVER_STATS.map((k) => (
        <span key={k}>
          {'. '}
          {t(`registry.stat.${k}` as never)}{' '}
          <FogValue
            reading={reading.stats[k]}
            knowledge={reading.knowledge}
            confirmed={confirmed}
          />
        </span>
      ))}
    </span>
  );
}

/** A fair salary hint as text: one amount when it is known exactly, a range, or "unknown". */
export function salaryText(hint: SalaryHint | null): string {
  if (!hint) return t('fog.salaryUnknown');
  if (hint.low === hint.high) return formatMoney(hint.low);
  return t('fog.salary', { low: formatMoney(hint.low), high: formatMoney(hint.high) });
}
