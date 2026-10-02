import { Command } from 'commander';
import { createMockClient } from '../testUtils';
import {
  listAnimals,
  getAnimal,
  createAnimal,
  updateAnimal,
  deleteAnimal,
  findAnimalByEid,
  lookupAnimalByEid,
  registerAnimals,
} from '../../../commands/animals';

describe('animals commands', () => {
  it('list animals forwards skip/take and resolves the farm', async () => {
    const client = createMockClient();
    client.listAnimals.mockResolvedValueOnce({ records: [{ id: 'a1' }], total: 1 } as any);

    const result = await listAnimals(client, 'farm-1', { skip: '10', take: '50' });

    expect(client.listAnimals).toHaveBeenCalledWith('farm-1', { skip: 10, take: 50 });
    expect(result).toEqual(expect.objectContaining({ message: 'Found 1 animal(s)' }));
  });

  it('list uses --farm override over the default', async () => {
    const client = createMockClient();
    client.listAnimals.mockResolvedValueOnce({ records: [] } as any);

    await listAnimals(client, 'farm-1', { farm: 'farm-9' });

    expect(client.listAnimals).toHaveBeenCalledWith('farm-9', {});
  });

  it('list throws when no farm is selected', async () => {
    const client = createMockClient();
    await expect(listAnimals(client, '', {})).rejects.toThrow(/No farm selected/);
  });

  it('forwards explicit status separately from metadata and rejects invalid statuses before a request', async () => {
    const client = createMockClient();
    client.listAnimals.mockResolvedValue({ records: [], total: 0 } as any);
    client.createAnimal.mockResolvedValue({ id: 'historical' } as any);
    client.updateAnimal.mockResolvedValue({ id: 'historical' } as any);
    await listAnimals(client, 'farm-1', { inventoryStatus: 'ALL' });
    await createAnimal(client, 'farm-1', { inventoryStatus: 'UNKNOWN' });
    await updateAnimal(client, 'farm-1', { animal_id: 'historical', inventoryStatus: 'SOLD' });
    expect(client.listAnimals).toHaveBeenCalledWith('farm-1', { inventory_status: 'ALL' });
    expect(client.createAnimal).toHaveBeenCalledWith('farm-1', {
      inventory_status: 'UNKNOWN',
      metadata: undefined,
    });
    expect(client.updateAnimal).toHaveBeenCalledWith('farm-1', 'historical', {
      inventory_status: 'SOLD',
      metadata: undefined,
    });
    await expect(createAnimal(client, 'farm-1', { inventoryStatus: 'ALL' })).rejects.toThrow(
      'Invalid --inventory-status',
    );
    await expect(listAnimals(client, 'farm-1', { inventoryStatus: 'sold' })).rejects.toThrow(
      'Invalid --inventory-status',
    );
    expect(client.createAnimal).toHaveBeenCalledTimes(1);
  });

  it('get animal by id', async () => {
    const client = createMockClient();
    client.getAnimal.mockResolvedValueOnce({ id: 'a1' } as any);

    const result = await getAnimal(client, 'farm-1', { animal_id: 'a1' });

    expect(client.getAnimal).toHaveBeenCalledWith('farm-1', 'a1');
    expect(result).toEqual({ id: 'a1' });
  });

  it('create animal forwards metadata object', async () => {
    const client = createMockClient();
    client.createAnimal.mockResolvedValueOnce({ id: 'a2' } as any);

    const result = await createAnimal(client, 'farm-1', { metadata: '{"species":"cattle"}' });

    expect(client.createAnimal).toHaveBeenCalledWith('farm-1', { metadata: { species: 'cattle' } });
    expect(result).toEqual(
      expect.objectContaining({ message: 'Animal created successfully with ID: a2' }),
    );
  });

  it('create animal without metadata passes undefined', async () => {
    const client = createMockClient();
    client.createAnimal.mockResolvedValueOnce({ id: 'a3' } as any);

    await createAnimal(client, 'farm-1', {});

    expect(client.createAnimal).toHaveBeenCalledWith('farm-1', { metadata: undefined });
  });

  it('update animal forwards metadata', async () => {
    const client = createMockClient();
    client.updateAnimal.mockResolvedValueOnce({ id: 'a1' } as any);

    const result = await updateAnimal(client, 'farm-1', { animal_id: 'a1', metadata: '{"n":1}' });

    expect(client.updateAnimal).toHaveBeenCalledWith('farm-1', 'a1', { metadata: { n: 1 } });
    expect(result).toEqual(expect.objectContaining({ message: 'Animal a1 updated' }));
  });

  it('delete animal reports the deleted id', async () => {
    const client = createMockClient();
    client.deleteAnimal.mockResolvedValueOnce(undefined as any);

    const result = await deleteAnimal(client, 'farm-1', { animal_id: 'a1' });

    expect(client.deleteAnimal).toHaveBeenCalledWith('farm-1', 'a1');
    expect(result).toEqual({ deleted: true, id: 'a1', message: 'Animal a1 deleted' });
  });

  it('find-by-eid reports created vs found', async () => {
    const client = createMockClient();
    client.findOrCreateAnimalByEid.mockResolvedValueOnce({ id: 'a1', created: false } as any);
    client.findOrCreateAnimalByEid.mockResolvedValueOnce({ id: 'a2', created: true } as any);

    const found = await findAnimalByEid(client, 'farm-1', { eid: 'e1' });
    const created = await findAnimalByEid(client, 'farm-1', { eid: 'e2' });

    expect(client.findOrCreateAnimalByEid).toHaveBeenNthCalledWith(1, 'farm-1', 'e1');
    expect(found.message).toBe('Animal found with EID e1');
    expect(created.message).toBe('Animal created with EID e2');
  });
});

describe('safe animal lookup command', () => {
  it.each(['not found', 'ambiguous'])(
    'propagates %s without falling back to creation',
    async (message) => {
      const client = createMockClient();
      client.lookupAnimalByEid.mockRejectedValue(new Error(message));
      await expect(
        lookupAnimalByEid(client, 'default', { farm: 'selected', eid: '001' }),
      ).rejects.toThrow(message);
      expect(client.lookupAnimalByEid).toHaveBeenCalledWith('selected', '001');
      expect(client.findOrCreateAnimalByEid).not.toHaveBeenCalled();
      expect(client.createAnimal).not.toHaveBeenCalled();
    },
  );

  it('returns the existing animal', async () => {
    const client = createMockClient();
    client.lookupAnimalByEid.mockResolvedValue({ id: 'animal' });
    expect(await lookupAnimalByEid(client, 'farm', { eid: '001' })).toEqual({ id: 'animal' });
    expect(client.findOrCreateAnimalByEid).not.toHaveBeenCalled();
  });

  it('makes read, create, and deprecated behavior explicit in command help', () => {
    const program = new Command();
    registerAnimals(program);
    const commands = program.commands[0].commands;
    expect(commands.find((c) => c.name() === 'lookup-by-eid')?.helpInformation()).toMatch(
      /Read-only.*Never creates/,
    );
    expect(commands.find((c) => c.name() === 'find-or-create-by-eid')?.helpInformation()).toMatch(
      /Creates inventory/,
    );
    expect(commands.find((c) => c.name() === 'find-by-eid')?.helpInformation()).toMatch(
      /DEPRECATED: creates inventory/,
    );
  });
});
