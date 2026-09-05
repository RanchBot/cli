import { createMockClient } from '../testUtils';
import { listFeedings, getFeeding } from '../../../commands/feedings';

describe('feedings commands', () => {
  it('list forwards status and since', async () => {
    const client = createMockClient();
    client.listFeedings.mockResolvedValueOnce({ records: [{ id: 'fd1' }] } as any);

    const result = await listFeedings(client, 'farm-1', {
      status: 'ACTIVE',
      since: '2026-06-01T00:00:00Z',
    });

    expect(client.listFeedings).toHaveBeenCalledWith('farm-1', {
      status: 'ACTIVE',
      since: '2026-06-01T00:00:00Z',
    });
    expect(result.message).toContain('1 feeding(s)');
  });

  it('list rejects an invalid status', async () => {
    const client = createMockClient();
    await expect(listFeedings(client, 'farm-1', { status: 'PENDING' })).rejects.toThrow(
      /Invalid --status/,
    );
  });

  it('get feeding wraps the result', async () => {
    const client = createMockClient();
    client.getFeeding.mockResolvedValueOnce({ id: 'fd1' } as any);

    const result = await getFeeding(client, 'farm-1', { feeding_id: 'fd1' });

    expect(client.getFeeding).toHaveBeenCalledWith('farm-1', 'fd1');
    expect(result).toEqual({ feeding: { id: 'fd1' }, message: 'Retrieved feeding fd1' });
  });
});
