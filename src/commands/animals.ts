import { Command } from 'commander';
import { withGlobals, run, run1, resolveFarm } from '../shared';
import { assertEnum, readDataFlag } from '../args';

const INVENTORY_STATUSES = ['CURRENT', 'UNKNOWN', 'SOLD', 'DECEASED'];
const inventoryStatus = (value: string | undefined, allowAll = false) =>
  value === undefined
    ? undefined
    : assertEnum(
        value,
        allowAll ? [...INVENTORY_STATUSES, 'ALL'] : INVENTORY_STATUSES,
        'inventory-status',
      );

export const listAnimals = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const params: { skip?: number; take?: number; inventory_status?: string } = {};
  if (opts.skip !== undefined) params.skip = Number(opts.skip);
  if (opts.take !== undefined) params.take = Number(opts.take);
  if (opts.inventoryStatus !== undefined)
    params.inventory_status = inventoryStatus(opts.inventoryStatus, true);
  const result = await client.listAnimals(farmId, params);
  return {
    ...result,
    message: `Found ${result.records?.length || 0} animal(s)`,
  };
};

export const getAnimal = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  return client.getAnimal(farmId, opts.animal_id);
};

export const createAnimal = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const metadata = readDataFlag(opts.metadata);
  const result = await client.createAnimal(farmId, {
    metadata,
    inventory_status: inventoryStatus(opts.inventoryStatus),
  });
  return { ...result, message: `Animal created successfully with ID: ${result.id}` };
};

export const updateAnimal = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const metadata = readDataFlag(opts.metadata);
  const result = await client.updateAnimal(farmId, opts.animal_id, {
    metadata,
    inventory_status: inventoryStatus(opts.inventoryStatus),
  });
  return { ...result, message: `Animal ${opts.animal_id} updated` };
};

export const deleteAnimal = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  await client.deleteAnimal(farmId, opts.animal_id);
  return { deleted: true, id: opts.animal_id, message: `Animal ${opts.animal_id} deleted` };
};

export const lookupAnimalByEid = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  return client.lookupAnimalByEid(farmId, opts.eid);
};

export const findAnimalByEid = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const result = await client.findOrCreateAnimalByEid(farmId, opts.eid);
  return {
    ...result,
    message: result.created
      ? `Animal created with EID ${opts.eid}`
      : `Animal found with EID ${opts.eid}`,
  };
};

export function registerAnimals(program: Command): void {
  const animals = program.command('animals').description('Animal records on the selected farm.');

  withGlobals(
    animals
      .command('list')
      .description('List current animals on the farm.')
      .option('--inventory-status <status>', 'CURRENT (default), UNKNOWN, SOLD, DECEASED, or ALL.')
      .option('--skip <n>', 'Records to skip (pagination).')
      .option('--take <n>', 'Max records to return.'),
  ).action(run(listAnimals));

  withGlobals(animals.command('get').description('Get one animal by UUID.'))
    .argument('<animal_id>')
    .action(run1(getAnimal, 'animal_id'));

  withGlobals(
    animals
      .command('create')
      .description('Create a new animal. Use --metadata for free-form attributes.')
      .option('--inventory-status <status>', 'CURRENT (default), UNKNOWN, SOLD, or DECEASED.')
      .option('--metadata <json>', 'Metadata object. Inline JSON, @file.json, or - (stdin).'),
  ).action(run(createAnimal));

  withGlobals(
    animals
      .command('update')
      .description('Update an animal. Use --metadata for the fields to change.')
      .option(
        '--inventory-status <status>',
        'CURRENT, UNKNOWN, SOLD, or DECEASED; preserves history.',
      )
      .option('--metadata <json>', 'Metadata to update. Inline JSON, @file.json, or - (stdin).'),
  )
    .argument('<animal_id>')
    .action(run1(updateAnimal, 'animal_id'));

  withGlobals(animals.command('delete').description('Delete an animal (soft delete).'))
    .argument('<animal_id>')
    .action(run1(deleteAnimal, 'animal_id'));

  withGlobals(
    animals
      .command('lookup-by-eid')
      .description(
        'Read-only exact EID lookup. Never creates animals; missing or ambiguous matches fail.',
      ),
  )
    .argument('<eid>')
    .action(run1(lookupAnimalByEid, 'eid'));

  withGlobals(
    animals
      .command('find-or-create-by-eid')
      .description(
        'Find or create an animal by EID. Creates inventory when no match exists; requires Editor access.',
      ),
  )
    .argument('<eid>')
    .action(run1(findAnimalByEid, 'eid'));

  withGlobals(
    animals
      .command('find-by-eid')
      .description(
        'DEPRECATED: creates inventory when no EID matches. Use lookup-by-eid for reads or find-or-create-by-eid for intentional creation.',
      ),
  )
    .argument('<eid>')
    .action(run1(findAnimalByEid, 'eid'));
}
