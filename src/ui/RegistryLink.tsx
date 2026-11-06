// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { ReactNode } from 'react';
import type { RegistryTarget } from '../db/registry';
import { useCareerStore } from '../state/career.store';

/** Text that opens a profile in the Registry: a driver, a car, a garage, a round's prelims or its race. */
export function RegistryLink({ to, children }: { to: RegistryTarget; children: ReactNode }) {
  const open = useCareerStore((s) => s.openRegistry);
  return (
    <button
      type="button"
      className="cursor-pointer text-left underline decoration-lc-line decoration-dotted underline-offset-2 hover:decoration-lc-accent-ink focus-visible:outline-2 focus-visible:outline-lc-accent-ink"
      onClick={() => open(to)}
    >
      {children}
    </button>
  );
}
