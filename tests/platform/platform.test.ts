// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import { createMemoryPlatform } from '../../src/platform/memory';

describe('memory platform', () => {
  it('unlocks an achievement once', async () => {
    const platform = createMemoryPlatform();
    expect(await platform.achievements.unlock('first-points')).toBe(true);
    expect(await platform.achievements.unlock('first-points')).toBe(false);
    expect(await platform.achievements.isUnlocked('first-points')).toBe(true);
    expect(await platform.achievements.list()).toEqual(['first-points']);
  });

  it('exports files', async () => {
    const platform = createMemoryPlatform();
    await platform.files.exportFile('a.lcsave', new Uint8Array([9]));
    expect([...(platform.exported.get('a.lcsave') ?? [])]).toEqual([9]);
  });
});
