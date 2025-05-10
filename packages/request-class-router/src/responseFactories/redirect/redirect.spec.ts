import { beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from '../../HttpRouter/HttpRouter';

const server = {};

describe('c.redirect()', () => {
  let app: HttpRouter;
  beforeEach(() => {
    app = new HttpRouter();
  });
  it('should default to 302', async () => {
    app.get('/', c => c.redirect('/home'));
    const resp = await app.fetch(new Request('http://localhost/'), server);
    expect(resp.status).toBe(302);
    expect(resp.headers.get('Location')).toBe('/home');
  });
  it('should allow custom status', async () => {
    app.get('/', c => c.redirect('/home', 303));
    const resp = await app.fetch(new Request('http://localhost/'), server);
    expect(resp.status).toBe(303);
    expect(resp.headers.get('Location')).toBe('/home');
  });
  it('should allow custom headers', async () => {
    app.get('/', c => {
      const resp = c.redirect('/home', 302);
      resp.headers.set('X-Hello', 'World');
      return resp;
    });
    const resp = await app.fetch(new Request('http://localhost/'), server);
    expect(resp.status).toBe(302);
    expect(resp.headers.get('Location')).toBe('/home');
    expect(resp.headers.get('X-Hello')).toBe('World');
  });
});
