import axios from 'axios';
import { OBSERVER_SCOPES } from './config';
import type { CliProfile } from './config';
import { CliError } from './errors';

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface AuthConfig {
  apiUrl: string;
  clientId: string;
  profile: CliProfile;
  deviceCodeEndpoint: string;
  deviceTokenEndpoint: string;
  tokenEndpoint: string;
}

export const FARM_DATA_SCOPES =
  'read:farms write:farms read:animals write:animals read:records write:records read:groups write:groups';
export const ADMIN_IMPORT_SCOPES = `${FARM_DATA_SCOPES} admin:imports`;
const OBSERVER_OAUTH_SCOPES = OBSERVER_SCOPES.join(' ');

function requireClientId(clientId: string): string {
  if (!clientId) {
    throw new CliError(
      'No OAuth client id configured. Set COGNITO_DEVICE_CLIENT_ID (see the skill/README).',
    );
  }
  return clientId;
}

/** Initiate the OAuth device-authorization flow. */
export async function initiateDeviceFlow(
  auth: AuthConfig,
  scopes = auth.profile === 'observer' ? OBSERVER_OAUTH_SCOPES : FARM_DATA_SCOPES,
): Promise<DeviceCodeResponse> {
  try {
    const response = await axios.post(auth.deviceCodeEndpoint, {
      client_id: requireClientId(auth.clientId),
      scope: scopes,
    });
    return response.data as DeviceCodeResponse;
  } catch (error: any) {
    throw new CliError(
      `Failed to start sign-in: ${error.response?.data?.message || error.message}`,
    );
  }
}

/**
 * Poll the device token endpoint until the user completes the browser step, the
 * code expires, or we hit the attempt cap. Default cap = ~5 minutes at 5s cadence.
 */
export async function pollForToken(
  auth: AuthConfig,
  deviceCode: string,
  interval = 5,
  maxAttempts = 60,
): Promise<OAuthTokens> {
  let cadence = interval;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await axios.post(
        auth.deviceTokenEndpoint,
        {
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: deviceCode,
          client_id: auth.clientId,
        },
        { validateStatus: (status) => status === 200 || status === 400 },
      );

      if (response.status === 200) {
        return {
          access_token: response.data.access_token,
          refresh_token: response.data.refresh_token,
          token_type: response.data.token_type || 'Bearer',
          expires_in: response.data.expires_in || 3600,
          scope: response.data.scope,
        };
      }

      if (response.data.error === 'authorization_pending') {
        attempts++;
        await sleep(cadence);
        continue;
      }
      if (response.data.error === 'slow_down') {
        cadence = Math.min(cadence * 2, 60);
        attempts++;
        await sleep(cadence);
        continue;
      }
      if (response.data.error === 'expired_token') {
        throw new CliError('Sign-in code expired. Run `ranchbot login` again.');
      }
      throw new CliError(
        response.data.error_description || response.data.error || 'Authorization failed.',
      );
    } catch (error) {
      if (error instanceof CliError) throw error;
      // axios may throw on a 400 despite validateStatus depending on version; handle both.
      const data = (error as any)?.response?.data;
      if (data?.error === 'authorization_pending') {
        attempts++;
        await sleep(cadence);
        continue;
      }
      throw new CliError(`Authorization failed: ${(error as Error).message}`);
    }
  }

  throw new CliError('Sign-in timed out. Run `ranchbot login` again.');
}

/** Revoke a device refresh-token family. */
export async function revokeRefreshToken(auth: AuthConfig, refreshToken: string): Promise<void> {
  try {
    await axios.post(`${auth.apiUrl}/oauth/revoke`, {
      token: refreshToken,
      client_id: requireClientId(auth.clientId),
    });
  } catch (error: any) {
    throw new CliError(
      `Failed to sign out: ${error.response?.data?.error_description || error.response?.data?.message || error.message}`,
    );
  }
}

/** Refresh an access token using a refresh token. */
export async function refreshAccessToken(
  auth: AuthConfig,
  refreshToken: string,
): Promise<OAuthTokens> {
  try {
    const response = await axios.post(auth.tokenEndpoint, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: requireClientId(auth.clientId),
    });
    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token || refreshToken,
      token_type: response.data.token_type || 'Bearer',
      expires_in: response.data.expires_in || 3600,
      scope: response.data.scope,
    };
  } catch (error: any) {
    throw new CliError(
      `Session expired. Run \`ranchbot login\` again. (${error.response?.data?.error_description || error.message})`,
    );
  }
}

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}
