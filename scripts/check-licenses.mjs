// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
// Fails if a production dependency has a licence that is not GPL-compatible.
// The allowed list matches "Licensing and distribution" in the Game Design Document.
import { init } from 'license-checker-rseidelsohn';

const ALLOWED = [
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'MPL-2.0',
  '0BSD',
  'CC0-1.0',
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'Unlicense',
  'Python-2.0',
  'BlueOak-1.0.0',
  'GPL-3.0-or-later',
  'GPL-3.0-only',
  'LGPL-3.0-or-later',
  'LGPL-3.0-only',
  'LGPL-2.1-or-later',
  'AGPL-3.0-or-later',
  'AGPL-3.0-only',
  'OFL-1.1',
];

init(
  { start: process.cwd(), production: true, excludePrivatePackages: true },
  (error, packages) => {
    if (error) throw error;
    const problems = [];
    for (const [name, info] of Object.entries(packages)) {
      const licences = String(info.licenses)
        .replace(/[()*]/g, '')
        .split(/\s+(?:OR|AND)\s+|\s*\/\s*/);
      const ok = licences.some((licence) => ALLOWED.includes(licence.trim()));
      if (!ok) problems.push(`${name}: ${info.licenses}`);
    }
    if (problems.length > 0) {
      console.error('Dependencies with licences that are not on the allowed list:');
      for (const problem of problems) console.error('  ' + problem);
      process.exit(1);
    }
    console.log(
      `All ${Object.keys(packages).length} production dependencies have allowed licences.`,
    );
  },
);
