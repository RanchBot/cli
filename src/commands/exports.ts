import { Command } from 'commander';
import { resolveFarm, run, run1, withGlobals } from '../shared';

export const registerExports = (program: Command) => {
  const exports = program
    .command('exports')
    .description(
      'Generate and download a private farm archive (available without a subscription).',
    );
  withGlobals(exports.command('create')).action(
    run((client, farm, opts) => client.requestFarmExport(resolveFarm(opts, farm))),
  );
  withGlobals(exports.command('list')).action(
    run((client, farm, opts) => client.listFarmExports(resolveFarm(opts, farm))),
  );
  withGlobals(exports.command('status <id>')).action(
    run1((client, farm, opts) => client.farmExportStatus(resolveFarm(opts, farm), opts.id), 'id'),
  );
  withGlobals(exports.command('cancel <id>')).action(
    run1((client, farm, opts) => client.cancelFarmExport(resolveFarm(opts, farm), opts.id), 'id'),
  );
  withGlobals(
    exports
      .command('download <id>')
      .requiredOption('--output <path>', 'New archive file path; never overwrites.'),
  ).action(
    run1(
      (client, farm, opts) =>
        client.downloadFarmExport(resolveFarm(opts, farm), opts.id, opts.output),
      'id',
    ),
  );
};
