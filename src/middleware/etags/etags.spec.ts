import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from '../../HttpRouter/HttpRouter.ts';
import etags from './etags.ts';

describe('etags middleware', () => {
  const helloWorldEtag = '"c6a1dfa4103602ad"';
  let server: Server;
  let app: HttpRouter;
  beforeEach(() => {
    app = new HttpRouter();
    app.use(etags());
    server = app.listen();
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
});
