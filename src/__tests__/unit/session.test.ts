import { refreshAccessToken } from '../../auth';
import {
  clearTokens,
  isTokenExpired,
  loadTokens,
  resolveRuntime,
  storeTokens,
  withTokenLock,
} from '../../config';
import { getAuthenticatedClient } from '../../session';

jest.mock('../../auth', () => ({ refreshAccessToken: jest.fn() }));
jest.mock('../../config', () => ({
  clearTokens: jest.fn(),
  isTokenExpired: jest.fn(),
  loadTokens: jest.fn(),
  resolveRuntime: jest.fn(),
  storeTokens: jest.fn(),
  withTokenLock: jest.fn(),
}));

const mockedLoadTokens = loadTokens as jest.MockedFunction<typeof loadTokens>;
const mockedIsTokenExpired = isTokenExpired as jest.MockedFunction<typeof isTokenExpired>;
const mockedResolveRuntime = resolveRuntime as jest.MockedFunction<typeof resolveRuntime>;
const mockedRefresh = refreshAccessToken as jest.MockedFunction<typeof refreshAccessToken>;
const mockedStoreTokens = storeTokens as jest.MockedFunction<typeof storeTokens>;
const mockedWithTokenLock = withTokenLock as jest.MockedFunction<typeof withTokenLock>;

const runtime = {
  apiUrl: 'https://api.ranch.bot',
  apiVersion: 'v1',
  clientId: 'ranchbot-admin-cli',
  profile: 'default' as const,
  deviceCodeEndpoint: 'https://api.ranch.bot/oauth/device',
  deviceTokenEndpoint: 'https://api.ranch.bot/oauth/device/token',
  tokenEndpoint: 'https://api.ranch.bot/oauth/token',
};

describe('getAuthenticatedClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLoadTokens.mockReturnValue({
      access_token: 'old-access',
      refresh_token: 'refresh',
      expires_at: 1,
      client_id: 'ranchbot-admin-cli',
    });
    mockedIsTokenExpired.mockReturnValue(true);
    mockedResolveRuntime.mockReturnValue(runtime);
    mockedRefresh.mockResolvedValue({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      token_type: 'Bearer',
      expires_in: 900,
    });
    mockedStoreTokens.mockReturnValue({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_at: Date.now() + 900_000,
      client_id: 'ranchbot-admin-cli',
    });
    mockedWithTokenLock.mockImplementation((callback) => callback());
  });

  it('refreshes with the client identity stored by admin login', async () => {
    await getAuthenticatedClient();

    expect(mockedResolveRuntime).toHaveBeenCalledWith({ clientId: 'ranchbot-admin-cli' });
    expect(mockedRefresh).toHaveBeenCalledWith(runtime, 'refresh');
    expect(mockedStoreTokens).toHaveBeenCalledWith(
      expect.objectContaining({ access_token: 'new-access' }),
      'default',
      'ranchbot-admin-cli',
    );
    expect(clearTokens).not.toHaveBeenCalled();
  });

  it('serializes parallel refreshes and reuses the rotated session', async () => {
    let cached = {
      access_token: 'old-access',
      refresh_token: 'refresh',
      expires_at: 1,
      client_id: 'ranchbot-admin-cli',
    };
    let previous = Promise.resolve();
    mockedLoadTokens.mockImplementation(() => cached);
    mockedIsTokenExpired.mockImplementation((tokens) => tokens?.access_token === 'old-access');
    mockedStoreTokens.mockImplementation((tokens, _profile, clientId) => {
      cached = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token!,
        expires_at: Date.now() + tokens.expires_in * 1000,
        client_id: clientId ?? 'ranchbot-admin-cli',
      };
      return cached;
    });
    mockedWithTokenLock.mockImplementation((callback) => {
      const result = previous.then(callback);
      previous = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    });

    const [first, second] = await Promise.all([getAuthenticatedClient(), getAuthenticatedClient()]);

    expect(mockedRefresh).toHaveBeenCalledTimes(1);
    expect((first.client as any).accessToken).toBe('new-access');
    expect((second.client as any).accessToken).toBe('new-access');
    expect(clearTokens).not.toHaveBeenCalled();
  });
});
