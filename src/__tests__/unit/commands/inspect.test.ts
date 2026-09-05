import { inspectRecord, inspectSms } from '../../../commands/inspect';
import { createMockClient } from '../testUtils';

const FARM_ID = '00000000-0000-4000-8000-000000000001';
const RECORD_ID = '00000000-0000-4000-8000-000000000002';

describe('inspect commands', () => {
  it('inspects the latest capture through the observer profile with redaction by default', async () => {
    const client = createMockClient();
    client.inspectSmsContext.mockResolvedValueOnce({ capture: { id: 'capture-1' } } as any);

    const result = await inspectSms(client, FARM_ID, {
      profile: 'observer',
      latest: true,
      history: '3',
    });

    expect(client.inspectSmsContext).toHaveBeenCalledWith(FARM_ID, {
      latest: 'true',
      history: 3,
    });
    expect(result).toEqual(
      expect.objectContaining({
        capture: { id: 'capture-1' },
        message: expect.stringContaining('redacted'),
      }),
    );
  });

  it('walks backward from a record and explicitly requests sensitive content', async () => {
    const client = createMockClient();
    client.inspectSmsContext.mockResolvedValueOnce({ capture: { id: 'capture-1' } } as any);

    const result = await inspectRecord(client, FARM_ID, {
      profile: 'observer',
      record_id: RECORD_ID,
      includeContent: true,
    });

    expect(client.inspectSmsContext).toHaveBeenCalledWith(FARM_ID, {
      record_id: RECORD_ID,
      history: 5,
      include_content: 'true',
    });
    expect(result).toEqual(
      expect.objectContaining({ message: expect.stringContaining('Sensitive') }),
    );
  });

  it('requires the observer credential profile', async () => {
    const client = createMockClient();

    await expect(inspectSms(client, FARM_ID, { profile: 'default', latest: true })).rejects.toThrow(
      /observer profile/,
    );
    expect(client.inspectSmsContext).not.toHaveBeenCalled();
  });

  it('requires exactly one selector', async () => {
    const client = createMockClient();

    await expect(
      inspectSms(client, FARM_ID, {
        profile: 'observer',
        latest: true,
        messageSid: 'SM-duplicate-selector',
      }),
    ).rejects.toThrow(/exactly one selector/);
  });

  it('bounds prior-message history', async () => {
    const client = createMockClient();

    await expect(
      inspectSms(client, FARM_ID, { profile: 'observer', latest: true, history: '21' }),
    ).rejects.toThrow(/integer from 0 to 20/);
  });
});
