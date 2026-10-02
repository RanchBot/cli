import { createWriteStream } from 'fs';
import { rm } from 'fs/promises';
import { createHash } from 'crypto';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import axios, { AxiosInstance } from 'axios';

export type AnimalInventoryStatus = 'CURRENT' | 'UNKNOWN' | 'SOLD' | 'DECEASED';

export interface ApiClientOptions {
  accessToken: string;
  apiUrl: string;
  apiVersion: string;
}

/**
 * Thin Ranch.Bot API client. Method-for-method port of the MCP server's client so the
 * CLI and MCP stay at parity (AGENTS.md "one farm-data contract"). The only difference
 * is the base URL is injected per invocation (flags/env) rather than read at module load.
 */
export class RanchBotApiClient {
  private client: AxiosInstance;
  private accessToken: string;

  constructor(options: ApiClientOptions) {
    this.accessToken = options.accessToken;
    this.client = axios.create({
      ...(options.accessToken.startsWith('rb_local_')
        ? { maxRedirects: 0, proxy: false as const }
        : {}),
      baseURL: `${options.apiUrl}/api/${options.apiVersion}`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  async previewAccountDeletion(phone: string) {
    return (await this.client.post('/admin/account-deletions/preview', { phone })).data;
  }
  async executeAccountDeletion(confirmation_token: string, phone: string) {
    return (await this.client.post('/admin/account-deletions', { confirmation_token, phone })).data;
  }
  async accountDeletionStatus(id: string) {
    return (await this.client.get(`/admin/account-deletions/${encodeURIComponent(id)}`)).data;
  }
  async resumeAccountDeletion(id: string, phone: string) {
    return (
      await this.client.post(`/admin/account-deletions/${encodeURIComponent(id)}/resume`, { phone })
    ).data;
  }
  async getBirthHistorySettings(farmId: string) {
    return (await this.client.get(`/farm/${farmId}/birth-history/settings`)).data;
  }

  async setBirthHistorySettings(farmId: string, settings: Record<string, unknown>) {
    return (await this.client.put(`/farm/${farmId}/birth-history/settings`, settings)).data;
  }

  async getBirthHistoryEvidence(farmId: string, params: { dam_id: string; birth_date: string }) {
    return (await this.client.get(`/farm/${farmId}/birth-history/evidence`, { params })).data;
  }

  async previewBirthEvent(
    farmId: string,
    data: { request_id: string; bundle: Record<string, unknown> },
  ) {
    return (await this.client.post(`/farm/${farmId}/birth-events/preview`, data)).data;
  }

  async confirmBirthEvent(
    farmId: string,
    data: { request_id: string; bundle: Record<string, unknown>; confirmation_hash: string },
  ) {
    return (await this.client.post(`/farm/${farmId}/birth-events`, data)).data;
  }

  async listBirthEvents(
    farmId: string,
    params?: { skip?: number; take?: number; animal_id?: string },
  ) {
    return (await this.client.get(`/farm/${farmId}/birth-events`, { params })).data;
  }

  async getBirthEvent(farmId: string, eventId: string) {
    return (await this.client.get(`/farm/${farmId}/birth-events/${eventId}`)).data;
  }

  async getBirthSourceEvidence(farmId: string, sourceSmsId: string) {
    return (await this.client.get(`/farm/${farmId}/birth-sources/${sourceSmsId}`)).data;
  }

  async listFarmTasks(farmId: string, params?: { skip?: number; take?: number; status?: string }) {
    return (await this.client.get(`/farm/${farmId}/farm-tasks`, { params })).data;
  }

  async updateFarmTask(
    farmId: string,
    taskId: string,
    data: { status: 'TODO' | 'DONE' | 'CANCELLED'; due_date?: string | null },
  ) {
    return (await this.client.put(`/farm/${farmId}/farm-tasks/${taskId}`, data)).data;
  }

  async listProtocolVersions(farmId: string, params?: { skip?: number; take?: number }) {
    return (await this.client.get(`/farm/${farmId}/protocol-versions`, { params })).data;
  }

  async createProtocolVersion(
    farmId: string,
    data: { name: string; version: string; steps: string[] },
  ) {
    return (await this.client.post(`/farm/${farmId}/protocol-versions`, data)).data;
  }

  async requestFarmExport(farmId: string) {
    return (await this.client.post(`/farm/${farmId}/exports`)).data;
  }

  async listFarmExports(farmId: string) {
    return (await this.client.get(`/farm/${farmId}/exports`)).data;
  }

  async farmExportStatus(farmId: string, id: string) {
    return (await this.client.get(`/farm/${farmId}/exports/${id}`)).data;
  }

  async cancelFarmExport(farmId: string, id: string) {
    return (await this.client.delete(`/farm/${farmId}/exports/${id}`)).data;
  }

  async downloadFarmExport(farmId: string, id: string, destination: string) {
    const response = await this.client.get(`/farm/${farmId}/exports/${id}/download`, {
      responseType: 'stream',
      maxRedirects: 0,
    });
    const hash = createHash('sha256');
    const output = createWriteStream(destination, { flags: 'wx', mode: 0o600 });
    let created = false;
    output.once('open', () => {
      created = true;
    });
    try {
      await pipeline(
        response.data,
        new Transform({
          transform(chunk, _encoding, callback) {
            hash.update(chunk);
            callback(null, chunk);
          },
        }),
        output,
      );
      const checksum = hash.digest('hex');
      if (checksum !== response.headers['x-content-sha256'])
        throw new Error('Archive checksum does not match. Download again.');
      return { path: destination, sha256: checksum };
    } catch (error) {
      if (created) await rm(destination, { force: true });
      throw error;
    }
  }

  async getFarms() {
    const response = await this.client.get('/farm');
    return {
      farms: response.data.records || [],
      total: response.data.total || 0,
      access: response.data.access || null,
    };
  }

  async getFarm(farmId: string) {
    const response = await this.client.get(`/farm/${farmId}`);
    return response.data;
  }

  async listAnimals(
    farmId: string,
    params?: { skip?: number; take?: number; inventory_status?: AnimalInventoryStatus | 'ALL' },
  ) {
    const response = await this.client.get(`/farm/${farmId}/animals`, { params });
    return response.data;
  }

  async getAnimal(farmId: string, animalId: string) {
    const response = await this.client.get(`/farm/${farmId}/animals/${animalId}`);
    return response.data;
  }

  async createAnimal(
    farmId: string,
    data: { metadata?: any; inventory_status?: AnimalInventoryStatus },
  ) {
    const response = await this.client.post(`/farm/${farmId}/animals`, data);
    return response.data;
  }

  async updateAnimal(
    farmId: string,
    animalId: string,
    data: { metadata?: any; inventory_status?: AnimalInventoryStatus },
  ) {
    const response = await this.client.put(`/farm/${farmId}/animals/${animalId}`, data);
    return response.data;
  }

  async deleteAnimal(farmId: string, animalId: string) {
    await this.client.delete(`/farm/${farmId}/animals/${animalId}`);
  }

  async lookupAnimalByEid(farmId: string, eid: string) {
    const response = await this.client.get(`/farm/${farmId}/animals/lookup-by-eid`, {
      params: { eid },
    });
    return response.data;
  }

  async findOrCreateAnimalByEid(farmId: string, eid: string) {
    const response = await this.client.post(`/farm/${farmId}/animals/find-or-create-by-eid`, {
      eid,
    });
    return response.data;
  }

  async listAnimalIdentifiers(farmId: string, animalId: string) {
    const response = await this.client.get(`/farm/${farmId}/animals/${animalId}/identifier`);
    return response.data;
  }

  async addAnimalIdentifier(
    farmId: string,
    animalId: string,
    data: { type: string; value: string; is_primary?: boolean },
  ) {
    const response = await this.client.post(`/farm/${farmId}/animals/${animalId}/identifier`, data);
    return response.data;
  }

  async removeAnimalIdentifier(farmId: string, animalId: string, identifierId: string) {
    await this.client.delete(`/farm/${farmId}/animals/${animalId}/identifier/${identifierId}`);
  }

  async listGroups(farmId: string) {
    const response = await this.client.get(`/farm/${farmId}/groups`);
    return response.data;
  }

  async listMemories(farmId: string) {
    const response = await this.client.get(`/farm/${farmId}/memory?grouped=true`);
    return response.data;
  }

  async getGroup(farmId: string, groupId: string) {
    const response = await this.client.get(`/farm/${farmId}/groups/${groupId}`);
    return response.data;
  }

  async createGroup(farmId: string, data: { description?: string; name: string }) {
    const response = await this.client.post(`/farm/${farmId}/groups`, data);
    return response.data;
  }

  async updateGroup(
    farmId: string,
    groupId: string,
    data: { description?: string; name?: string },
  ) {
    const response = await this.client.put(`/farm/${farmId}/groups/${groupId}`, data);
    return response.data;
  }

  async deleteGroup(farmId: string, groupId: string) {
    await this.client.delete(`/farm/${farmId}/groups/${groupId}`);
  }

  async listRecords(farmId: string, params?: { skip?: number; take?: number; type?: string }) {
    const response = await this.client.get(`/farm/${farmId}/records`, { params });
    return response.data;
  }

  async getRecord(farmId: string, recordId: string) {
    const response = await this.client.get(`/farm/${farmId}/records/${recordId}`);
    return response.data;
  }

  async inspectSmsContext(
    farmId: string,
    params: {
      latest?: 'true';
      message_sid?: string;
      record_id?: string;
      history?: number;
      include_content?: 'true';
    },
  ) {
    const response = await this.client.get(`/farm/${farmId}/inspection/sms-context`, { params });
    return response.data;
  }

  async createRecord(
    farmId: string,
    data: {
      applied_at: string;
      description?: string;
      name: string;
      type: string;
      animal_ids?: string[];
      group_ids?: string[];
    },
  ) {
    const response = await this.client.post(`/farm/${farmId}/records`, data);
    return response.data;
  }

  async updateRecord(
    farmId: string,
    recordId: string,
    data: {
      applied_at?: string;
      description?: string;
      name?: string;
      type?: string;
    },
  ) {
    const response = await this.client.put(`/farm/${farmId}/records/${recordId}`, data);
    return response.data;
  }

  async deleteRecord(farmId: string, recordId: string) {
    await this.client.delete(`/farm/${farmId}/records/${recordId}`);
  }

  async listChuteSessions(
    farmId: string,
    params?: { skip?: number; take?: number; status?: string },
  ) {
    const response = await this.client.get(`/farm/${farmId}/chute-sessions`, { params });
    return response.data;
  }

  async getChuteSession(farmId: string, sessionId: string) {
    const response = await this.client.get(`/farm/${farmId}/chute-sessions/${sessionId}`);
    return response.data;
  }

  async listRations(
    farmId: string,
    params?: { skip?: number; take?: number; include_inactive?: boolean },
  ) {
    const response = await this.client.get(`/farm/${farmId}/rations`, { params });
    return response.data;
  }

  async getRation(farmId: string, rationId: string) {
    const response = await this.client.get(`/farm/${farmId}/rations/${rationId}`);
    return response.data;
  }

  async createRation(
    farmId: string,
    data: {
      name: string;
      unit?: string;
      ingredients: { name: string; per_head_lbs: number }[];
      assignments?: { group_id: string; feedings_per_day?: number; label?: string }[];
    },
  ) {
    const response = await this.client.post(`/farm/${farmId}/rations`, data);
    return response.data;
  }

  async createChuteSession(
    farmId: string,
    data: {
      name?: string;
      config: { widgets: unknown[]; new_animal_fields?: string[]; record_type?: string };
      group_id?: string;
    },
  ) {
    const response = await this.client.post(`/farm/${farmId}/chute-sessions`, data);
    return response.data;
  }

  async listFeedings(
    farmId: string,
    params?: { skip?: number; take?: number; status?: string; since?: string },
  ) {
    const response = await this.client.get(`/farm/${farmId}/feedings`, { params });
    return response.data;
  }

  async updateChuteSession(
    farmId: string,
    sessionId: string,
    data: {
      name?: string;
      config?: { widgets: unknown[]; new_animal_fields?: string[]; record_type?: string };
      group_id?: string;
    },
  ) {
    const response = await this.client.put(`/farm/${farmId}/chute-sessions/${sessionId}`, data);
    return response.data;
  }

  async getFeeding(farmId: string, feedingId: string) {
    const response = await this.client.get(`/farm/${farmId}/feedings/${feedingId}`);
    return response.data;
  }

  async listImportRequests(params?: { skip?: number; take?: number; status?: string }) {
    const response = await this.client.get('/admin/import-request', { params });
    return response.data;
  }

  async getImportRequest(importRequestId: string) {
    const response = await this.client.get(`/admin/import-request/${importRequestId}`);
    return response.data;
  }

  async updateImportRequestStatus(
    importRequestId: string,
    data: { status: 'PROCESSING' | 'COMPLETED' | 'FAILED'; summary?: string },
  ) {
    const response = await this.client.post(
      `/admin/import-request/${importRequestId}/status`,
      data,
    );
    return response.data;
  }
}
