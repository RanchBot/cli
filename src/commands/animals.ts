import { Command } from 'commander';
import { withGlobals, run, run1, resolveFarm } from '../shared';
import { readDataFlag } from '../args';

export const listAnimals = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const params: { skip?: number; take?: number } = {};
  if (opts.skip !== undefined) params.skip = Number(opts.skip);
  if (opts.take !== undefined) params.take = Number(opts.take);
  const result = await client.listAnimals(farmId, params);
  return {
    ...result,
    message: `Found ${result.animals?.length || 0} animal(s)`,
  };
};

export const getAnimal = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  return client.getAnimal(farmId, opts.animal_id);
};

export const createAnimal = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const metadata = readDataFlag(opts.metadata);
  const result = await client.createAnimal(farmId, { metadata });
  return { ...result, message: `Animal created successfully with ID: ${result.id}` };
};

export const updateAnimal = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const metadata = readDataFlag(opts.metadata);
  const result = await client.updateAnimal(farmId, opts.animal_id, { metadata });
  return { ...result, message: `Animal ${opts.animal_id} updated` };
};

export const deleteAnimal = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  await client.deleteAnimal(farmId, opts.animal_id);
  return { deleted: true, id: opts.animal_id, message: `Animal ${opts.animal_id} deleted` };
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
      .description('List animals on the farm.')
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
      .option('--metadata <json>', 'Metadata object. Inline JSON, @file.json, or - (stdin).'),
  ).action(run(createAnimal));

  withGlobals(
    animals
      .command('update')
      .description('Update an animal. Use --metadata for the fields to change.')
      .option('--metadata <json>', 'Metadata to update. Inline JSON, @file.json, or - (stdin).'),
  )
    .argument('<animal_id>')
    .action(run1(updateAnimal, 'animal_id'));

  withGlobals(animals.command('delete').description('Delete an animal (soft delete).'))
    .argument('<animal_id>')
    .action(run1(deleteAnimal, 'animal_id'));

  withGlobals(animals.command('find-by-eid').description('Find or create an animal by EID.'))
    .argument('<eid>')
    .action(run1(findAnimalByEid, 'eid'));
}
