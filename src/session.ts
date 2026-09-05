import { RanchBotApiClient } from './client';
import {
  RuntimeOverrides,
  RuntimeConfig,
  resolveRuntime,
  loadTokens,
  storeTokens,
  isTokenExpired,
  clearTokens,
  hasObserverAccessTokenClaims,
  withTokenLock,
} from './config';
import { refreshAccessToken } from './auth';
import { CliError } from './errors';

export interface ResolvedSession {
  client: RanchBotApiClient;
  runtime: RuntimeConfig;
}

/** Build an authenticated API client for one CLI invocation. */
export async function getAuthenticatedClient(
  overrides: RuntimeOverrides = {},
): Promise<ResolvedSession> {
  let runtime = resolveRuntime(overrides);
  let tokens = loadTokens(runtime.profile);

  if (!tokens) {
    throw new CliError(
      `Not logged in for the ${runtime.profile} profile. Run \`ranchbot login --profile ${runtime.profile}\`.`,
    );
  }

  runtime = resolveRuntime({
    ...overrides,
    clientId: overrides.clientId || tokens.client_id,
  });
  if (runtime.profile === 'observer' && !hasObserverAccessTokenClaims(tokens.access_token)) {
    clearTokens(runtime.profile);
    throw new CliError(
      'The observer cache does not contain the bounded observer credential. Run `ranchbot login --profile observer` again.',
    );
  }

  if (isTokenExpired(tokens)) {
    const session = await withTokenLock(async () => {
      const current = loadTokens(runtime.profile);
      if (!current) {
        throw new CliError(
          `Not logged in for the ${runtime.profile} profile. Run \`ranchbot login --profile ${runtime.profile}\`.`,
        );
      }
      const currentRuntime = resolveRuntime({
        ...overrides,
        clientId: overrides.clientId || current.client_id,
      });
      if (!isTokenExpired(current)) return { tokens: current, runtime: currentRuntime };
      if (!current.refresh_token) {
        clearTokens(currentRuntime.profile);
        throw new CliError(
          `The ${currentRuntime.profile} session expired. Run \`ranchbot login --profile ${currentRuntime.profile}\` again.`,
        );
      }

      try {
        const refreshed = await refreshAccessToken(currentRuntime, current.refresh_token);
        const stored = storeTokens(refreshed, currentRuntime.profile, currentRuntime.clientId);
        return { tokens: stored, runtime: currentRuntime };
      } catch (err) {
        clearTokens(currentRuntime.profile);
        throw err;
      }
    }, runtime.profile);
    tokens = session.tokens;
    runtime = session.runtime;
  }

  return {
    client: new RanchBotApiClient({
      accessToken: tokens.access_token,
      apiUrl: runtime.apiUrl,
      apiVersion: runtime.apiVersion,
    }),
    runtime,
  };
}
