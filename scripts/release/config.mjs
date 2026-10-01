/**
 * Package-specific release configuration for @ranchbot/cli.
 * Kept separate so `main.mjs` and the tests share one source of truth.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertChangelogHeading, pinnedReferenceChecks } from './release.mjs';

export const packageName = '@ranchbot/cli';
export const repository = 'RanchBot/cli';
export const binary = 'ranchbot';

/** Runtime allowlist for the published tarball. */
export const tarball = {
  dirs: ['dist', 'skills'],
  rootFiles: ['README.md', 'LICENSE'],
  requiredRootFiles: [
    'README.md',
    'LICENSE',
    'dist/index.js',
    'dist/index.d.ts',
    'skills/ranchbot/SKILL.md',
  ],
};

/**
 * Every declared version that must match the release tag or candidate. Runtime
 * CLI/MCP versions derive from package metadata, so only the packaged README
 * pins and the changelog heading still need an explicit copy check.
 */
export function extraVersionChecks(root) {
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
  assertChangelogHeading({ text: changelog, version });
  return pinnedReferenceChecks({
    text: readme,
    packageName,
    label: 'README.md',
    requirePins: true,
    requiredSnippets: [`npm install -g ${packageName}@`, `npx -y ${packageName}@`],
  });
}

export const installCommands = [
  'npm install -g @ranchbot/cli@${version}',
  'npx -y @ranchbot/cli@${version} --version',
  'npx -y @ranchbot/cli@${version} --help',
];

export const warnings = [
  'Upgrade only after stopping any older `ranchbot` process; a running older version can hold the local credential lock.',
  'Log in again with `ranchbot login` if the local session was created by a major-version change.',
];
