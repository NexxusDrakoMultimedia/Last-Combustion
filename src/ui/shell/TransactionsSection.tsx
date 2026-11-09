// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useEffect, useState } from 'react';
import { formatMoney, hasText, t } from '../../i18n';
import type { LedgerFilter } from '../../sim/ledger';
import { useCareerStore } from '../../state/career.store';
import { button, field } from '../styles';

/** The newest lines shown at once; the export always holds every matching line. */
const LIMIT = 200;

/** Every ledger line, newest first, with the cash after it, filters, and an export to CSV. */
export function TransactionsSection() {
  const { ledgerYears, transactionsView, loadTransactions, exportLedger, money, status } =
    useCareerStore();
  const [year, setYear] = useState('');
  const [category, setCategory] = useState('');
  const [round, setRound] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const cash = money?.cash;
  useEffect(() => {
    const filter: LedgerFilter = {};
    if (year) filter.year = Number(year);
    if (category) filter.category = category;
    if (round) filter.round = Number(round);
    if (from) filter.from = from;
    if (to) filter.to = to;
    if (text.trim()) filter.text = text;
    loadTransactions(filter);
    // The cash changes when money moves, so the lines are read again then.
  }, [year, category, round, from, to, text, cash, loadTransactions]);
  const view = transactionsView;
  if (!view) return <p className="text-sm text-lc-dim">{t('money.none')}</p>;
  const shown = [...view.rows].reverse().slice(0, LIMIT);
  const label = (c: string) =>
    hasText(`money.category.${c}`) ? t(`money.category.${c}` as never) : c;
  return (
    <div className="space-y-4 text-sm">
      <p className="text-lc-dim">{t('transactions.intro')}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1" htmlFor="tx-year">
          {t('transactions.year')}
          <select
            id="tx-year"
            className={field}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            <option value="">{t('transactions.allYears')}</option>
            {ledgerYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1" htmlFor="tx-category">
          {t('transactions.category')}
          <select
            id="tx-category"
            className={field}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">{t('transactions.allCategories')}</option>
            {view.categories.map((c) => (
              <option key={c} value={c}>
                {label(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1" htmlFor="tx-round">
          {t('transactions.round')}
          <select
            id="tx-round"
            className={field}
            value={round}
            onChange={(e) => setRound(e.target.value)}
          >
            <option value="">{t('transactions.allRounds')}</option>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {t('transactions.round.value', { round: n })}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1" htmlFor="tx-from">
          {t('transactions.from')}
          <input
            id="tx-from"
            type="date"
            className={field}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="space-y-1" htmlFor="tx-to">
          {t('transactions.to')}
          <input
            id="tx-to"
            type="date"
            className={field}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="space-y-1" htmlFor="tx-text">
          {t('transactions.note')}
          <input
            id="tx-text"
            className={field}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="lc-num text-lc-dim">
          {t('transactions.showing', { shown: view.rows.length, total: view.total })}
          {view.rows.length > LIMIT && ' ' + t('transactions.limited', { limit: LIMIT })}
        </p>
        <button
          type="button"
          className={button}
          disabled={status === 'busy' || view.rows.length === 0}
          onClick={() => void exportLedger()}
        >
          {t('transactions.export')}
        </button>
      </div>
      {shown.length === 0 ? (
        <p className="text-lc-dim">{t('transactions.empty')}</p>
      ) : (
        <table className="w-full">
          <caption className="sr-only">{t('ledger.tab.transactions')}</caption>
          <thead>
            <tr className="text-left text-lc-dim">
              <th className="lc-display py-1 text-xs">{t('transactions.date')}</th>
              <th className="lc-display py-1 text-xs">{t('transactions.round')}</th>
              <th className="lc-display py-1 text-xs">{t('transactions.category')}</th>
              <th className="lc-display py-1 text-right text-xs">{t('transactions.amount')}</th>
              <th className="lc-display py-1 text-right text-xs">{t('transactions.balance')}</th>
              <th className="lc-display py-1 text-xs">{t('transactions.noteHeading')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-lc-line">
                <td className="lc-num py-1">{r.date}</td>
                <td className="lc-num py-1">{r.round ?? ''}</td>
                <td className="py-1">{label(r.category)}</td>
                <td
                  className={`lc-num py-1 text-right ${r.amount < 0 ? 'text-lc-bad' : 'text-lc-good'}`}
                >
                  {formatMoney(r.amount)}
                </td>
                <td className="lc-num py-1 text-right">{formatMoney(r.balance)}</td>
                <td className="py-1 text-lc-dim">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
