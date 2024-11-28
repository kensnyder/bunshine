import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from '../../HttpRouter/HttpRouter';
import { etags } from './etags';

describe('etags middleware', () => {
  let port = 50800;
  const helloWorldEtag = '"c6a1dfa4103602ad"';
  let server: Server;
  let app: HttpRouter;
  beforeEach(() => {
    app = new HttpRouter();
    app.use(etags());
    server = app.listen({ port: 0 });
  });
  afterEach(() => {
    server.stop(true);
  });
  it('should return empty response for matching hash', async () => {
    app.get('/', c => c.text('Hello world'));
    const resp = await fetch(server.url, {
      headers: {
        'If-None-Match': helloWorldEtag,
      },
    });
    const text = await resp.text();
    expect(resp.status).toBe(304);
    expect(resp.headers.get('Etag')).toBe(helloWorldEtag);
    expect(text).toBe('');
  });
  it('should match when multiple etags are given', async () => {
    app.get('/', c => c.text('Hello world'));
    const resp = await fetch(server.url, {
      headers: {
        'If-None-Match': `"abc", ${helloWorldEtag}`,
      },
    });
    const text = await resp.text();
    expect(resp.status).toBe(304);
    expect(resp.headers.get('Etag')).toBe(helloWorldEtag);
    expect(text).toBe('');
  });
  it('should return full response for mismatch', async () => {
    app.get('/', c => c.text('Hello world'));
    const mismatchEtag = '"mismatch"';
    const resp = await fetch(server.url, {
      headers: {
        'If-None-Match': mismatchEtag,
      },
    });
    const text = await resp.text();
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Etag')).toBe(helloWorldEtag);
    expect(text).toBe('Hello world');
  });
  it('should not generate for non-200', async () => {
    app.get('/', c => c.text('Hello world', { status: 404 }));
    const resp = await fetch(server.url, {
      headers: {
        'If-None-Match': helloWorldEtag,
      },
    });
    const text = await resp.text();
    expect(resp.status).toBe(404);
    expect(resp.headers.has('Etag')).toBe(false);
    expect(text).toBe('Hello world');
  });
  it('should not generate for non-GET', async () => {
    app.post('/', c => c.text('Hello world'));
    const resp = await fetch(server.url, {
      method: 'POST',
      headers: {
        'If-None-Match': helloWorldEtag,
      },
    });
    const text = await resp.text();
    expect(resp.status).toBe(200);
    expect(resp.headers.has('Etag')).toBe(false);
    expect(text).toBe('Hello world');
  });
});
