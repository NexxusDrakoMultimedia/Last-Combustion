// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  clampReputation,
  highlightSlots,
  nextBeat,
  templateOf,
  type Beat,
} from '../../src/sim/storyline';

const feud: Beat[] = [
  { key: 'build_up', when: 'start' },
  { key: 'showdown', when: 'meeting' },
  { key: 'aftermath', when: 'next_round' },
];
const open = { bothInFinal: false, rivalryOpen: true };

describe('the next beat of a storyline', () => {
  it('starts with the beat that is due as soon as the storyline starts', () => {
    expect(nextBeat(feud, 0, open)).toEqual({ kind: 'beat', index: 0, key: 'build_up' });
  });

  it('waits for a meeting while the rivalry is open', () => {
    expect(nextBeat(feud, 1, open)).toBeNull();
    expect(nextBeat(feud, 1, { ...open, bothInFinal: true })).toEqual({
      kind: 'beat',
      index: 1,
      key: 'showdown',
    });
  });

  it('ends when the rivalry is over before the meeting', () => {
    expect(nextBeat(feud, 1, { bothInFinal: false, rivalryOpen: false })).toEqual({ kind: 'end' });
  });

  it('still plays the aftermath of a showdown after the rivalry cools', () => {
    expect(nextBeat(feud, 2, { bothInFinal: false, rivalryOpen: false })).toEqual({
      kind: 'beat',
      index: 2,
      key: 'aftermath',
    });
  });

  it('has nothing after the last beat', () => {
    expect(nextBeat(feud, 3, open)).toBeNull();
  });

  it('never skips a beat, and only ends while waiting for a meeting', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4 }),
        fc.boolean(),
        fc.boolean(),
        (step, bothInFinal, rivalryOpen) => {
          const next = nextBeat(feud, step, { bothInFinal, rivalryOpen });
          if (next?.kind === 'beat') expect(next.index).toBe(step);
          if (next?.kind === 'end') {
            expect(feud[step]!.when).toBe('meeting');
            expect(rivalryOpen).toBe(false);
          }
          if (step >= feud.length) expect(next).toBeNull();
        },
      ),
    );
  });
});

describe('highlighted storylines', () => {
  it('leaves the slots the cap has room for, never below zero', () => {
    expect(highlightSlots(0, 3)).toBe(3);
    expect(highlightSlots(2, 3)).toBe(1);
    expect(highlightSlots(3, 3)).toBe(0);
    expect(highlightSlots(5, 3)).toBe(0);
  });
});

describe('driver reputation', () => {
  it('stays between 0 and 100', () => {
    expect(clampReputation(98, 5)).toBe(100);
    expect(clampReputation(1, -5)).toBe(0);
    expect(clampReputation(50, 3)).toBe(53);
  });
});

describe('the templates in the data file', () => {
  it('have at most five beats, and every card sits on one of them', () => {
    const t = templateOf('rivalry_feud')!;
    expect(t.beats.length).toBeLessThanOrEqual(5);
    for (const beat of Object.keys(t.cards)) expect(t.beats.map((b) => b.key)).toContain(beat);
  });

  it('give every choice a unique key and bounded effects', () => {
    const t = templateOf('rivalry_feud')!;
    for (const choices of Object.values(t.cards)) {
      expect(new Set(choices.map((c) => c.key)).size).toBe(choices.length);
      for (const c of choices) {
        expect(Math.abs(c.effects.fans ?? 0)).toBeLessThanOrEqual(0.01);
        expect(Math.abs(c.effects.reputation ?? 0)).toBeLessThanOrEqual(10);
        expect(Math.abs(c.effects.relationship ?? 0)).toBeLessThanOrEqual(20);
      }
    }
  });

  it('is unknown for a name that is not a template', () => {
    expect(templateOf('no_such_story')).toBeUndefined();
  });
});
