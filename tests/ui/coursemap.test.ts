// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CourseMapData } from '../../src/db/coursemap';
import { hasText, t } from '../../src/i18n';
import { outlineOf } from '../../src/sim/courses/map';
import { useCareerStore } from '../../src/state/career.store';
import { CourseMap } from '../../src/ui/shell/CourseMap';
import { CourseMapSection } from '../../src/ui/shell/CourseMapSection';

afterEach(cleanup);

const data = (over: Partial<CourseMapData> = {}): CourseMapData => ({
  round: 1,
  year: 2031,
  courseNumber: 1,
  name: 'Test Pass',
  lapKm: outlineOf(1)!.lapKm,
  sectors: [
    { startKm: 0, overtakeSpot: false },
    { startKm: 10, overtakeSpot: true },
    { startKm: 20, overtakeSpot: false },
  ],
  markers: [
    { km: 5, kind: 'crash' },
    { km: 12, kind: 'spin' },
  ],
  ...over,
});

describe('the course map', () => {
  it('draws the road, a mark for each incident and each overtaking spot', () => {
    const { container } = render(createElement(CourseMap, { map: data() }));
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('path')!.getAttribute('d')).toBe(outlineOf(1)!.path);
    expect(container.querySelectorAll('[data-marker]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-overtake]')).toHaveLength(1);
  });

  it('names each incident for anyone who cannot see the colour', () => {
    const { container } = render(createElement(CourseMap, { map: data() }));
    const labels = [...container.querySelectorAll('[data-marker] title')].map((n) => n.textContent);
    expect(labels).toEqual([t('map.kind.crash'), t('map.kind.spin')]);
  });

  it('draws the road alone when nothing has gone wrong', () => {
    const { container } = render(createElement(CourseMap, { map: data({ markers: [] }) }));
    expect(container.querySelectorAll('[data-marker]')).toHaveLength(0);
    expect(container.querySelector('path')).not.toBeNull();
  });
});

describe('the course map section', () => {
  it('says so when there is no map yet', () => {
    useCareerStore.setState({ courseMap: undefined, mapRounds: [] });
    const { container } = render(createElement(CourseMapSection));
    expect(container.innerHTML).toContain(t('map.none'));
  });

  it('shows the course and lets the round be changed', () => {
    const load = vi.fn();
    useCareerStore.setState({
      courseMap: data(),
      mapRounds: [1, 2, 3],
      loadCourseMap: load,
    });
    const { container, getByRole } = render(createElement(CourseMapSection));
    expect(container.innerHTML).toContain('Test Pass');
    fireEvent.change(getByRole('combobox'), { target: { value: '2' } });
    expect(load).toHaveBeenLastCalledWith(2);
  });
});

describe('the text of the map', () => {
  it('has a line for every kind of incident on it', () => {
    for (const kind of ['crash', 'spin', 'mistake', 'wildlife', 'mechanical_failure', 'contact'])
      expect(hasText(`map.kind.${kind}`), kind).toBe(true);
  });
});
