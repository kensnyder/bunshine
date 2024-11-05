import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { LRUCache } from 'lru-cache';
import HttpRouter from '../../HttpRouter/HttpRouter';
import { responseCache } from './responseCache';

describe('responseCache middleware', () => {
  let server: Server;
  let app: HttpRouter;
  beforeEach(() => {
    app = new HttpRouter();
    app.use(responseCache(new LRUCache({ max: 100 })));
    server = app.listen();
  });
  afterEach(() => {
    server.stop(true);
  });
  it('should return cached responses when needed', async () => {
    app.get('/', c => c.text('Hello world'));
    const resp1 = await fetch(server.url);
    const text1 = await resp1.text();
    const resp2 = await fetch(server.url);
    const text2 = await resp2.text();
    const resp3 = await fetch(server.url);
    const text3 = await resp3.text();
    expect(resp1).not.toBe(resp2);
    expect(resp1).not.toBe(resp3);
    expect(resp2).not.toBe(resp3);
    expect(resp1.headers.has('Bunshine-Cached-At')).toBe(false);
    expect(text1).toBe('Hello world');
    expect(resp2.headers.get('Bunshine-Cached-At')).toMatch(
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/
    );
    expect(text2).toBe('Hello world');
    expect(resp2.headers.get('Bunshine-Cached-At')).toBe(
      resp3.headers.get('Bunshine-Cached-At')
    );
    expect(text3).toBe('Hello world');
  });
});
