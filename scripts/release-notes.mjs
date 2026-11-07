// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
// Prints the CHANGELOG.md section for a version, for use as GitHub Release notes.
// A beta (a version with a hyphen, such as 0.2.0-beta7) has no section of its own: the changelog
// lists releases only, so a beta's notes are what stands under [Unreleased].
// Usage: node scripts/release-notes.mjs 0.1.0
import { readFileSync } from 'node:fs';

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/release-notes.mjs <version>');
  process.exit(1);
}
const lines = readFileSync('CHANGELOG.md', 'utf8').split('\n');
const prerelease = version.includes('-');
const name = prerelease ? 'Unreleased' : version;
const heading = new RegExp(`^## \\[${name.replace(/[.+*?^$()|[\]\\]/g, '\\$&')}\\]`);
const start = lines.findIndex((line) => heading.test(line));
if (start === -1) {
  console.error(`No section for ${name} in CHANGELOG.md`);
  process.exit(1);
}
const end = lines.findIndex((line, i) => i > start && line.startsWith('## ['));
const body = lines
  .slice(start + 1, end === -1 ? undefined : end)
  .join('\n')
  .trim();
console.log(
  prerelease
    ? `A beta of the ${version.split('-')[0]} release: the changes so far, still to be checked.\n\n${body}`
    : body,
);
