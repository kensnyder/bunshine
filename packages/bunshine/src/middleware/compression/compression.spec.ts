import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from '../../HttpRouter/HttpRouter';
import { compression, type CompressionOptions } from './compression';

const html = await fetch('https://www.npmjs.com/package/bunshine').then(res =>
  res.text()
);

describe('compression middleware', () => {
  testWithOptions('should support "gzip"', { prefer: 'gzip' });
  testWithOptions('should support "br"', { prefer: 'br' });
  testWithOptions('should support "none"', { prefer: 'none' });
  describe('compression rules', () => {
    let port = 50200;
    let server: Server;
    let app: HttpRouter;
    beforeEach(() => {
      app = new HttpRouter();
      app.use(compression());
      server = app.listen({ port: port++ });
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
      expect(text).toBe(respText);
    });
    it('should avoid compressing non-text responses', async () => {
      const respText = 'Hello world';
      app.get(
        '/',
        () =>
          new Response(Buffer.from(respText), {
            headers: { 'Content-Type': 'application/octet-stream' },
          })
      );
      const resp = await fetch(server.url);
      const text = await resp.text();
      expect(resp.status).toBe(200);
      expect(resp.headers.get('Content-encoding')).toBe(null);
      expect(text).toBe(respText);
    });
    it("should avoid compressing when client doesn't support it", async () => {
      app.get('/', c => c.html(html));
      const resp = await fetch(server.url, {
        headers: { 'Accept-Encoding': 'identity' },
      });
      const text = await resp.text();
      expect(resp.status).toBe(200);
      expect(resp.headers.get('Content-encoding')).toBe(null);
      expect(text).toBe(html);
    });
    it("should use br if gzip isn't supported", async () => {
      app.get('/', c => c.html(html));
      const resp = await fetch(server.url, {
        headers: { 'Accept-Encoding': 'br' },
      });
      const text = await resp.text();
      expect(resp.status).toBe(200);
      expect(resp.headers.get('Content-encoding')).toBe('br');
      expect(text).toBe(html);
    });
    it("should use gzip if br isn't supported", async () => {
      app.get('/', c => c.html(html));
      const resp = await fetch(server.url, {
        headers: { 'Accept-Encoding': 'gzip' },
      });
      const text = await resp.text();
      expect(resp.status).toBe(200);
      expect(resp.headers.get('Content-encoding')).toBe('gzip');
      expect(text).toBe(html);
    });
  });
});

function testWithOptions(
  description: string,
  options: Partial<CompressionOptions>
) {
  describe('regular payload', () => {
    let port = 50600;
    let server: Server;
    let app: HttpRouter;
    beforeEach(() => {
      app = new HttpRouter();
      app.use(compression(options));
      server = app.listen({ port: port++ });
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
      const text = await resp.text();
      expect(text).toBe(html);
      if (options.prefer === 'none') {
        expect(resp.headers.get('Content-encoding')).toBe(null);
      } else {
        expect(resp.headers.get('Content-encoding')).toBe(options.prefer!);
      }
    });
  });
}
