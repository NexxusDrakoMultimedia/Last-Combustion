// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { formatDate, formatMoney, t } from '../../i18n';
import { useCareerStore } from '../../state/career.store';
import { button, quiet } from '../styles';
import { Plate } from '../Plate';

/** A condition bar: 100 is new, 0 is worn out. */
export function ConditionBar({ wear }: { wear: number }) {
  const condition = Math.max(0, Math.min(100, Math.round(100 - wear)));
  const colour = condition >= 70 ? 'bg-lc-good' : condition >= 40 ? 'bg-lc-warn' : 'bg-lc-bad';
  return (
    <span className="inline-flex items-center gap-2">
      <span
        role="meter"
        aria-label={t('shell.condition')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={condition}
        className="inline-block h-1.5 w-20 bg-lc-line"
      >
        <span className={`block h-full ${colour}`} style={{ width: `${condition}%` }} />
      </span>
      <span className="lc-num text-xs">{t('shell.percent', { value: condition })}</span>
    </span>
  );
}

export function SeasonCalendar() {
  const hub = useCareerStore((s) => s.hub);
  if (!hub) return null;
  return (
    <table className="w-full text-left text-sm">
      <caption className="sr-only">{t('hub.calendar')}</caption>
      <thead className="lc-display text-xs text-lc-dim">
        <tr>
          <th scope="col">{t('hub.round')}</th>
          <th scope="col">{t('hub.course')}</th>
          <th scope="col">{t('hub.date')}</th>
          <th scope="col">{t('hub.status')}</th>
        </tr>
      </thead>
      <tbody>
        {hub.rounds.map((r) => (
          <tr key={r.number} className="border-t border-lc-line">
            <td className="lc-num py-1">{r.number}</td>
            <td>{r.course}</td>
            <td>{formatDate(r.finalDate)}</td>
            <td className={r.status === 'complete' ? 'text-lc-good' : 'text-lc-dim'}>
              {t(`hub.status.${r.status}`)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DriversTable() {
  const hub = useCareerStore((s) => s.hub);
  if (!hub) return null;
  if (hub.standings.length === 0)
    return <p className="text-sm text-lc-dim">{t('hub.tableEmpty')}</p>;
  return (
    <table className="w-full text-left text-sm">
      <caption className="sr-only">{t('hub.table')}</caption>
      <thead className="lc-display text-xs text-lc-dim">
        <tr>
          <th scope="col">{t('hub.rank')}</th>
          <th scope="col">{t('hub.driver')}</th>
          <th scope="col">{t('hub.points')}</th>
          <th scope="col">{t('hub.wins')}</th>
        </tr>
      </thead>
      <tbody>
        {hub.standings.map((d) => (
          <tr key={d.rank} className="border-t border-lc-line">
            <td className="lc-num py-1">{d.rank}</td>
            <td>{t('hub.driverCell', { number: d.raceNumber, driver: d.driver })}</td>
            <td className="lc-num">{d.points}</td>
            <td className="lc-num">{d.wins}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function OwnedCars({ locked }: { locked: boolean }) {
  const { cars, hub, status, raceCar } = useCareerStore();
  const started = hub?.rounds.some((r) => r.status !== 'scheduled') ?? false;
  return (
    <ul className="space-y-2 text-sm">
      {cars.map((c) => (
        <li
          key={c.carId}
          className="flex flex-wrap items-center justify-between gap-2 border border-lc-line bg-lc-raised p-2"
        >
          <span>
            <Plate plate={c.plate} state={c.plateState} />{' '}
            <span className="font-medium">{c.modelName}</span>{' '}
            <span className="text-lc-dim">
              {t('market.carDetail', {
                year: c.modelYear,
                km: c.roadKm,
                value: formatMoney(c.value),
              })}
            </span>
          </span>
          <ConditionBar wear={c.wear} />
          {c.inEntry !== null ? (
            <span className="text-lc-dim">{t('market.racing', { number: c.inEntry })}</span>
          ) : (
            <button
              type="button"
              className={quiet}
              disabled={locked || status === 'busy' || started}
              onClick={() => void raceCar(c.carId)}
            >
              {t('market.use')}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function UsedMarket({ locked }: { locked: boolean }) {
  const { listings, hub, status, buyListing } = useCareerStore();
  const cash = hub?.player?.cash ?? 0;
  return (
    <ul className="space-y-2 text-sm">
      {listings.map((l) => (
        <li
          key={l.id}
          className="flex flex-wrap items-center justify-between gap-2 border border-lc-line bg-lc-raised p-2"
        >
          <span>
            <Plate plate={l.plate} state={l.plateState} />{' '}
            <span className="font-medium">{l.modelName}</span>{' '}
            <span className="text-lc-dim">
              {t('market.listingDetail', { year: l.modelYear, km: l.roadKm })}
            </span>
          </span>
          <ConditionBar wear={l.wear} />
          <span className="lc-num">{formatMoney(l.price)}</span>
          <button
            type="button"
            className={button}
            disabled={locked || status === 'busy' || l.price > cash}
            onClick={() => void buyListing(l.id)}
          >
            {t('market.buy')}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function MenuActions() {
  const s = useCareerStore();
  const busy = s.status === 'busy';
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={button} disabled={busy} onClick={() => void s.saveSlot1()}>
        {t('hub.save')}
      </button>
      <button
        type="button"
        className={quiet}
        disabled={busy || s.slotsInUse === 0}
        onClick={() => void s.loadSlot1()}
      >
        {t('hub.load')}
      </button>
      <button type="button" className={quiet} disabled={busy} onClick={() => void s.exportFile()}>
        {t('hub.export')}
      </button>
    </div>
  );
}
