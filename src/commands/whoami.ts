import { Command } from 'commander';
import { hasExactObserverScopes, loadTokens, resolveRuntime } from '../config';
import { CliError } from '../errors';
import { withGlobals, toRuntimeOverrides, Handler, run } from '../shared';

/** Confirm the session is valid, show API base, default farm, and accessible farms. */
export const whoami: Handler = async (client, defaultFarmId, opts) => {
  // getAuthenticatedClient already refreshed/validated the token to get this far;
  // calling getFarms confirms it against the API and lists what's selectable.
  const { farms, access } = await client.getFarms();
  const runtime = resolveRuntime(toRuntimeOverrides(opts));
  const cachedScopes = (loadTokens(runtime.profile)?.scope ?? '').split(' ').filter(Boolean);
  if (
    runtime.profile === 'observer' &&
    (access?.profile !== 'observer' ||
      !access.read_only ||
      !Array.isArray(access.scopes) ||
      !hasExactObserverScopes(access.scopes))
  ) {
    throw new CliError(
      'The API did not recognize this as the bounded read-only observer credential.',
    );
  }
  const scopes = access?.scopes ?? cachedScopes;
  return {
    api_url: runtime.apiUrl,
    api_version: runtime.apiVersion,
    profile: runtime.profile,
    scopes,
    read_only:
      runtime.profile === 'observer'
        ? true
        : !scopes.some((scope: string) => scope.startsWith('write:')),
    default_farm_id: defaultFarmId || null,
    farm_count: farms.length,
    farms: farms.map((farm: { id: string; name?: string }) => ({ id: farm.id, name: farm.name })),
    message: defaultFarmId
      ? `Signed in. Default farm: ${defaultFarmId}.`
      : 'Signed in. No default farm set — run `ranchbot farms use <farm_id>`.',
  };
};

export function registerWhoami(program: Command): void {
  withGlobals(
    program
      .command('whoami')
      .description('Show the signed-in account status, default farm, and accessible farms.'),
  ).action(run(whoami));
}
