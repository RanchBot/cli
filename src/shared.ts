import { Command } from 'commander';
import { RanchBotApiClient } from './client';
import { getDefaultFarmId, RuntimeOverrides } from './config';
import { getAuthenticatedClient } from './session';
import { CliError } from './errors';
import { printResult } from './output';

export interface GlobalOptions {
  json?: boolean;
  farm?: string;
  apiUrl?: string;
  apiVersion?: string;
  clientId?: string;
  profile?: string;
}

/** A command handler: typed client + the persisted default farm + merged opts. */
export type Handler = (
  client: RanchBotApiClient,
  defaultFarmId: string,
  opts: Record<string, any>,
) => Promise<unknown>;

/**
 * Add the shared global flags to a leaf command. Defined per leaf (not on the program)
 * so they parse in any position on every command and appear in each command's --help.
 */
export function withGlobals(cmd: Command): Command {
  return cmd
    .option('-j, --json', 'Machine-readable JSON on stdout (agents always set this).')
    .option('--farm <id>', 'Use this farm for one command (overrides the default).')
    .option('--api-url <url>', 'Override the API base URL.')
    .option('--api-version <v>', 'Override the API version segment.')
    .option('--client-id <id>', 'Override the OAuth device client id.')
    .option('--profile <name>', 'Credential profile: default or observer.', 'default');
}

export function toRuntimeOverrides(opts: GlobalOptions): RuntimeOverrides {
  return {
    apiUrl: opts.apiUrl,
    apiVersion: opts.apiVersion,
    clientId: opts.clientId,
    profile: opts.profile,
  };
}

/**
 * Resolve the farm a command targets: the explicit --farm override wins, else the
 * persisted default. Throws a clear error when neither is set.
 */
export function resolveFarm(opts: GlobalOptions, defaultFarmId: string): string {
  const farmId = opts.farm || defaultFarmId;
  if (!farmId) {
    throw new CliError(
      'No farm selected. Set one with `ranchbot farms use <farm_id>`, or pass --farm <id>.',
    );
  }
  return farmId;
}

/**
 * Build an authenticated client for one invocation and run the handler. The handler
 * receives the *persisted* default farm id (empty string if none) and the merged opts;
 * it resolves `opts.farm || defaultFarmId` itself via resolveFarm() when it needs a farm.
 */
export async function execute(handler: Handler, opts: GlobalOptions): Promise<unknown> {
  const { client } = await getAuthenticatedClient(toRuntimeOverrides(opts));
  const defaultFarmId = getDefaultFarmId() || '';
  return handler(client, defaultFarmId, opts as Record<string, any>);
}

/** Action wrapper for commands with no positional argument. */
export function run(handler: Handler) {
  return async (opts: GlobalOptions): Promise<void> => {
    const result = await execute(handler, opts);
    printResult(result, opts);
  };
}

/** Action wrapper for commands with one positional argument. */
export function run1(handler: Handler, key: string) {
  return async (positional: string, opts: GlobalOptions): Promise<void> => {
    const merged = { ...opts, [key]: positional };
    const result = await execute(handler, merged);
    printResult(result, opts);
  };
}

/** Action wrapper for commands with two positional arguments. */
export function run2(handler: Handler, key1: string, key2: string) {
  return async (pos1: string, pos2: string, opts: GlobalOptions): Promise<void> => {
    const merged = { ...opts, [key1]: pos1, [key2]: pos2 };
    const result = await execute(handler, merged);
    printResult(result, opts);
  };
}
