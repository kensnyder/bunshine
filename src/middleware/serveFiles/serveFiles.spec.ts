import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { globby } from 'globby';
import fs from 'node:fs/promises';
import path from 'path';
import HttpRouter from '../../HttpRouter/HttpRouter.ts';
import { serveFiles } from './serveFiles.ts';

const fixturesPath = path.join(import.meta.dir, '..', '..', 'testFixtures');

describe('serveFiles middleware', () => {
  let app: HttpRouter;
  let server: Server;
  beforeEach(() => {
    app = new HttpRouter();
    app.onError(c => {
      console.log('---------- error', c.error);
      return c.text('Error', { status: 500 });
    });
  });
  afterEach(() => {
    server.stop(true);
  });
  describe('files', () => {
    it('should serve file', async () => {
      app.get('/files/*', serveFiles(fixturesPath));
      server = app.listen();
      const resp = await fetch(`${server.url}files/home.html`);
      const text = await resp.text();
      expect(text).toBe('<h1>Welcome home</h1>\n');
      expect(resp.headers.get('content-length')).toBe('22');
      expect(resp.status).toBe(200);
    });
    it('should serve empty file', async () => {
      app.get('/files/*', serveFiles(fixturesPath));
      server = app.listen();
      const resp = await fetch(`${server.url}files/empty.txt`);
      const text = await resp.text();
      expect(text).toBe('');
      expect(resp.headers.get('content-length')).toBe('0');
      expect(resp.status).toBe(204);
    });
    it('should support head', async () => {
      app.head('/files/*', serveFiles(fixturesPath));
      server = app.listen();
      const resp = await fetch(`${server.url}files/home.html`, {
        method: 'HEAD',
      });
      const text = await resp.text();
      expect(text).toBe('');
      expect(resp.headers.get('content-length')).toBe('22');
      expect(resp.status).toBe(204);
    });
    it('should 404 if file does not exist', async () => {
      app.get('/files/*', serveFiles(fixturesPath));
      server = app.listen();
      const resp = await fetch(`${server.url}files/404.html`);
      expect(resp.status).toBe(404);
    });
  });
  describe('headers', () => {
    // ETag support TO BE IMPLEMENTED
    // it('should add ETag', async () => {
    //   app.head(
    //     '/files/*',
    //     serveFiles(fixturesPath, {
    //       etag: true,
    //     })
    //   );
    //   server = app.listen();
    //   const resp = await fetch(`${server.url}files/home.html`);
    //   const text = await resp.text();
    //   expect(text).toBe('');
    //   expect(resp.headers.get('etag')).toMatch(/^W\/"[^"]+"$/);
    //   expect(resp.status).toBe(200);
    // });
    it('should add date header', async () => {
      app.get('/files/*', serveFiles(fixturesPath));
      server = app.listen();
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
      server = app.listen();
      const resp = await fetch(`${server.url}files/home.html`);
      expect(resp.headers.get('last-modified')).toMatch(
        /^\w{3}, \d+ \w+ \d+ \d+:\d+:\d+ \w+$/
      );
    });
    it('should add accept-ranges header', async () => {
      app.get('/files/*', serveFiles(fixturesPath));
      server = app.listen();
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
      server = app.listen();
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
      server = app.listen();
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
      server = app.listen();
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
      server = app.listen();
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
      server = app.listen();
      const resp = await fetch(`${server.url}files/folder`);
      const text = await resp.text();
      expect(text).toBe('index.html\n');
    });
    it('should find index.js', async () => {
      app.get(
        '/files/*',
        serveFiles(fixturesPath, {
          index: ['index.js'],
        })
      );
      server = app.listen();
      const resp = await fetch(`${server.url}files/folder`);
      const text = await resp.text();
      expect(text).toBe('// index.js\n');
    });
    it('should support fallbacks', async () => {
      app.get(
        '/files/*',
        serveFiles(fixturesPath, {
          index: ['nothing.html', 'index.js'],
        })
      );
      server = app.listen();
      const resp = await fetch(`${server.url}files/folder`);
      const text = await resp.text();
      expect(text).toBe('// index.js\n');
    });
    it('should should not follow directories', async () => {
      app.get(
        '/files/*',
        serveFiles(fixturesPath, {
          index: ['folder'],
        })
      );
      server = app.listen();
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
      server = app.listen();
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
      server = app.listen();
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
      server = app.listen();
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
      server = app.listen();
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
      server = app.listen();
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
      server = app.listen();
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
      server = app.listen();
      const resp = await fetch(`${server.url}files/noext`);
      const text = await resp.text();
      expect(text).toBe('noext\n');
    });
  });
  describe('gzip', () => {
    describe('NeverCache', () => {
      it('should gzip file on demand', async () => {
        app.get(
          '/toGzip/*',
          serveFiles(`${fixturesPath}/toGzip`, {
            gzip: {
              minFileSize: 0,
              maxFileSize: 100000,
              cache: { type: 'never' },
            },
          }),
          c => c.text('Hello')
        );
        server = app.listen();
        const resp = await fetch(`${server.url}toGzip/1.js`);
        const text = await resp.text();
        expect(text).toBe('// This is file number one\n');
        expect(resp.headers.get('content-encoding')).toBe('gzip');
      });
      it('should ignore if file is too small', async () => {
        app.get(
          '/toGzip/*',
          serveFiles(`${fixturesPath}/toGzip`, {
            gzip: {
              minFileSize: 1000,
              maxFileSize: 100000,
              cache: { type: 'never' },
            },
          }),
          c => c.text('Hello')
        );
        server = app.listen();
        const resp = await fetch(`${server.url}toGzip/1.js`);
        const text = await resp.text();
        expect(text).toBe('// This is file number one\n');
        expect(resp.headers.get('content-encoding')).toBe(null);
      });
      it('should ignore if file is too big', async () => {
        app.get(
          '/toGzip/*',
          serveFiles(`${fixturesPath}/toGzip`, {
            gzip: {
              minFileSize: 0,
              maxFileSize: 10,
              cache: { type: 'never' },
            },
          }),
          c => c.text('Hello')
        );
        server = app.listen();
        const resp = await fetch(`${server.url}toGzip/1.js`);
        const text = await resp.text();
        expect(text).toBe('// This is file number one\n');
        expect(resp.headers.get('content-encoding')).toBe(null);
      });
      it('should not gzip jpeg file', async () => {
        app.get(
          '/toGzip/*',
          serveFiles(`${fixturesPath}/toGzip`, {
            gzip: {
              minFileSize: 0,
              maxFileSize: 1e6,
              cache: { type: 'never' },
            },
          }),
          c => c.text('Hello')
        );
        server = app.listen();
        const resp = await fetch(`${server.url}toGzip/dream.jpg`);
        expect(resp.headers.get('content-encoding')).toBe(null);
      });
    });
    describe('MemoryCache', () => {
      it('should gzip', async () => {
        app.get(
          '/toGzip/*',
          serveFiles(`${fixturesPath}/toGzip`, {
            gzip: {
              minFileSize: 0,
              maxFileSize: 100000,
              cache: { type: 'memory', maxBytes: 500 },
            },
          }),
          c => c.text('Hello')
        );
        server = app.listen();
        const resp = await fetch(`${server.url}toGzip/2.css`);
        const text = await resp.text();
        expect(text).toBe('/* This is file number two */\n');
        expect(resp.headers.get('content-encoding')).toBe('gzip');
      });
      it('should ignore if file is too small', async () => {
        app.get(
          '/toGzip/*',
          serveFiles(`${fixturesPath}/toGzip`, {
            gzip: {
              minFileSize: 1000,
              maxFileSize: 100000,
              cache: { type: 'memory', maxBytes: 500 },
            },
          }),
          c => c.text('Hello')
        );
        server = app.listen();
        const resp = await fetch(`${server.url}toGzip/1.js`);
        const text = await resp.text();
        expect(text).toBe('// This is file number one\n');
        expect(resp.headers.get('content-encoding')).toBe(null);
      });
      it('should ignore if file is too big', async () => {
        app.get(
          '/toGzip/*',
          serveFiles(`${fixturesPath}/toGzip`, {
            gzip: {
              minFileSize: 0,
              maxFileSize: 10,
              cache: { type: 'memory', maxBytes: 500 },
            },
          }),
          c => c.text('Hello')
        );
        server = app.listen();
        const resp = await fetch(`${server.url}toGzip/1.js`);
        const text = await resp.text();
        expect(text).toBe('// This is file number one\n');
        expect(resp.headers.get('content-encoding')).toBe(null);
      });
      it('should not gzip jpeg file', async () => {
        app.get(
          '/toGzip/*',
          serveFiles(`${fixturesPath}/toGzip`, {
            gzip: {
              minFileSize: 0,
              maxFileSize: 1e6,
              cache: { type: 'never' },
            },
          }),
          c => c.text('Hello')
        );
        server = app.listen();
        const resp = await fetch(`${server.url}toGzip/dream.jpg`);
        expect(resp.headers.get('content-encoding')).toBe(null);
      });
    });
    describe('FileCache', () => {
      beforeEach(async () => {
        const paths = await globby(['/tmp/*~src~testFixtures~toGzip~*.gz']);
        for (const path of paths) {
          await fs.unlink(path);
        }
      });
      it('should gzip with file cache', async () => {
        app.get(
          '/toGzip/*',
          serveFiles(`${fixturesPath}/toGzip`, {
            gzip: {
              minFileSize: 0,
              maxFileSize: 100000,
              cache: { type: 'file', maxBytes: 500, path: '/tmp' },
            },
          }),
          c => c.text('Hello')
        );
        server = app.listen();
        const resp = await fetch(`${server.url}toGzip/1.js`);
        const text = await resp.text();
        expect(text).toBe('// This is file number one\n');
        expect(resp.headers.get('content-encoding')).toBe('gzip');
        // check if it properly disposes of the oldest accessed file (1.js)
        await fetch(`${server.url}toGzip/2.css`);
        await fetch(`${server.url}toGzip/3.html`);
        const paths = await globby(['/tmp/*~src~testFixtures~toGzip~*.gz']);
        expect(paths.some(p => p.includes('1.js'))).toBe(false);
        expect(paths.some(p => p.includes('2.css'))).toBe(true);
        expect(paths.some(p => p.includes('3.html'))).toBe(true);
      });
      it('should ignore if file is too small', async () => {
        app.get(
          '/toGzip/*',
          serveFiles(`${fixturesPath}/toGzip`, {
            gzip: {
              minFileSize: 1000,
              maxFileSize: 100000,
              cache: { type: 'file', maxBytes: 500, path: '/tmp' },
            },
          }),
          c => c.text('Hello')
        );
        server = app.listen();
        const resp = await fetch(`${server.url}toGzip/1.js`);
        const text = await resp.text();
        expect(text).toBe('// This is file number one\n');
        expect(resp.headers.get('content-encoding')).toBe(null);
      });
      it('should ignore if file is too big', async () => {
        app.get(
          '/toGzip/*',
          serveFiles(`${fixturesPath}/toGzip`, {
            gzip: {
              minFileSize: 0,
              maxFileSize: 10,
              cache: { type: 'file', maxBytes: 500, path: '/tmp' },
            },
          }),
          c => c.text('Hello')
        );
        server = app.listen();
        const resp = await fetch(`${server.url}toGzip/1.js`);
        const text = await resp.text();
        expect(text).toBe('// This is file number one\n');
        expect(resp.headers.get('content-encoding')).toBe(null);
      });
      it('should not gzip jpeg file', async () => {
        app.get(
          '/toGzip/*',
          serveFiles(`${fixturesPath}/toGzip`, {
            gzip: {
              minFileSize: 0,
              maxFileSize: 1e6,
              cache: { type: 'never' },
            },
          }),
          c => c.text('Hello')
        );
        server = app.listen();
        const resp = await fetch(`${server.url}toGzip/dream.jpg`);
        expect(resp.headers.get('content-encoding')).toBe(null);
      });
    });
    describe('PrecompressCache', () => {
      beforeEach(async () => {
        const paths = await globby(['/tmp/*~src~testFixtures~toGzip~**.gz']);
        for (const path of paths) {
          await fs.unlink(path);
        }
      });
      it('should gzip with file cache', async () => {
        app.get(
          '/toGzip/*',
          serveFiles(`${fixturesPath}/toGzip`, {
            gzip: {
              minFileSize: 0,
              maxFileSize: 100000,
              cache: { type: 'precompress', maxBytes: 7500, path: '/tmp' },
            },
          }),
          c => c.text('Hello')
        );
        server = app.listen();
        const resp = await fetch(`${server.url}toGzip/1.js`);
        const text = await resp.text();
        expect(text).toBe('// This is file number one\n');
        expect(resp.headers.get('content-encoding')).toBe('gzip');
        // check if it properly pre-zipped all 4 files
        const paths = await globby(['/tmp/*~src~testFixtures~toGzip~**.gz']);
        expect(paths).toHaveLength(4);
      });
      it('should gzip some with file cache under limited maxBytes', async () => {
        app.get(
          '/toGzip/*',
          serveFiles(`${fixturesPath}/toGzip`, {
            gzip: {
              minFileSize: 0,
              maxFileSize: 100000,
              cache: { type: 'precompress', maxBytes: 75, path: '/tmp' },
            },
          }),
          c => c.text('Hello')
        );
        server = app.listen();
        const resp = await fetch(`${server.url}toGzip/1.js`);
        const text = await resp.text();
        // check if it properly pre-zipped the files
        const paths = await globby(['/tmp/*~src~testFixtures~toGzip~*.gz']);
        expect(paths).toHaveLength(2);
      });
      it('should ignore if file is too small', async () => {
        app.get(
          '/toGzip/*',
          serveFiles(`${fixturesPath}/toGzip`, {
            gzip: {
              minFileSize: 1000,
              maxFileSize: 100000,
              cache: { type: 'precompress', maxBytes: 500, path: '/tmp' },
            },
          }),
          c => c.text('Hello')
        );
        server = app.listen();
        const resp = await fetch(`${server.url}toGzip/1.js`);
        const text = await resp.text();
        expect(text).toBe('// This is file number one\n');
        expect(resp.headers.get('content-encoding')).toBe(null);
      });
      it('should ignore if file is too big', async () => {
        app.get(
          '/toGzip/*',
          serveFiles(`${fixturesPath}/toGzip`, {
            gzip: {
              minFileSize: 0,
              maxFileSize: 10,
              cache: { type: 'precompress', maxBytes: 500, path: '/tmp' },
            },
          }),
          c => c.text('Hello')
        );
        server = app.listen();
        const resp = await fetch(`${server.url}toGzip/1.js`);
        const text = await resp.text();
        expect(text).toBe('// This is file number one\n');
        expect(resp.headers.get('content-encoding')).toBe(null);
      });
      it('should not gzip jpeg file', async () => {
        app.get(
          '/toGzip/*',
          serveFiles(`${fixturesPath}/toGzip`, {
            gzip: {
              minFileSize: 0,
              maxFileSize: 1e6,
              cache: { type: 'never' },
            },
          }),
          c => c.text('Hello')
        );
        server = app.listen();
        const resp = await fetch(`${server.url}toGzip/dream.jpg`);
        expect(resp.headers.get('content-encoding')).toBe(null);
      });
    });
  });
});
