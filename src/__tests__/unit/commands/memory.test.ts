import { createMockClient } from '../testUtils';
import { listMemories } from '../../../commands/memory';

describe('memory commands', () => {
  it('list collapses grouped versions to the current value per key', async () => {
    const client = createMockClient();
    client.listMemories.mockResolvedValueOnce({
      memories: [
        {
          key: 'breed',
          versions: [
            { id: 'v2', value: 'Angus', source: 'chat', created_at: '2026-06-19T00:00:00Z' },
            { id: 'v1', value: 'unknown', source: 'chat', created_at: '2026-06-01T00:00:00Z' },
          ],
        },
      ],
    } as any);

    const result = await listMemories(client, 'farm-1', {});

    expect(client.listMemories).toHaveBeenCalledWith('farm-1');
    expect(result.memories).toEqual([
      {
        key: 'breed',
        value: 'Angus',
        source: 'chat',
        as_of: '2026-06-19T00:00:00Z',
        version_count: 2,
      },
    ]);
    expect(result.message).toBe('Found 1 memory');
  });
});
