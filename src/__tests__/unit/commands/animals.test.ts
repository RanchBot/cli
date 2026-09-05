import { createMockClient } from '../testUtils';
import {
  listAnimals,
  getAnimal,
  createAnimal,
  updateAnimal,
  deleteAnimal,
  findAnimalByEid,
} from '../../../commands/animals';

describe('animals commands', () => {
  it('list animals forwards skip/take and resolves the farm', async () => {
    const client = createMockClient();
    client.listAnimals.mockResolvedValueOnce({ animals: [{ id: 'a1' }], total: 1 } as any);

    const result = await listAnimals(client, 'farm-1', { skip: '10', take: '50' });

    expect(client.listAnimals).toHaveBeenCalledWith('farm-1', { skip: 10, take: 50 });
    expect(result).toEqual(expect.objectContaining({ message: 'Found 1 animal(s)' }));
  });

  it('list uses --farm override over the default', async () => {
    const client = createMockClient();
    client.listAnimals.mockResolvedValueOnce({ animals: [] } as any);

    await listAnimals(client, 'farm-1', { farm: 'farm-9' });

    expect(client.listAnimals).toHaveBeenCalledWith('farm-9', {});
  });

  it('list throws when no farm is selected', async () => {
    const client = createMockClient();
    await expect(listAnimals(client, '', {})).rejects.toThrow(/No farm selected/);
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
