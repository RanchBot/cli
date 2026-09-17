import { Command } from 'commander';
import { z } from 'zod';
import { readDataFlag } from '../args';
import { RanchBotApiClient } from '../client';
import { resolveFarm, run, run1, withGlobals } from '../shared';

const pageSchema = z.object({
  skip: z.coerce.number().int().min(0).optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
});
const requestSchema = z.object({
  request_id: z.string().uuid(),
  bundle: z.record(z.unknown()),
});
const confirmationSchema = requestSchema.extend({
  confirmation_hash: z.string().regex(/^[a-f0-9]{64}$/),
});
const taskStatus = z.enum(['TODO', 'DONE', 'CANCELLED']);
const protocolSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    version: z.string().trim().min(1).max(80),
    steps: z.array(z.string().trim().min(1).max(1000)).min(1).max(40),
  })
  .strict();

export const previewBirthEvent = async (
  client: RanchBotApiClient,
  defaultFarmId: string,
  opts: any,
) =>
  client.previewBirthEvent(
    resolveFarm(opts, defaultFarmId),
    requestSchema.parse(readDataFlag(opts.data)),
  );

export const confirmBirthEvent = async (
  client: RanchBotApiClient,
  defaultFarmId: string,
  opts: any,
) => {
  // Project the reviewed response, including its exact hash, without interpreting the bundle.
  const input = confirmationSchema.parse(readDataFlag(opts.data));
  return client.confirmBirthEvent(resolveFarm(opts, defaultFarmId), input);
};

export const listBirthEvents = async (
  client: RanchBotApiClient,
  defaultFarmId: string,
  opts: any,
) =>
  client.listBirthEvents(resolveFarm(opts, defaultFarmId), {
    ...pageSchema.parse(opts),
    animal_id: z.string().uuid().optional().parse(opts.animal),
  });

export const getBirthEvent = async (client: RanchBotApiClient, defaultFarmId: string, opts: any) =>
  client.getBirthEvent(resolveFarm(opts, defaultFarmId), z.string().uuid().parse(opts.event_id));

export const getBirthSourceEvidence = async (
  client: RanchBotApiClient,
  defaultFarmId: string,
  opts: any,
) =>
  client.getBirthSourceEvidence(
    resolveFarm(opts, defaultFarmId),
    z.string().uuid().parse(opts.source_sms_id),
  );

export const listFarmTasks = async (client: RanchBotApiClient, defaultFarmId: string, opts: any) =>
  client.listFarmTasks(resolveFarm(opts, defaultFarmId), {
    ...pageSchema.parse(opts),
    status: taskStatus.optional().parse(opts.status),
  });

export const updateFarmTask = async (
  client: RanchBotApiClient,
  defaultFarmId: string,
  opts: any,
) => {
  const data = z
    .object({
      status: taskStatus,
      due_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
    })
    .strict()
    .parse(readDataFlag(opts.data));
  return client.updateFarmTask(
    resolveFarm(opts, defaultFarmId),
    z.string().uuid().parse(opts.task_id),
    data,
  );
};

export const listProtocolVersions = async (
  client: RanchBotApiClient,
  defaultFarmId: string,
  opts: any,
) => client.listProtocolVersions(resolveFarm(opts, defaultFarmId), pageSchema.parse(opts));

export const createProtocolVersion = async (
  client: RanchBotApiClient,
  defaultFarmId: string,
  opts: any,
) =>
  client.createProtocolVersion(
    resolveFarm(opts, defaultFarmId),
    protocolSchema.parse(readDataFlag(opts.data)),
  );

const pagination = (command: Command) =>
  command
    .option('--skip <n>', 'Records to skip.')
    .option('--take <n>', 'Maximum records to return (1–200; default 50).');
const data = (command: Command) =>
  command.requiredOption('--data <json>', 'JSON object, @file.json, or - for stdin.');

export function registerBirthEvents(program: Command): void {
  const births = program
    .command('birth-events')
    .description('Review and confirm one atomic birth event.');
  withGlobals(
    data(
      births
        .command('preview')
        .description(
          'Preview {request_id, bundle}; review every field and evidence before confirming. No farm data is saved.',
        ),
    ),
  ).action(run(previewBirthEvent));
  withGlobals(
    data(
      births
        .command('confirm')
        .description(
          'Save the producer-approved preview using its exact request_id, bundle, and confirmation_hash.',
        ),
    ),
  ).action(run(confirmBirthEvent));
  withGlobals(
    pagination(
      births
        .command('list')
        .description('List saved birth events.')
        .option('--animal <id>', 'Filter by dam or offspring UUID.'),
    ),
  ).action(run(listBirthEvents));
  withGlobals(births.command('get').description('Retrieve a saved event and accessible evidence.'))
    .argument('<event_id>')
    .action(run1(getBirthEvent, 'event_id'));

  const sources = program.command('birth-sources').description('Your retained SMS birth evidence.');
  withGlobals(
    sources
      .command('get')
      .description('Read ordered media status and current-farm identity candidates.'),
  )
    .argument('<sourceSmsId>')
    .action(run1(getBirthSourceEvidence, 'source_sms_id'));

  const tasks = program
    .command('farm-tasks')
    .description('Follow-up work, including undated todos.');
  withGlobals(
    pagination(tasks.command('list').option('--status <status>', 'TODO, DONE, or CANCELLED.')),
  ).action(run(listFarmTasks));
  withGlobals(
    data(tasks.command('update').description('Set {status, due_date?}; null clears the due date.')),
  )
    .argument('<task_id>')
    .action(run1(updateFarmTask, 'task_id'));

  const protocols = program.command('protocols').description('Immutable farm protocol versions.');
  withGlobals(pagination(protocols.command('list'))).action(run(listProtocolVersions));
  withGlobals(
    data(
      protocols
        .command('create')
        .description('Create a producer-approved {name, version, steps} definition.'),
    ),
  ).action(run(createProtocolVersion));
}
