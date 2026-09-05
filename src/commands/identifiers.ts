import { Command } from 'commander';
import { withGlobals, run1, run2, resolveFarm } from '../shared';
import { assertEnum } from '../args';

const IDENTIFIER_TYPES = ['BRAND', 'EID', 'MANAGEMENT_TAG', 'NAME', 'TATTOO'];

export const listIdentifiers = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const result = await client.listAnimalIdentifiers(farmId, opts.animal_id);
  return {
    ...result,
    message: `Found ${result.identifiers?.length || 0} identifier(s) for animal ${opts.animal_id}`,
  };
};

export const addIdentifier = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const type = assertEnum(opts.type, IDENTIFIER_TYPES, 'type');
  const result = await client.addAnimalIdentifier(farmId, opts.animal_id, {
    type,
    value: opts.value,
    is_primary: opts.primary === true,
  });
  return { ...result, message: `Identifier added to animal ${opts.animal_id}` };
};

export const removeIdentifier = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  await client.removeAnimalIdentifier(farmId, opts.animal_id, opts.identifier_id);
  return {
    deleted: true,
    id: opts.identifier_id,
    message: `Identifier ${opts.identifier_id} removed from animal ${opts.animal_id}`,
  };
};

export function registerIdentifiers(program: Command): void {
  const identifiers = program
    .command('identifiers')
    .description('Animal identifiers (tags, names, EID, brand, tattoo).');

  withGlobals(identifiers.command('list').description('List identifiers for an animal.'))
    .argument('<animal_id>')
    .action(run1(listIdentifiers, 'animal_id'));

  withGlobals(
    identifiers
      .command('add')
      .description('Add an identifier to an animal.')
      .requiredOption('--type <type>', `One of: ${IDENTIFIER_TYPES.join(', ')}`)
      .requiredOption('--value <value>', 'The identifier value, e.g. "#301" or "Betsy".')
      .option('--primary', "Mark as the animal's primary identifier."),
  )
    .argument('<animal_id>')
    .action(run1(addIdentifier, 'animal_id'));

  withGlobals(identifiers.command('remove').description('Remove an identifier from an animal.'))
    .argument('<animal_id>')
    .argument('<identifier_id>')
    .action(run2(removeIdentifier, 'animal_id', 'identifier_id'));
}
