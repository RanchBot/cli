import {
  initiateDeviceFlow,
  pollForToken,
  refreshAccessToken,
  revokeRefreshToken,
} from '../../auth';
import { login } from '../../commands/login';
import { logout } from '../../commands/logout';
import {
  clearTokens,
  isTokenExpired,
  loadTokens,
  resolveProfile,
  resolveRuntime,
  StoredTokens,
  storeTokens,
  tokenCachePath,
  withTokenLock,
} from '../../config';
import { getAuthenticatedClient } from '../../session';

jest.mock('../../auth', () => ({
  initiateDeviceFlow: jest.fn(),
  pollForToken: jest.fn(),
  refreshAccessToken: jest.fn(),
  revokeRefreshToken: jest.fn(),
}));
jest.mock('../../config', () => ({
  clearTokens: jest.fn(),
  isTokenExpired: jest.fn(),
  loadTokens: jest.fn(),
  resolveProfile: jest.fn(),
  resolveRuntime: jest.fn(),
  storeTokens: jest.fn(),
  tokenCachePath: jest.fn(),
  withTokenLock: jest.fn(),
}));

const mockedInitiate = initiateDeviceFlow as jest.MockedFunction<typeof initiateDeviceFlow>;
const mockedPoll = pollForToken as jest.MockedFunction<typeof pollForToken>;
const mockedRefresh = refreshAccessToken as jest.MockedFunction<typeof refreshAccessToken>;
const mockedRevoke = revokeRefreshToken as jest.MockedFunction<typeof revokeRefreshToken>;
const mockedLoad = loadTokens as jest.MockedFunction<typeof loadTokens>;
const mockedResolveProfile = resolveProfile as jest.MockedFunction<typeof resolveProfile>;
const mockedResolve = resolveRuntime as jest.MockedFunction<typeof resolveRuntime>;
const mockedStore = storeTokens as jest.MockedFunction<typeof storeTokens>;
const mockedExpired = isTokenExpired as jest.MockedFunction<typeof isTokenExpired>;
const mockedLock = withTokenLock as jest.MockedFunction<typeof withTokenLock>;

const runtime = (clientId = 'ranchbot-cli') => ({
  apiUrl: 'https://api.ranch.bot',
  apiVersion: 'v1',
  clientId,
  profile: 'default' as const,
  deviceCodeEndpoint: 'https://api.ranch.bot/oauth/device',
  deviceTokenEndpoint: 'https://api.ranch.bot/oauth/device/token',
  tokenEndpoint: 'https://api.ranch.bot/oauth/token',
});

const oauthTokens = (accessToken: string, refreshToken: string) => ({
  access_token: accessToken,
  refresh_token: refreshToken,
  token_type: 'Bearer',
  expires_in: 900,
});

describe('login/logout token-cache serialization', () => {
  let cached: StoredTokens | null;
  let releaseRefresh: (tokens: ReturnType<typeof oauthTokens>) => void;
  let refreshStarted: Promise<void>;
  let markRefreshStarted: () => void;
  let stderr: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    cached = {
      access_token: 'old-access',
      refresh_token: 'old-refresh',
      expires_at: 1,
      client_id: 'ranchbot-cli',
    };
    let previous = Promise.resolve();
    mockedLock.mockImplementation((callback) => {
      const result = previous.then(callback);
      previous = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    });
    mockedLoad.mockImplementation(() => cached);
    mockedStore.mockImplementation((tokens, _profile, clientId) => {
      cached = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + tokens.expires_in * 1000,
        client_id: clientId,
      };
      return cached;
    });
    (clearTokens as jest.MockedFunction<typeof clearTokens>).mockImplementation(() => {
      cached = null;
    });
    mockedExpired.mockImplementation((tokens) => tokens?.access_token === 'old-access');
    mockedResolveProfile.mockImplementation(() => 'default');
    mockedResolve.mockImplementation((options = {}) => runtime(options.clientId));
    (tokenCachePath as jest.MockedFunction<typeof tokenCachePath>).mockReturnValue(
      '/home/test/.ranchbot/tokens.json',
    );
    refreshStarted = new Promise<void>((resolve) => {
      markRefreshStarted = resolve;
    });
    mockedRefresh.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseRefresh = resolve;
          markRefreshStarted();
        }),
    );
    mockedInitiate.mockResolvedValue({
      device_code: 'device-code',
      user_code: 'USERCODE',
      verification_uri: 'https://app.ranch.bot/activate',
      verification_uri_complete: 'https://app.ranch.bot/activate?user_code=USERCODE',
      expires_in: 900,
      interval: 5,
    });
    mockedPoll.mockResolvedValue(oauthTokens('login-access', 'login-refresh'));
    mockedRevoke.mockResolvedValue(undefined);
    stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => stderr.mockRestore());

  it('lets logout revoke the rotated family after an in-flight refresh', async () => {
    const refresh = getAuthenticatedClient();
    await refreshStarted;
    const signOut = logout();

    releaseRefresh(oauthTokens('rotated-access', 'rotated-refresh'));
    await Promise.all([refresh, signOut]);

    expect(mockedRevoke).toHaveBeenCalledWith(runtime(), 'rotated-refresh');
    expect(cached).toBeNull();
  });

  it('lets login revoke the rotated family before replacing the cache', async () => {
    const refresh = getAuthenticatedClient();
    await refreshStarted;
    const signIn = login({});

    releaseRefresh(oauthTokens('rotated-access', 'rotated-refresh'));
    await Promise.all([refresh, signIn]);

    expect(mockedRevoke).toHaveBeenCalledWith(runtime(), 'rotated-refresh');
    expect(cached).toMatchObject({
      access_token: 'login-access',
      refresh_token: 'login-refresh',
    });
  });
});
