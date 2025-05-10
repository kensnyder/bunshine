import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from '../../HttpRouter/HttpRouter';
import { performanceHeader } from './performanceHeader';

describe('performanceHeader middleware', () => {
  let app: HttpRouter;
  let server: Server;
  beforeEach(() => {
    app = new HttpRouter();
    server = Bun.serve({ fetch: app.fetch, port: 0 });
  });
  afterEach(() => {
    server.stop(true);
  });
  it('should add X-Took header', async () => {
    app.use(performanceHeader());
    app.get('/foo', c => c.text('Hello'));
    const resp = await fetch(`${server.url}foo`);
    expect(resp.headers.get('X-Took')).toMatch(/\d+\.\d{3}/);
    const text = await resp.text();
    expect(text).toBe('Hello');
  });
});
