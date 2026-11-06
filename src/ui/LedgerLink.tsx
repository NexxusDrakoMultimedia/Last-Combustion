// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { ReactNode } from 'react';
import type { LedgerTarget } from '../db/ledger';
import { useCareerStore } from '../state/career.store';

/** Text that opens a profile in the Ledger: a driver, a car, a garage, a round's prelims or its race. */
export function LedgerLink({ to, children }: { to: LedgerTarget; children: ReactNode }) {
  const open = useCareerStore((s) => s.openLedger);
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
