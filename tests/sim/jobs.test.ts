// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import { onMarket, retireAgeFor } from '../../src/sim/jobs';

const left = (over: Partial<{ reason: string | null; leftYear: number; age: number }> = {}) => ({
  reason: 'fired' as string | null,
  leftYear: 2031,
  age: 40,
  ...over,
});

describe('the job market', () => {
  it('keeps someone who was let go for two full seasons, then they retire', () => {
    expect(onMarket('mechanic', left(), 2031)).toBe(true);
    expect(onMarket('mechanic', left(), 2032)).toBe(true);
    expect(onMarket('mechanic', left(), 2033)).toBe(true);
    // Left in 2031: out of work for all of 2032 and 2033, retired when 2034 begins.
    expect(onMarket('mechanic', left(), 2034)).toBe(false);
  });

  it('is closed to the retired, the dead and the poached, and to anyone at retirement age', () => {
    for (const reason of ['retired', 'died', 'poached'])
      expect(onMarket('executive', left({ reason }), 2031), reason).toBe(false);
    for (const kind of ['mechanic', 'executive'] as const) {
      expect(onMarket(kind, left({ age: retireAgeFor(kind) - 1 }), 2031)).toBe(true);
      expect(onMarket(kind, left({ age: retireAgeFor(kind) }), 2031)).toBe(false);
    }
  });

  it('takes anyone else who left for a reason that is not final: let go, quit, or a contract that ended', () => {
    for (const reason of ['fired', 'quit', 'dismissed', 'contract', null])
      expect(onMarket('executive', left({ reason }), 2031), String(reason)).toBe(true);
  });
});
