// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GhostView } from '../../src/db/ghost';
import { hasText, t } from '../../src/i18n';
import { useCareerStore } from '../../src/state/career.store';
import { GhostSection } from '../../src/ui/shell/GhostSection';

afterEach(cleanup);

const view = (over: Partial<GhostView> = {}): GhostView => ({
  available: true,
  round: 2,
  options: [
    { driverId: 7, name: 'Ayla Ward', points: 80, timeMs: 600_000 },
    { driverId: 9, name: 'Tom Reid', points: 60, timeMs: 603_500 },
  ],
  entries: [{ entryId: 11, raceNumber: 42, driver: 'Sam Hale', pick: null }],
  results: [],
  ...over,
});

const html = () => render(createElement(GhostSection)).container.innerHTML;

describe('the ghost section', () => {
  it('says there is no ghost in the first season', () => {
    useCareerStore.setState({ ghost: view({ available: false, options: [], entries: [] }) });
    expect(html()).toContain(t('ghost.none'));
  });

  it('says so when every round has been run', () => {
    useCareerStore.setState({ ghost: view({ round: null, options: [] }) });
    expect(html()).toContain(t('ghost.done'));
  });

  it('offers none, Easy and each Hard ghost for an entry, and passes the pick on', () => {
    const pick = vi.fn(() => Promise.resolve());
    useCareerStore.setState({ ghost: view(), setGhostPick: pick });
    const { getByRole, container } = render(createElement(GhostSection));
    const select = getByRole('combobox');
    expect([...select.querySelectorAll('option')].map((o) => o.getAttribute('value'))).toEqual([
      'none',
      'easy',
      'hard:7',
      'hard:9',
    ]);
    expect(container.innerHTML).toContain('Sam Hale');
    fireEvent.change(select, { target: { value: 'hard:9' } });
    expect(pick).toHaveBeenLastCalledWith(11, { mode: 'hard', driverId: 9 });
    fireEvent.change(select, { target: { value: 'easy' } });
    expect(pick).toHaveBeenLastCalledWith(11, { mode: 'easy' });
    fireEvent.change(select, { target: { value: 'none' } });
    expect(pick).toHaveBeenLastCalledWith(11, null);
  });

  it('shows the pick that is set', () => {
    useCareerStore.setState({
      ghost: view({
        entries: [
          {
            entryId: 11,
            raceNumber: 42,
            driver: 'Sam Hale',
            pick: { mode: 'hard', driverId: 9, ghostName: 'Tom Reid' },
          },
        ],
      }),
    });
    const { getByRole } = render(createElement(GhostSection));
    expect((getByRole('combobox') as HTMLSelectElement).value).toBe('hard:9');
  });

  it('shows how the last ghosts went: beaten, lost to, and Easy', () => {
    useCareerStore.setState({
      ghost: view({
        results: [
          {
            round: 1,
            year: 2032,
            raceNumber: 42,
            driver: 'Sam Hale',
            mode: 'hard',
            ghostName: 'Ayla Ward',
            ghostTimeMs: 600_000,
            ownTimeMs: 599_200,
            beaten: true,
            deltaMs: 800,
          },
          {
            round: 1,
            year: 2032,
            raceNumber: 43,
            driver: 'Ben Cole',
            mode: 'hard',
            ghostName: 'Tom Reid',
            ghostTimeMs: 603_500,
            ownTimeMs: 604_000,
            beaten: false,
            deltaMs: -500,
          },
          {
            round: 1,
            year: 2032,
            raceNumber: 44,
            driver: 'Kim Park',
            mode: 'easy',
            ghostName: null,
            ghostTimeMs: 598_000,
            ownTimeMs: 600_000,
            beaten: null,
            deltaMs: -2000,
          },
        ],
      }),
    });
    const out = html();
    expect(out).toContain('Sam Hale');
    expect(out).toContain('Ayla Ward');
    expect(out).toContain('0.800');
    expect(out).toContain('Tom Reid');
    expect(out).toContain('0.500');
    expect(out).toContain('Kim Park');
  });
});

describe('the text of the ghost record', () => {
  it('has every line the section can show', () => {
    for (const key of [
      'ghost.title',
      'ghost.intro',
      'ghost.none',
      'ghost.done',
      'ghost.round',
      'ghost.pick.none',
      'ghost.pick.easy',
      'ghost.pick.hard',
      'ghost.result.beat',
      'ghost.result.lost',
      'ghost.result.easy',
      'ghost.result.nothing',
    ])
      expect(hasText(key), key).toBe(true);
  });
});
