import { Command } from 'commander';
import { setDefaultFarmId } from '../config';
import { withGlobals, run, run1 } from '../shared';
import { printResult } from '../output';

export const listFarms = async (client: any) => {
  const result = await client.getFarms();
  const farms = result.farms || [];
  return {
    farms,
    total: result.total || farms.length,
    message: `Found ${farms.length} farm(s)`,
  };
};

export const getFarm = async (client: any, _defaultFarmId: string, opts: any) => {
  return client.getFarm(opts.farm_id);
};

export function registerFarms(program: Command): void {
  const farms = program.command('farms').description('Farm selection and lookup.');

  withGlobals(farms.command('list').description('List all farms you can access.')).action(
    run(listFarms),
  );

  withGlobals(farms.command('get').description('Get details about a farm.'))
    .argument('<farm_id>')
    .action(run1(getFarm, 'farm_id'));

  // `use` is a local config write — no auth, no API call.
  withGlobals(farms.command('use').description('Set the default farm for future commands.'))
    .argument('<farm_id>')
    .action((farmId: string, opts: any) => {
      setDefaultFarmId(farmId);
      printResult({ default_farm_id: farmId, message: `Default farm set to ${farmId}` }, opts);
    });
}
