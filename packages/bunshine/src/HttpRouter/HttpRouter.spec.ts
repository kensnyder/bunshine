import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from './HttpRouter';

// @ts-expect-error
const server: Server = {};

describe('HttpRouter', () => {
  let port = 50100;
  describe('handlers', () => {
    let app: HttpRouter;
    let oldEnv: string | undefined;
    beforeEach(() => {
      app = new HttpRouter();
      oldEnv = Bun.env.NODE_ENV;
    });
    afterEach(() => {
      Bun.env.NODE_ENV = oldEnv;
    });
    it('should respond to GET', async () => {
      app.get('/', () => new Response('Hi'));
      const resp = await app.fetch(new Request('http://localhost/'), server);
      expect(resp.status).toBe(200);
      expect(await resp.text()).toBe('Hi');
    });
    it('should flatten handlers', async () => {
      let i = 0;
      const inc = () => {
        i++;
      };
      app.get('/', [[inc, inc, [inc]], inc], inc, () => new Response('Hi'));
      const resp = await app.fetch(new Request('http://localhost/'), server);
      expect(i).toBe(5);
      expect(resp.status).toBe(200);
      expect(await resp.text()).toBe('Hi');
    });
    it('should support X-HTTP-Method-Override', async () => {
      app.put('/home', () => new Response('Hi'));
      const resp = await app.fetch(
        new Request('http://localhost/home', {
          headers: {
            'X-HTTP-Method-Override': 'PUT',
          },
        }),
        server
      );
      expect(resp.status).toBe(200);
      expect(await resp.text()).toBe('Hi');
    });
    it('should allow registering 404 handler', async () => {
      app.on404(() => new Response('Sad Face', { status: 404 }));
      app.get('/', () => new Response('Hi'));
      const resp = await app.fetch(
        new Request('http://localhost/home'),
        server
      );
      expect(resp.status).toBe(404);
      expect(await resp.text()).toBe('Sad Face');
    });
    it('should handle fallback 404', async () => {
      app.get('/', () => new Response('Hi'));
      const resp = await app.fetch(
        new Request('http://localhost/home'),
        server
      );
      expect(resp.status).toBe(404);
      expect(resp.headers.get('Content-type')).toBe('text/plain');
      expect(await resp.text()).toBe('404 Not Found');
    });
    it('should handle fallback 404 in dev', async () => {
      Bun.env.NODE_ENV = 'development';
      app.get('/', () => new Response('Hi'));
      const resp = await app.fetch(
        new Request('http://localhost/home'),
        server
      );
      expect(resp.status).toBe(404);
      expect(resp.headers.get('Content-type')).toBe('text/html');
      expect(resp.headers.get('Reason')).toBe(
        'Handlers failed to return a Response'
      );
      expect(await resp.text()).toContain('<h1>404 Not Found</h1>');
    });
    it('should allow registering 500 handler', async () => {
      app.onError(() => new Response('Bad news', { status: 502 }));
      app.get('/', () => {
        throw new Error('Oops');
      });
      const resp = await app.fetch(new Request('http://localhost/'), server);
      expect(await resp.text()).toBe('Bad news');
      expect(resp.status).toBe(502);
    });
    it('should handle fallback 500', async () => {
      app.get('/', () => {
        throw new Error('Oops');
      });
      const resp = await app.fetch(new Request('http://localhost/'), server);
      expect(resp.headers.get('Content-type')).toBe('text/plain');
      expect(resp.status).toBe(500);
      expect(await resp.text()).toBe('500 Server Error');
    });
    it('should handle fallback 500 in dev', async () => {
      Bun.env.NODE_ENV = 'development';
      app.get('/', () => {
        throw new Error('Oops');
      });
      const resp = await app.fetch(new Request('http://localhost/'), server);
      expect(resp.headers.get('Content-type')).toBe('text/html');
      expect(resp.status).toBe(500);
      expect(await resp.text()).toContain('<h1>500 Server Error</h1>');
    });
    it('should allow throwing response', async () => {
      app.get('/', () => {
        throw new Response(null, {
          status: 302,
          headers: {
            Location: '/home',
          },
        });
      });
      const resp = await app.fetch(new Request('http://localhost/'), server);
      expect(resp.status).toBe(302);
      expect(resp.headers.get('location')).toBe('/home');
    });
    it('should extract params', async () => {
      app.get('/users/:id', c => {
        throw new Response(c.params.id, {
          status: 200,
          headers: {
            'Content-type': 'text/plain',
          },
        });
      });
      const resp = await app.fetch(
        new Request('http://localhost/users/1337'),
        server
      );
      expect(resp.status).toBe(200);
      expect(await resp.text()).toBe('1337');
    });
    it('should give params for * routes', async () => {
      app.get('/abc/*', c => {
        throw new Response(c.params[0], {
          status: 200,
          headers: {
            'Content-type': 'text/plain',
          },
        });
      });
      const resp = await app.fetch(
        new Request('http://localhost/abc/index.html'),
        server
      );
      expect(resp.status).toBe(200);
      expect(await resp.text()).toBe('index.html');
    });
    it('should allow registering multiple methods', async () => {
      app.on(['POST', 'PUT'], '/user', c => {
        return new Response('Method was ' + c.request.method);
      });
      const resp = await app.fetch(
        new Request('http://localhost/user', { method: 'POST' }),
        server
      );
      expect(resp.status).toBe(200);
      expect(await resp.text()).toBe('Method was POST');
      const resp2 = await app.fetch(
        new Request('http://localhost/user', { method: 'PUT' }),
        server
      );
      expect(resp2.status).toBe(200);
      expect(await resp2.text()).toBe('Method was PUT');
    });
    it('should allow RegExp paths', async () => {
      app.get(/^\/user\/(.+)\/(.+)/, c => {
        return new Response(
          JSON.stringify({
            pathname: c.url.pathname,
            params: c.params,
          }),
          {
            headers: {
              'Content-type': 'application/json',
            },
          }
        );
      });
      const resp = await app.fetch(
        new Request('http://localhost/user/123/account'),
        server
      );
      expect(resp.status).toBe(200);
      expect(await resp.json()).toEqual({
        pathname: '/user/123/account',
        params: {
          '0': '123',
          '1': 'account',
        },
      });
    });
  });
  describe('middleware', () => {
    let app: HttpRouter;
    beforeEach(() => {
      app = new HttpRouter();
    });
    it('should allow returning', async () => {
      app.get('*', () => new Response('Unauthorized', { status: 401 }));
      app.get('/', () => new Response('Hi'));
      const resp = await app.fetch(new Request('http://localhost/'), server);
      expect(resp.status).toBe(401);
      expect(await resp.text()).toBe('Unauthorized');
    });
    it('should allow registration with with .use()', async () => {
      app.use(() => new Response('Unauthorized', { status: 401 }));
      app.get('/', () => new Response('Hi'));
      const resp = await app.fetch(new Request('http://localhost/'), server);
      expect(resp.status).toBe(401);
      expect(await resp.text()).toBe('Unauthorized');
    });
    it('should allow doing nothing', async () => {
      app.get('*', () => {});
      app.get('/', () => new Response('Hi'));
      const resp = await app.fetch(new Request('http://localhost/'), server);
      expect(resp.status).toBe(200);
      expect(await resp.text()).toBe('Hi');
    });
    it('should allow altering response', async () => {
      app.get('*', async (_, next) => {
        const resp = await next();
        resp.headers.set('x-powered-by', 'bun');
        return resp;
      });
      app.get('/', () => new Response('Hi'));
      const resp = await app.fetch(new Request('http://localhost/'), server);
      expect(resp.status).toBe(200);
      expect(await resp.text()).toBe('Hi');
      expect(resp.headers.get('x-powered-by')).toBe('bun');
    });
    it('should allow inspection but returning a different response', async () => {
      app.get('*', async (_, next) => {
        await next();
        return new Response('Unauthorized', { status: 401 });
      });
      app.get('/', () => new Response('Hi'));
      const resp = await app.fetch(new Request('http://localhost/'), server);
      expect(resp.status).toBe(401);
      expect(await resp.text()).toBe('Unauthorized');
    });
    it('should allow registering multiple verbs', async () => {
      app.on(['GET', 'POST'], '/user', () => new Response('Hi'));
      const resp = await app.fetch(
        new Request('http://localhost/user'),
        server
      );
      expect(resp.status).toBe(200);
      expect(await resp.text()).toBe('Hi');
      const resp2 = await app.fetch(
        new Request('http://localhost/user', {
          method: 'POST',
        }),
        server
      );
      expect(resp2.status).toBe(200);
      expect(await resp2.text()).toBe('Hi');
    });
  });
  describe('listening', () => {
    let server: Server;
    afterEach(() => {
      server.stop(true);
    });
    it('should assign random port', async () => {
      const app = new HttpRouter();
      server = app.listen();
      app.get('/', () => new Response('Hi'));
      const resp = await fetch(server.url);
      expect(typeof server.port).toBe('number');
      expect(server.port).toBeGreaterThan(0);
      expect(resp.status).toBe(200);
      expect(await resp.text()).toBe('Hi');
    });
  });
  describe('server', () => {
    let app: HttpRouter;
    let server: Server;
    beforeEach(() => {
      app = new HttpRouter();
      server = app.listen({ port: port++ });
    });
    afterEach(() => {
      server.stop(true);
    });
    it('should get client ip info', async () => {
      app.get('/', c => c.json(c.ip));
      const resp = await fetch(server.url);
      const info = (await resp.json()) as {
        address: string;
        family: string;
        port: number;
      };
      expect(info.address).toBe('::1');
      expect(info.family).toBe('IPv6');
      expect(info.port).toBeGreaterThan(0);
    });
    it('should emit url', async () => {
      app.all('/', () => new Response('Hi'));
      let output: string = '';
      const to = (message: string) => (output = message);
      app.emitUrl({ to });
      expect(output).toContain(String(server.url));
    });
    it('should handle all', async () => {
      app.all('/', () => new Response('Hi'));
      const resp = await fetch(server.url);
      expect(resp.status).toBe(200);
      expect(await resp.text()).toBe('Hi');
    });
    it('should handle GET', async () => {
      app.get('/', () => new Response('Hi'));
      const resp = await fetch(server.url);
      expect(resp.status).toBe(200);
      expect(await resp.text()).toBe('Hi');
    });
    it('should handle PUT', async () => {
      app.put('/', async ({ request, json }) => {
        return json(await request.json());
      });
      const resp = await fetch(server.url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Alice' }),
      });
      const body = await resp.json();
      expect(resp.status).toBe(200);
      expect(body).toEqual({ name: 'Alice' });
    });
    it('should handle HEAD', async () => {
      app.head('/hi', ({ url }) => {
        const name = url.searchParams.get('name');
        return new Response(null, {
          status: 204,
          headers: {
            'Content-length': '0',
            Message: `Hi ${name}`,
          },
        });
      });
      const resp = await fetch(`${server.url}/hi?name=Bob`, {
        method: 'HEAD',
      });
      expect(resp.status).toBe(204);
      expect(resp.headers.get('Message')).toBe('Hi Bob');
    });
    it('should handle POST', async () => {
      app.post('/parrot', async ({ request }) => {
        const formData = await request.formData();
        const json = JSON.stringify(Object.fromEntries(formData));
        return new Response(json, {
          status: 200,
          headers: {
            'Content-type': 'application/json',
          },
        });
      });
      const formData = new URLSearchParams();
      formData.append('key', 'secret');
      const resp = await fetch(`${server.url}/parrot`, {
        method: 'POST',
        headers: {
          'Content-type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });
      expect(resp.status).toBe(200);
      expect(await resp.json()).toEqual({ key: 'secret' });
    });
    it('should handle POST', async () => {
      app.post('/parrot', async ({ request }) => {
        const formData = await request.formData();
        const json = JSON.stringify(Object.fromEntries(formData));
        return new Response(json, {
          status: 200,
          headers: {
            'Content-type': 'application/json',
          },
        });
      });
      const formData = new FormData();
      formData.append('key2', 'secret2');
      const resp = await fetch(`${server.url}/parrot`, {
        method: 'POST',
        body: formData,
      });
      expect(resp.status).toBe(200);
      expect(await resp.json()).toEqual({ key2: 'secret2' });
    });
    it('should handle PATCH', async () => {
      app.patch('/', async ({ request, json }) => {
        return json(await request.json());
      });
      const resp = await fetch(server.url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Charlie' }),
      });
      const body = await resp.json();
      expect(resp.status).toBe(200);
      expect(body).toEqual({ name: 'Charlie' });
    });
    it('should handle TRACE', async () => {
      let body: { name: string } = { name: '' };
      app.trace('/', () => {
        return new Response(null, {
          headers: {
            'Content-type': 'message/http',
          },
        });
      });
      const resp = await fetch(server.url, {
        method: 'TRACE',
        headers: {
          'Max-Forwards': '0',
        },
      });
      expect(resp.status).toBe(200);
      expect(resp.headers.get('Content-type')).toBe('message/http');
    });
    it('should handle DELETE', async () => {
      let id: string = 'N/A';
      app.delete('/users/:id', ({ params }) => {
        id = params.id;
        return new Response(null, {
          status: 204,
          headers: {
            'Content-type': 'application/json',
          },
        });
      });
      const resp = await fetch(`${server.url}/users/42`, {
        method: 'DELETE',
      });
      expect(resp.status).toBe(204);
      expect(id).toBe('42');
    });
    it('should handle OPTIONS', async () => {
      app.options('*', () => {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Methods': 'GET,POST',
          },
        });
      });
      const resp = await fetch(`${server.url}/users/42`, {
        method: 'OPTIONS',
      });
      expect(resp.status).toBe(204);
      expect(resp.headers.get('Access-Control-Allow-Methods')).toBe('GET,POST');
    });
    it('should store data on locals', async () => {
      app.get('/home', ({ app }) => {
        return new Response(app.locals.foo);
      });
      app.locals.foo = 'bar';
      const resp = await fetch(`${server.url}/home`);
      expect(resp.status).toBe(200);
      expect(await resp.text()).toBe('bar');
    });
  });
});
