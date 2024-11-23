import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from '../../HttpRouter/HttpRouter';

describe('c.redirect()', () => {
  let port = 50350;
  let app: HttpRouter;
  let server: Server;
  beforeEach(() => {
    app = new HttpRouter();
    server = app.listen({ port: port++ });
  });
  afterEach(() => {
    server.stop(true);
  });
  it('should default to 302', async () => {
    app.get('/', c => c.redirect('/home'));
    const resp = await fetch(server.url, { redirect: 'manual' });
    expect(resp.status).toBe(302);
    expect(resp.headers.get('Location')).toBe('/home');
  });
  it('should allow custom status', async () => {
    app.get('/', c => c.redirect('/home', 303));
    const resp = await fetch(server.url, { redirect: 'manual' });
    expect(resp.status).toBe(303);
    expect(resp.headers.get('Location')).toBe('/home');
  });
  it('should allow custom headers', async () => {
    app.get('/', c => {
      const resp = c.redirect('/home', 302);
      resp.headers.set('X-Hello', 'World');
      return resp;
    });
    const resp = await fetch(server.url, { redirect: 'manual' });
    expect(resp.status).toBe(302);
    expect(resp.headers.get('Location')).toBe('/home');
    expect(resp.headers.get('X-Hello')).toBe('World');
  });
});
