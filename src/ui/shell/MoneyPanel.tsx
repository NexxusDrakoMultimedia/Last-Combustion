// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { formatMoney, hasText, t } from '../../i18n';
import { useCareerStore } from '../../state/career.store';

/** The garage's cash, what came in and went out this far, and the ledger by category. */
export function MoneyPanel() {
  const { money } = useCareerStore();
  if (!money) return <p className="text-sm text-lc-dim">{t('money.none')}</p>;
  const lines = Object.entries(money.byCategory).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-2 border border-lc-line bg-lc-raised p-3 text-sm">
        <div>
          <dt className="lc-display text-xs text-lc-dim">{t('money.cash')}</dt>
          <dd className={`lc-num ${money.cash < 0 ? 'text-lc-bad' : ''}`}>
            {formatMoney(money.cash)}
          </dd>
        </div>
        <div>
          <dt className="lc-display text-xs text-lc-dim">{t('money.income')}</dt>
          <dd className="lc-num text-lc-good">{formatMoney(money.income)}</dd>
        </div>
        <div>
          <dt className="lc-display text-xs text-lc-dim">{t('money.expenses')}</dt>
          <dd className="lc-num">{formatMoney(money.expenses)}</dd>
        </div>
      </dl>
      {lines.length === 0 ? (
        <p className="text-sm text-lc-dim">{t('money.empty')}</p>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">{t('money.ledger')}</caption>
          <thead>
            <tr className="text-left text-lc-dim">
              <th className="lc-display py-1 text-xs">{t('money.category')}</th>
              <th className="lc-display py-1 text-right text-xs">{t('money.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(([category, amount]) => (
              <tr key={category} className="border-t border-lc-line">
                <td className="py-1">
                  {hasText(`money.category.${category}`)
                    ? t(`money.category.${category}` as never)
                    : category}
                </td>
                <td className={`lc-num py-1 text-right ${amount < 0 ? '' : 'text-lc-good'}`}>
                  {formatMoney(amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
