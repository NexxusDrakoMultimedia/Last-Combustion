// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { flagClass, flagLabel } from './flag';
import { useCareerStore } from '../state/career.store';

/** A flag's artwork, from the bundled `flag-icons` set, with the nation's name as its label. */
export function Flag({ code }: { code: string }) {
  const vyktory = useCareerStore((s) => s.vyktory);
  const label = flagLabel(code, vyktory);
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`${flagClass(code, vyktory)} shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgba(255,255,255,0.18)]`}
    />
  );
}

/** The flag of a driver or garage, looked up by id, or nothing if it is not known. */
export function EntityFlag({ kind, id }: { kind: 'driver' | 'garage'; id: number }) {
  const code = useCareerStore((s) => s.flags.get(`${kind}:${id}`));
  return code ? <Flag code={code} /> : null;
}
