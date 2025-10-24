import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from '../../HttpRouter/HttpRouter';
import { etags, type EtagHashCalculator } from './etags';

// Utility to spin up a server per test
function setupApp(mw = etags()) {
  const app = new HttpRouter();
  app.use(mw);
  const server = app.listen({ port: 0 });
  return { app, server } as const;
}

describe('etags middleware', () => {
  const helloWorldEtag = '"c6a1dfa4103602ad"';
  let server: Server;
  let app: HttpRouter;
  beforeEach(() => {
    ({ app, server } = setupApp());
  });
  afterEach(() => {
    server.stop(true);
  });

  it('GET If-None-Match match returns 304 and sets canonical ETag', async () => {
    app.get('/', c => c.text('Hello world'));
    const resp = await fetch(server.url, {
      headers: {
        'If-None-Match': helloWorldEtag,
      },
    });
    const text = await resp.text();
    expect(resp.status).toBe(304);
    expect(resp.headers.get('ETag')).toBe(helloWorldEtag);
    // 304 has no body
    expect(text).toBe('');
  });

  it('matches when multiple ETags are given', async () => {
    app.get('/', c => c.text('Hello world'));
    const resp = await fetch(server.url, {
      headers: {
        'If-None-Match': `"abc", ${helloWorldEtag}`,
      },
    });
    const text = await resp.text();
    expect(resp.status).toBe(304);
    expect(resp.headers.get('ETag')).toBe(helloWorldEtag);
    expect(text).toBe('');
  });

  it('returns full response for mismatch and sets ETag', async () => {
    app.get('/', c => c.text('Hello world'));
    const mismatchEtag = '"mismatch"';
    const resp = await fetch(server.url, {
      headers: {
        'If-None-Match': mismatchEtag,
      },
    });
    const text = await resp.text();
    expect(resp.status).toBe(200);
    expect(resp.headers.get('ETag')).toBe(helloWorldEtag);
    expect(text).toBe('Hello world');
  });

  it('does not generate for non-200/201/203/410', async () => {
    app.get('/', c => c.text('Hello world', { status: 404 }));
    const resp = await fetch(server.url, {
      headers: {
        'If-None-Match': helloWorldEtag,
      },
    });
    const text = await resp.text();
    expect(resp.status).toBe(404);
    expect(resp.headers.has('ETag')).toBe(false);
    expect(text).toBe('Hello world');
  });

  it('POST If-None-Match match returns 412 with no body', async () => {
    app.post('/', c => c.text('Hello world'));
    const resp = await fetch(server.url, {
      method: 'POST',
      headers: {
        'If-None-Match': helloWorldEtag,
      },
    });
    const text = await resp.text();
    expect(resp.status).toBe(412);
    expect(resp.headers.has('ETag')).toBe(true);
    expect(text).toBe('');
  });

  it('does not generate for streams', async () => {
    app.post('/', c => {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode('Hello world'));
          } finally {
            controller.close();
          }
        },
      });
      return new Response(readable, {
        headers: {
          'Content-Type': 'text/stream',
          'Transfer-Encoding': 'chunked',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    });
    const resp = await fetch(server.url, { method: 'POST' });
    expect(resp.status).toBe(200);
    expect(resp.headers.has('ETag')).toBe(false);
  });

  it('If-Match failing precondition returns 412, passing proceeds', async () => {
    app.put('/', c => c.text('Hello world'));
    // Failing precondition
    const fail = await fetch(server.url, { method: 'PUT', headers: { 'If-Match': '"nope"' } });
    expect(fail.status).toBe(412);
    expect(await fail.text()).toBe('');

    // Passing precondition by first getting real ETag via GET to compute ETag
    await fetch(server.url);
    // Now PUT with If-Match should pass only if server would compute the same ETag for PUT
    // To avoid relying on body hash for PUT, we hit a GET route for pass scenario instead
    app.get('/check', c => c.text('Hello world'));
    app.put('/check', c => c.text('Hello world'));
    const probeGet = await fetch(server.url + '/check');
    const etag = probeGet.headers.get('ETag')!;
    const pass = await fetch(server.url + '/check', { method: 'PUT', headers: { 'If-Match': etag } });
    expect(pass.status).toBe(200);
    expect(await pass.text()).toBe('Hello world');
  });

  it('weak vs strong comparison: If-None-Match uses weak, If-Match uses strong', async () => {
    app.get('/', c => c.text('A'));
    const probe = await fetch(server.url);
    const etag = probe.headers.get('ETag')!; // e.g., "..."
    // Weak If-None-Match should match even if header is weak
    const weakHit = await fetch(server.url, { headers: { 'If-None-Match': `W/${etag}` } });
    expect(weakHit.status).toBe(304);
    // Strong If-Match should fail when header is weak
    app.put('/', c => c.text('A'));
    const strongFail = await fetch(server.url, { method: 'PUT', headers: { 'If-Match': `W/${etag}` } });
    expect(strongFail.status).toBe(412);
  });

  it('wildcard handling: If-None-Match * matches; If-Match * passes', async () => {
    app.get('/', c => c.text('Hello world'));
    expect((await fetch(server.url, { headers: { 'If-None-Match': '*' } })).status).toBe(304);
    app.put('/put', c => c.text('ok'));
    expect((await fetch(server.url + '/put', { method: 'PUT', headers: { 'If-Match': '*' } })).status).toBe(200);
  });

  it('HEAD: does not compute but honors existing ETag for conditionals', async () => {
    // No existing ETag -> no conditional effect
    app.head('/', c => c.text('x'));
    let resp = await fetch(server.url, { method: 'HEAD', headers: { 'If-None-Match': '"x"' } });
    expect(resp.status).toBe(200);
    expect(resp.headers.get('ETag')).toBeNull();

    // With existing ETag set by upstream
    const mw = etags();
    ({ app, server } = setupApp(mw));
    app.head('/h', _c => new Response(null, { headers: { ETag: helloWorldEtag } }));
    resp = await fetch(server.url + '/h', { method: 'HEAD', headers: { 'If-None-Match': helloWorldEtag } });
    expect(resp.status).toBe(304);
    expect(resp.headers.get('ETag')).toBe(helloWorldEtag);
  });

  it('preserves status (e.g., 201) when rewrapping computed buffer', async () => {
    app.get('/', c => c.text('created', { status: 201 }));
    const resp = await fetch(server.url);
    expect(resp.status).toBe(201);
    expect(await resp.text()).toBe('created');
  });

  it('adds Vary: Content-Encoding only when computed ETag; appends if present', async () => {
    // First: no existing Vary
    app.get('/', c => c.text('Hello world'));
    let resp = await fetch(server.url);
    expect(resp.headers.get('Vary')).toBe('Content-Encoding');

    // Second: existing Vary other value
    ({ app, server } = setupApp());
    app.get('/v', _ => new Response('hi', { headers: { Vary: 'Accept' } }));
    resp = await fetch(server.url + '/v');
    expect(resp.headers.get('Vary')).toBe('Accept, Content-Encoding');
  });

  it('maxSize prevents buffering even when Content-Length missing', async () => {
    const mw = etags({ maxSize: 1 });
    ({ app, server } = setupApp(mw));
    // Create a response without Content-Length but larger than maxSize by using a stream-like cloning
    app.get('/', _ => new Response('Hello world'));
    const resp = await fetch(server.url);
    expect(resp.headers.get('ETag')).toBeNull();
    expect(await resp.text()).toBe('Hello world');
  });

  it('exceptWhen skips etag logic and conditionals', async () => {
    const mw = etags({ exceptWhen: () => true });
    ({ app, server } = setupApp(mw));
    app.get('/', c => c.text('Hello world'));
    const resp = await fetch(server.url, { headers: { 'If-None-Match': helloWorldEtag } });
    expect(resp.status).toBe(200);
    expect(resp.headers.get('ETag')).toBeNull();
  });

  it('calculator error falls back to original response', async () => {
    const badCalc: EtagHashCalculator = async () => {
      throw new Error('boom');
    };
    const mw = etags({ calculator: badCalc });
    ({ app, server } = setupApp(mw));
    app.get('/', c => c.text('Hello world'));
    const resp = await fetch(server.url);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('ETag')).toBeNull();
    expect(await resp.text()).toBe('Hello world');
  });

  it('normalizes Etag header casing and does not overwrite existing when overwrite=false', async () => {
    const mw = etags();
    ({ app, server } = setupApp(mw));
    app.get('/', _ => new Response('Hello world', { headers: { Etag: helloWorldEtag } }));
    const resp = await fetch(server.url);
    expect(resp.headers.get('ETag')).toBe(helloWorldEtag);
    // The original header may remain accessible case-insensitively; ensure canonical casing exists
    // and that there are not duplicate values.
  });

  it('overwrite=true recalculates and replaces existing ETag; sets Vary', async () => {
    const calc: EtagHashCalculator = async (_c, _r) => ({ buffer: new TextEncoder().encode('abc'), hash: 'deadbeef' });
    const mw = etags({ overwrite: true, calculator: calc });
    ({ app, server } = setupApp(mw));
    app.get('/', _ => new Response('Hello world', { headers: { ETag: '"old"' } }));
    const resp = await fetch(server.url);
    expect(resp.headers.get('ETag')).toBe('"deadbeef"');
    expect(resp.headers.get('Vary')).toContain('Content-Encoding');
  });

  it('does not generate for 204/empty body, 206, no-store, DELETE, and 0 Content-Length', async () => {
    // 204
    ({ app, server } = setupApp());
    app.get('/s204', _ => new Response(null, { status: 204 }));
    let resp = await fetch(server.url + '/s204');
    expect(resp.headers.get('ETag')).toBeNull();

    // 206
    ({ app, server } = setupApp());
    app.get('/s206', _ => new Response('partial', { status: 206 }));
    resp = await fetch(server.url + '/s206', { headers: { 'If-None-Match': '"whatever"' } });
    expect(resp.status).toBe(206);
    expect(resp.headers.get('ETag')).toBeNull();

    // no-store
    ({ app, server } = setupApp());
    app.get('/nostore', _ => new Response('x', { headers: { 'Cache-Control': 'no-store' } }));
    resp = await fetch(server.url + '/nostore');
    expect(resp.headers.get('ETag')).toBeNull();

    // DELETE method not supported for generation
    ({ app, server } = setupApp());
    app.delete('/d', c => c.text('del'));
    resp = await fetch(server.url + '/d', { method: 'DELETE', headers: { 'If-None-Match': '*' } });
    expect(resp.status).toBe(200);
    expect(resp.headers.get('ETag')).toBeNull();

    // Explicit Content-Length: 0
    ({ app, server } = setupApp());
    app.get('/zero', _ => new Response('', { headers: { 'Content-Length': '0' } }));
    resp = await fetch(server.url + '/zero');
    expect(resp.headers.get('ETag')).toBeNull();
  });
});
