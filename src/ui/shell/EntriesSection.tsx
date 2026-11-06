// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useState } from 'react';
import { formatMoney, t } from '../../i18n';
import { economyBalance, seasonBalance } from '../../sim/worldgen/data';
import { useCareerStore } from '../../state/career.store';
import { Plate } from '../Plate';
import { button, field, quiet } from '../styles';

/** What one more entry can cost the garage each round, at most (fee, tyres, servicing and extra travel). */
const perRound =
  economyBalance.costs.entryFee +
  economyBalance.costs.raceTyres +
  economyBalance.costs.practiceTyres +
  economyBalance.costs.servicing +
  economyBalance.costs.travelPerExtraEntry;

/** The garage's entries this season, and a way to add one with a spare car and a signed driver. */
export function EntriesSection({ locked }: { locked: boolean }) {
  const { entries, cars, agents, hub, status, addEntry, removeEntry } = useCareerStore();
  const [carId, setCarId] = useState('');
  const [driverId, setDriverId] = useState('');
  const started = hub?.rounds.some((r) => r.status !== 'scheduled') ?? false;
  const busy = status === 'busy';
  const spareCars = cars.filter((c) => c.inEntry === null);
  const spareDrivers = agents.filter((a) => a.signed);
  const full = entries.length >= seasonBalance.garages.maxEntriesPerGarage;
  const car = carId === '' ? String(spareCars[0]?.carId ?? '') : carId;
  const driver = driverId === '' ? String(spareDrivers[0]?.driverId ?? '') : driverId;
  const frozen = locked || busy || started;

  return (
    <section className="space-y-2 text-sm">
      <h3 className="lc-display text-sm text-lc-dim">{t('entries.title')}</h3>
      <p className="text-lc-dim">{t('entries.intro', { cost: formatMoney(perRound) })}</p>
      <ul className="space-y-1">
        {entries.map((e) => (
          <li
            key={e.raceNumber}
            className="flex flex-wrap items-center justify-between gap-2 border border-lc-line p-2"
          >
            <span>
              <span className="lc-num font-medium">{t('entries.number', { n: e.raceNumber })}</span>{' '}
              <Plate plate={e.plate} state={e.plateState} />{' '}
              {t('entries.pair', { driver: e.driverName, car: e.carName })}
            </span>
            {entries.length > 1 && (
              <button
                type="button"
                className={quiet}
                disabled={frozen}
                onClick={() => void removeEntry(e.raceNumber)}
              >
                {t('entries.remove')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {full ? (
        <p className="text-lc-dim">{t('entries.full')}</p>
      ) : spareCars.length === 0 || spareDrivers.length === 0 ? (
        <p className="text-lc-dim">
          {spareCars.length === 0 ? t('entries.needCar') : t('entries.needDriver')}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1" htmlFor="entry-car">
            {t('entries.car')}
            <select
              id="entry-car"
              className={field}
              value={car}
              onChange={(e) => setCarId(e.target.value)}
            >
              {spareCars.map((c) => (
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
          <label className="space-y-1" htmlFor="entry-driver">
            {t('entries.driver')}
            <select
              id="entry-driver"
              className={field}
              value={driver}
              onChange={(e) => setDriverId(e.target.value)}
            >
              {spareDrivers.map((a) => (
                <option key={a.driverId} value={a.driverId}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              className={button}
              disabled={frozen || car === '' || driver === ''}
              onClick={() => void addEntry(Number(car), Number(driver))}
            >
              {t('entries.add')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
