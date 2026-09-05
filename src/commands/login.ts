import { Command } from 'commander';
import {
  hasExactObserverScopes,
  hasObserverAccessTokenClaims,
  loadTokens,
  resolveRuntime,
  RuntimeOverrides,
  storeTokens,
  tokenCachePath,
  withTokenLock,
} from '../config';
import { ADMIN_IMPORT_SCOPES, initiateDeviceFlow, pollForToken, revokeRefreshToken } from '../auth';
import { withGlobals, toRuntimeOverrides } from '../shared';
import { printResult } from '../output';
import { CliError } from '../errors';

/**
 * Run the OAuth device flow. The URL + code are written to **stderr** immediately
 * (before the blocking poll) so stdout stays clean for the final JSON result and the
 * agent/founder can read the sign-in link. The founder completes the browser step.
 */
export async function login(overrides: RuntimeOverrides, admin = false): Promise<unknown> {
  const runtime = resolveRuntime({ ...overrides, admin });
  const device = await initiateDeviceFlow(runtime, admin ? ADMIN_IMPORT_SCOPES : undefined);

  const prompt = {
    message:
      'Complete sign-in in your browser. Open the URL and approve the code, or enter ' +
      'the code at the verification page:',
    verification_uri_complete: device.verification_uri_complete,
    verification_uri: device.verification_uri,
    user_code: device.user_code,
  };
  process.stderr.write(
    `\n${prompt.message}\n  ${prompt.verification_uri_complete}\n  code: ${prompt.user_code}\n\nWaiting for approval…\n`,
  );

  const tokens = await pollForToken(runtime, device.device_code, device.interval);
  const scopes = (tokens.scope ?? '').split(' ').filter(Boolean);
  if (
    runtime.profile === 'observer' &&
    (!hasExactObserverScopes(scopes) || !hasObserverAccessTokenClaims(tokens.access_token))
  ) {
    throw new CliError('The API did not issue the bounded read-only observer credential.');
  }
  await withTokenLock(async () => {
    const current = loadTokens(runtime.profile);
    if (current?.refresh_token) {
      const currentRuntime = resolveRuntime({
        ...overrides,
        clientId: current.client_id || runtime.clientId,
      });
      await revokeRefreshToken(currentRuntime, current.refresh_token);
    }
    storeTokens(tokens, runtime.profile, runtime.clientId);
  }, runtime.profile);
  return {
    signed_in: true,
    profile: runtime.profile,
    read_only: !scopes.some((scope) => scope.startsWith('write:')),
    message: `Signed in. Tokens cached at ${tokenCachePath(runtime.profile)}.`,
    expires_in: tokens.expires_in,
  };
}

export function registerLogin(program: Command): void {
  withGlobals(
    program
      .command('login')
      .description(
        'Sign in to Ranch.Bot via the OAuth device flow (founder completes the browser step).',
      )
      .option('--admin', 'Request the internal admin-import capability (admin accounts only).'),
  ).action(async (opts) => {
    const result = await login(toRuntimeOverrides(opts), Boolean(opts.admin));
    printResult(result, opts);
  });
}
