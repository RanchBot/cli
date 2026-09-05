import { Command } from 'commander';
import { withGlobals, run, run1, resolveFarm } from '../shared';

export const listGroups = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const result = await client.listGroups(farmId);
  return {
    ...result,
    message: `Found ${result.records?.length || 0} group(s)`,
  };
};

export const getGroup = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  return client.getGroup(farmId, opts.group_id);
};

export const createGroup = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const data: { name: string; description?: string } = { name: opts.name };
  if (opts.description) data.description = opts.description;
  const result = await client.createGroup(farmId, data);
  return { ...result, message: `Group created successfully with ID: ${result.id}` };
};

export const updateGroup = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const data: { name?: string; description?: string } = {};
  if (opts.name !== undefined) data.name = opts.name;
  if (opts.description !== undefined) data.description = opts.description;
  const result = await client.updateGroup(farmId, opts.group_id, data);
  return { ...result, message: `Group ${opts.group_id} updated` };
};

export const deleteGroup = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  await client.deleteGroup(farmId, opts.group_id);
  return { deleted: true, id: opts.group_id, message: `Group ${opts.group_id} deleted` };
};

export function registerGroups(program: Command): void {
  const groups = program.command('groups').description('Animal groups on the selected farm.');

  withGlobals(groups.command('list').description('List groups on the farm.')).action(
    run(listGroups),
  );

  withGlobals(groups.command('get').description('Get one group by UUID, including its members.'))
    .argument('<group_id>')
    .action(run1(getGroup, 'group_id'));

  withGlobals(
    groups
      .command('create')
      .description('Create a new group.')
      .requiredOption('--name <name>', 'Group name.')
      .option('--description <desc>', 'Optional description.'),
  ).action(run(createGroup));

  withGlobals(
    groups
      .command('update')
      .description('Update a group.')
      .option('--name <name>', 'New name.')
      .option('--description <desc>', 'New description.'),
  )
    .argument('<group_id>')
    .action(run1(updateGroup, 'group_id'));

  withGlobals(groups.command('delete').description('Delete a group (soft delete).'))
    .argument('<group_id>')
    .action(run1(deleteGroup, 'group_id'));
}
