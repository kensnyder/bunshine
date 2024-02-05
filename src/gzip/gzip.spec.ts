import { describe, expect, it } from 'bun:test';
import fs from 'node:fs/promises';

import { gzipString } from './gzip.ts';
import { GzipCache } from './GzipCache.ts';

describe('gzipString', () => {
  it('should gzip a string', () => {
    const input = 'hello, world!';
    const output = gzipString(input);
    expect(output).toBeInstanceOf(Uint8Array);
    expect(output).toHaveLength(33);
  });
  it('should gzip a string at level 9', async () => {
    const lorem = await fs.readFile(
      `${import.meta.dir}/../testFixtures/lorem.txt`,
      'utf8'
    );
    const output = gzipString(lorem, { level: 9 });
    expect(output).toBeInstanceOf(Uint8Array);
    expect(output).toHaveLength(4041);
  });
  it('should provide GzipCache base class', async () => {
    const cache = new GzipCache();
    const setup = await cache.setup();
    const resp = await cache.fetch(
      Bun.file(`${import.meta.dir}/../testFixtures/lorem.txt`)
    );
    expect(resp).toBeInstanceOf(Response);
    expect(setup).toBeUndefined();
  });
});
