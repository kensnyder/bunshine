import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from '../../HttpRouter/HttpRouter';

describe('c.json()', () => {
  let app: HttpRouter;
  let server: Server;
  beforeEach(() => {
    app = new HttpRouter();
    server = app.listen({ port: 0 });
  });
  afterEach(() => {
    server.stop(true);
  });
  it('should serve data', async () => {
    const data = {
      string: 'string',
      number: 1,
      null: null,
    };
    app.get('/', c => c.json(data));
    const resp = await fetch(server.url);
    const fetchedData = await resp.json();
    expect(fetchedData).toEqual(data);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('content-type')).toContain('application/json');
  });
  it('should handle undefined', async () => {
    app.get('/', c => c.json(undefined));
    const resp = await fetch(server.url);
    const fetchedData = await resp.json();
    expect(fetchedData).toEqual(null);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('content-type')).toContain('application/json');
  });
  it('should accept headers', async () => {
    app.get('/', c =>
      c.json('', {
        headers: {
          'X-Hello': 'World',
        },
      })
    );
    const resp = await fetch(server.url);
    const fetchedData = await resp.json();
    expect(fetchedData).toEqual('');
    expect(resp.status).toBe(200);
    expect(resp.headers.get('x-hello')).toBe('World');
  });
});
