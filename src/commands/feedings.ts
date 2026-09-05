import { Command } from 'commander';
import { withGlobals, run, run1, resolveFarm } from '../shared';
import { assertEnum } from '../args';

const FEEDING_STATUSES = ['ACTIVE', 'COMPLETED'];

export const listFeedings = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const params: { skip?: number; take?: number; status?: string; since?: string } = {};
  if (opts.skip !== undefined) params.skip = Number(opts.skip);
  if (opts.take !== undefined) params.take = Number(opts.take);
  if (opts.status) params.status = assertEnum(opts.status, FEEDING_STATUSES, 'status');
  if (opts.since) params.since = opts.since;
  const result = await client.listFeedings(farmId, params);
  return { ...result, message: `Found ${result.records?.length || 0} feeding(s)` };
};

export const getFeeding = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const feeding = await client.getFeeding(farmId, opts.feeding_id);
  return { feeding, message: `Retrieved feeding ${feeding.id}` };
};

export function registerFeedings(program: Command): void {
  const feedings = program.command('feedings').description('Executed mixer loads (read-only).');

  withGlobals(
    feedings
      .command('list')
      .description('List feedings, newest first.')
      .option(
        '--status <status>',
        `Filter: ${FEEDING_STATUSES.join(', ')} (ACTIVE = in progress / resumable).`,
      )
      .option('--since <iso>', 'Only feedings fed at or after this ISO datetime.')
      .option('--skip <n>', 'Records to skip (pagination).')
      .option('--take <n>', 'Max records to return.'),
  ).action(run(listFeedings));

  withGlobals(feedings.command('get').description('Get one feeding by UUID.'))
    .argument('<feeding_id>')
    .action(run1(getFeeding, 'feeding_id'));
}
