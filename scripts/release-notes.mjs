// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
// Prints the CHANGELOG.md section for a version, for use as GitHub Release notes.
// Usage: node scripts/release-notes.mjs 0.1.0
import { readFileSync } from 'node:fs';

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/release-notes.mjs <version>');
  process.exit(1);
}
const lines = readFileSync('CHANGELOG.md', 'utf8').split('\n');
const heading = new RegExp(`^## \\[${version.replace(/[.+*?^$()|[\]\\]/g, '\\$&')}\\]`);
const start = lines.findIndex((line) => heading.test(line));
if (start === -1) {
  console.error(`No section for version ${version} in CHANGELOG.md`);
  process.exit(1);
}
const end = lines.findIndex((line, i) => i > start && line.startsWith('## ['));
console.log(
  lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join('\n')
    .trim(),
);
