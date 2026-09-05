import { createMockClient } from '../testUtils';
import { listRations, getRation, createRation } from '../../../commands/rations';
import { CliError } from '../../../errors';

const ration = {
  name: 'Finishing lambs — winter',
  unit: 'lb',
  ingredients: [{ name: 'Alfalfa hay', per_head_lbs: 2.5 }],
  assignments: [{ group_id: 'g1', feedings_per_day: 2, label: 'AM' }],
};

describe('rations commands', () => {
  it('list forwards include-inactive', async () => {
    const client = createMockClient();
    client.listRations.mockResolvedValueOnce({ records: [{ id: 'rt1' }] } as any);

    const result = await listRations(client, 'farm-1', { includeInactive: true });

    expect(client.listRations).toHaveBeenCalledWith('farm-1', { include_inactive: true });
    expect(result.message).toContain('1 ration(s)');
  });

  it('get ration', async () => {
    const client = createMockClient();
    client.getRation.mockResolvedValueOnce({ id: 'rt1' } as any);
    await getRation(client, 'farm-1', { ration_id: 'rt1' });
    expect(client.getRation).toHaveBeenCalledWith('farm-1', 'rt1');
  });

  it('create forwards the ration and notes inactive assignments', async () => {
    const client = createMockClient();
    client.createRation.mockResolvedValueOnce({
      id: 'rt2',
      name: ration.name,
      assignments: [{ group_id: 'g1' }],
    } as any);

    const result = await createRation(client, 'farm-1', { data: JSON.stringify(ration) });

    expect(client.createRation).toHaveBeenCalledWith('farm-1', ration);
    expect(result.message).toContain('inactive until the user activates them');
  });

  it('create requires --data', async () => {
    const client = createMockClient();
    await expect(createRation(client, 'farm-1', {})).rejects.toThrow(/--data is required/);
  });

  it('create rejects ingredients missing per_head_lbs', async () => {
    const client = createMockClient();
    await expect(
      createRation(client, 'farm-1', {
        data: JSON.stringify({ name: 'X', ingredients: [{ name: 'Hay' }] }),
      }),
    ).rejects.toThrow(CliError);
  });
});
