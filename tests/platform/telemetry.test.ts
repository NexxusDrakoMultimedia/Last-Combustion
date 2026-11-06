// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import en from '../../locales/en.json';
import {
  LEDGER_CATEGORIES,
  RESOURCE_ITEM_TYPES,
  addSink,
  clearSinks,
  designId,
  ledgerDeltas,
  removeSink,
  resourceItemType,
  safeMessage,
  track,
  trackDesign,
  type TelemetryEvent,
} from '../../src/platform/telemetry';

afterEach(() => clearSinks());

describe('design ids', () => {
  it('join up to five clean parts of at most 32 characters', () => {
    expect(designId('Panel', 'Open', 'Drivers')).toBe('Panel:Open:Drivers');
    expect(designId('Panel', 'Tab', 'season', 'table', 'x', 'dropped')).toBe(
      'Panel:Tab:season:table:x',
    );
    expect(designId('a b!', 'ç', '', 7)).toBe('ab:7');
    expect(designId('x'.repeat(50))).toBe('x'.repeat(32));
    expect(designId('!!!')).toBe('Unknown');
  });

  it('always fit the rules, whatever goes in', () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { maxLength: 9 }), (parts) => {
        const id = designId(...parts);
        const segments = id.split(':');
        expect(segments.length).toBeGreaterThanOrEqual(1);
        expect(segments.length).toBeLessThanOrEqual(5);
        for (const s of segments) {
          expect(s.length).toBeGreaterThan(0);
          expect(s.length).toBeLessThanOrEqual(32);
          expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
        }
      }),
    );
  });
});

describe('sinks', () => {
  it('send nothing until one is added, and stop when it is removed', () => {
    const seen: TelemetryEvent[] = [];
    const sink = { send: (e: TelemetryEvent) => void seen.push(e) };
    trackDesign(1, 'Before');
    expect(seen).toEqual([]);
    addSink(sink);
    addSink(sink);
    trackDesign(2, 'Action', 'Save');
    expect(seen).toEqual([{ kind: 'design', id: 'Action:Save', value: 2 }]);
    removeSink(sink);
    trackDesign(3, 'After');
    expect(seen).toHaveLength(1);
  });

  it('reach every sink, and one that fails never stops the others or the game', () => {
    const seen: string[] = [];
    addSink({
      send: () => {
        throw new Error('broken sink');
      },
    });
    addSink({ send: (e) => void seen.push(e.kind) });
    expect(() => track({ kind: 'error', severity: 'Error', message: 'x' })).not.toThrow();
    expect(seen).toEqual(['error']);
  });

  it('leave out the value of a design event that has none', () => {
    const seen: TelemetryEvent[] = [];
    addSink({ send: (e) => void seen.push(e) });
    trackDesign(undefined, 'Panel', 'Open', 'Money');
    expect(seen[0]).toEqual({ kind: 'design', id: 'Panel:Open:Money' });
    expect('value' in seen[0]!).toBe(false);
  });
});

describe('money events', () => {
  it('turn a ledger category into letters-only item types, at most twenty of them', () => {
    expect(resourceItemType('championship_prize')).toBe('ChampionshipPrize');
    expect(resourceItemType('entry_fee')).toBe('EntryFee');
    expect(RESOURCE_ITEM_TYPES.length).toBeLessThanOrEqual(20);
    expect(new Set(RESOURCE_ITEM_TYPES).size).toBe(RESOURCE_ITEM_TYPES.length);
    for (const type of RESOURCE_ITEM_TYPES) expect(type).toMatch(/^[A-Za-z]+$/);
  });

  it('cover exactly the ledger categories the Money panel names', () => {
    const named = Object.keys(en)
      .filter((k) => k.startsWith('money.category.'))
      .map((k) => k.slice('money.category.'.length))
      .sort();
    expect([...LEDGER_CATEGORIES].sort()).toEqual(named);
  });

  it('report what moved between two looks: sources for gains, sinks for losses', () => {
    const events = ledgerDeltas(
      { prize: 1000, tyres: -500, travel: -200 },
      { prize: 6000, tyres: -500, travel: -1700.4, sponsor: 250, unknown_thing: 99 },
    );
    expect(events).toEqual([
      { kind: 'resource', flow: 'Source', itemType: 'Prize', amount: 5000 },
      { kind: 'resource', flow: 'Source', itemType: 'Sponsor', amount: 250 },
      { kind: 'resource', flow: 'Sink', itemType: 'Travel', amount: 1500 },
    ]);
    expect(ledgerDeltas({ prize: 5 }, { prize: 5 })).toEqual([]);
  });

  it('always report positive whole amounts', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.constantFrom(...LEDGER_CATEGORIES), fc.integer({ min: -1e7, max: 1e7 })),
        fc.dictionary(fc.constantFrom(...LEDGER_CATEGORIES), fc.integer({ min: -1e7, max: 1e7 })),
        (a, b) => {
          for (const e of ledgerDeltas(a, b)) {
            expect(e.amount).toBeGreaterThan(0);
            expect(Number.isInteger(e.amount)).toBe(true);
          }
        },
      ),
    );
  });
});

describe('error messages', () => {
  it('are one short line with long numbers hidden', () => {
    expect(safeMessage('A garage\n  with   that name')).toBe('A garage with that name');
    expect(safeMessage('Car 123456789 failed')).toBe('Car # failed');
    expect(safeMessage('x'.repeat(300))).toHaveLength(100);
  });
});
