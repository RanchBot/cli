import { Command } from 'commander';
import { withGlobals, run, resolveFarm } from '../shared';

interface MemoryVersion {
  id: string;
  value: unknown;
  source: string | null;
  confidence: number | null;
  created_at: string;
  updated_at: string;
}

interface GroupedMemory {
  key: string;
  versions: MemoryVersion[];
}

/**
 * List what the in-app assistant currently remembers about the farm (current value
 * per key). Read-only by design: saving memory is exclusive to the in-app chat, where
 * every save shows a visible "Remembered" chip.
 */
export const listMemories = async (client: any, defaultFarmId: string, opts: any) => {
  const farmId = resolveFarm(opts, defaultFarmId);
  const result = await client.listMemories(farmId);
  const grouped: GroupedMemory[] = result.memories ?? [];
  const memories = grouped.map((memory) => {
    const current = memory.versions[0];
    return {
      key: memory.key,
      value: current?.value,
      source: current?.source ?? null,
      as_of: current?.created_at,
      version_count: memory.versions.length,
    };
  });
  return {
    memories,
    message: `Found ${memories.length} ${memories.length === 1 ? 'memory' : 'memories'}`,
  };
};

export function registerMemory(program: Command): void {
  const memory = program
    .command('memory')
    .description('Farm memory (read-only — saving memory is in-app only).');

  withGlobals(
    memory
      .command('list')
      .description('List what the assistant remembers (current value per key).'),
  ).action(run(listMemories));
}
