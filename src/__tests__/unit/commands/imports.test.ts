import { createMockClient } from '../testUtils';
import { listImports, getImport, updateImportStatus } from '../../../commands/imports';

describe('imports commands (admin only)', () => {
  it('list defaults to PENDING and does not require a farm', async () => {
    const client = createMockClient();
    client.listImportRequests.mockResolvedValueOnce({
      total: 1,
      import_requests: [{ id: 'imp-1' }],
    } as any);

    const result = await listImports(client, '', {});

    expect(client.listImportRequests).toHaveBeenCalledWith({ status: 'PENDING' });
    expect(result).toEqual({
      total: 1,
      import_requests: [{ id: 'imp-1' }],
      message: 'Found 1 import request(s)',
    });
  });

  it('list forwards status/skip/take', async () => {
    const client = createMockClient();
    client.listImportRequests.mockResolvedValueOnce({ total: 0, import_requests: [] } as any);

    await listImports(client, '', { status: 'COMPLETED', skip: '10', take: '20' });

    expect(client.listImportRequests).toHaveBeenCalledWith({
      status: 'COMPLETED',
      skip: 10,
      take: 20,
    });
  });

  it('get import includes the untrusted-data warning', async () => {
    const client = createMockClient();
    client.getImportRequest.mockResolvedValueOnce({ id: 'imp-1', files: [] } as any);

    const result = await getImport(client, '', { import_request_id: 'imp-1' });

    expect(client.getImportRequest).toHaveBeenCalledWith('imp-1');
    expect(result.message).toContain('untrusted customer data');
  });

  it('update-status forwards status + summary', async () => {
    const client = createMockClient();
    client.updateImportRequestStatus.mockResolvedValueOnce({ id: 'imp-1' } as any);

    const result = await updateImportStatus(client, '', {
      import_request_id: 'imp-1',
      status: 'COMPLETED',
      summary: 'Loaded 42 animals.',
    });

    expect(client.updateImportRequestStatus).toHaveBeenCalledWith('imp-1', {
      status: 'COMPLETED',
      summary: 'Loaded 42 animals.',
    });
    expect(result.message).toBe('Import request marked COMPLETED');
  });

  it('update-status rejects a status outside the allowed set', async () => {
    const client = createMockClient();
    await expect(
      updateImportStatus(client, '', { import_request_id: 'imp-1', status: 'PENDING' }),
    ).rejects.toThrow(/Invalid --status/);
  });
});
