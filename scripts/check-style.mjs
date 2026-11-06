// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
// Checks the writing style of the documents and the player-facing text: no em dashes, and no
// en dashes used as a spaced dash (an en dash is fine in a number range such as 1–40, though
// "1 to 40" is better in prose). Run with `pnpm docs:style`.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const EM_DASH = '—';
const SPACED_EN_DASH = ' – ';

const files = execFileSync(
  'git',
  ['ls-files', '*.md', 'locales/*.json', 'data/**/*.json', 'data/*.json'],
  {
    encoding: 'utf8',
  },
)
  .split('\n')
  .filter((f) => f !== '' && !f.startsWith('LICENSES/') && f !== 'LICENSE');

const problems = [];
for (const file of new Set(files)) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (line.includes(EM_DASH))
        problems.push(`${file}:${i + 1}: em dash (use a comma, colon, full stop or brackets)`);
      if (line.includes(SPACED_EN_DASH))
        problems.push(
          `${file}:${i + 1}: spaced en dash (use a comma, colon, full stop or brackets)`,
        );
    });
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} style problem(s).`);
  process.exit(1);
}
console.log(`Style check passed for ${new Set(files).size} files.`);
