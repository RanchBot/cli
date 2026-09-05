import { Command } from 'commander';
import { withGlobals, run, run1, resolveFarm } from '../shared';
import { readDataFlag } from '../args';
import { CliError } from '../errors';

export const listRations = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const result = await client.listRations(farmId, {
    include_inactive: opts.includeInactive === true,
  });
  return { ...result, message: `Found ${result.records?.length || 0} ration(s)` };
};

export const getRation = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  return client.getRation(farmId, opts.ration_id);
};

/**
 * Record a ration the user has already decided on. Structure only — never formulate,
 * balance, or invent amounts. Assignments land inactive pending in-app activation.
 */
export const createRation = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const data = readDataFlag(opts.data);
  if (!data) {
    throw new CliError(
      '--data is required. Provide a ration object: ' +
        '{ name, unit?, ingredients: [{ name, per_head_lbs }], assignments?: [{ group_id, feedings_per_day?, label? }] }.',
    );
  }
  if (!data.name || typeof data.name !== 'string') {
    throw new CliError('ration.name is required.');
  }
  if (!Array.isArray(data.ingredients) || data.ingredients.length === 0) {
    throw new CliError('ration.ingredients must be a non-empty array of { name, per_head_lbs }.');
  }
  for (const ingredient of data.ingredients) {
    if (
      !ingredient.name ||
      typeof ingredient.per_head_lbs !== 'number' ||
      ingredient.per_head_lbs <= 0
    ) {
      throw new CliError(
        'Each ingredient needs a name and a positive per_head_lbs (pounds per head per day).',
      );
    }
  }

  const ration = await client.createRation(farmId, {
    name: data.name,
    unit: data.unit,
    ingredients: data.ingredients,
    assignments: data.assignments,
  });
  const assignmentNote =
    (ration.assignments?.length ?? 0) > 0
      ? ' Its group assignments are inactive until the user activates them on the Rations page in the app — remind them of that step.'
      : '';
  return {
    ration,
    message: `Created ration "${ration.name}" with ID: ${ration.id}.${assignmentNote}`,
  };
};

export function registerRations(program: Command): void {
  const rations = program
    .command('rations')
    .description('Feed rations (structure only; never formulate or balance).');

  withGlobals(
    rations
      .command('list')
      .description('List feed rations.')
      .option('--include-inactive', 'Include retired rations.'),
  ).action(run(listRations));

  withGlobals(rations.command('get').description('Get one ration by UUID.'))
    .argument('<ration_id>')
    .action(run1(getRation, 'ration_id'));

  withGlobals(
    rations
      .command('create')
      .description(
        'Record a ration the user has already decided on (per-head-per-day, in load order).',
      )
      .requiredOption(
        '--data <json>',
        'Ration object. Inline JSON, @file.json, or - (stdin). ' +
          '{ name, unit?, ingredients: [{ name, per_head_lbs }], assignments? }.',
      ),
  ).action(run(createRation));
}
