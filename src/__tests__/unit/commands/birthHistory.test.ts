import { RanchBotApiClient } from '../../../client';
import {
  getBirthHistoryEvidence,
  getBirthHistorySettings,
  setBirthHistorySettings,
} from '../../../commands/birthHistory';

const farmId = '11111111-1111-4111-8111-111111111111';
const damId = '22222222-2222-4222-8222-222222222222';
const client = () =>
  ({
    getBirthHistorySettings: jest.fn(),
    setBirthHistorySettings: jest.fn(),
    getBirthHistoryEvidence: jest.fn(),
  }) as unknown as jest.Mocked<RanchBotApiClient>;
it('keeps history reads separate from producer configuration writes and forwards exact settings', async () => {
  const api = client();
  const settings = { version: 1, species: 'SHEEP', birth_windows: [] };
  await getBirthHistorySettings(api, farmId, {});
  await getBirthHistoryEvidence(api, 'unused', { farm: farmId, dam: damId, date: '2026-09-04' });
  expect(api.getBirthHistorySettings).toHaveBeenCalledWith(farmId);
  expect(api.getBirthHistoryEvidence).toHaveBeenCalledWith(farmId, {
    dam_id: damId,
    birth_date: '2026-09-04',
  });
  expect(api.setBirthHistorySettings).not.toHaveBeenCalled();
  await setBirthHistorySettings(api, farmId, { data: JSON.stringify(settings) });
  expect(api.setBirthHistorySettings).toHaveBeenCalledWith(farmId, settings);
});
it('rejects missing dam identifiers and dates before a request', async () => {
  const api = client();
  await expect(getBirthHistoryEvidence(api, farmId, { date: '2026-09-04' })).rejects.toThrow();
  await expect(
    getBirthHistoryEvidence(api, farmId, { dam: damId, date: 'tomorrow' }),
  ).rejects.toThrow();
  expect(api.getBirthHistoryEvidence).not.toHaveBeenCalled();
});
