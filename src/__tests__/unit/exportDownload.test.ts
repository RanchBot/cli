import axios from 'axios';
import { createHash } from 'crypto';
import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { RanchBotApiClient } from '../../client';

jest.mock('axios');
const get = jest.fn();
let directory: string;
let destination: string;
let client: RanchBotApiClient;
const bytes = Buffer.from('synthetic archive');
const checksum = createHash('sha256').update(bytes).digest('hex');
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cli-export-'));
  destination = join(directory, 'archive.zip');
  (axios.create as jest.Mock).mockReturnValue({ get });
  get.mockResolvedValue({
    data: Readable.from([bytes]),
    headers: { 'x-content-sha256': checksum },
  });
  client = new RanchBotApiClient({
    accessToken: 'synthetic',
    apiUrl: 'http://localhost',
    apiVersion: 'v1',
  });
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));
test('downloads exact bytes and verifies the checksum without redirects', async () => {
  await expect(client.downloadFarmExport('farm', 'job', destination)).resolves.toEqual({
    path: destination,
    sha256: checksum,
  });
  expect(readFileSync(destination)).toEqual(bytes);
  expect(get).toHaveBeenCalledWith('/farm/farm/exports/job/download', {
    responseType: 'stream',
    maxRedirects: 0,
  });
});
test('refuses to overwrite and preserves existing bytes', async () => {
  writeFileSync(destination, 'existing');
  await expect(client.downloadFarmExport('farm', 'job', destination)).rejects.toMatchObject({
    code: 'EEXIST',
  });
  expect(readFileSync(destination, 'utf8')).toBe('existing');
});
test('removes a download with a bad checksum', async () => {
  get.mockResolvedValue({ data: Readable.from([bytes]), headers: { 'x-content-sha256': 'bad' } });
  await expect(client.downloadFarmExport('farm', 'job', destination)).rejects.toThrow('checksum');
  expect(existsSync(destination)).toBe(false);
});
test('removes incomplete output when the source stream fails', async () => {
  get.mockResolvedValue({
    data: Readable.from(
      (async function* () {
        yield bytes;
        throw new Error('interrupted');
      })(),
    ),
    headers: {},
  });
  await expect(client.downloadFarmExport('farm', 'job', destination)).rejects.toThrow(
    'interrupted',
  );
  expect(existsSync(destination)).toBe(false);
});
