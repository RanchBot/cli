import fs from 'fs';
import os from 'os';
import path from 'path';
import { Command } from 'commander';
import { RanchBotApiClient } from '../../../client';
import {
  confirmBirthEvent,
  createProtocolVersion,
  getBirthSourceEvidence,
  listBirthEvents,
  listFarmTasks,
  previewBirthEvent,
  registerBirthEvents,
  updateFarmTask,
} from '../../../commands/birthEvents';

const farmId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const animalId = '33333333-3333-4333-8333-333333333333';
const bundle = {
  dam_id: animalId,
  birth_date: '2026-09-07',
  time_precision: 'morning',
  offspring: [{ review_label: 'Lamb 1', sex: 'male', birth_weight: { value: 3.2, unit: 'kg' } }],
  unresolved: ['Protocol definition not available'],
};
const preview = {
  request_id: requestId,
  bundle,
  review: { dam: { id: animalId } },
  confirmation_hash: 'a'.repeat(64),
};
const mockClient = () =>
  ({
    previewBirthEvent: jest.fn().mockResolvedValue(preview),
    confirmBirthEvent: jest.fn().mockResolvedValue({ id: requestId }),
    listBirthEvents: jest.fn(),
    listFarmTasks: jest.fn(),
    updateFarmTask: jest.fn(),
    createProtocolVersion: jest.fn(),
    getBirthSourceEvidence: jest.fn(),
  }) as unknown as jest.Mocked<RanchBotApiClient>;

describe('birth event commands', () => {
  it('registers source lookup with a required source ID and farm/output flags', () => {
    const program = new Command();
    registerBirthEvents(program);
    const source = program.commands.find((command) => command.name() === 'birth-sources');
    const get = source?.commands.find((command) => command.name() === 'get');
    expect(
      get?.registeredArguments.map((argument) => [argument.name(), argument.required]),
    ).toEqual([['sourceSmsId', true]]);
    expect(get?.options.map((option) => option.long)).toEqual(
      expect.arrayContaining(['--farm', '--json']),
    );
  });

  it('reads source evidence using the default or explicitly selected farm', async () => {
    const client = mockClient();
    await getBirthSourceEvidence(client, farmId, { source_sms_id: requestId });
    expect(client.getBirthSourceEvidence).toHaveBeenLastCalledWith(farmId, requestId);
    await getBirthSourceEvidence(client, requestId, { farm: farmId, source_sms_id: requestId });
    expect(client.getBirthSourceEvidence).toHaveBeenLastCalledWith(farmId, requestId);
    await expect(getBirthSourceEvidence(client, '', { source_sms_id: requestId })).rejects.toThrow(
      'No farm selected',
    );
    await expect(
      getBirthSourceEvidence(client, farmId, { source_sms_id: '../other' }),
    ).rejects.toThrow();
    expect(client.getBirthSourceEvidence).toHaveBeenCalledTimes(2);
    expect(client.confirmBirthEvent).not.toHaveBeenCalled();
  });

  it('previews without calling confirmation and preserves all evidence fields', async () => {
    const client = mockClient();
    expect(
      await previewBirthEvent(client, farmId, {
        data: JSON.stringify({ request_id: requestId, bundle }),
      }),
    ).toEqual(preview);
    expect(client.previewBirthEvent).toHaveBeenCalledWith(farmId, {
      request_id: requestId,
      bundle,
    });
    expect(client.confirmBirthEvent).not.toHaveBeenCalled();
  });

  it('confirms the reviewed JSON file with its unchanged bundle and hash', async () => {
    const client = mockClient();
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-birth-review-'));
    const file = path.join(directory, 'review.json');
    try {
      fs.writeFileSync(file, JSON.stringify(preview));
      await confirmBirthEvent(client, 'another-farm', { farm: farmId, data: `@${file}` });
      expect(client.confirmBirthEvent).toHaveBeenCalledWith(farmId, {
        request_id: requestId,
        bundle,
        confirmation_hash: preview.confirmation_hash,
      });
      expect(client.previewBirthEvent).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(directory, { recursive: true });
    }
  });

  it.each([undefined, 'bad', 'a'.repeat(63)])(
    'rejects confirmation without a valid reviewed hash (%s)',
    async (confirmation_hash) => {
      const client = mockClient();
      await expect(
        confirmBirthEvent(client, farmId, {
          data: JSON.stringify({ request_id: requestId, bundle, confirmation_hash }),
        }),
      ).rejects.toThrow();
      expect(client.confirmBirthEvent).not.toHaveBeenCalled();
    },
  );

  it('forwards bounded filters and rejects an excessive page size', async () => {
    const client = mockClient();
    await listBirthEvents(client, farmId, { skip: '10', take: '25', animal: animalId });
    expect(client.listBirthEvents).toHaveBeenCalledWith(farmId, {
      skip: 10,
      take: 25,
      animal_id: animalId,
    });
    await expect(listBirthEvents(client, farmId, { take: '201' })).rejects.toThrow();
  });

  it('keeps undated tasks discoverable and permits clearing a due date', async () => {
    const client = mockClient();
    await listFarmTasks(client, farmId, { status: 'TODO' });
    expect(client.listFarmTasks).toHaveBeenCalledWith(farmId, { status: 'TODO' });
    await updateFarmTask(client, farmId, {
      task_id: requestId,
      data: JSON.stringify({ status: 'TODO', due_date: null }),
    });
    expect(client.updateFarmTask).toHaveBeenCalledWith(farmId, requestId, {
      status: 'TODO',
      due_date: null,
    });
  });

  it('requires provided protocol steps and passes an immutable version', async () => {
    const client = mockClient();
    await expect(
      createProtocolVersion(client, farmId, {
        data: '{"name":"Neonatal","version":"1","steps":[]}',
      }),
    ).rejects.toThrow();
    const protocol = { name: 'Neonatal', version: '1', steps: ['Record producer observations'] };
    await createProtocolVersion(client, farmId, { data: JSON.stringify(protocol) });
    expect(client.createProtocolVersion).toHaveBeenCalledWith(farmId, protocol);
  });
});
