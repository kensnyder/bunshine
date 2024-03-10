import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from '../HttpRouter/HttpRouter.ts';
import { trailingSlashes } from './trailingSlashes.ts';

describe('trailingSlashes middleware', () => {
  let app: HttpRouter;
  let server: Server;
  beforeEach(() => {
    app = new HttpRouter();
  });
  afterEach(() => {
    server.stop(true);
  });
  it('should add slashes', async () => {
    app.use(trailingSlashes('add'));
    server = app.listen({ port: 7800 });
    const resp = await fetch('http://localhost:7800/foo');
    expect(resp.redirected).toBe(true);
    expect(resp.url).toBe('http://localhost:7800/foo/');
  });
  it('should add slashes with query string', async () => {
    app.use(trailingSlashes('add'));
    server = app.listen({ port: 7801 });
    const resp = await fetch('http://localhost:7801/foo?a=b');
    expect(resp.redirected).toBe(true);
    expect(resp.url).toBe('http://localhost:7801/foo/?a=b');
  });
  it('should remove slashes', async () => {
    app.use(trailingSlashes('remove'));
    server = app.listen({ port: 7802 });
    const resp = await fetch('http://localhost:7802/foo/');
    expect(resp.redirected).toBe(true);
    expect(resp.url).toBe('http://localhost:7802/foo');
  });
  it('should remove slashes with query string', async () => {
    app.use(trailingSlashes('remove'));
    server = app.listen({ port: 7803 });
    const resp = await fetch('http://localhost:7803/foo/?a=b');
    expect(resp.redirected).toBe(true);
    expect(resp.url).toBe('http://localhost:7803/foo?a=b');
  });
  it('should not remove slashes at root', async () => {
    app.use(trailingSlashes('remove'));
    server = app.listen({ port: 7804 });
    const resp = await fetch('http://localhost:7804/');
    expect(resp.redirected).toBe(false);
    expect(resp.url).toBe('http://localhost:7804/');
  });
});
