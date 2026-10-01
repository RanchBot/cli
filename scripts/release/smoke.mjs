#!/usr/bin/env node
/**
 * Installed-tarball smoke test for @ranchbot/cli: the binary must report the
 * tagged version and print help without configuration or credentials.
 */
import { execFileSync } from 'node:child_process';

const [binary, expectedVersion] = process.argv.slice(2);
if (!binary || !expectedVersion) {
  throw new Error('usage: smoke.mjs <installed-binary> <expected-version>');
}

const version = execFileSync(binary, ['--version'], { encoding: 'utf8' }).trim();
if (version !== expectedVersion) {
  throw new Error(`--version printed ${JSON.stringify(version)}, expected ${expectedVersion}`);
}

const help = execFileSync(binary, ['--help'], { encoding: 'utf8' });
if (!help.trim()) throw new Error('--help printed nothing');

console.log(`smoke ok: ${binary} --version=${version}`);
