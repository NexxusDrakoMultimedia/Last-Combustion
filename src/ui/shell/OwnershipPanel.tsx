// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useState } from 'react';
import { formatMoney, t } from '../../i18n';
import { roundTerms, sharesPrice } from '../../sim/equity';
import { useCareerStore } from '../../state/career.store';
import { RegistryLink } from '../RegistryLink';
import { button, field, quiet } from '../styles';

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

      <Governance />
      <Raise />
      <Pay />
      <Events />

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

function Raise() {
  const { ownership, status, issueShares } = useCareerStore();
  const [investor, setInvestor] = useState('0');
  const [amount, setAmount] = useState('');
  if (!ownership) return null;
  const r = ownership.round;
  const offer = r.investors[Number(investor)];
  const value = Number(amount) || 0;
  const terms = offer
    ? roundTerms(ownership.valuation.total, ownership.issued, value, offer.appetite)
    : undefined;
  const tooMuch = terms !== undefined && terms.stake > r.maxStake;
  const vetoed = ownership.control.blockers[0];
  const tooLittle = value < r.minAmount;
  return (
    <section className="space-y-2">
      <h3 className="lc-display text-sm text-lc-dim">
        {t('ownership.raise.title', { name: r.name })}
      </h3>
      <p className="text-lc-dim">{t('ownership.raise.explain')}</p>
      {!r.available ? (
        <p>{t('ownership.raise.done')}</p>
      ) : (
        <div className="space-y-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1" htmlFor="raise-investor">
              {t('ownership.raise.investor')}
              <select
                id="raise-investor"
                className={field}
                value={investor}
                onChange={(e) => setInvestor(e.target.value)}
              >
                {r.investors.map((i, n) => (
                  <option key={i.name} value={n}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1" htmlFor="raise-amount">
              {t('ownership.raise.amount')}
              <input
                id="raise-amount"
                className={field}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </label>
          </div>
          {offer && (
            <p className="text-lc-dim">
              {t('ownership.raise.believes', {
                name: offer.name,
                percent: Math.round(offer.appetite * 100),
              })}{' '}
              {t(`ownership.raise.class.${offer.class}` as never, { name: offer.name })}
            </p>
          )}
          {terms && value > 0 && !tooLittle && (
            <p className="lc-num">
              {t('ownership.raise.terms', {
                amount: formatMoney(value),
                stake: Math.round(terms.stake * 1000) / 10,
                shares: terms.newShares.toLocaleString('en-AU'),
                price: formatMoney(Math.round(terms.pricePerShare * 100) / 100),
                pre: formatMoney(Math.round(terms.preMoney)),
              })}
            </p>
          )}
          {value > 0 && tooLittle && (
            <p className="text-lc-bad">
              {t('ownership.raise.tooLittle', { min: formatMoney(r.minAmount) })}
            </p>
          )}
          {vetoed && (
            <p className="text-lc-bad">{t('ownership.raise.vetoed', { name: vetoed.name })}</p>
          )}
          {tooMuch && (
            <p className="text-lc-bad">
              {t('ownership.raise.tooMuch', { max: Math.round(r.maxStake * 100) })}
            </p>
          )}
          <button
            type="button"
            className={button}
            disabled={status === 'busy' || !offer || tooLittle || tooMuch || vetoed !== undefined}
            onClick={() => void issueShares(Number(investor), value)}
          >
            {t('ownership.raise.button', { amount: formatMoney(value) })}
          </button>
        </div>
      )}
    </section>
  );
}

function Pay() {
  const { ownership, status, declareDividend, buyBackShares } = useCareerStore();
  const [dividend, setDividend] = useState('');
  if (!ownership) return null;
  const d = ownership.dividend;
  const value = dividend === '' ? d.suggested : Number(dividend);
  const outside = ownership.holders.filter((h) => h.type !== 'owner' && h.class !== 'option');
  return (
    <section className="space-y-3">
      <h3 className="lc-display text-sm text-lc-dim">{t('ownership.dividend')}</h3>
      <p className="text-lc-dim">{t('ownership.dividend.explain')}</p>
      <p className="lc-num">
        {t('ownership.ownerCash', { amount: formatMoney(ownership.ownerCash) })}
      </p>
      {!d.available ? (
        <p>{t('ownership.dividend.done')}</p>
      ) : (
        <div className="space-y-2">
          <p className="text-lc-dim">
            {t('ownership.dividend.suggested', { amount: formatMoney(d.suggested) })}
          </p>
          <label className="block space-y-1" htmlFor="dividend-amount">
            {t('ownership.dividend.amount')}
            <input
              id="dividend-amount"
              className={field}
              inputMode="numeric"
              value={dividend === '' ? String(d.suggested) : dividend}
              onChange={(e) => setDividend(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </label>
          <button
            type="button"
            className={button}
            disabled={status === 'busy' || !(value > 0) || value > d.cash}
            onClick={() => void declareDividend(value)}
          >
            {t('ownership.dividend.button', { amount: formatMoney(value) })}
          </button>
        </div>
      )}
      {outside.length > 0 && (
        <div className="space-y-2">
          <h4 className="lc-display text-xs text-lc-dim">{t('ownership.buyback')}</h4>
          <p className="text-lc-dim">{t('ownership.buyback.explain')}</p>
          <ul className="space-y-1">
            {outside.map((h) => {
              const price = sharesPrice(ownership.valuation.total, ownership.issued, h.shares);
              return (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-2 border border-lc-line p-2"
                >
                  <span>
                    {h.name}{' '}
                    <span className="lc-num text-lc-dim">{h.shares.toLocaleString('en-AU')}</span>
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      className={quiet}
                      disabled={status === 'busy' || price > d.cash}
                      onClick={() => void buyBackShares(h.id, h.shares, 'garage')}
                    >
                      {t('ownership.buyback.garage', { price: formatMoney(price) })}
                    </button>
                    <button
                      type="button"
                      className={quiet}
                      disabled={status === 'busy' || price > ownership.ownerCash}
                      onClick={() => void buyBackShares(h.id, h.shares, 'owner')}
                    >
                      {t('ownership.buyback.owner', { price: formatMoney(price) })}
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function Events() {
  const { ownership } = useCareerStore();
  if (!ownership || ownership.events.length === 0) return null;
  const num = (x: unknown): number => (typeof x === 'number' ? x : 0);
  const str = (x: unknown): string => (typeof x === 'string' ? x : '');
  return (
    <section className="space-y-2">
      <h3 className="lc-display text-sm text-lc-dim">{t('ownership.events')}</h3>
      <ul className="space-y-1">
        {ownership.events.map((e) => (
          <li key={e.id} className="flex flex-wrap gap-3 border-t border-lc-line py-1">
            <span className="lc-num text-lc-dim">{e.date}</span>
            <span>
              {e.kind === 'round' &&
                t('ownership.event.round', {
                  round: str(e.detail.round),
                  investor: str(e.detail.investor),
                  amount: formatMoney(num(e.detail.amount)),
                  stake: Math.round(num(e.detail.stake) * 1000) / 10,
                })}
              {e.kind === 'dividend' &&
                t('ownership.event.dividend', {
                  amount: formatMoney(num(e.detail.amount)),
                  owner: formatMoney(num(e.detail.owner)),
                })}
              {e.kind === 'stake' &&
                t(
                  e.detail.action === 'sell'
                    ? 'ownership.event.stake.sell'
                    : 'ownership.event.stake.buy',
                  {
                    shares: num(e.detail.shares).toLocaleString('en-AU'),
                    garage: str(e.detail.garage),
                    price: formatMoney(num(e.detail.price)),
                  },
                )}
              {e.kind === 'takeover' &&
                t('ownership.event.takeover', {
                  garage: str(e.detail.garage),
                  premium: Math.round(num(e.detail.premium) * 100),
                  cost: formatMoney(num(e.detail.cost)),
                  cars: num(e.detail.cars),
                  drivers: num(e.detail.drivers),
                })}
              {e.kind === 'buyback' &&
                t(
                  e.detail.by === 'owner'
                    ? 'ownership.event.buyback.owner'
                    : 'ownership.event.buyback.garage',
                  {
                    shares: num(e.detail.shares).toLocaleString('en-AU'),
                    from: str(e.detail.from),
                    price: formatMoney(num(e.detail.price)),
                  },
                )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Governance() {
  const { ownership } = useCareerStore();
  if (!ownership) return null;
  const c = ownership.control;
  const votes = Math.round(c.ownerVotes * 1000) / 10;
  const latest = ownership.targets[0];
  const previous = ownership.targets[1];
  const warn =
    previous !== undefined && previous.met === false && latest?.met === null && c.ownerVotes <= 0.5;
  const called = ownership.targets.find((x) => x.vote);
  return (
    <section className="space-y-3">
      <h3 className="lc-display text-sm text-lc-dim">{t('ownership.control')}</h3>
      <p>{t(`ownership.control.${c.level}` as never, { votes })}</p>
      {c.blockers.map((b) => (
        <p key={b.name} className="text-lc-dim">
          {t('ownership.control.blockers', {
            name: b.name,
            votes: Math.round(b.votes * 1000) / 10,
          })}
        </p>
      ))}
      <p className="text-lc-dim">{t('ownership.control.note')}</p>

      <h4 className="lc-display text-xs text-lc-dim">{t('ownership.board')}</h4>
      <ul className="space-y-1">
        {ownership.board.map((d) => (
          <li
            key={`${d.seat}-${d.name}`}
            className="flex flex-wrap items-baseline justify-between gap-2 border-t border-lc-line py-1"
          >
            <span>
              <span className="font-medium">{d.name}</span>{' '}
              <span className="text-lc-dim">{t(`ownership.board.${d.seat}` as never)}</span>
            </span>
            {d.seat !== 'chair' && (
              <span className="lc-num text-lc-dim">
                {t('ownership.board.stake', { percent: Math.round(d.stake * 1000) / 10 })}
              </span>
            )}
          </li>
        ))}
      </ul>

      <h4 className="lc-display text-xs text-lc-dim">{t('ownership.target')}</h4>
      <ul className="space-y-1">
        {ownership.targets.map((x) => (
          <li key={x.year} className="flex flex-wrap gap-3 border-t border-lc-line py-1">
            <span>{t('ownership.target.row', { year: x.year, target: x.target })}</span>
            <span className={x.met === false ? 'text-lc-bad' : 'text-lc-dim'}>
              {x.met === null
                ? t('ownership.target.open')
                : x.finish === null
                  ? t('ownership.target.noFinish')
                  : t(x.met ? 'ownership.target.met' : 'ownership.target.missed', {
                      finish: x.finish,
                    })}
            </span>
          </li>
        ))}
      </ul>
      {warn && <p className="text-lc-bad">{t('ownership.target.warning', { votes })}</p>}
      {called && (
        <p className="text-lc-bad">{t('ownership.target.vote', { year: called.year, votes })}</p>
      )}
    </section>
  );
}
