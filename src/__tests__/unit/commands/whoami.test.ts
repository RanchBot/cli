import { whoami } from '../../../commands/whoami';
import { createMockClient } from '../testUtils';

jest.mock('../../../config', () => {
  const actual = jest.requireActual('../../../config');
  return {
    ...actual,
    loadTokens: jest.fn().mockReturnValue({
      access_token: 'opaque',
      expires_at: Date.now() + 60_000,
      scope: 'read:farms read:inspection',
    }),
  };
});

describe('whoami observer attestation', () => {
  it('reports read-only only when the API attests the observer client', async () => {
    const client = createMockClient();
    client.getFarms.mockResolvedValue({
      farms: [{ id: 'farm-1', name: 'Farm One' }],
      total: 1,
      access: {
        profile: 'observer',
        read_only: true,
        scopes: ['read:farms', 'read:inspection'],
      },
    });

    await expect(whoami(client, '', { profile: 'observer' })).resolves.toEqual(
      expect.objectContaining({
        profile: 'observer',
        read_only: true,
        scopes: ['read:farms', 'read:inspection'],
      }),
    );
  });

  it('rejects an observer cache used with a non-observer server session', async () => {
    const client = createMockClient();
    client.getFarms.mockResolvedValue({ farms: [], total: 0, access: null });

    await expect(whoami(client, '', { profile: 'observer' })).rejects.toThrow(
      /did not recognize.*read-only observer/,
    );
  });
});
