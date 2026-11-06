// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useState } from 'react';
import { formatMoney, t } from '../i18n';
import { IDENTITY_SIGN } from '../sim/identity';
import type { Identity } from '../sim/worldgen/types';
import { useCareerStore } from '../state/career.store';
import { button } from './styles';
import { Plate } from './Plate';

/** Before the first race the owner picks a starter car (of three) and a driver (of five). */
export function StarterChoice() {
  const { starter, status, chooseStarter } = useCareerStore();
  const [carId, setCarId] = useState<number | null>(null);
  const [driverId, setDriverId] = useState<number | null>(null);
  if (!starter) return null;
  const busy = status === 'busy';

  return (
    <div className="space-y-4">
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">{t('starter.cars')}</legend>
        {starter.cars.map((c) => (
          <label key={c.carId} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="starter-car"
              checked={carId === c.carId}
              onChange={() => setCarId(c.carId)}
            />
            <Plate plate={c.plate} state={c.plateState} />
            {t('starter.car', {
              model: c.modelName,
              year: c.modelYear,
              km: c.roadKm,
              wear: c.wear,
              value: formatMoney(c.value),
            })}
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">{t('starter.drivers')}</legend>
        {starter.drivers.map((d) => (
          <label key={d.driverId} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="starter-driver"
              checked={driverId === d.driverId}
              onChange={() => setDriverId(d.driverId)}
            />
            {t('starter.driver', {
              name: d.name,
              sign: IDENTITY_SIGN[d.identity as Identity],
              age: d.age,
              pace: d.pace,
              consistency: d.consistency,
              racecraft: d.racecraft,
              tyres: d.tyreManagement,
              composure: d.composure,
              wet: d.wetSkill,
            })}
          </label>
        ))}
      </fieldset>
      <button
        type="button"
        className={button}
        disabled={busy || carId === null || driverId === null}
        onClick={() => carId !== null && driverId !== null && void chooseStarter(carId, driverId)}
      >
        {t('starter.confirm')}
      </button>
    </div>
  );
}
