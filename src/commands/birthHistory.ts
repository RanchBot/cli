import { Command } from 'commander';
import { z } from 'zod';
import { readDataFlag } from '../args';
import { RanchBotApiClient } from '../client';
import { resolveFarm, run, withGlobals } from '../shared';

export const getBirthHistorySettings = async (
  client: RanchBotApiClient,
  farmId: string,
  opts: any,
) => client.getBirthHistorySettings(resolveFarm(opts, farmId));
export const setBirthHistorySettings = async (
  client: RanchBotApiClient,
  farmId: string,
  opts: any,
) =>
  client.setBirthHistorySettings(
    resolveFarm(opts, farmId),
    z.record(z.unknown()).parse(readDataFlag(opts.data)),
  );
export const getBirthHistoryEvidence = async (
  client: RanchBotApiClient,
  farmId: string,
  opts: any,
) =>
  client.getBirthHistoryEvidence(resolveFarm(opts, farmId), {
    dam_id: z.string().uuid().parse(opts.dam),
    birth_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .parse(opts.date),
  });

export function registerBirthHistory(program: Command): void {
  const history = program
    .command('birth-history')
    .description('Producer settings and dated birth-history evidence.');
  withGlobals(
    history.command('settings').description('Read configured species intervals and birth windows.'),
  ).action(run(getBirthHistorySettings));
  withGlobals(
    history
      .command('configure')
      .description('Replace producer-approved settings; no gestation or age defaults are assumed.')
      .requiredOption('--data <json>', 'Versioned settings JSON, @file.json, or - for stdin.'),
  ).action(run(setBirthHistorySettings));
  withGlobals(
    history
      .command('evidence')
      .description('Review recorded exposure and movement history without selecting a sire.')
      .requiredOption('--dam <id>', 'Dam UUID.')
      .requiredOption('--date <date>', 'Birth date YYYY-MM-DD.'),
  ).action(run(getBirthHistoryEvidence));
}
