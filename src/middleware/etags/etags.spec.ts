import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from '../../HttpRouter/HttpRouter.ts';

describe('etags body processor', () => {
  let server: Server;
  let app: HttpRouter;
  beforeEach(() => {
    app = new HttpRouter();
    server = app.listen();
  });
  afterEach(() => {
    server.stop(true);
  });
  it('should return empty response for matching hash', async () => {
    app.disableCompression();
    app.get('/', c => c.text('Hello world'));
    const helloWorldEtag = '"c6a1dfa4103602ad"';
    const resp = await fetch(server.url, {
      headers: {
        'If-None-Match': helloWorldEtag,
      },
    });
    const text = await resp.text();
    console.log('returned text', JSON.stringify(text));
    expect(text).toBe('');
    expect(resp.headers.get('Etag')).toBe(helloWorldEtag);
    expect(resp.status).toBe(304);
  });
  it('should return full response for mismatch', async () => {
    app.disableCompression();
    app.get('/', c => c.text('Hello world'));
    const mismatchEtag = '"mismatch"';
    const helloWorldEtag = '"c6a1dfa4103602ad"';
    const resp = await fetch(server.url, {
      headers: {
        'If-None-Match': mismatchEtag,
      },
    });
    const text = await resp.text();
    expect(text).toBe('Hello world');
    expect(resp.headers.get('Etag')).toBe(helloWorldEtag);
    expect(resp.status).toBe(200);
  });
});
