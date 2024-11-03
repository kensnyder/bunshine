import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from '../../HttpRouter/HttpRouter.ts';
import compression, { type CompressionOptions } from './compression.ts';

const html = await fetch('https://www.npmjs.com/package/bunshine').then(res =>
  res.text()
);

describe('compression middleware', () => {
  testWithOptions('should support "gzip"', { prefer: 'gzip' });
  testWithOptions('should support "br"', { prefer: 'br' });
  testWithOptions('should support "none"', { prefer: 'none' });
  describe('small payloads', () => {
    let server: Server;
    let app: HttpRouter;
    beforeEach(() => {
      app = new HttpRouter();
      app.use(compression());
      server = app.listen();
    });
    afterEach(() => {
      server.stop(true);
    });
    it('should ignore small payloads', async () => {
      const respText = 'Hello world';
      app.get('/', c => c.text(respText));
      const resp = await fetch(server.url);
      const text = await resp.text();
      expect(resp.status).toBe(200);
      expect(resp.headers.get('Content-encoding')).toBe(null);
      expect(text).toBe('Hello world');
    });
  });
});

function testWithOptions(
  description: string,
  options: Partial<CompressionOptions>
) {
  describe('regular payload', () => {
    let server: Server;
    let app: HttpRouter;
    beforeEach(() => {
      app = new HttpRouter();
      app.use(compression(options));
      server = app.listen();
      app.get('/', c => c.html(html));
    });
    afterEach(() => {
      server.stop(true);
    });
    it(`should ${description}`, async () => {
      const resp = await fetch(server.url, {
        headers: {
          'Accept-Encoding': 'gzip, br',
        },
      });
      expect(resp.status).toBe(200);
      if (options.prefer === 'none') {
        expect(resp.headers.get('Content-encoding')).toBe(null);
      } else {
        expect(resp.headers.get('Content-encoding')).toBe(options.prefer!);
      }
      const text = await resp.text();
      expect(text).toBe(html);
    });
  });
}
