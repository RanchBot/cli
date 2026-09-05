import { Command } from 'commander';
import { withGlobals, run, run1, resolveFarm } from '../shared';
import { assertEnum, readDataFlag } from '../args';
import { CliError } from '../errors';

const RECORD_TYPES = ['FEED', 'GENETIC', 'HEALTH', 'MOVEMENT', 'OTHER'];

export const listRecords = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const params: { skip?: number; take?: number; type?: string } = {};
  if (opts.skip !== undefined) params.skip = Number(opts.skip);
  if (opts.take !== undefined) params.take = Number(opts.take);
  if (opts.type) params.type = assertEnum(opts.type, RECORD_TYPES, 'type');
  const result = await client.listRecords(farmId, params);
  return {
    ...result,
    message: `Found ${result.records?.length || 0} record(s)`,
  };
};

export const getRecord = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  return client.getRecord(farmId, opts.record_id);
};

/**
 * Build a create-record payload from --data (base) and scalar flags (overrides). A
 * record must attach to at least one animal or group, or it won't appear in any history.
 */
function buildCreatePayload(opts: any) {
  const data = readDataFlag(opts.data) || {};
  if (opts.name !== undefined) data.name = opts.name;
  if (opts.type !== undefined) data.type = assertEnum(opts.type, RECORD_TYPES, 'type');
  if (opts.appliedAt !== undefined) data.applied_at = opts.appliedAt;
  if (opts.description !== undefined) data.description = opts.description;
  if (opts.animal?.length) data.animal_ids = opts.animal;
  if (opts.group?.length) data.group_ids = opts.group;
  // Always send both arrays (defaulting to []) so the API's required animal_ids/group_ids
  // schema is satisfied for group-only or animal-only records (RAN-154). A flag overrides
  // --data; when a flag is absent, an existing --data value is preserved.
  if (data.animal_ids === undefined) data.animal_ids = [];
  if (data.group_ids === undefined) data.group_ids = [];

  if (!data.name) {
    throw new CliError('--name (or name in --data) is required.');
  }
  if (!data.type) {
    throw new CliError(`--type is required (one of: ${RECORD_TYPES.join(', ')}).`);
  }
  if (!data.applied_at) {
    throw new CliError('--applied-at is required (ISO date/time, e.g. 2026-06-19T09:00:00Z).');
  }
  if (!data.animal_ids?.length && !data.group_ids?.length) {
    throw new CliError(
      'A record must attach to at least one animal (--animal <id>, repeatable) or group (--group <id>, repeatable).',
    );
  }
  return data;
}

export const createRecord = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const data = buildCreatePayload(opts);
  const result = await client.createRecord(farmId, data);
  return { ...result, message: `Record created successfully with ID: ${result.id}` };
};

export const updateRecord = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const data: Record<string, any> = readDataFlag(opts.data) || {};
  if (opts.name !== undefined) data.name = opts.name;
  if (opts.type !== undefined) data.type = assertEnum(opts.type, RECORD_TYPES, 'type');
  if (opts.appliedAt !== undefined) data.applied_at = opts.appliedAt;
  if (opts.description !== undefined) data.description = opts.description;
  if (Object.keys(data).length === 0) {
    throw new CliError(
      'Nothing to update. Provide --name, --type, --applied-at, --description, or --data.',
    );
  }
  const result = await client.updateRecord(farmId, opts.record_id, data);
  return { ...result, message: `Record ${opts.record_id} updated` };
};

export const deleteRecord = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  await client.deleteRecord(farmId, opts.record_id);
  return { deleted: true, id: opts.record_id, message: `Record ${opts.record_id} deleted` };
};

export function registerRecords(program: Command): void {
  const records = program
    .command('records')
    .description('Records (events applied to animals or groups).');

  withGlobals(
    records
      .command('list')
      .description('List records on the farm.')
      .option('--type <type>', `Filter by record type: ${RECORD_TYPES.join(', ')}.`)
      .option('--skip <n>', 'Records to skip (pagination).')
      .option('--take <n>', 'Max records to return.'),
  ).action(run(listRecords));

  withGlobals(records.command('get').description('Get one record by UUID.'))
    .argument('<record_id>')
    .action(run1(getRecord, 'record_id'));

  withGlobals(
    records
      .command('create')
      .description(
        'Create a record and attach it to animals and/or groups. At least one --animal or --group is required.',
      )
      .requiredOption('--name <name>', 'Short name for the event.')
      .requiredOption('--type <type>', `Kind of event: ${RECORD_TYPES.join(', ')}.`)
      .requiredOption('--applied-at <iso>', 'When the event occurred (ISO date/time).')
      .option(
        '--animal <id>',
        'Animal UUID (repeatable).',
        (v: string, acc: string[]) => acc.concat(v),
        [],
      )
      .option(
        '--group <id>',
        'Group UUID (repeatable).',
        (v: string, acc: string[]) => acc.concat(v),
        [],
      )
      .option('--description <desc>', 'Optional description.')
      .option('--data <json>', 'Full or partial payload. Inline JSON, @file.json, or - (stdin).'),
  ).action(run(createRecord));

  withGlobals(
    records
      .command('update')
      .description('Update a record. Pass any combination of fields to change.')
      .option('--name <name>', 'Short name for the event.')
      .option('--type <type>', `Kind of event: ${RECORD_TYPES.join(', ')}.`)
      .option('--applied-at <iso>', 'When the event occurred (ISO date/time).')
      .option('--description <desc>', 'Description.')
      .option('--data <json>', 'Full or partial payload. Inline JSON, @file.json, or - (stdin).'),
  )
    .argument('<record_id>')
    .action(run1(updateRecord, 'record_id'));

  withGlobals(records.command('delete').description('Delete a record (soft delete).'))
    .argument('<record_id>')
    .action(run1(deleteRecord, 'record_id'));
}
