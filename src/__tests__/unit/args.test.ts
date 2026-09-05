import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { readDataFlag, readJsonFlag, assertEnum } from '../../args';
import { CliError } from '../../errors';

describe('readDataFlag', () => {
  it('parses inline JSON object', () => {
    expect(readDataFlag('{"a":1}')).toEqual({ a: 1 });
  });

  it('reads from a @file', () => {
    const file = path.join(os.tmpdir(), `rb-cli-args-${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify({ from: 'file' }));
    expect(readDataFlag(`@${file}`)).toEqual({ from: 'file' });
    fs.unlinkSync(file);
  });

  it('returns undefined when the flag is absent', () => {
    expect(readDataFlag(undefined)).toBeUndefined();
  });

  it('rejects non-object JSON (array)', () => {
    expect(() => readDataFlag('[1,2,3]')).toThrow(CliError);
  });

  it('rejects invalid JSON', () => {
    expect(() => readDataFlag('{not json')).toThrow(CliError);
  });

  it('reports a missing @file clearly', () => {
    expect(() => readDataFlag('@/no/such/path.json')).toThrow(/Could not read --data file/);
  });
});

describe('readJsonFlag', () => {
  it('parses an array', () => {
    expect(readJsonFlag('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('parses an object', () => {
    expect(readJsonFlag('{"x":1}')).toEqual({ x: 1 });
  });

  it('returns undefined when absent', () => {
    expect(readJsonFlag(undefined)).toBeUndefined();
  });

  it('rejects invalid JSON', () => {
    expect(() => readJsonFlag('nope')).toThrow(CliError);
  });
});

describe('assertEnum', () => {
  it('returns the value when valid', () => {
    expect(assertEnum('HEALTH', ['FEED', 'HEALTH'], 'type')).toBe('HEALTH');
  });

  it('throws when missing', () => {
    expect(() => assertEnum(undefined, ['FEED', 'HEALTH'], 'type')).toThrow(/--type is required/);
  });

  it('throws with the allowed set when invalid', () => {
    expect(() => assertEnum('WRONG', ['FEED', 'HEALTH'], 'type')).toThrow(
      /Invalid --type "WRONG".*FEED, HEALTH/,
    );
  });
});
