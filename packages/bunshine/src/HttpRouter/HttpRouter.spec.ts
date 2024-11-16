import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import EventSource from 'eventsource';
import HttpRouter from './HttpRouter';

type SseTestEvent = {
  type: string;
  data: string;
  lastEventId?: string;
  origin?: string;
};

// @ts-expect-error
const server: Server = {};

describe('HttpRouter', () => {
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
    it('should allow headGet', async () => {
      app.headGet('/', c => {
        if (c.request.method === 'GET') {
          return c.file(`${import.meta.dirname}/../../testFixtures/home.html`);
        } else {
          return new Response('', {
            headers: {
              'Content-type': 'text/html',
              'Content-length': '22',
            },
          });
        }
      });
      const getResp = await app.fetch(new Request('http://localhost/'), server);
      expect(getResp.status).toBe(200);
      expect(await getResp.text()).toInclude('Welcome home');
      const headResp = await app.fetch(
        new Request('http://localhost/', { method: 'HEAD' }),
        server
      );
      expect(headResp.status).toBe(200);
      expect(await headResp.text()).toBe('');
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
  describe('server', () => {
    let app: HttpRouter;
    let server: Server;
    beforeEach(() => {
      app = new HttpRouter();
    });
    afterEach(() => {
      server.stop(true);
    });
    it('should assign random port', async () => {
      app.get('/', () => new Response('Hi'));
      server = app.listen({ port: 7769 });
      const resp = await fetch(`http://localhost:${server.port}/`);
      expect(typeof server.port).toBe('number');
      expect(server.port).toBeGreaterThan(0);
      expect(resp.status).toBe(200);
      expect(await resp.text()).toBe('Hi');
    });
    it('should get client ip info', async () => {
      app.get('/', c => c.json(c.ip));
      server = app.listen({ port: 7770 });
      const resp = await fetch(`http://localhost:${server.port}/`);
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
      server = app.listen({ port: 7771 });
      let output: string;
      const to = (message: string) => (output = message);
      app.emitUrl({ to });
      // @ts-expect-error
      expect(output).toContain(String(server.url));
    });
    it('should handle all', async () => {
      app.all('/', () => new Response('Hi'));
      server = app.listen({ port: 7772 });
      const resp = await fetch('http://localhost:7772/');
      expect(resp.status).toBe(200);
      expect(await resp.text()).toBe('Hi');
    });
    it('should handle GET', async () => {
      app.get('/', () => new Response('Hi'));
      server = app.listen({ port: 7773 });
      const resp = await fetch('http://localhost:7773/');
      expect(resp.status).toBe(200);
      expect(await resp.text()).toBe('Hi');
    });
    it('should handle PUT', async () => {
      app.put('/', async ({ request, json }) => {
        return json(await request.json());
      });
      server = app.listen({ port: 7774 });
      const resp = await fetch('http://localhost:7774/', {
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
      server = app.listen({ port: 7775 });
      const resp = await fetch('http://localhost:7775/hi?name=Bob', {
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
      server = app.listen({ port: 7776 });
      const formData = new URLSearchParams();
      formData.append('key', 'secret');
      const resp = await fetch('http://localhost:7776/parrot', {
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
      server = app.listen({ port: 7777 });
      const formData = new FormData();
      formData.append('key2', 'secret2');
      const resp = await fetch('http://localhost:7777/parrot', {
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
      server = app.listen({ port: 7778 });
      const resp = await fetch('http://localhost:7778/', {
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
      server = app.listen({ port: 7779 });
      const resp = await fetch('http://localhost:7779/', {
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
      server = app.listen({ port: 7780 });
      const resp = await fetch('http://localhost:7780/users/42', {
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
      server = app.listen({ port: 7781 });
      const resp = await fetch('http://localhost:7781/users/42', {
        method: 'OPTIONS',
      });
      expect(resp.status).toBe(204);
      expect(resp.headers.get('Access-Control-Allow-Methods')).toBe('GET,POST');
    });
    it('should store data on locals', async () => {
      app.get('/home', ({ app }) => {
        return new Response(app.locals.foo);
      });
      server = app.listen({ port: 7782 });
      app.locals.foo = 'bar';
      const resp = await fetch('http://localhost:7782/home');
      expect(resp.status).toBe(200);
      expect(await resp.text()).toBe('bar');
    });
  });
  describe('sse', () => {
    let app: HttpRouter;
    let server: Server;
    beforeEach(() => {
      app = new HttpRouter();
    });
    afterEach(() => {
      server.stop(true);
    });
    function sseTest({
      port,
      payloads,
      event,
      headers = {},
    }: {
      port: number;
      payloads:
        | Array<[string, any, string]>
        | Array<[string, any]>
        | Array<[string]>;
      event: string;
      headers?: Record<string, string>;
    }): Promise<SseTestEvent[]> {
      return new Promise((outerResolve, outerReject) => {
        const events: SseTestEvent[] = [];
        const readyToSend = new Promise((resolve, reject) => {
          app.get('/sse', c => {
            return c.sse(
              send => {
                resolve(() => {
                  for (const payload of payloads) {
                    // @ts-expect-error
                    send(...payload);
                  }
                });
              },
              { headers }
            );
          });
          app.onError(c => reject(c.error));
          server = app.listen({ port });
        }) as Promise<() => void>;
        const readyToListen = new Promise((resolve, reject) => {
          const stream = new EventSource(`http://localhost:${port}/sse`);
          stream.addEventListener('error', evt => {
            reject(evt);
            stream.close();
          });
          stream.addEventListener(event, evt => {
            events.push(evt);
            if (events.length === payloads.length) {
              outerResolve(events);
              stream.close();
            }
          });
          resolve(port);
        }) as Promise<number>;
        Promise.all([readyToSend, readyToListen])
          .then(([doSend]) => doSend())
          .catch(outerReject);
      });
    }
    it('should handle unnamed data', async () => {
      const events = await sseTest({
        event: 'message',
        port: 7784,
        payloads: [['Hello'], ['World']],
      });
      expect(events.length).toBe(2);
      expect(events[0].data).toBe('Hello');
      expect(events[1].data).toBe('World');
    });
    it('should send last event id and origin', async () => {
      const events = await sseTest({
        event: 'myEvent',
        port: 7785,
        payloads: [
          ['myEvent', 'hi1', 'id1'],
          ['myEvent', 'hi2', 'id2'],
        ],
      });
      expect(events.length).toBe(2);
      expect(events[0].data).toBe('hi1');
      expect(events[1].data).toBe('hi2');
      expect(events[0].lastEventId).toBe('id1');
      expect(events[1].lastEventId).toBe('id2');
      expect(events[0].origin).toBe('http://localhost:7785');
      expect(events[1].origin).toBe('http://localhost:7785');
    });
    it('should JSON encode data if needed', async () => {
      const events = await sseTest({
        event: 'myEvent',
        port: 7786,
        payloads: [['myEvent', { name: 'Bob' }]],
      });
      expect(events.length).toBe(1);
      expect(events[0].data).toBe('{"name":"Bob"}');
    });
    it('should warn when overriding some headers', async () => {
      spyOn(console, 'warn').mockImplementation(() => {});
      await sseTest({
        event: 'myEvent',
        port: 7787,
        payloads: [['myEvent', { name: 'Bob' }]],
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'foo',
          Connection: 'whatever',
        },
      });
      expect(console.warn).toHaveBeenCalledTimes(3);
      // @ts-expect-error
      console.warn.mockRestore();
    });
    it('should not warn if those headers are correct', async () => {
      spyOn(console, 'warn').mockImplementation(() => {});
      await sseTest({
        event: 'myEvent',
        port: 7788,
        payloads: [['myEvent', { name: 'Bob' }]],
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
      expect(console.warn).toHaveBeenCalledTimes(0);
      // @ts-expect-error
      console.warn.mockRestore();
    });
  });
});
