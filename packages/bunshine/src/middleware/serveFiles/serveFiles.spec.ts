import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import path from 'path';
import HttpRouter from '../../HttpRouter/HttpRouter';
import { serveFiles } from './serveFiles';

const fixturesPath = path.join(
  import.meta.dir,
  '..',
  '..',
  '..',
  'testFixtures'
);

describe('serveFiles middleware', () => {
  let app: HttpRouter;
  let server: Server;
  beforeEach(() => {
    app = new HttpRouter();
    server = app.listen({ port: 0 });
  });
  afterEach(() => {
    server.stop(true);
  });
  describe('files', () => {
    it('should serve file', async () => {
      app.get('/files/*', serveFiles(fixturesPath));
      const resp = await fetch(`${server.url}files/home.html`);
      const text = await resp.text();
      expect(text).toBe('<h1>Welcome home</h1>\n');
      expect(resp.headers.get('content-length')).toBe('22');
      expect(resp.status).toBe(200);
    });
    it('should serve empty file', async () => {
      app.get('/files/*', serveFiles(fixturesPath));
      const resp = await fetch(`${server.url}files/empty.txt`);
      const text = await resp.text();
      expect(text).toBe('');
      expect(resp.headers.get('content-length')).toBe('0');
      expect(resp.status).toBe(200);
    });
    it('should support head', async () => {
      app.head('/files/*', serveFiles(fixturesPath));
      const resp = await fetch(`${server.url}files/home.html`, {
        method: 'HEAD',
      });
      const text = await resp.text();
      expect(text).toBe('');
      expect(resp.headers.get('content-length')).toBe('22'); // Fixed in Bun 1.1.43
      expect(resp.status).toBe(200);
    });
    it('should 404 if file does not exist', async () => {
      app.get('/files/*', serveFiles(fixturesPath));
      const resp = await fetch(`${server.url}files/404.html`);
      expect(resp.status).toBe(404);
    });
    it('should 404 if file does not exist (no fallthrough)', async () => {
      app.get('/files/*', serveFiles(fixturesPath, { fallthrough: false }));
      const resp = await fetch(`${server.url}files/404.html`);
      expect(resp.status).toBe(404);
    });
  });
  describe('headers', () => {
    it('should add date header', async () => {
      app.get('/files/*', serveFiles(fixturesPath));
      const resp = await fetch(`${server.url}files/home.html`);
      const text = await resp.text();
      expect(text).toBe('<h1>Welcome home</h1>\n');
      expect(resp.headers.get('date')).toMatch(
        /^\w{3}, \d+ \w+ \d+ \d+:\d+:\d+ \w+$/
      );
      expect(resp.status).toBe(200);
    });
    it('should add last-modified header', async () => {
      app.get('/files/*', serveFiles(fixturesPath));
      const resp = await fetch(`${server.url}files/home.html`);
      expect(resp.headers.get('last-modified')).toMatch(
        /^\w{3}, \d+ \w+ \d+ \d+:\d+:\d+ \w+$/
      );
    });
    it('should allow supressing last-modified', async () => {
      app.get(
        '/files/*',
        serveFiles(fixturesPath, {
          lastModified: false,
        })
      );
      const resp = await fetch(`${server.url}files/home.html`);
      expect(resp.headers.get('last-modified')).toBe(null);
    });
    it('should add accept-ranges header', async () => {
      app.get('/files/*', serveFiles(fixturesPath));
      const resp = await fetch(`${server.url}files/home.html`);
      expect(resp.headers.get('accept-ranges')).toBe('bytes');
    });
  });
  describe('middleware', () => {
    it('should allow altering response', async () => {
      app.get(
        '/files/*',
        async (_, next) => {
          const resp = await next();
          resp.headers.set('x-foo', 'bar');
          return resp;
        },
        serveFiles(fixturesPath)
      );
      const resp = await fetch(`${server.url}files/home.html`);
      const text = await resp.text();
      expect(text).toBe('<h1>Welcome home</h1>\n');
      expect(resp.headers.get('x-foo')).toBe('bar');
    });
  });
  describe('maxAge', () => {
    it('should handle maxAge as 0', async () => {
      app.get(
        '/files/*',
        serveFiles(fixturesPath, {
          maxAge: 0,
        })
      );
      const resp = await fetch(`${server.url}files/home.html`);
      expect(resp.headers.get('cache-control')).toBe('public, max-age=0');
    });
    it('should handle maxAge as number', async () => {
      app.get(
        '/files/*',
        serveFiles(fixturesPath, {
          maxAge: 123956,
        })
      );
      const resp = await fetch(`${server.url}files/home.html`);
      expect(resp.headers.get('cache-control')).toBe('public, max-age=123');
    });
    it('should handle maxAge as string', async () => {
      app.get(
        '/files/*',
        serveFiles(fixturesPath, {
          maxAge: '30d',
        })
      );
      const resp = await fetch(`${server.url}files/home.html`);
      expect(resp.headers.get('cache-control')).toBe('public, max-age=2592000');
    });
    it('should throw if maxAge is invalid', async () => {
      const thrower = () => {
        serveFiles(fixturesPath, {
          maxAge: 'foobar',
        });
      };
      expect(thrower).toThrow(/foobar/);
    });
  });
  describe('index', () => {
    it('should find index.html', async () => {
      app.get(
        '/files/*',
        serveFiles(fixturesPath, {
          index: ['index.html'],
        })
      );
      const resp = await fetch(`${server.url}files/folder`);
      const text = await resp.text();
      expect(text).toBe('index.html\n');
      expect(resp.headers.get('content-type')).toContain('text/html');
    });
    it('should serve index.css', async () => {
      app.get('/files/*', serveFiles(fixturesPath));
      const resp = await fetch(`${server.url}files/folder/index.css`);
      const text = await resp.text();
      expect(text).toContain('body');
      expect(resp.headers.get('content-type')).toContain('text/css');
    });
    it('should find index.js', async () => {
      app.get(
        '/files/*',
        serveFiles(fixturesPath, {
          index: ['index.js'],
        })
      );
      const resp = await fetch(`${server.url}files/folder`);
      const text = await resp.text();
      expect(text).toBe('// index.js\n');
      expect(resp.headers.get('content-type')).toContain('text/javascript');
    });
    it('should support fallbacks', async () => {
      app.get(
        '/files/*',
        serveFiles(fixturesPath, {
          index: ['nothing.html', 'index.js'],
        })
      );
      const resp = await fetch(`${server.url}files/folder`);
      const text = await resp.text();
      expect(text).toBe('// index.js\n');
      expect(resp.headers.get('content-type')).toContain('text/javascript');
    });
    it('should should not follow directories', async () => {
      app.get(
        '/files/*',
        serveFiles(fixturesPath, {
          index: ['folder'],
        })
      );
      const resp = await fetch(`${server.url}files`);
      expect(resp.status).toBe(404);
    });
  });
  describe('dotfiles', () => {
    it('should defer dotfile "ignore" requests to next handler', async () => {
      app.get(
        '/files/*',
        serveFiles(fixturesPath, {
          dotfiles: 'ignore',
        }),
        c => c.text('Hello')
      );
      const resp = await fetch(`${server.url}files/.dotfile`);
      const text = await resp.text();
      expect(text).toBe('Hello');
    });
    it('should return 403 for dotfile "deny" requests', async () => {
      app.get(
        '/files/*',
        serveFiles(fixturesPath, {
          dotfiles: 'deny',
        })
      );
      const resp = await fetch(`${server.url}files/.dotfile`);
      expect(resp.status).toBe(403);
    });
    it('should serve dotfile "allow" requests', async () => {
      app.get(
        '/files/*',
        serveFiles(fixturesPath, {
          dotfiles: 'allow',
        })
      );
      const resp = await fetch(`${server.url}files/.dotfile`);
      const text = await resp.text();
      expect(text).toBe('.dotfile\n');
    });
    it('should 404 on ".." filenames', async () => {
      app.get(
        '/files/*',
        serveFiles(fixturesPath, {
          dotfiles: 'ignore',
        })
      );
      const resp = await fetch(`${server.url}files/..`);
      expect(resp.status).toBe(404);
    });
  });
  describe('extensions', () => {
    it('should defer unknown extension requests to next handler', async () => {
      app.get(
        '/files/*',
        serveFiles(fixturesPath, {
          extensions: ['txt'],
        }),
        c => c.text('Hello')
      );
      const resp = await fetch(`${server.url}files/home.html`);
      const text = await resp.text();
      expect(text).toBe('Hello');
    });
    it('should serve if extension matches', async () => {
      app.get(
        '/files/*',
        serveFiles(fixturesPath, {
          extensions: ['html'],
        })
      );
      const resp = await fetch(`${server.url}files/home.html`);
      const text = await resp.text();
      expect(text).toBe('<h1>Welcome home</h1>\n');
    });
    it('should allow serving files with no extension', async () => {
      app.get(
        '/files/*',
        serveFiles(fixturesPath, {
          extensions: ['', 'html'],
        })
      );
      const resp = await fetch(`${server.url}files/noext`);
      const text = await resp.text();
      expect(text).toBe('noext\n');
    });
  });
});
