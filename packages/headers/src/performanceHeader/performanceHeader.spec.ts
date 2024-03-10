import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from '../../../src/HttpRouter/HttpRouter.ts';
import { performanceHeader } from './performanceHeader.ts';

describe('performanceHeader middleware', () => {
  let app: HttpRouter;
  let server: Server;
  beforeEach(() => {
    app = new HttpRouter();
  });
  afterEach(() => {
    server.stop(true);
  });
  it('should add X-Took header', async () => {
    app.use(performanceHeader());
    app.get('/foo', c => c.text('Hello'));
    server = app.listen({ port: 7900 });
    const resp = await fetch('http://localhost:7900/foo');
    expect(resp.headers.get('X-Took')).toMatch(/\d+\.\d{3}/);
    const text = await resp.text();
    expect(text).toBe('Hello');
  });
});
