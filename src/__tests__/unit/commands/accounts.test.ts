import { createInterface } from 'readline/promises';
import { printResult } from '../../../output';
import { Command } from 'commander';
import { confirmAccountDeletion, registerAccounts } from '../../../commands/accounts';
import { getAuthenticatedClient } from '../../../session';
jest.mock('../../../session');
jest.mock('readline/promises');
jest.mock('../../../output', () => ({ printResult: jest.fn() }));
const phone = '+15550001851';
const inputTTY = process.stdin.isTTY;
const outputTTY = process.stderr.isTTY;
const client = {
  previewAccountDeletion: jest.fn(),
  executeAccountDeletion: jest.fn(),
  accountDeletionStatus: jest.fn(),
  resumeAccountDeletion: jest.fn(),
};
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
  Object.defineProperty(process.stderr, 'isTTY', { value: true, configurable: true });
  (getAuthenticatedClient as jest.Mock).mockResolvedValue({
    client,
    runtime: { apiUrl: 'http://localhost:7001' },
  });
});
afterEach(() => {
  Object.defineProperty(process.stdin, 'isTTY', { value: inputTTY, configurable: true });
  Object.defineProperty(process.stderr, 'isTTY', { value: outputTTY, configurable: true });
});
test('requires exact full phone and final yes', async () => {
  expect(
    await confirmAccountDeletion(
      phone,
      jest.fn().mockResolvedValueOnce(phone).mockResolvedValueOnce('yes'),
    ),
  ).toBe(true);
  expect(
    await confirmAccountDeletion(
      phone,
      jest.fn().mockResolvedValueOnce(phone).mockResolvedValueOnce('no'),
    ),
  ).toBe(false);
  const wrong = jest.fn().mockResolvedValue('1851');
  expect(await confirmAccountDeletion(phone, wrong)).toBe(false);
  expect(wrong).toHaveBeenCalledTimes(1);
});
test.each(['delete', 'resume-deletion'])(
  '%s refuses noninteractive execution before contacting the API',
  async (command) => {
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    const program = new Command();
    registerAccounts(program);
    const args =
      command === 'delete'
        ? ['accounts', 'delete', '--phone', phone]
        : ['accounts', 'resume-deletion', 'job'];
    await expect(program.parseAsync(args, { from: 'user' })).rejects.toThrow('interactive');
    expect(getAuthenticatedClient).not.toHaveBeenCalled();
  },
);
test('dry-run supports JSON without an interactive terminal or execution', async () => {
  Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
  client.previewAccountDeletion.mockResolvedValue({ target: { phone }, blockers: [] });
  const program = new Command();
  registerAccounts(program);
  await program.parseAsync(['accounts', 'delete', '--phone', phone, '--dry-run', '--json'], {
    from: 'user',
  });
  expect(client.previewAccountDeletion).toHaveBeenCalledWith(phone);
  expect(client.executeAccountDeletion).not.toHaveBeenCalled();
});
test.each(['--yes', '--force'])('does not expose a %s bypass', async (flag) => {
  const program = new Command().exitOverride().configureOutput({ writeErr: () => undefined });
  registerAccounts(program);
  await expect(
    program.parseAsync(['accounts', 'delete', '--phone', phone, flag], { from: 'user' }),
  ).rejects.toThrow('unknown option');
  expect(getAuthenticatedClient).not.toHaveBeenCalled();
});

test('cancels the command without executing when confirmation is declined', async () => {
  jest.spyOn(process.stderr, 'write').mockReturnValue(true);
  client.previewAccountDeletion.mockResolvedValue({ target: { phone }, blockers: [] });
  const close = jest.fn();
  (createInterface as jest.Mock).mockReturnValue({
    question: jest.fn().mockResolvedValueOnce(phone).mockResolvedValueOnce('no'),
    close,
  });
  const program = new Command();
  registerAccounts(program);
  await program.parseAsync(['accounts', 'delete', '--phone', phone], { from: 'user' });
  expect(client.executeAccountDeletion).not.toHaveBeenCalled();
  expect(printResult).toHaveBeenCalledWith({ cancelled: true }, expect.anything());
  expect(close).toHaveBeenCalled();
});
test('reads status without requiring a terminal', async () => {
  Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
  client.accountDeletionStatus.mockResolvedValue({ status: 'FAILED' });
  const program = new Command();
  registerAccounts(program);
  await program.parseAsync(['accounts', 'deletion-status', 'job', '--json'], { from: 'user' });
  expect(client.accountDeletionStatus).toHaveBeenCalledWith('job');
});
test.each(['FAILED', 'RUNNING'])('resumes only a confirmed failed job (%s)', async (status) => {
  jest.spyOn(process.stderr, 'write').mockReturnValue(true);
  client.accountDeletionStatus.mockResolvedValue({ status, target: { phone } });
  (createInterface as jest.Mock).mockReturnValue({
    question: jest.fn().mockResolvedValueOnce(phone).mockResolvedValueOnce('yes'),
    close: jest.fn(),
  });
  const program = new Command();
  registerAccounts(program);
  const result = program.parseAsync(['accounts', 'resume-deletion', 'job'], { from: 'user' });
  if (status === 'FAILED') {
    await result;
    expect(client.resumeAccountDeletion).toHaveBeenCalledWith('job', phone);
  } else {
    await expect(result).rejects.toThrow('Only a failed');
    expect(client.resumeAccountDeletion).not.toHaveBeenCalled();
  }
});
test('propagates ordinary-session rejection without execution', async () => {
  const forbidden = Object.assign(new Error('Admin scope required'), { status: 403 });
  client.previewAccountDeletion.mockRejectedValue(forbidden);
  const program = new Command();
  registerAccounts(program);
  await expect(
    program.parseAsync(['accounts', 'delete', '--phone', phone, '--dry-run'], { from: 'user' }),
  ).rejects.toBe(forbidden);
  expect(client.executeAccountDeletion).not.toHaveBeenCalled();
});
