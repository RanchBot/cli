import { createMockClient } from '../testUtils';
import {
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
} from '../../../commands/records';
import { CliError } from '../../../errors';

describe('records commands', () => {
  it('list filters by type', async () => {
    const client = createMockClient();
    client.listRecords.mockResolvedValueOnce({ records: [{ id: 'r1' }] } as any);

    const result = await listRecords(client, 'farm-1', { type: 'HEALTH', skip: '0', take: '25' });

    expect(client.listRecords).toHaveBeenCalledWith('farm-1', {
      type: 'HEALTH',
      skip: 0,
      take: 25,
    });
    expect(result).toEqual(expect.objectContaining({ message: 'Found 1 record(s)' }));
  });

  it('list rejects an invalid type', async () => {
    const client = createMockClient();
    await expect(listRecords(client, 'farm-1', { type: 'BOGUS' })).rejects.toThrow(
      /Invalid --type/,
    );
  });

  it('get record by id', async () => {
    const client = createMockClient();
    client.getRecord.mockResolvedValueOnce({ id: 'r1' } as any);
    const result = await getRecord(client, 'farm-1', { record_id: 'r1' });
    expect(client.getRecord).toHaveBeenCalledWith('farm-1', 'r1');
    expect(result).toEqual({ id: 'r1' });
  });

  it('create forwards animal/group arrays + scalars', async () => {
    const client = createMockClient();
    client.createRecord.mockResolvedValueOnce({ id: 'r9' } as any);

    const result = await createRecord(client, 'farm-1', {
      name: '8-way',
      type: 'HEALTH',
      appliedAt: '2026-06-19T09:00:00Z',
      animal: ['a1', 'a2'],
      group: ['g1'],
      description: 'spring',
    });

    expect(client.createRecord).toHaveBeenCalledWith('farm-1', {
      name: '8-way',
      type: 'HEALTH',
      applied_at: '2026-06-19T09:00:00Z',
      animal_ids: ['a1', 'a2'],
      group_ids: ['g1'],
      description: 'spring',
    });
    expect(result).toEqual(
      expect.objectContaining({ message: 'Record created successfully with ID: r9' }),
    );
  });

  it('create accepts a full --data payload', async () => {
    const client = createMockClient();
    client.createRecord.mockResolvedValueOnce({ id: 'r2' } as any);

    const data = JSON.stringify({
      name: 'Move',
      type: 'MOVEMENT',
      applied_at: '2026-06-19T09:00:00Z',
      animal_ids: ['a1'],
    });

    await createRecord(client, 'farm-1', { data });

    expect(client.createRecord).toHaveBeenCalledWith('farm-1', {
      name: 'Move',
      type: 'MOVEMENT',
      applied_at: '2026-06-19T09:00:00Z',
      animal_ids: ['a1'],
      // The CLI always sends both arrays (defaulting to []) so the API's required
      // animal_ids/group_ids schema is satisfied even for single-attachment records (RAN-154).
      group_ids: [],
    });
  });

  it('create forwards a group-only payload (sends animal_ids: []) [RAN-154]', async () => {
    const client = createMockClient();
    client.createRecord.mockResolvedValueOnce({ id: 'r3' } as any);

    await createRecord(client, 'farm-1', {
      name: 'Pen move',
      type: 'MOVEMENT',
      appliedAt: '2026-06-19T09:00:00Z',
      group: ['g1'],
    });

    expect(client.createRecord).toHaveBeenCalledWith('farm-1', {
      name: 'Pen move',
      type: 'MOVEMENT',
      applied_at: '2026-06-19T09:00:00Z',
      animal_ids: [],
      group_ids: ['g1'],
    });
  });

  it('create requires at least one animal or group', async () => {
    const client = createMockClient();
    await expect(
      createRecord(client, 'farm-1', {
        name: 'x',
        type: 'HEALTH',
        appliedAt: '2026-06-19T09:00:00Z',
      }),
    ).rejects.toThrow(/at least one animal.*group/);
  });

  it('create requires name/type/applied-at', async () => {
    const client = createMockClient();
    await expect(createRecord(client, 'farm-1', { animal: ['a1'] })).rejects.toThrow(CliError);
  });

  it('update merges provided fields', async () => {
    const client = createMockClient();
    client.updateRecord.mockResolvedValueOnce({ id: 'r1' } as any);

    const result = await updateRecord(client, 'farm-1', {
      record_id: 'r1',
      description: 'updated',
    });

    expect(client.updateRecord).toHaveBeenCalledWith('farm-1', 'r1', { description: 'updated' });
    expect(result).toEqual(expect.objectContaining({ message: 'Record r1 updated' }));
  });

  it('update errors when nothing provided', async () => {
    const client = createMockClient();
    await expect(updateRecord(client, 'farm-1', { record_id: 'r1' })).rejects.toThrow(
      /Nothing to update/,
    );
  });

  it('delete record', async () => {
    const client = createMockClient();
    client.deleteRecord.mockResolvedValueOnce(undefined as any);
    const result = await deleteRecord(client, 'farm-1', { record_id: 'r1' });
    expect(client.deleteRecord).toHaveBeenCalledWith('farm-1', 'r1');
    expect(result.deleted).toBe(true);
  });
});
