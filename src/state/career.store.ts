// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { create } from 'zustand';
import { createCareer, readCareer, type CareerRow } from '../db/career';
import { getSchemaVersion } from '../db/migrate';
import { createNewDatabase, loadFromSlot, packDatabase, saveToSlot } from '../db/session';
import { nextRoundNumber, playPrelims, type PrelimSummary } from '../db/prelims';
import { persistWorld, readWorldSummary, type WorldSummary } from '../db/world';
import { generateWorld } from '../sim/worldgen';
import type { MessageKey, MessageValues } from '../i18n';
import { getServices } from './services';

/**
 * The database is the single source of truth. This store only holds a small read-model for
 * the UI and a handle to the open database; it never owns game data (see the GDD,
 * "Technical architecture").
 */
let openDb: Database | undefined;

export interface Notice {
  key: MessageKey;
  values?: MessageValues;
}

interface CareerState {
  status: 'idle' | 'busy' | 'ready';
  schemaVersion: number | undefined;
  career: CareerRow | undefined;
  world: WorldSummary | undefined;
  nextRound: number | null;
  prelims: PrelimSummary | undefined;
  slotsInUse: number;
  notice: Notice | undefined;
  createTestCareer(): Promise<void>;
  runNextPrelims(): Promise<void>;
  saveSlot1(): Promise<void>;
  loadSlot1(): Promise<void>;
  exportFile(): Promise<void>;
  refreshSlots(): Promise<void>;
}

function describeError(error: unknown): Notice {
  return {
    key: 'debug.error',
    values: { message: error instanceof Error ? error.message : String(error) },
  };
}

export const useCareerStore = create<CareerState>()((set, get) => {
  /** Refreshes the read-model from the open database. */
  const refresh = (db: Database) =>
    set({
      status: 'ready',
      schemaVersion: getSchemaVersion(db),
      career: readCareer(db),
      world: readWorldSummary(db),
      nextRound: nextRoundNumber(db),
    });

  const run = async (action: () => Promise<Notice | undefined>) => {
    const before = get().status;
    set({ status: 'busy' });
    try {
      const notice = await action();
      set({ status: openDb ? 'ready' : before, notice });
      await get().refreshSlots();
    } catch (error) {
      set({ status: openDb ? 'ready' : before, notice: describeError(error) });
    }
  };

  return {
    status: 'idle',
    schemaVersion: undefined,
    career: undefined,
    world: undefined,
    nextRound: null,
    prelims: undefined,
    slotsInUse: 0,
    notice: undefined,

    createTestCareer: () =>
      run(async () => {
        const SQL = await getServices().loadSql();
        openDb?.close();
        openDb = createNewDatabase(SQL);
        const masterSeed = String(Date.now());
        createCareer(openDb, {
          mode: 'garage_owner',
          masterSeed,
          startYear: 2031,
          difficulty: 'standard',
        });
        persistWorld(openDb, generateWorld(masterSeed));
        refresh(openDb);
        return undefined;
      }),

    runNextPrelims: () =>
      run(async () => {
        if (!openDb) return undefined;
        const round = nextRoundNumber(openDb);
        if (round === null) return undefined;
        const summary = playPrelims(openDb, round);
        refresh(openDb);
        set({ prelims: summary });
        return undefined;
      }),

    saveSlot1: () =>
      run(async () => {
        if (!openDb) return undefined;
        await saveToSlot(openDb, getServices().platform.saves, 'slot1', 'Slot 1');
        return { key: 'debug.saved' };
      }),

    loadSlot1: () =>
      run(async () => {
        const services = getServices();
        const SQL = await services.loadSql();
        const loaded = await loadFromSlot(SQL, services.platform.saves, 'slot1');
        openDb?.close();
        openDb = loaded.db;
        refresh(openDb);
        return { key: 'debug.loaded' };
      }),

    exportFile: () =>
      run(async () => {
        if (!openDb) return undefined;
        const bytes = await packDatabase(openDb, 'Export');
        await getServices().platform.files.exportFile('career.lcsave', bytes);
        return undefined;
      }),

    refreshSlots: async () => {
      const used = await getServices().platform.saves.occupied();
      set({ slotsInUse: used.length });
    },
  };
});
