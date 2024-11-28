import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from '../../HttpRouter/HttpRouter';
import { trailingSlashes } from './trailingSlashes';

describe('trailingSlashes middleware', () => {
  let port = 50250;
  let app: HttpRouter;
  let server: Server;
  beforeEach(() => {
    app = new HttpRouter();
    server = app.listen({ port: 0 });
  });
  afterEach(() => {
    server.stop(true);
  });
  it('should add slashes', async () => {
    app.use(trailingSlashes('add'));
    const resp = await fetch(`${server.url}foo`);
    expect(resp.redirected).toBe(true);
    expect(resp.url).toBe(`${server.url}foo/`);
  });
  it('should add slashes with query string', async () => {
    app.use(trailingSlashes('add'));
    const resp = await fetch(`${server.url}foo?a=b`);
    expect(resp.redirected).toBe(true);
    expect(resp.url).toBe(`${server.url}foo/?a=b`);
  });
  it('should remove slashes', async () => {
    app.use(trailingSlashes('remove'));
    const resp = await fetch(`${server.url}foo/`);
    expect(resp.redirected).toBe(true);
    expect(resp.url).toBe(`${server.url}foo`);
  });
  it('should remove slashes with query string', async () => {
    app.use(trailingSlashes('remove'));
    const resp = await fetch(`${server.url}foo/?a=b`);
    expect(resp.redirected).toBe(true);
    expect(resp.url).toBe(`${server.url}foo?a=b`);
  });
  it('should not remove slashes at root', async () => {
    app.use(trailingSlashes('remove'));
    const resp = await fetch(server.url);
    expect(resp.redirected).toBe(false);
    expect(resp.url).toBe(`${server.url}`);
  });
});
