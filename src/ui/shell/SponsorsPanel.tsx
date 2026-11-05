// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useState } from 'react';
import { formatMoney, hasText, t } from '../../i18n';
import { useCareerStore } from '../../state/career.store';
import { sponsorBalance } from '../../sim/worldgen/data';
import { button, field, quiet } from '../styles';

/** The title sponsor: who pays the garage now, who it could ask, and the negotiation over a fee. */
export function SponsorsPanel() {
  const {
    sponsors,
    sponsorNegotiation,
    status,
    negotiateSponsor,
    offerSponsor,
    endSponsorNegotiation,
  } = useCareerStore();
  const [fee, setFee] = useState('');
  const [years, setYears] = useState('1');
  const busy = status === 'busy';

  if (sponsorNegotiation) {
    const last = sponsorNegotiation.last;
    const accepted = last?.kind === 'accepted';
    const walked = last?.kind === 'walked';
    const counter = last?.kind === 'countered' ? last.counter : undefined;
    return (
      <div className="space-y-4">
        <p className="text-sm">
          {t('sponsors.negotiating', {
            name: sponsorNegotiation.name,
            fair: formatMoney(sponsorNegotiation.fairValue),
            patience: sponsorNegotiation.patience,
          })}
        </p>
        {counter && (
          <p className="border border-lc-line bg-lc-raised p-2 text-sm">
            {t('sponsors.counter', { fee: formatMoney(counter.fee), years: counter.years })}
          </p>
        )}
        {accepted && (
          <p className="text-lc-good">
            {t('sponsors.accepted', { name: sponsorNegotiation.name })}
          </p>
        )}
        {walked && (
          <p className="text-lc-bad">{t('sponsors.walked', { name: sponsorNegotiation.name })}</p>
        )}
        {!accepted && !walked && (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm" htmlFor="sponsor-fee">
              {t('sponsors.fee')}
              <input
                id="sponsor-fee"
                className={field}
                inputMode="numeric"
                value={fee}
                onChange={(e) => setFee(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </label>
            <label className="space-y-1 text-sm" htmlFor="sponsor-years">
              {t('sponsors.years')}
              <select
                id="sponsor-years"
                className={field}
                value={years}
                onChange={(e) => setYears(e.target.value)}
              >
                {Array.from({ length: sponsorBalance.maxYears }, (_, i) => i + 1).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                className={button}
                disabled={busy || fee === ''}
                onClick={() => void offerSponsor(Number(fee), Number(years))}
              >
                {t('sponsors.ask')}
              </button>
            </div>
          </div>
        )}
        <button type="button" className={quiet} onClick={endSponsorNegotiation}>
          {t('sponsors.back')}
        </button>
      </div>
    );
  }

  if (!sponsors) return <p className="text-sm text-lc-dim">{t('sponsors.none')}</p>;
  return (
    <div className="space-y-4 text-sm">
      <section className="border border-lc-line bg-lc-raised p-3">
        <h3 className="lc-display text-xs text-lc-dim">{t('sponsors.title')}</h3>
        {sponsors.deal ? (
          <p>
            {t('sponsors.current', {
              name: sponsors.deal.sponsor,
              fee: formatMoney(sponsors.deal.seasonFee),
              year: sponsors.deal.endYear,
            })}
          </p>
        ) : (
          <p className="text-lc-dim">{t('sponsors.noDeal')}</p>
        )}
      </section>
      {!sponsors.deal && (
        <ul className="space-y-2">
          {sponsors.approachable.length === 0 && (
            <li className="text-lc-dim">{t('sponsors.noneApproachable')}</li>
          )}
          {sponsors.approachable.map((s) => (
            <li
              key={s.stableId}
              className="flex flex-wrap items-center justify-between gap-2 border border-lc-line p-2"
            >
              <span>
                <span className="font-medium">{s.name}</span>{' '}
                <span className="text-lc-dim">
                  {hasText(`sponsors.tier.${s.tier}`)
                    ? t(`sponsors.tier.${s.tier}` as never)
                    : s.tier}
                </span>
              </span>
              <button
                type="button"
                className={quiet}
                disabled={busy}
                onClick={() => void negotiateSponsor(s.stableId)}
              >
                {t('sponsors.negotiate')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
