// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useEffect } from 'react';
import { formatMoney, hasText, t } from '../../i18n';
import { LEDGER_GROUPS } from '../../sim/ledger';
import { useCareerStore } from '../../state/career.store';
import { field } from '../styles';

const signed = (x: number): string => (x > 0 ? '+' : '') + formatMoney(x);
const tone = (x: number): string => (x < 0 ? 'text-lc-bad' : x > 0 ? 'text-lc-good' : '');

/** The garage's cash, and its books for a financial year: each category grouped, with the year's results. */
export function LedgerPanel() {
  const { money, ledgerYears, ledgerView, loadLedger } = useCareerStore();
  const newest = ledgerYears[0];
  useEffect(() => {
    if (!ledgerView && newest !== undefined) loadLedger(newest);
  }, [ledgerView, newest, loadLedger]);
  if (!money) return <p className="text-sm text-lc-dim">{t('money.none')}</p>;
  const view = ledgerView;
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-3 gap-2 border border-lc-line bg-lc-raised p-3">
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
      {ledgerYears.length === 0 || !view ? (
        <p className="text-lc-dim">{t('money.empty')}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="ledger-year" className="lc-display text-xs text-lc-dim">
              {t('ledger.year')}
            </label>
            <select
              id="ledger-year"
              className={field}
              value={view.year}
              onChange={(e) => loadLedger(Number(e.target.value))}
            >
              {ledgerYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <span className="text-lc-dim">
              {view.closed ? t('ledger.closed') : t('ledger.running')}
            </span>
          </div>
          <dl className="grid gap-2 border border-lc-line p-3 sm:grid-cols-3">
            <div title={t('ledger.operatingNote')}>
              <dt className="lc-display text-xs text-lc-dim">{t('ledger.operating')}</dt>
              <dd className={`lc-num ${tone(view.operatingResult)}`}>
                {formatMoney(view.operatingResult)}
              </dd>
            </div>
            <div title={t('ledger.assetsNote')}>
              <dt className="lc-display text-xs text-lc-dim">{t('ledger.assets')}</dt>
              <dd className={`lc-num ${tone(view.assetResult)}`}>
                {formatMoney(view.assetResult)}
              </dd>
            </div>
            <div>
              <dt className="lc-display text-xs text-lc-dim">{t('ledger.cash')}</dt>
              <dd className={`lc-num ${tone(view.netCashMovement)}`}>
                {formatMoney(view.netCashMovement)}
              </dd>
            </div>
          </dl>
          <table className="w-full">
            <caption className="sr-only">{t('money.ledger')}</caption>
            <thead>
              <tr className="text-left text-lc-dim">
                <th className="lc-display py-1 text-xs">{t('ledger.category')}</th>
                <th className="lc-display py-1 text-right text-xs">{t('ledger.income')}</th>
                <th className="lc-display py-1 text-right text-xs">{t('ledger.spending')}</th>
                <th className="lc-display py-1 text-right text-xs">{t('ledger.net')}</th>
                <th className="lc-display py-1 text-right text-xs">
                  {t('ledger.versus', { year: view.year - 1 })}
                </th>
                <th className="lc-display py-1 text-right text-xs">{t('ledger.share')}</th>
              </tr>
            </thead>
            {LEDGER_GROUPS.map((group) => {
              const totals = view.groups.find((g) => g.group === group)!;
              const lines = view.lines.filter((l) => l.group === group);
              if (lines.length === 0) return null;
              const weight = lines.reduce((sum, l) => sum + Math.abs(l.net), 0);
              return (
                <tbody key={group} className="border-t border-lc-line">
                  <tr className="bg-lc-raised">
                    <th scope="rowgroup" className="py-1 text-left font-medium">
                      {t(`ledger.group.${group}` as never)}
                    </th>
                    <td className="lc-num py-1 text-right">{formatMoney(totals.income)}</td>
                    <td className="lc-num py-1 text-right">{formatMoney(totals.spending)}</td>
                    <td className={`lc-num py-1 text-right ${tone(totals.net)}`}>
                      {formatMoney(totals.net)}
                    </td>
                    <td />
                    <td />
                  </tr>
                  {lines.map((l) => (
                    <tr key={l.category}>
                      <td className="py-1 pl-3">
                        {hasText(`money.category.${l.category}`)
                          ? t(`money.category.${l.category}` as never)
                          : l.category}
                      </td>
                      <td className="lc-num py-1 text-right">{formatMoney(l.income)}</td>
                      <td className="lc-num py-1 text-right">{formatMoney(l.spending)}</td>
                      <td className={`lc-num py-1 text-right ${tone(l.net)}`}>
                        {formatMoney(l.net)}
                      </td>
                      <td className="lc-num py-1 text-right text-lc-dim">
                        {l.previousNet === null ? '–' : signed(l.net - l.previousNet)}
                      </td>
                      <td className="lc-num py-1 text-right text-lc-dim">
                        {weight === 0 ? '–' : `${Math.round((Math.abs(l.net) / weight) * 100)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </>
      )}
    </div>
  );
}
