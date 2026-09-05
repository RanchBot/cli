import { createMockClient } from '../testUtils';
import {
  listChuteSessions,
  getChuteSession,
  createChuteSession,
  updateChuteSession,
} from '../../../commands/chute';
import { CliError } from '../../../errors';

const widgets = [{ id: 'w1', type: 'weight', label: 'Weight', size: 'full' }];

describe('chute commands', () => {
  it('list filters by status', async () => {
    const client = createMockClient();
    client.listChuteSessions.mockResolvedValueOnce({ records: [{ id: 's1' }] } as any);

    const result = await listChuteSessions(client, 'farm-1', { status: 'PROPOSED' });

    expect(client.listChuteSessions).toHaveBeenCalledWith('farm-1', { status: 'PROPOSED' });
    expect(result.message).toContain('1 chute session(s)');
  });

  it('list rejects an invalid status', async () => {
    const client = createMockClient();
    await expect(listChuteSessions(client, 'farm-1', { status: 'DRAFT' })).rejects.toThrow(
      /Invalid --status/,
    );
  });

  it('get chute session', async () => {
    const client = createMockClient();
    client.getChuteSession.mockResolvedValueOnce({ id: 's1' } as any);
    await getChuteSession(client, 'farm-1', { session_id: 's1' });
    expect(client.getChuteSession).toHaveBeenCalledWith('farm-1', 's1');
  });

  it('create accepts a widgets array and resolves an existing group by name', async () => {
    const client = createMockClient();
    client.listGroups.mockResolvedValueOnce({
      records: [{ id: 'g9', name: 'Calves 2026' }],
    } as any);
    client.createChuteSession.mockResolvedValueOnce({ id: 's2', name: 'Weigh Day' } as any);

    const result = await createChuteSession(client, 'farm-1', {
      data: JSON.stringify(widgets),
      name: 'Weigh Day',
      recordType: 'HEALTH',
      groupName: 'Calves 2026',
      newAnimalFields: 'tag,name,sex',
    });

    expect(client.listGroups).toHaveBeenCalledWith('farm-1');
    expect(client.createGroup).not.toHaveBeenCalled(); // group existed
    expect(client.createChuteSession).toHaveBeenCalledWith('farm-1', {
      name: 'Weigh Day',
      config: {
        widgets,
        new_animal_fields: ['tag', 'name', 'sex'],
        record_type: 'HEALTH',
      },
      group_id: 'g9',
    });
    expect(result.message).toContain('Proposed chute session');
  });

  it('create creates the group when the name is new', async () => {
    const client = createMockClient();
    client.listGroups.mockResolvedValueOnce({ records: [] } as any);
    client.createGroup.mockResolvedValueOnce({ id: 'g-new' } as any);
    client.createChuteSession.mockResolvedValueOnce({ id: 's3', name: 'X' } as any);

    await createChuteSession(client, 'farm-1', {
      data: JSON.stringify(widgets),
      groupName: 'Yearlings',
    });

    expect(client.createGroup).toHaveBeenCalledWith('farm-1', { name: 'Yearlings' });
    expect(client.createChuteSession).toHaveBeenCalledWith(
      'farm-1',
      expect.objectContaining({ group_id: 'g-new' }),
    );
  });

  it('create requires a widget grid', async () => {
    const client = createMockClient();
    await expect(createChuteSession(client, 'farm-1', {})).rejects.toThrow(CliError);
  });

  it('update replaces the widget grid', async () => {
    const client = createMockClient();
    client.updateChuteSession.mockResolvedValueOnce({ id: 's1', name: 'Renamed' } as any);

    const result = await updateChuteSession(client, 'farm-1', {
      session_id: 's1',
      data: JSON.stringify(widgets),
      name: 'Renamed',
    });

    expect(client.updateChuteSession).toHaveBeenCalledWith('farm-1', 's1', {
      name: 'Renamed',
      config: { widgets, record_type: undefined },
      group_id: undefined,
    });
    expect(result.message).toContain('Updated proposed chute session');
  });
});
