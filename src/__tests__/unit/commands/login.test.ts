import { initiateDeviceFlow, pollForToken } from '../../../auth';
import { login } from '../../../commands/login';
import { storeTokens } from '../../../config';

jest.mock('../../../auth', () => ({
  initiateDeviceFlow: jest.fn(),
  pollForToken: jest.fn(),
}));
jest.mock('../../../config', () => {
  const actual = jest.requireActual('../../../config');
  return { ...actual, storeTokens: jest.fn(), tokenCachePath: jest.fn(() => '/token-cache') };
});

const mockedInitiate = initiateDeviceFlow as jest.Mock;
const mockedPoll = pollForToken as jest.Mock;
const mockedStore = storeTokens as jest.Mock;

const accessTokenFor = (clientId: string) =>
  [
    Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'),
    Buffer.from(
      JSON.stringify({
        iss: 'ranchbot',
        typ: 'access',
        client_id: clientId,
        scope: 'read:farms read:inspection',
      }),
    ).toString('base64url'),
    'test-signature',
  ].join('.');

const observerAccessToken = accessTokenFor('ranchbot-pi-observer-v1');

const device = {
  device_code: 'device-code',
  user_code: 'ABCD1234',
  verification_uri: 'https://test/activate',
  verification_uri_complete: 'https://test/activate?user_code=ABCD1234',
  expires_in: 900,
  interval: 1,
};

describe('login observer profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedInitiate.mockResolvedValue(device);
  });

  it('stores an observer token only with the exact read-only grants', async () => {
    const tokens = {
      access_token: observerAccessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'read:farms read:inspection',
    };
    mockedPoll.mockResolvedValue(tokens);

    await expect(login({ profile: 'observer' })).resolves.toEqual(
      expect.objectContaining({ profile: 'observer', read_only: true }),
    );
    expect(mockedStore).toHaveBeenCalledWith(tokens, 'observer', 'ranchbot-pi-observer-v1');
  });

  it('refuses to cache exact scopes carried by a non-observer token', async () => {
    mockedPoll.mockResolvedValue({
      access_token: accessTokenFor('normal-client'),
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'read:farms read:inspection',
    });

    await expect(login({ profile: 'observer' })).rejects.toThrow(/bounded read-only observer/);
    expect(mockedStore).not.toHaveBeenCalled();
  });

  it('refuses to cache an observer token with a write scope', async () => {
    mockedPoll.mockResolvedValue({
      access_token: 'access',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'read:farms read:inspection write:records',
    });

    await expect(login({ profile: 'observer' })).rejects.toThrow(/read-only observer credential/);
    expect(mockedStore).not.toHaveBeenCalled();
  });
});
