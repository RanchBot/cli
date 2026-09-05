import { CliError, toErrorEnvelope } from './errors';

export interface OutputOptions {
  json?: boolean;
}

/** Write a successful result to stdout: raw JSON when --json, else a best-effort human view. */
export function printResult(data: unknown, opts: OutputOptions): void {
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
    return;
  }
  printHuman(data);
}

/**
 * Human view (the founder's default; agents use --json). If the payload carries a
 * `message`, print it first, then a pretty block of the remaining fields. This keeps
 * output legible without special-casing every list shape — richer tables are a
 * follow-up; --json is always the precise surface.
 */
function printHuman(data: unknown): void {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const { message, ...rest } = data as Record<string, unknown>;
    if (message) {
      console.log(String(message));
    }
    if (Object.keys(rest).length > 0) {
      console.log(JSON.stringify(rest, null, 2));
    } else if (!message) {
      // Empty object with no message: show something.
      console.log(JSON.stringify(data, null, 2));
    }
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}

/** Write the error envelope to stderr and return the process exit code. */
export function printError(err: unknown, opts: OutputOptions): number {
  const env = toErrorEnvelope(err);
  const line = opts.json ? JSON.stringify(env) : `Error: ${env.message}`;
  process.stderr.write(`${line}\n`);
  return err instanceof CliError ? err.exitCode : 1;
}
