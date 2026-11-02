// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useEffect } from 'react';
import { formatDate, t } from '../i18n';
import { useCareerStore } from '../state/career.store';

/** A temporary panel that proves the foundations work end to end. Removed once real screens exist. */
export function DebugPanel() {
  const { status, schemaVersion, career, world, slotsInUse, notice } = useCareerStore();
  const { createTestCareer, saveSlot1, loadSlot1, exportFile, refreshSlots } = useCareerStore();
  const busy = status === 'busy';
  const hasCareer = career !== undefined;

  useEffect(() => {
    void refreshSlots();
  }, [refreshSlots]);

  const button =
    'rounded bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:opacity-40';

  return (
    <section
      aria-labelledby="debug-heading"
      className="space-y-4 rounded border border-zinc-700 p-4"
    >
      <h2 id="debug-heading" className="text-lg font-semibold">
        {t('debug.heading')}
      </h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={button}
          disabled={busy}
          onClick={() => void createTestCareer()}
        >
          {t('debug.createCareer')}
        </button>
        <button
          type="button"
          className={button}
          disabled={busy || !hasCareer}
          onClick={() => void saveSlot1()}
        >
          {t('debug.saveSlot1')}
        </button>
        <button
          type="button"
          className={button}
          disabled={busy || slotsInUse === 0}
          onClick={() => void loadSlot1()}
        >
          {t('debug.loadSlot1')}
        </button>
        <button
          type="button"
          className={button}
          disabled={busy || !hasCareer}
          onClick={() => void exportFile()}
        >
          {t('debug.exportFile')}
        </button>
      </div>
      <ul className="space-y-1 text-sm text-zinc-300" aria-live="polite">
        {schemaVersion !== undefined && <li>{t('debug.schema', { version: schemaVersion })}</li>}
        {career && (
          <li>
            {t('debug.career', {
              mode: t(`mode.${career.mode}`),
              seed: career.masterSeed,
              date: formatDate(career.gameDate),
            })}
          </li>
        )}
        {world && (
          <>
            <li>{t('debug.world', { ...world })}</li>
            <li>{t('debug.seriesFans', { fans: world.seriesFans })}</li>
          </>
        )}
        <li>{t('debug.slots', { count: slotsInUse })}</li>
        {notice && <li>{t(notice.key, notice.values)}</li>}
      </ul>
    </section>
  );
}
