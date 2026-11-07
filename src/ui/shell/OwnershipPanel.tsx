// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { formatMoney, t } from '../../i18n';
import { useCareerStore } from '../../state/career.store';
import { RegistryLink } from '../RegistryLink';

const percent = (x: number): string => `${Math.round(x * 1000) / 10}%`;

/** Who owns the player's garage, what it is worth and how that has moved over the seasons. */
export function OwnershipPanel() {
  const { ownership } = useCareerStore();
  if (!ownership) return <p className="text-sm text-lc-dim">{t('ownership.none')}</p>;
  const v = ownership.valuation;
  const parts = [
    ['cash', v.cash],
    ['cars', v.cars],
    ['profit', v.profit],
    ['fans', v.fans],
    ['prestige', v.prestige],
    ['titles', v.titles],
  ] as const;
  return (
    <div className="space-y-6 text-sm">
      <dl className="grid grid-cols-3 gap-2 border border-lc-line bg-lc-raised p-3">
        <div>
          <dt className="lc-display text-xs text-lc-dim">{t('ownership.value')}</dt>
          <dd className="lc-num">{formatMoney(v.total)}</dd>
        </div>
        <div>
          <dt className="lc-display text-xs text-lc-dim">{t('ownership.sharePrice')}</dt>
          <dd className="lc-num">{formatMoney(Math.round(ownership.sharePrice * 100) / 100)}</dd>
        </div>
        <div>
          <dt className="lc-display text-xs text-lc-dim">{t('ownership.issued')}</dt>
          <dd className="lc-num">{ownership.issued.toLocaleString('en-AU')}</dd>
        </div>
      </dl>

      <section className="space-y-2">
        <h3 className="lc-display text-sm text-lc-dim">{t('ownership.holders')}</h3>
        <table className="w-full">
          <caption className="sr-only">{t('ownership.holders')}</caption>
          <thead>
            <tr className="text-left text-lc-dim">
              <th className="lc-display py-1 text-xs">{t('ownership.holder')}</th>
              <th className="lc-display py-1 text-xs">{t('ownership.class')}</th>
              <th className="lc-display py-1 text-right text-xs">{t('ownership.shares')}</th>
              <th className="lc-display py-1 text-right text-xs">{t('ownership.stake')}</th>
              <th className="lc-display py-1 text-right text-xs">{t('ownership.diluted')}</th>
              <th className="lc-display py-1 text-right text-xs">{t('ownership.votes')}</th>
              <th className="lc-display py-1 text-right text-xs">{t('ownership.paid')}</th>
              <th className="lc-display py-1 text-xs">{t('ownership.since')}</th>
            </tr>
          </thead>
          <tbody>
            {ownership.holders.map((h) => (
              <tr key={h.id} className="border-t border-lc-line">
                <td className="py-1">
                  <span className="font-medium">
                    <RegistryLink to={{ kind: 'person', person: 'shareholder', id: h.profileId }}>
                      {h.name}
                    </RegistryLink>
                  </span>{' '}
                  <span className="text-lc-dim">{t(`ownership.type.${h.type}` as never)}</span>
                </td>
                <td className="py-1">{t(`ownership.class.${h.class}` as never)}</td>
                <td className="lc-num py-1 text-right">{h.shares.toLocaleString('en-AU')}</td>
                <td className="lc-num py-1 text-right">{percent(h.stake)}</td>
                <td className="lc-num py-1 text-right">{percent(h.diluted)}</td>
                <td className="lc-num py-1 text-right">{percent(h.votes)}</td>
                <td className="lc-num py-1 text-right">{formatMoney(h.paid)}</td>
                <td className="lc-num py-1 text-lc-dim">{h.since}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2">
        <h3 className="lc-display text-sm text-lc-dim">{t('ownership.worth')}</h3>
        <table className="w-full">
          <caption className="sr-only">{t('ownership.worth')}</caption>
          <tbody>
            {parts.map(([part, amount]) => (
              <tr key={part} className="border-t border-lc-line">
                <th scope="row" className="py-1 text-left font-normal">
                  {t(`ownership.part.${part}` as never)}
                </th>
                <td className="lc-num py-1 text-right">{formatMoney(amount)}</td>
              </tr>
            ))}
            <tr className="border-t border-lc-line">
              <th scope="row" className="py-1 text-left font-medium">
                {t('ownership.part.total')}
              </th>
              <td className="lc-num py-1 text-right font-medium">{formatMoney(v.total)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="space-y-2">
        <h3 className="lc-display text-sm text-lc-dim">{t('ownership.history')}</h3>
        {ownership.history.length === 0 ? (
          <p className="text-lc-dim">{t('ownership.historyNone')}</p>
        ) : (
          <ul className="space-y-1">
            {[...ownership.history].reverse().map((h) => (
              <li key={h.date} className="flex justify-between border-t border-lc-line py-1">
                <span className="lc-num text-lc-dim">{h.date}</span>
                <span className="lc-num">{formatMoney(h.value)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
