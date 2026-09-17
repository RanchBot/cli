import { Command } from 'commander';
import { registerExports } from '../../../commands/exports';
import { getAuthenticatedClient } from '../../../session';
jest.mock('../../../session');
jest.mock('../../../output', () => ({ printResult: jest.fn() }));
const client = {
  requestFarmExport: jest.fn(),
  listFarmExports: jest.fn(),
  farmExportStatus: jest.fn(),
  cancelFarmExport: jest.fn(),
  downloadFarmExport: jest.fn(),
};
beforeEach(() => {
  (getAuthenticatedClient as jest.Mock).mockResolvedValue({ client, runtime: {} });
});
test.each([
  { args: ['create'], method: 'requestFarmExport', expected: ['farm'] },
  { args: ['list'], method: 'listFarmExports', expected: ['farm'] },
  { args: ['status', 'job'], method: 'farmExportStatus', expected: ['farm', 'job'] },
  { args: ['cancel', 'job'], method: 'cancelFarmExport', expected: ['farm', 'job'] },
  {
    args: ['download', 'job', '--output', 'archive.zip'],
    method: 'downloadFarmExport',
    expected: ['farm', 'job', 'archive.zip'],
  },
])('routes exports $args', async ({ args, method, expected }) => {
  const program = new Command();
  registerExports(program);
  await program.parseAsync(['exports', ...args, '--farm', 'farm', '--json'], { from: 'user' });
  expect(client[method as keyof typeof client]).toHaveBeenCalledWith(...expected);
});
