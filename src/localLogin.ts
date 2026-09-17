import axios from 'axios';
import { createInterface } from 'readline';
import { Writable } from 'stream';
import { CliError } from './errors';
import { localOrigin, storeLocalSession } from './localSession';

export async function loginLocal(address: string): Promise<unknown> {
  const origin = localOrigin(address);
  if (!process.stdin.isTTY) throw new CliError('Local login requires an interactive terminal.');
  const http = axios.create({ baseURL: origin, maxRedirects: 0, proxy: false, timeout: 15000 });
  try {
    if ((await http.get('/v1/runtime')).data.mode !== 'local') throw new Error();
  } catch {
    throw new CliError('Could not verify a local installation at this address.');
  }
  let hidden = false;
  const output = new Writable({
    write(chunk, _encoding, done) {
      if (!hidden) process.stderr.write(chunk);
      done();
    },
  });
  const terminal = createInterface({ input: process.stdin, output, terminal: true });
  const ask = (label: string, secret = false) =>
    new Promise<string>((resolve) => {
      terminal.question(label, (answer) => {
        hidden = false;
        if (secret) process.stderr.write('\n');
        resolve(answer);
      });
      hidden = secret;
    });
  try {
    const username = await ask('Local username: ');
    const password = await ask('Password: ', true);
    try {
      const { data } = await http.post('/v1/auth/login', { username, password });
      storeLocalSession(origin, data);
      return { signed_in: true, local: true, origin, expires_in: data.expires_in };
    } catch {
      // Axios errors can retain the password-bearing request configuration.
      throw new CliError(
        'Local sign-in failed. Check the username, password and installation connection.',
      );
    }
  } finally {
    terminal.close();
  }
}
