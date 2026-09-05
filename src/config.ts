import { tryLock } from 'fs-native-extensions';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import dotenv from 'dotenv';
import { CliError } from './errors';

dotenv.config();

/**
 * Local state for the Ranch.Bot CLI lives under ~/.ranchbot/ (mode 700):
 *   - tokens.json           (mode 600): normal OAuth tokens
 *   - tokens-observer.json  (mode 600): short-lived observer access token
 *   - config.json                      : the persisted default farm id (+ future prefs)
 *
 * Token cache is intentionally separate from the published MCP server's
 * ~/.ranchbot-mcp-tokens.json — the MCP contract is public and must not regress.
 */

const CONFIG_DIR = path.join(homedir(), '.ranchbot');
const DEFAULT_TOKEN_FILE = path.join(CONFIG_DIR, 'tokens.json');
const OBSERVER_TOKEN_FILE = path.join(CONFIG_DIR, 'tokens-observer.json');
const DEFAULT_TOKEN_LOCK_FILE = path.join(CONFIG_DIR, 'tokens.lock');
const OBSERVER_TOKEN_LOCK_FILE = path.join(CONFIG_DIR, 'tokens-observer.lock');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export const OBSERVER_DEVICE_CLIENT_ID = 'ranchbot-pi-observer-v1';
export const OBSERVER_SCOPES = ['read:farms', 'read:inspection'] as const;
export type CliProfile = 'default' | 'observer';

export const hasExactObserverScopes = (scopes: string[]): boolean =>
  scopes.length === OBSERVER_SCOPES.length &&
  OBSERVER_SCOPES.every((scope) => scopes.includes(scope));

/** Local fail-closed profile guard; the API still performs the authoritative JWT verification. */
export const hasObserverAccessTokenClaims = (accessToken: string): boolean => {
  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3 || parts.some((part) => !part)) return false;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      iss?: unknown;
      typ?: unknown;
      client_id?: unknown;
      scope?: unknown;
    };
    const scopes =
      typeof payload.scope === 'string' ? payload.scope.split(' ').filter(Boolean) : [];
    return (
      payload.iss === 'ranchbot' &&
      payload.typ === 'access' &&
      payload.client_id === OBSERVER_DEVICE_CLIENT_ID &&
      hasExactObserverScopes(scopes)
    );
  } catch {
    return false;
  }
};

export function resolveProfile(value?: string): CliProfile {
  const profile = value || 'default';
  if (profile !== 'default' && profile !== 'observer') {
    throw new CliError('Invalid --profile. Use "default" or "observer".');
  }
  return profile;
}

const tokenFileFor = (profile: CliProfile): string =>
  profile === 'observer' ? OBSERVER_TOKEN_FILE : DEFAULT_TOKEN_FILE;

export const tokenCachePath = (profile: CliProfile): string => tokenFileFor(profile);

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface StoredTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope?: string;
  client_id?: string;
}

interface StoredConfig {
  defaultFarmId?: string;
}

/** Ensure ~/.ranchbot exists with restrictive perms. Idempotent. */
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    return;
  }
  // Tighten perms on a pre-existing dir if it's too open (best effort).
  try {
    fs.chmodSync(CONFIG_DIR, 0o700);
  } catch {
    // ignore — we still read/write below
  }
}

// --- Tokens -----------------------------------------------------------------

export function toStoredTokens(
  tokens: OAuthTokens,
  profile: CliProfile,
  now = Date.now(),
  clientId?: string,
): StoredTokens {
  return {
    access_token: tokens.access_token,
    // Defense in depth for an older API: never retain an observer refresh token. Current servers
    // neither issue nor accept one, so the production read grant ends with the one-hour access JWT.
    refresh_token: profile === 'default' ? tokens.refresh_token : undefined,
    expires_at: now + tokens.expires_in * 1000,
    scope: tokens.scope,
    client_id: clientId,
  };
}

export function storeTokens(
  tokens: OAuthTokens,
  profile: CliProfile = 'default',
  clientId?: string,
): StoredTokens {
  ensureConfigDir();
  const stored = toStoredTokens(tokens, profile, Date.now(), clientId);
  const tokenFile = tokenFileFor(profile);
  fs.writeFileSync(tokenFile, JSON.stringify(stored, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(tokenFile, 0o600);
  } catch {
    // best effort
  }
  return stored;
}

export function loadTokens(profile: CliProfile = 'default'): StoredTokens | null {
  try {
    const tokenFile = tokenFileFor(profile);
    if (!fs.existsSync(tokenFile)) return null;
    const data = fs.readFileSync(tokenFile, 'utf-8');
    return JSON.parse(data) as StoredTokens;
  } catch {
    return null;
  }
}

export function clearTokens(profile: CliProfile = 'default'): void {
  try {
    const tokenFile = tokenFileFor(profile);
    if (fs.existsSync(tokenFile)) fs.unlinkSync(tokenFile);
  } catch {
    // ignore
  }
}

export function isTokenExpired(tokens: StoredTokens | null, leewayMs = 60_000): boolean {
  if (!tokens) return true;
  return Date.now() + leewayMs >= tokens.expires_at;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isProcessRunning = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
};

const tokenLockFileFor = (profile: CliProfile): string =>
  profile === 'observer' ? OBSERVER_TOKEN_LOCK_FILE : DEFAULT_TOKEN_LOCK_FILE;

/** Serialize token-cache mutations across CLI processes for one credential profile. */
export async function withTokenLock<T>(
  callback: () => Promise<T>,
  profileOrLockFile: CliProfile | string = 'default',
): Promise<T> {
  ensureConfigDir();
  const lockFile =
    profileOrLockFile === 'default' || profileOrLockFile === 'observer'
      ? tokenLockFileFor(profileOrLockFile)
      : profileOrLockFile;
  const deadline = Date.now() + 30_000;
  // The inode must persist: unlinking it would let contenders lock different files.
  const lock = fs.openSync(lockFile, fs.constants.O_RDWR | fs.constants.O_CREAT, 0o600);
  try {
    while (!tryLock(lock)) {
      if (Date.now() >= deadline) throw new Error('Timed out waiting for the token cache lock');
      await wait(25);
    }

    // Older clients used PID files. They must be stopped before upgrading.
    const owner = fs.readFileSync(lock, 'utf8');
    const pid = Number(owner.split(':', 1)[0]);
    if (Number.isSafeInteger(pid) && pid > 0 && isProcessRunning(pid)) {
      throw new Error(
        'Legacy token cache lock has a live owner; stop older clients before upgrading',
      );
    }
    // Retire legacy PID metadata in place without truncating the locked file.
    if (!owner.startsWith('native-lock')) fs.writeSync(lock, 'native-lock', 0, 'utf8');
    return await callback();
  } finally {
    // Closing also releases ownership after errors; the OS releases it on process death.
    fs.closeSync(lock);
  }
}

// --- Config (default farm + future prefs) -----------------------------------

function loadConfig(): StoredConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data) as StoredConfig;
  } catch {
    return {};
  }
}

function saveConfig(config: StoredConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function getDefaultFarmId(): string | undefined {
  return loadConfig().defaultFarmId;
}

export function setDefaultFarmId(farmId: string | null): void {
  const config = loadConfig();
  if (farmId) {
    config.defaultFarmId = farmId;
  } else {
    delete config.defaultFarmId;
  }
  saveConfig(config);
}

// --- Runtime resolution (flag > env > default) ------------------------------

export interface RuntimeOverrides {
  apiUrl?: string;
  apiVersion?: string;
  clientId?: string;
  profile?: string;
  admin?: boolean;
}

export interface RuntimeConfig {
  apiUrl: string;
  apiVersion: string;
  clientId: string;
  profile: CliProfile;
  deviceCodeEndpoint: string;
  deviceTokenEndpoint: string;
  tokenEndpoint: string;
}

export function resolveRuntime(overrides: RuntimeOverrides = {}): RuntimeConfig {
  const apiUrl = overrides.apiUrl || process.env.RANCHBOT_API_URL || 'https://api.ranch.bot';
  const apiVersion = overrides.apiVersion || process.env.API_VERSION || 'v1';
  const profile = resolveProfile(overrides.profile);
  if (profile === 'observer' && overrides.admin) {
    throw new CliError('The observer profile cannot request admin access.');
  }
  if (
    profile === 'observer' &&
    overrides.clientId &&
    overrides.clientId !== OBSERVER_DEVICE_CLIENT_ID
  ) {
    throw new CliError('The observer profile requires its dedicated OAuth client id.');
  }
  // These are public OAuth client identifiers, not credentials. Explicit overrides remain useful
  // for local development, but production defaults have stable reviewed names.
  const profileClientId =
    profile === 'observer'
      ? OBSERVER_DEVICE_CLIENT_ID
      : overrides.admin
        ? 'ranchbot-admin-cli'
        : process.env.COGNITO_DEVICE_CLIENT_ID || 'ranchbot-cli';
  const clientId = overrides.clientId || profileClientId;
  return {
    apiUrl,
    apiVersion,
    clientId,
    profile,
    deviceCodeEndpoint: `${apiUrl}/oauth/device`,
    deviceTokenEndpoint: `${apiUrl}/oauth/device/token`,
    tokenEndpoint: `${apiUrl}/oauth/token`,
  };
}

/** @internal — exposed for tests. Never print or read token file contents in an agent session. */
export const paths = {
  CONFIG_DIR,
  DEFAULT_TOKEN_FILE,
  OBSERVER_TOKEN_FILE,
  DEFAULT_TOKEN_LOCK_FILE,
  OBSERVER_TOKEN_LOCK_FILE,
  CONFIG_FILE,
};
