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
    let server: Server;
    let app: HttpRouter;
    beforeEach(() => {
      app = new HttpRouter();
      app.use(compression());
      server = app.listen({ port: 0 });
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

  for (const compressionType of ['gzip', 'br']) {
    describe(`streaming responses with ${compressionType}`, () => {
      let server: Server;
      let app: HttpRouter;
      beforeEach(() => {
        app = new HttpRouter();
        app.use(compression());
        server = app.listen({ port: 0 });
      });
      afterEach(() => {
        server.stop(true);
      });

      it('should compress chunked transfer-encoded responses', async () => {
        const chunks = ['Hello', ' ', 'World', '!'];
        const expected = chunks.join('');

        app.get('/', () => {
          const stream = new ReadableStream({
            async start(controller) {
              for (const chunk of chunks) {
                await new Promise(resolve => setTimeout(resolve, 10));
                controller.enqueue(chunk);
              }
              controller.close();
            },
          });

          return new Response(stream, {
            headers: {
              'Transfer-Encoding': 'chunked',
              'Content-Type': 'text/plain',
            },
          });
        });

        const resp = await fetch(server.url, {
          headers: { 'Accept-Encoding': compressionType },
        });

        expect(resp.status).toBe(200);
        expect(resp.headers.get('Content-encoding')).toBe(compressionType);
        const text = await resp.text();
        expect(text).toBe(expected);
      });

      it('should compress SSE responses', async () => {
        const events = ['event1', 'event2', 'event3'];

        app.get('/', () => {
          const stream = new ReadableStream({
            async start(controller) {
              for (const event of events) {
                await new Promise(resolve => setTimeout(resolve, 10));
                controller.enqueue(`data: ${event}\n\n`);
              }
              controller.close();
            },
          });

          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            },
          });
        });

        const resp = await fetch(server.url, {
          headers: { 'Accept-Encoding': compressionType },
        });

        expect(resp.status).toBe(200);
        expect(resp.headers.get('Content-encoding')).toBe(compressionType);

        const text = await resp.text();
        const expectedSSE = events.map(event => `data: ${event}\n\n`).join('');
        expect(text).toBe(expectedSSE);
      });
    });
  }
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
      server = app.listen({ port: 0 });
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
