// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useState } from 'react';
import { formatMoney, t } from '../../i18n';
import { buyerPays, sellerReceives } from '../../sim/auction';
import { useCareerStore } from '../../state/career.store';
import { Plate } from '../Plate';
import { button, field, quiet } from '../styles';

/** The auction house: bid on the lots of the open auction, consign a car, and see how the last auction went. */
export function AuctionSection({ locked }: { locked: boolean }) {
  const { auction, auctionClosing, cars, hub, status, placeBid, consign } = useCareerStore();
  const [bids, setBids] = useState<Record<number, string>>({});
  const [carId, setCarId] = useState('');
  const [reserve, setReserve] = useState('');
  const cash = hub?.player?.cash ?? 0;
  const busy = status === 'busy';
  const spare = cars.filter((c) => c.inEntry === null);
  const alreadyConsigned = new Set(auction?.lotViews.filter((l) => l.mine).map((l) => l.carId));
  const consignable = spare.filter((c) => !alreadyConsigned.has(c.carId));
  // The chosen car, or the first one left when the choice is empty or already consigned.
  const car = consignable.some((c) => String(c.carId) === carId)
    ? carId
    : String(consignable[0]?.carId ?? '');

  return (
    <div className="space-y-6 text-sm">
      {auctionClosing && (
        <section className="space-y-1 border border-lc-line bg-lc-raised p-3">
          <h3 className="lc-display text-xs text-lc-dim">{t('auction.lastTitle')}</h3>
          <p>
            {t('auction.lastSummary', {
              sold: auctionClosing.result.sold,
              unsold: auctionClosing.result.unsold,
              turnover: formatMoney(auctionClosing.result.turnover),
            })}
          </p>
          {auctionClosing.lots.length === 0 && (
            <p className="text-lc-dim">{t('auction.lastNothing')}</p>
          )}
          <ul>
            {auctionClosing.lots.map((l) => (
              <li key={`${l.plate}-${l.outcome}`}>
                {t(`auction.outcome.${l.outcome}` as never, {
                  plate: l.plate,
                  model: l.modelName,
                  price: l.price === null ? '' : formatMoney(l.price),
                })}
              </li>
            ))}
          </ul>
        </section>
      )}
      {!auction ? (
        <p className="text-lc-dim">{t('auction.none')}</p>
      ) : (
        <section className="space-y-2">
          <h3 className="lc-display text-sm text-lc-dim">{t('auction.openTitle')}</h3>
          <p className="text-lc-dim">
            {t('auction.intro', {
              premium: Math.round((buyerPays(1000) / 1000 - 1) * 100),
              fee: Math.round((1 - sellerReceives(1000) / 1000) * 100),
            })}
          </p>
          <ul className="space-y-1">
            {auction.lotViews.map((l) => {
              const value = bids[l.id] ?? '';
              const amount = Number(value);
              return (
                <li key={l.id} className="space-y-1 border border-lc-line p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <Plate plate={l.plate} state={l.plateState} carId={l.carId} />{' '}
                      <span className="font-medium">{l.modelName}</span>{' '}
                      <span className="text-lc-dim">
                        {t('auction.lotDetail', {
                          year: l.modelYear,
                          km: l.roadKm,
                          wear: l.wear,
                        })}
                      </span>
                    </span>
                    <span className="lc-num text-lc-dim">
                      {t('auction.opening', { price: formatMoney(l.openingPrice) })}
                    </span>
                  </div>
                  {l.mine ? (
                    <p className="text-lc-dim">
                      {t('auction.yourLot', { reserve: formatMoney(l.reserve) })}
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {l.myBid !== null && (
                        <span className="lc-num text-lc-good">
                          {t('auction.yourBid', { amount: formatMoney(l.myBid) })}
                        </span>
                      )}
                      <label className="sr-only" htmlFor={`bid-${l.id}`}>
                        {t('auction.maxBid')}
                      </label>
                      <input
                        id={`bid-${l.id}`}
                        className={`${field} w-32`}
                        inputMode="numeric"
                        placeholder={t('auction.maxBid')}
                        value={value}
                        onChange={(e) =>
                          setBids({ ...bids, [l.id]: e.target.value.replace(/[^0-9]/g, '') })
                        }
                      />
                      <button
                        type="button"
                        className={button}
                        disabled={locked || busy || value === '' || buyerPays(amount) > cash}
                        onClick={() => void placeBid(l.id, amount)}
                      >
                        {t('auction.bid')}
                      </button>
                      {value !== '' && (
                        <span className="lc-num text-xs text-lc-dim">
                          {t('auction.youPay', { total: formatMoney(buyerPays(amount)) })}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {auction && (
        <section className="space-y-2">
          <h3 className="lc-display text-sm text-lc-dim">{t('auction.consignTitle')}</h3>
          {consignable.length === 0 ? (
            <p className="text-lc-dim">{t('auction.nothingToConsign')}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1" htmlFor="consign-car">
                {t('auction.consignCar')}
                <select
                  id="consign-car"
                  className={field}
                  value={car}
                  onChange={(e) => setCarId(e.target.value)}
                >
                  {consignable.map((c) => (
                    <option key={c.carId} value={c.carId}>
                      {t('upgrades.carOption', {
                        state: c.plateState,
                        plate: c.plate,
                        model: c.modelName,
                      })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1" htmlFor="consign-reserve">
                {t('auction.reserve')}
                <input
                  id="consign-reserve"
                  className={field}
                  inputMode="numeric"
                  value={reserve}
                  onChange={(e) => setReserve(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  className={quiet}
                  disabled={locked || busy || car === '' || reserve === ''}
                  onClick={() => void consign(Number(car), Number(reserve))}
                >
                  {t('auction.consign')}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
