import { createMockClient } from '../testUtils';
import { listIdentifiers, addIdentifier, removeIdentifier } from '../../../commands/identifiers';

describe('identifiers commands', () => {
  it('list identifiers for an animal', async () => {
    const client = createMockClient();
    client.listAnimalIdentifiers.mockResolvedValueOnce({ identifiers: [{ id: 'i1' }] } as any);

    const result = await listIdentifiers(client, 'farm-1', { animal_id: 'a1' });

    expect(client.listAnimalIdentifiers).toHaveBeenCalledWith('farm-1', 'a1');
    expect(result.message).toContain('1 identifier(s)');
  });

  it('add forwards type/value/is_primary', async () => {
    const client = createMockClient();
    client.addAnimalIdentifier.mockResolvedValueOnce({ id: 'i2' } as any);

    const result = await addIdentifier(client, 'farm-1', {
      animal_id: 'a1',
      type: 'MANAGEMENT_TAG',
      value: '#301',
      primary: true,
    });

    expect(client.addAnimalIdentifier).toHaveBeenCalledWith('farm-1', 'a1', {
      type: 'MANAGEMENT_TAG',
      value: '#301',
      is_primary: true,
    });
    expect(result.message).toBe('Identifier added to animal a1');
  });

  it('add rejects an invalid type', async () => {
    const client = createMockClient();
    await expect(
      addIdentifier(client, 'farm-1', { animal_id: 'a1', type: 'RFID', value: 'x' }),
    ).rejects.toThrow(/Invalid --type/);
  });

  it('remove identifier', async () => {
    const client = createMockClient();
    client.removeAnimalIdentifier.mockResolvedValueOnce(undefined as any);

    const result = await removeIdentifier(client, 'farm-1', {
      animal_id: 'a1',
      identifier_id: 'i1',
    });

    expect(client.removeAnimalIdentifier).toHaveBeenCalledWith('farm-1', 'a1', 'i1');
    expect(result.deleted).toBe(true);
  });
});
