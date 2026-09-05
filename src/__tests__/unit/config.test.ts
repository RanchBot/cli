import { tryLock } from 'fs-native-extensions';
import * as fs from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import {
  hasObserverAccessTokenClaims,
  OBSERVER_DEVICE_CLIENT_ID,
  resolveProfile,
  resolveRuntime,
  toStoredTokens,
  withTokenLock,
} from '../../config';

const tokens = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  token_type: 'Bearer',
  expires_in: 3600,
  scope: 'read:farms read:inspection',
};

describe('CLI credential profiles', () => {
  it('recognizes only the dedicated access-token claims for the observer cache', () => {
    const token = (clientId: string, scope = 'read:farms read:inspection') =>
      [
        Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'),
        Buffer.from(
          JSON.stringify({
            iss: 'ranchbot',
            typ: 'access',
            client_id: clientId,
            scope,
          }),
        ).toString('base64url'),
        'test-signature',
      ].join('.');

    expect(hasObserverAccessTokenClaims(token(OBSERVER_DEVICE_CLIENT_ID))).toBe(true);
    expect(hasObserverAccessTokenClaims(token('normal-client'))).toBe(false);
    expect(
      hasObserverAccessTokenClaims(token(OBSERVER_DEVICE_CLIENT_ID, 'read:farms write:records')),
    ).toBe(false);
    expect(hasObserverAccessTokenClaims('opaque-token')).toBe(false);
  });

  it('uses stable named clients for default and admin login', () => {
    expect(resolveRuntime()).toMatchObject({ clientId: 'ranchbot-cli', profile: 'default' });
    expect(resolveRuntime({ admin: true })).toMatchObject({
      clientId: 'ranchbot-admin-cli',
      profile: 'default',
    });
  });

  it('resolves the dedicated observer OAuth client', () => {
    const runtime = resolveRuntime({ profile: 'observer' });

    expect(runtime.profile).toBe('observer');
    expect(runtime.clientId).toBe(OBSERVER_DEVICE_CLIENT_ID);
  });

  it('rejects unknown profile names', () => {
    expect(() => resolveProfile('production')).toThrow(/default.*observer/);
  });

  it('does not allow the observer profile to substitute a broader OAuth client', () => {
    expect(() => resolveRuntime({ profile: 'observer', clientId: 'normal-client' })).toThrow(
      /dedicated OAuth client/,
    );
  });

  it('serializes concurrent token-cache mutations', async () => {
    const directory = fs.mkdtempSync(path.join(tmpdir(), 'ranchbot-cli-lock-'));
    const lockFile = path.join(directory, 'tokens.lock');
    const events: string[] = [];
    let releaseFirst!: () => void;
    let markFirstEntered!: () => void;
    const holdFirst = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstEntered = new Promise<void>((resolve) => {
      markFirstEntered = resolve;
    });

    const first = withTokenLock(async () => {
      events.push('first:start');
      markFirstEntered();
      await holdFirst;
      events.push('first:end');
    }, lockFile);
    await firstEntered;
    const second = withTokenLock(async () => {
      events.push('second');
    }, lockFile);

    try {
      await new Promise((resolve) => setTimeout(resolve, 75));
      expect(events).toEqual(['first:start']);
    } finally {
      releaseFirst();
    }
    await Promise.all([first, second]);
    expect(events).toEqual(['first:start', 'first:end', 'second']);
    const probe = fs.openSync(lockFile, 'a+');
    try {
      expect(tryLock(probe)).toBe(true);
    } finally {
      fs.closeSync(probe);
    }
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('discards observer refresh tokens while retaining normal-profile refresh', () => {
    expect(toStoredTokens(tokens, 'observer', 1_000)).toEqual({
      access_token: 'access-token',
      refresh_token: undefined,
      expires_at: 3_601_000,
      scope: 'read:farms read:inspection',
    });
    expect(toStoredTokens(tokens, 'default', 1_000).refresh_token).toBe('refresh-token');
  });
});
