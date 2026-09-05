import { createMockClient } from '../testUtils';
import { listFarms, getFarm } from '../../../commands/farms';

describe('farms commands', () => {
  it('list farms maps the response', async () => {
    const client = createMockClient();
    client.getFarms.mockResolvedValueOnce({ farms: [{ id: 'f1', name: 'Home' }], total: 1 } as any);

    const result = await listFarms(client);

    expect(client.getFarms).toHaveBeenCalled();
    expect(result).toEqual({
      farms: [{ id: 'f1', name: 'Home' }],
      total: 1,
      message: 'Found 1 farm(s)',
    });
  });

  it('get farm by id', async () => {
    const client = createMockClient();
    client.getFarm.mockResolvedValueOnce({ id: 'f1', name: 'Home' } as any);

    const result = await getFarm(client, '', { farm_id: 'f1' });

    expect(client.getFarm).toHaveBeenCalledWith('f1');
    expect(result).toEqual({ id: 'f1', name: 'Home' });
  });
});
