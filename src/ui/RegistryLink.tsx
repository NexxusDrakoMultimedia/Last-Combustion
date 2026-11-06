// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { ReactNode } from 'react';
import { t } from '../i18n';
import type { RegistryTarget } from '../db/registry';
import { EASTER_HINT_KEY, EASTER_MARK } from '../sim/easter';
import { useCareerStore } from '../state/career.store';

/** The dragon beside a dragon-blooded driver's name. Its hint is deliberately cryptic. */
export function DragonMark() {
  return (
    <span role="img" aria-label={t(EASTER_HINT_KEY)} title={t(EASTER_HINT_KEY)}>
      {EASTER_MARK}
    </span>
  );
}

/**
 * Text that opens a profile in the Registry: a driver, a car, a garage, a round's prelims or its
 * race. A dragon-blooded driver's link carries the dragon mark.
 */
export function RegistryLink({ to, children }: { to: RegistryTarget; children: ReactNode }) {
  const open = useCareerStore((s) => s.openRegistry);
  const dragon = useCareerStore((s) => to.kind === 'driver' && s.dragonDrivers.has(to.id));
  return (
    <button
      type="button"
      className="cursor-pointer text-left underline decoration-lc-line decoration-dotted underline-offset-2 hover:decoration-lc-accent-ink focus-visible:outline-2 focus-visible:outline-lc-accent-ink"
      onClick={() => open(to)}
    >
      {children}
      {dragon && (
        <>
          {' '}
          <DragonMark />
        </>
      )}
    </button>
  );
}
