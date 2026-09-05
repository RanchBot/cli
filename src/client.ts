import axios, { AxiosInstance } from 'axios';

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
      baseURL: `${options.apiUrl}/api/${options.apiVersion}`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
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

  async listAnimals(farmId: string, params?: { skip?: number; take?: number }) {
    const response = await this.client.get(`/farm/${farmId}/animals`, { params });
    return response.data;
  }

  async getAnimal(farmId: string, animalId: string) {
    const response = await this.client.get(`/farm/${farmId}/animals/${animalId}`);
    return response.data;
  }

  async createAnimal(farmId: string, data: { metadata?: any }) {
    const response = await this.client.post(`/farm/${farmId}/animals`, data);
    return response.data;
  }

  async updateAnimal(farmId: string, animalId: string, data: { metadata?: any }) {
    const response = await this.client.put(`/farm/${farmId}/animals/${animalId}`, data);
    return response.data;
  }

  async deleteAnimal(farmId: string, animalId: string) {
    await this.client.delete(`/farm/${farmId}/animals/${animalId}`);
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
