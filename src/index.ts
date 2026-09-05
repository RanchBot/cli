#!/usr/bin/env node
import { Command } from 'commander';
import { printError } from './output';
import { registerLogin } from './commands/login';
import { registerLogout } from './commands/logout';
import { registerWhoami } from './commands/whoami';
import { registerFarms } from './commands/farms';
import { registerAnimals } from './commands/animals';
import { registerIdentifiers } from './commands/identifiers';
import { registerGroups } from './commands/groups';
import { registerRecords } from './commands/records';
import { registerChute } from './commands/chute';
import { registerRations } from './commands/rations';
import { registerFeedings } from './commands/feedings';
import { registerMemory } from './commands/memory';
import { registerImports } from './commands/imports';
import { registerInspect } from './commands/inspect';

const program = new Command();

program
  .name('ranchbot')
  .description(
    'Ranch.Bot CLI — operate farm data (animals, records, groups, identifiers, chute ' +
      'sessions, rations, feedings, memory, imports) and inspect SMS provenance from any ' +
      "agent harness or shell. Reuses the MCP server's device-flow auth.",
  )
  .version('1.0.0');

registerLogin(program);
registerLogout(program);
registerWhoami(program);
registerFarms(program);
registerAnimals(program);
registerIdentifiers(program);
registerGroups(program);
registerRecords(program);
registerChute(program);
registerRations(program);
registerFeedings(program);
registerMemory(program);
registerImports(program);
registerInspect(program);

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    // Best-effort --json detection for the error envelope; the failing command's opts
    // aren't reachable from here, so fall back to scanning argv.
    const json = process.argv.includes('--json');
    const code = printError(err, { json });
    process.exit(code);
  }
}

void main();
