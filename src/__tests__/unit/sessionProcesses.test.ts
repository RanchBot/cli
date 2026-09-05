import { tryLock } from 'fs-native-extensions';
import { fork, ChildProcess } from 'child_process';
import { once } from 'events';
import * as fs from 'fs';
import { createServer, Server, ServerResponse } from 'http';
import { tmpdir } from 'os';
import * as path from 'path';

type PendingRequest = {
  body: Record<string, string>;
  response: ServerResponse;
  authorization?: string;
};
const tokens = (prefix: string) => ({
  access_token: `${prefix}-access`,
  refresh_token: `${prefix}-refresh`,
  token_type: 'Bearer',
  expires_in: 900,
});
const reply = (pending: PendingRequest, body: unknown, status = 200) => {
  pending.response.writeHead(status, { 'Content-Type': 'application/json' });
  pending.response.end(JSON.stringify(body));
};

describe('CLI sessions across processes', () => {
  let home: string;
  let cache: string;
  let lock: string;
  let server: Server;
  let apiUrl: string;
  let children: ChildProcess[];
  let queues: Map<string, PendingRequest[]>;
  let waiters: Map<string, (request: PendingRequest) => void>;

  const next = (url: string): Promise<PendingRequest> => {
    const queued = queues.get(url)?.shift();
    return queued ? Promise.resolve(queued) : new Promise((resolve) => waiters.set(url, resolve));
  };
  const expectOwnership = (held: boolean) => {
    const probe = fs.openSync(lock, 'a+');
    try {
      expect(tryLock(probe)).toBe(!held);
    } finally {
      fs.closeSync(probe);
    }
  };
  const readCache = () => JSON.parse(fs.readFileSync(cache, 'utf8'));
  const start = (operation: string) => {
    const child = fork(
      path.resolve(__dirname, '../fixtures/sessionWorker.ts'),
      [operation, apiUrl],
      {
        cwd: home,
        execArgv: ['--require', require.resolve('tsx/cjs')],
        env: { HOME: home, PATH: process.env.PATH, DOTENV_CONFIG_PATH: path.join(home, '.env') },
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      },
    );
    children.push(child);
    let stderr = '';
    child.stderr!.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
    const contended = new Promise<void>((resolve) => {
      child.on('message', (message) => {
        if (message === 'contended') resolve();
      });
    });
    const done = once(child, 'exit').then(([code]) => ({ code, stderr }));
    return { child, contended, done };
  };
  const approveLogin = async () => {
    reply(await next('/oauth/device'), {
      device_code: 'synthetic-device',
      user_code: 'TESTCODE',
      verification_uri: `${apiUrl}/activate`,
      verification_uri_complete: `${apiUrl}/activate`,
      expires_in: 900,
      interval: 1,
    });
    reply(await next('/oauth/device/token'), tokens('replacement'));
  };
  const expectUsableReplacement = async () => {
    const use = start('use');
    const request = await next('/api/v1/farm');
    expect(request.authorization).toBe('Bearer replacement-access');
    reply(request, { records: [], total: 0 });
    expect((await use.done).code).toBe(0);
  };

  beforeEach(async () => {
    home = fs.mkdtempSync(path.join(tmpdir(), 'ranchbot-session-'));
    fs.mkdirSync(path.join(home, '.ranchbot'));
    cache = path.join(home, '.ranchbot/tokens.json');
    lock = path.join(home, '.ranchbot/tokens.lock');
    fs.writeFileSync(
      cache,
      JSON.stringify({ ...tokens('old'), expires_at: 1, client_id: 'ranchbot-cli' }),
    );
    children = [];
    queues = new Map();
    waiters = new Map();
    server = createServer((request, response) => {
      let raw = '';
      request.on('data', (data: Buffer) => {
        raw += data.toString();
      });
      request.on('end', () => {
        const pending = {
          body: raw ? JSON.parse(raw) : {},
          response,
          authorization: request.headers.authorization,
        };
        const url = request.url!;
        const waiter = waiters.get(url);
        if (waiter) {
          waiters.delete(url);
          waiter(pending);
        } else {
          queues.set(url, [...(queues.get(url) || []), pending]);
        }
      });
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    apiUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  afterEach(async () => {
    await Promise.all(
      children.map(async (child) => {
        if (child.exitCode === null && child.signalCode === null) {
          const exited = once(child, 'exit');
          child.kill();
          await exited;
        }
      }),
    );
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(home, { recursive: true, force: true });
  });

  it.each(['logout', 'login'])(
    'serializes refresh racing with %s',
    async (operation) => {
      const refresh = start('refresh');
      const refreshRequest = await next('/oauth/token');
      expect(refreshRequest.body.refresh_token).toBe('old-refresh');
      expectOwnership(true);
      const command = start(operation);
      if (operation === 'login') await approveLogin();
      await command.contended;
      reply(refreshRequest, tokens('rotated'));
      expect((await refresh.done).code).toBe(0);

      const revoke = await next('/oauth/revoke');
      expect(revoke.body).toEqual({ token: 'rotated-refresh', client_id: 'ranchbot-cli' });
      expect(readCache().refresh_token).toBe('rotated-refresh');
      expectOwnership(true);
      reply(revoke, {});
      expect((await command.done).code).toBe(0);
      expectOwnership(false);
      if (operation === 'logout') {
        expect(fs.existsSync(cache)).toBe(false);
      } else {
        expect(readCache().refresh_token).toBe('replacement-refresh');
        await expectUsableReplacement();
      }
    },
    20_000,
  );

  it.each(['logout', 'login'])(
    'preserves credentials and releases the lock when %s revocation fails',
    async (operation) => {
      const original = fs.readFileSync(cache, 'utf8');
      const failed = start(operation);
      if (operation === 'login') await approveLogin();
      const revoke = await next('/oauth/revoke');
      expect(revoke.body.token).toBe('old-refresh');
      reply(revoke, { error_description: 'Synthetic revocation failure' }, 503);
      expect(await failed.done).toMatchObject({
        code: 1,
        stderr: expect.stringContaining('Synthetic revocation failure'),
      });
      expect(fs.readFileSync(cache, 'utf8')).toBe(original);
      expectOwnership(false);

      const retry = start(operation);
      if (operation === 'login') await approveLogin();
      const retried = await next('/oauth/revoke');
      expect(retried.body.token).toBe('old-refresh');
      reply(retried, {});
      expect((await retry.done).code).toBe(0);
      expectOwnership(false);
      if (operation === 'logout') expect(fs.existsSync(cache)).toBe(false);
      else await expectUsableReplacement();
    },
    20_000,
  );
});
