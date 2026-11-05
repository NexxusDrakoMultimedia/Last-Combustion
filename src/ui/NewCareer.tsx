// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useEffect, useState, type FormEvent } from 'react';
import { t } from '../i18n';
import type { OwnerSetup } from '../db/player';
import { flagNames } from '../sim/worldgen/data';
import { useCareerStore } from '../state/career.store';
import { button, field, panel, quiet } from './styles';

const IDENTITIES = ['masculine', 'feminine', 'non_binary'] as const;

/** The first screen: create the owner and the garage (Garage owner mode). */
export function NewCareer() {
  const { status, slotsInUse, notice, startCareer, loadSlot1, refreshSlots } = useCareerStore();
  const [setup, setSetup] = useState<OwnerSetup>({
    ownerName: '',
    identity: 'masculine',
    birthDate: '1990-06-15',
    garageName: '',
    flag: 'AU',
    primaryColour: '#b91c1c',
    secondaryColour: '#fbbf24',
  });
  const busy = status === 'busy';
  useEffect(() => {
    void refreshSlots();
  }, [refreshSlots]);

  const set = <K extends keyof OwnerSetup>(key: K, value: OwnerSetup[K]) =>
    setSetup((s) => ({ ...s, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void startCareer(setup);
  };
  const flags = Object.entries(flagNames)
    .filter(([code]) => /^[A-Z]{2}$/.test(code))
    .sort((a, b) => a[1].short.localeCompare(b[1].short));

  return (
    <section aria-labelledby="new-heading" className={panel}>
      <h2 id="new-heading" className="lc-display text-xl">
        {t('newCareer.heading')}
      </h2>
      <p className="text-sm text-lc-dim">{t('newCareer.mode')}</p>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
        <label className="space-y-1 text-sm" htmlFor="owner-name">
          {t('newCareer.ownerName')}
          <input
            id="owner-name"
            className={field}
            value={setup.ownerName}
            required
            onChange={(e) => set('ownerName', e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm" htmlFor="owner-identity">
          {t('newCareer.identity')}
          <select
            id="owner-identity"
            className={field}
            value={setup.identity}
            onChange={(e) => set('identity', e.target.value as OwnerSetup['identity'])}
          >
            {IDENTITIES.map((identity) => (
              <option key={identity} value={identity}>
                {t(`identity.${identity}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm" htmlFor="owner-birth">
          {t('newCareer.birthDate')}
          <input
            id="owner-birth"
            type="date"
            className={field}
            value={setup.birthDate}
            required
            onChange={(e) => set('birthDate', e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm" htmlFor="garage-name">
          {t('newCareer.garageName')}
          <input
            id="garage-name"
            className={field}
            value={setup.garageName}
            required
            onChange={(e) => set('garageName', e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm" htmlFor="garage-flag">
          {t('newCareer.flag')}
          <select
            id="garage-flag"
            className={field}
            value={setup.flag}
            onChange={(e) => set('flag', e.target.value)}
          >
            {flags.map(([code, names]) => (
              <option key={code} value={code}>
                {names.short}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-4">
          <label className="space-y-1 text-sm" htmlFor="colour-1">
            {t('newCareer.primary')}
            <input
              id="colour-1"
              type="color"
              className="block h-9 w-16"
              value={setup.primaryColour}
              onChange={(e) => set('primaryColour', e.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm" htmlFor="colour-2">
            {t('newCareer.secondary')}
            <input
              id="colour-2"
              type="color"
              className="block h-9 w-16"
              value={setup.secondaryColour}
              onChange={(e) => set('secondaryColour', e.target.value)}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button type="submit" className={button} disabled={busy}>
            {t('newCareer.start')}
          </button>
          <button
            type="button"
            className={quiet}
            disabled={busy || slotsInUse === 0}
            onClick={() => void loadSlot1()}
          >
            {t('hub.load')}
          </button>
        </div>
      </form>
      {notice && (
        <p role="alert" className="text-sm text-lc-warn">
          {t(notice.key, notice.values)}
        </p>
      )}
    </section>
  );
}
