// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { t } from '../../i18n';
import type { Subject } from '../../sim/scouting';
import { useCareerStore } from '../../state/career.store';

/**
 * Assigns one of the player's scouts to the subject of a Registry page (a driver, a car or a garage the
 * player does not own), where the player is looking when they want to know more. Nothing for something they own.
 */
export function ScoutAssign({ subject, owned }: { subject: Subject; owned: boolean }) {
  const scouts = useCareerStore((s) => s.scouts);
  const assignScout = useCareerStore((s) => s.assignScout);
  const busy = useCareerStore((s) => s.status) === 'busy';
  if (owned) return null;
  const mine = scouts.filter(
    (s) => s.assignment?.kind === subject.kind && s.assignment.id === subject.id,
  );
  if (scouts.length === 0) return <p className="text-lc-dim">{t('scouts.hireFirst')}</p>;
  return (
    <div className="flex flex-wrap items-center gap-2 text-lc-dim">
      {mine.length > 0 && (
        <span>{t('scouts.watching', { names: mine.map((s) => s.name).join(', ') })}</span>
      )}
      <select
        aria-label={t('scouts.assignHere')}
        className="border border-lc-line bg-lc-raised p-1 text-lc-text"
        value=""
        disabled={busy}
        onChange={(e) => {
          if (e.target.value) void assignScout(Number(e.target.value), subject);
        }}
      >
        <option value="">{t('scouts.assignHere')}</option>
        {scouts
          .filter((s) => !mine.includes(s))
          .map((s) => (
            <option key={s.id} value={s.id}>
              {t('scouts.pickScout', { name: s.name, skill: s.skill })}
            </option>
          ))}
      </select>
    </div>
  );
}
