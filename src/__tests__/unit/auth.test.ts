import axios from 'axios';
import { AuthConfig, initiateDeviceFlow, revokeRefreshToken } from '../../auth';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const config = (profile: 'default' | 'observer'): AuthConfig => ({
  apiUrl: 'https://api.test',
  clientId: profile === 'observer' ? 'ranchbot-pi-observer-v1' : 'normal-client',
  profile,
  deviceCodeEndpoint: 'https://api.test/oauth/device',
  deviceTokenEndpoint: 'https://api.test/oauth/device/token',
  tokenEndpoint: 'https://api.test/oauth/token',
});

const response = {
  data: {
    device_code: 'device-code',
    user_code: 'ABCD1234',
    verification_uri: 'https://test/activate',
    verification_uri_complete: 'https://test/activate?user_code=ABCD1234',
    expires_in: 900,
    interval: 5,
  },
};

describe('initiateDeviceFlow profiles', () => {
  beforeEach(() => mockedAxios.post.mockResolvedValue(response));

  it('requests only inspection and farm identity scopes for the observer', async () => {
    await initiateDeviceFlow(config('observer'));

    expect(mockedAxios.post).toHaveBeenCalledWith('https://api.test/oauth/device', {
      client_id: 'ranchbot-pi-observer-v1',
      scope: 'read:farms read:inspection',
    });
  });

  it('keeps the normal CLI read/write scopes', async () => {
    await initiateDeviceFlow(config('default'));

    expect(mockedAxios.post).toHaveBeenCalledWith('https://api.test/oauth/device', {
      client_id: 'normal-client',
      scope:
        'read:farms write:farms read:animals write:animals read:records write:records read:groups write:groups',
    });
  });

  it('revokes a server-side refresh-token family', async () => {
    await revokeRefreshToken(config('default'), 'rb_rt_current');

    expect(mockedAxios.post).toHaveBeenCalledWith('https://api.test/oauth/revoke', {
      token: 'rb_rt_current',
      client_id: 'normal-client',
    });
  });
});
