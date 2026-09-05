import { createMockClient } from '../testUtils';
import {
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
} from '../../../commands/groups';

describe('groups commands', () => {
  it('list groups', async () => {
    const client = createMockClient();
    client.listGroups.mockResolvedValueOnce({ records: [{ id: 'g1' }] } as any);

    const result = await listGroups(client, 'farm-1', {});
    expect(client.listGroups).toHaveBeenCalledWith('farm-1');
    expect(result.message).toContain('1 group(s)');
  });

  it('get group', async () => {
    const client = createMockClient();
    client.getGroup.mockResolvedValueOnce({ id: 'g1' } as any);
    await getGroup(client, 'farm-1', { group_id: 'g1' });
    expect(client.getGroup).toHaveBeenCalledWith('farm-1', 'g1');
  });

  it('create forwards name + description', async () => {
    const client = createMockClient();
    client.createGroup.mockResolvedValueOnce({ id: 'g2' } as any);

    const result = await createGroup(client, 'farm-1', {
      name: 'Calves',
      description: '2026 drop',
    });

    expect(client.createGroup).toHaveBeenCalledWith('farm-1', {
      name: 'Calves',
      description: '2026 drop',
    });
    expect(result.message).toContain('g2');
  });

  it('create sends only name when description omitted', async () => {
    const client = createMockClient();
    client.createGroup.mockResolvedValueOnce({ id: 'g3' } as any);
    await createGroup(client, 'farm-1', { name: 'Cows' });
    expect(client.createGroup).toHaveBeenCalledWith('farm-1', { name: 'Cows' });
  });

  it('update sends only provided fields', async () => {
    const client = createMockClient();
    client.updateGroup.mockResolvedValueOnce({ id: 'g1' } as any);
    await updateGroup(client, 'farm-1', { group_id: 'g1', description: 'new' });
    expect(client.updateGroup).toHaveBeenCalledWith('farm-1', 'g1', { description: 'new' });
  });

  it('delete group', async () => {
    const client = createMockClient();
    client.deleteGroup.mockResolvedValueOnce(undefined as any);
    const result = await deleteGroup(client, 'farm-1', { group_id: 'g1' });
    expect(client.deleteGroup).toHaveBeenCalledWith('farm-1', 'g1');
    expect(result.deleted).toBe(true);
  });
});
