import axios from 'axios';
import { clearLocalSession, loadLocalSession, localOrigin } from '../localSession';
import { Command } from 'commander';
import {
  clearTokens,
  loadTokens,
  resolveProfile,
  resolveRuntime,
  RuntimeOverrides,
  withTokenLock,
} from '../config';
import { revokeRefreshToken } from '../auth';
import { printResult } from '../output';
import { GlobalOptions, toRuntimeOverrides, withGlobals } from '../shared';

export async function logout(overrides: RuntimeOverrides = {}): Promise<unknown> {
  if (overrides.local) {
    const origin = localOrigin(resolveRuntime(overrides).apiUrl);
    const session = loadLocalSession(origin);
    if (session) {
      try {
        await axios.post(origin + '/v1/auth/logout', undefined, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          maxRedirects: 0,
          proxy: false,
          timeout: 15000,
        });
      } catch {
        throw new Error(
          'Could not revoke the local session. Check the installation connection and try again.',
        );
      }
    }
    clearLocalSession(origin);
    return { signed_out: true, local: true };
  }
  const profile = resolveProfile(overrides.profile);
  await withTokenLock(async () => {
    const tokens = loadTokens(profile);
    if (tokens?.refresh_token) {
      const runtime = resolveRuntime({
        ...overrides,
        clientId: overrides.clientId || tokens.client_id,
      });
      await revokeRefreshToken(runtime, tokens.refresh_token);
    }
    clearTokens(profile);
  }, profile);

  return {
    signed_out: true,
    profile,
    message: `Tokens cleared. Run \`ranchbot login --profile ${profile}\` to sign in again.`,
  };
}

export function registerLogout(program: Command): void {
  withGlobals(
    program
      .command('logout')
      .description('Revoke the current session and clear its cached sign-in tokens.'),
  ).action(async (opts: GlobalOptions) => {
    printResult(await logout(toRuntimeOverrides(opts)), opts);
  });
}
