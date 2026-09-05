import * as fs from 'fs';
import { CliError } from './errors';

/**
 * Resolve the shared `--data` flag, which accepts:
 *   --data @file.json   read from a file
 *   --data -            read from stdin
 *   --data '{"…": …}'   inline JSON
 * Returns the parsed object, or undefined when the flag was not provided.
 */
export function readDataFlag(value: string | undefined): Record<string, any> | undefined {
  if (value === undefined) return undefined;

  let raw: string;
  if (value === '-') {
    raw = fs.readFileSync(0, 'utf-8'); // fd 0 = stdin
  } else if (value.startsWith('@')) {
    const filePath = value.slice(1);
    try {
      raw = fs.readFileSync(filePath, 'utf-8');
    } catch (err: any) {
      throw new CliError(`Could not read --data file "${filePath}": ${err.message}`);
    }
  } else {
    raw = value;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new CliError('--data must be a JSON object.');
    }
    return parsed as Record<string, any>;
  } catch (err: any) {
    if (err instanceof CliError) throw err;
    throw new CliError(`--data is not valid JSON: ${err.message}`);
  }
}

/**
 * Like readDataFlag but returns any JSON value (object OR array). Used where the flag
 * is a list (e.g. a chute widget grid) rather than a record.
 */
export function readJsonFlag(value: string | undefined): any {
  if (value === undefined) return undefined;
  let raw: string;
  if (value === '-') {
    raw = fs.readFileSync(0, 'utf-8');
  } else if (value.startsWith('@')) {
    const filePath = value.slice(1);
    try {
      raw = fs.readFileSync(filePath, 'utf-8');
    } catch (err: any) {
      throw new CliError(`Could not read --data file "${filePath}": ${err.message}`);
    }
  } else {
    raw = value;
  }
  try {
    return JSON.parse(raw);
  } catch (err: any) {
    throw new CliError(`--data is not valid JSON: ${err.message}`);
  }
}

/** Validate a value against an allow-list (enum), else throw with the allowed set. */
export function assertEnum(value: string | undefined, allowed: string[], field: string): string {
  if (!value) {
    throw new CliError(`--${field} is required (one of: ${allowed.join(', ')}).`);
  }
  if (!allowed.includes(value)) {
    throw new CliError(`Invalid --${field} "${value}". Must be one of: ${allowed.join(', ')}.`);
  }
  return value;
}
