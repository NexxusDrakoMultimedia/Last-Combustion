// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { SqlJsStatic } from '../db/sql';
import type { PlatformServices } from '../platform/types';

/** The outside world the stores talk to. Tests replace it with fakes. */
export interface Services {
  loadSql(): Promise<SqlJsStatic>;
  platform: PlatformServices;
}

let current: Services | undefined;

export function setServices(services: Services): void {
  current = services;
}

export function getServices(): Services {
  if (!current) throw new Error('Services have not been set up. Call setServices() first.');
  return current;
}
