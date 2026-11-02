// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeEach, describe, expect, it } from 'vitest';
import { latestSchemaVersion } from '../../src/db/migrate';
import { loadSql } from '../../src/db/sql';
import { createMemoryPlatform } from '../../src/platform/memory';
import { useCareerStore } from '../../src/state/career.store';
import { setServices } from '../../src/state/services';

describe('career store', () => {
  let platform: ReturnType<typeof createMemoryPlatform>;
  beforeEach(() => {
    platform = createMemoryPlatform();
    setServices({ loadSql: () => loadSql(), platform });
    useCareerStore.setState({
      status: 'idle',
      schemaVersion: undefined,
      career: undefined,
      slotsInUse: 0,
      notice: undefined,
    });
  });

  it('creates a career, saves it, and loads it back', async () => {
    const store = useCareerStore.getState();
    await store.createTestCareer();
    expect(useCareerStore.getState().career?.mode).toBe('garage_owner');
    expect(useCareerStore.getState().schemaVersion).toBe(latestSchemaVersion());
    expect(useCareerStore.getState().world?.entries).toBe(313);

    await useCareerStore.getState().saveSlot1();
    expect(useCareerStore.getState().slotsInUse).toBe(1);
    const seed = useCareerStore.getState().career?.masterSeed;

    useCareerStore.setState({ career: undefined });
    await useCareerStore.getState().loadSlot1();
    expect(useCareerStore.getState().career?.masterSeed).toBe(seed);
    expect(useCareerStore.getState().notice?.key).toBe('debug.loaded');
  });

  it('runs the prelims of each round in order and then stops', async () => {
    await useCareerStore.getState().createTestCareer();
    expect(useCareerStore.getState().nextRound).toBe(1);
    await useCareerStore.getState().runNextPrelims();
    expect(useCareerStore.getState().prelims?.roundNumber).toBe(1);
    expect(useCareerStore.getState().prelims?.qualifiers).toBe(15);
    expect(useCareerStore.getState().nextRound).toBe(2);
    for (let i = 0; i < 5; i++) await useCareerStore.getState().runNextPrelims();
    expect(useCareerStore.getState().nextRound).toBeNull();
  });

  it('exports a .lcsave file through the platform', async () => {
    await useCareerStore.getState().createTestCareer();
    await useCareerStore.getState().exportFile();
    expect(platform.exported.has('career.lcsave')).toBe(true);
  });

  it('reports a clear error when loading an empty slot', async () => {
    await useCareerStore.getState().loadSlot1();
    expect(useCareerStore.getState().notice?.key).toBe('debug.error');
  });
});
