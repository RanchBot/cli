import { Command } from 'commander';
import { withGlobals, run, run1, resolveFarm } from '../shared';
import { assertEnum, readJsonFlag } from '../args';
import { CliError } from '../errors';

const CHUTE_STATUSES = ['PROPOSED', 'ACTIVE', 'COMPLETED'];

/** Resolve a group by name (case-insensitive), creating it when missing. */
async function resolveGroupIdByName(
  client: any,
  farmId: string,
  groupName: string | undefined,
): Promise<string | undefined> {
  if (!groupName?.trim()) return undefined;
  const name = groupName.trim();
  const groups = await client.listGroups(farmId);
  const existing = (groups.records ?? []).find(
    (group: { id: string; name: string }) => group.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) return existing.id;
  const created = await client.createGroup(farmId, { name });
  return created.id;
}

/** Accept --data as either a widgets array or a config object containing a widgets array. */
function parseWidgetData(opts: any): { widgets: unknown[] | undefined; cfg: Record<string, any> } {
  if (opts.data === undefined) return { widgets: undefined, cfg: {} };
  const parsed = readJsonFlag(opts.data);
  if (Array.isArray(parsed)) return { widgets: parsed, cfg: {} };
  if (parsed && typeof parsed === 'object') {
    return { widgets: parsed.widgets, cfg: parsed };
  }
  throw new CliError(
    '--data must be a widgets array or a config object containing a widgets array.',
  );
}

export const listChuteSessions = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const params: { skip?: number; take?: number; status?: string } = {};
  if (opts.skip !== undefined) params.skip = Number(opts.skip);
  if (opts.take !== undefined) params.take = Number(opts.take);
  if (opts.status) params.status = assertEnum(opts.status, CHUTE_STATUSES, 'status');
  const result = await client.listChuteSessions(farmId, params);
  return { ...result, message: `Found ${result.records?.length || 0} chute session(s)` };
};

export const getChuteSession = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  return client.getChuteSession(farmId, opts.session_id);
};

export const createChuteSession = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const { widgets, cfg } = parseWidgetData(opts);
  if (!Array.isArray(widgets) || widgets.length === 0) {
    throw new CliError(
      '--data is required and must be a non-empty widgets array (or a config object with one).',
    );
  }
  const name = opts.name ?? cfg.name;
  const recordType = opts.recordType ?? cfg.record_type;
  const newAnimalFields =
    opts.newAnimalFields !== undefined
      ? String(opts.newAnimalFields)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : cfg.new_animal_fields;
  const groupName = opts.groupName ?? cfg.group_name;
  const groupId = await resolveGroupIdByName(client, farmId, groupName);

  const result = await client.createChuteSession(farmId, {
    name,
    config: { widgets, new_animal_fields: newAnimalFields, record_type: recordType },
    group_id: groupId,
  });
  return {
    ...result,
    message:
      `Proposed chute session "${result.name}" (${widgets.length} widget(s)). ` +
      'The user reviews and starts it from Chute Mode in the app.',
  };
};

export const updateChuteSession = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const { widgets, cfg } = parseWidgetData(opts);
  const name = opts.name ?? cfg.name;
  const groupName = opts.groupName ?? cfg.group_name;
  const recordType = cfg.record_type;
  const groupId = await resolveGroupIdByName(client, farmId, groupName);

  const config = widgets ? { widgets, record_type: recordType } : undefined;
  const result = await client.updateChuteSession(farmId, opts.session_id, {
    name,
    config,
    group_id: groupId,
  });
  return { ...result, message: `Updated proposed chute session "${result.name}".` };
};

export function registerChute(program: Command): void {
  const chute = program
    .command('chute')
    .description('Chute-mode work sessions (propose only; the operator starts them in-app).');

  withGlobals(
    chute
      .command('list')
      .description('List chute sessions.')
      .option('--status <status>', `Filter: ${CHUTE_STATUSES.join(', ')}.`)
      .option('--skip <n>', 'Records to skip (pagination).')
      .option('--take <n>', 'Max records to return.'),
  ).action(run(listChuteSessions));

  withGlobals(chute.command('get').description('Get one chute session by UUID.'))
    .argument('<session_id>')
    .action(run1(getChuteSession, 'session_id'));

  withGlobals(
    chute
      .command('create')
      .description(
        'Propose a chute session from a widget grid. --data is the widgets array ' +
          '(inline JSON, @file.json, or stdin). Proposing never records data.',
      )
      .option('--data <json>', 'Widget grid (array) or full config object.')
      .option('--name <name>', 'Session name.')
      .option('--record-type <type>', 'RecordType for per-animal pass records (e.g. HEALTH).')
      .option('--group-name <name>', 'Group processed animals join (created if missing).')
      .option(
        '--new-animal-fields <csv>',
        'Comma-separated identity fields on the new-animal form (tag,name,sex,color,dob).',
      ),
  ).action(run(createChuteSession));

  withGlobals(
    chute
      .command('update')
      .description('Revise a PROPOSED chute session before the operator starts it.')
      .option('--data <json>', 'Replacement widget grid (array) or full config object.')
      .option('--name <name>', 'New session name.')
      .option('--group-name <name>', 'Group processed animals join (created if missing).'),
  )
    .argument('<session_id>')
    .action(run1(updateChuteSession, 'session_id'));
}
