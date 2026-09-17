import { createInterface } from 'readline/promises';
import { Command } from 'commander';
import { CliError } from '../errors';
import { getAuthenticatedClient } from '../session';
import { printResult } from '../output';
import { GlobalOptions, toRuntimeOverrides, withGlobals } from '../shared';

export const requireTerminal = () => {
  if (!process.stdin.isTTY || !process.stderr.isTTY)
    throw new CliError(
      'Account deletion requires an interactive terminal. Use --dry-run to preview.',
    );
};
export const confirmAccountDeletion = async (
  phone: string,
  ask?: (prompt: string) => Promise<string>,
): Promise<boolean> => {
  requireTerminal();
  const reader = ask
    ? undefined
    : createInterface({ input: process.stdin, output: process.stderr });
  const question = ask ?? ((prompt: string) => reader!.question(prompt));
  try {
    if ((await question('Type the full target phone number: ')) !== phone) return false;
    return (
      (
        await question(
          'Permanently delete this account and immediately cancel its billing? [yes/no] ',
        )
      )
        .trim()
        .toLowerCase() === 'yes'
    );
  } finally {
    reader?.close();
  }
};
export const registerAccounts = (program: Command) => {
  const accounts = program.command('accounts').description('Admin account deletion and recovery.');
  withGlobals(
    accounts
      .command('delete')
      .requiredOption('--phone <phone>', 'Full E.164 phone number.')
      .option('--dry-run', 'Preview only; supports JSON output.'),
  ).action(async (opts: GlobalOptions & { phone: string; dryRun?: boolean }) => {
    if (!opts.dryRun) requireTerminal();
    const { client, runtime } = await getAuthenticatedClient(toRuntimeOverrides(opts));
    const preview = await client.previewAccountDeletion(opts.phone);
    if (opts.dryRun) {
      printResult(preview, opts);
      return;
    }
    process.stderr.write(`API: ${runtime.apiUrl}\n${JSON.stringify(preview, null, 2)}\n`);
    if (preview.blockers.length) throw new CliError('Resolve the listed blockers before deletion.');
    if (!(await confirmAccountDeletion(preview.target.phone))) {
      printResult({ cancelled: true }, opts);
      return;
    }
    printResult(
      await client.executeAccountDeletion(preview.confirmation_token, preview.target.phone),
      opts,
    );
  });
  withGlobals(accounts.command('deletion-status <id>')).action(
    async (id: string, opts: GlobalOptions) => {
      const { client } = await getAuthenticatedClient(toRuntimeOverrides(opts));
      printResult(await client.accountDeletionStatus(id), opts);
    },
  );
  withGlobals(accounts.command('resume-deletion <id>')).action(
    async (id: string, opts: GlobalOptions) => {
      requireTerminal();
      const { client, runtime } = await getAuthenticatedClient(toRuntimeOverrides(opts));
      const status = await client.accountDeletionStatus(id);
      process.stderr.write(`API: ${runtime.apiUrl}\n${JSON.stringify(status, null, 2)}\n`);
      if (status.status !== 'FAILED' || !status.target?.phone)
        throw new CliError('Only a failed deletion job can be resumed.');
      if (!(await confirmAccountDeletion(status.target.phone))) {
        printResult({ cancelled: true }, opts);
        return;
      }
      printResult(await client.resumeAccountDeletion(id, status.target.phone), opts);
    },
  );
};
