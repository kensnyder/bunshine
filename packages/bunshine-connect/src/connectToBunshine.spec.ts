import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { HttpRouter } from 'bunshine';
import {
  ConnectErrorHandler,
  ConnectRouteHandler,
} from '../../connect-to-fetch/src/handler.types';
import connectToBunshine from './connectToBunshine';

describe('connectToBunshine', () => {
  let server: Server;
  let app: HttpRouter;
  let error: Error | null;
  beforeEach(() => {
    app = new HttpRouter();
    app.onError(c => {
      error = c.error;
      if (error && error.message !== 'foobar') {
        console.log(c.error);
      }
    });
    server = app.listen({ port: 0 });
  });
  afterEach(() => {
    server.stop(true);
  });
  it('should run handler', async () => {
    const connectHandler: ConnectRouteHandler = (req, res, next) => {
      res.end('Hello world');
    };
    app.get('/', connectToBunshine(connectHandler));
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(resp.status).toBe(200);
    expect(text).toBe('Hello world');
  });
  it('should run handler after timeout', async () => {
    const connectHandler: ConnectRouteHandler = (req, res, next) => {
      setTimeout(() => res.end('Hello world'), 15);
    };
    app.get('/', connectToBunshine(connectHandler));
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(resp.status).toBe(200);
    expect(text).toBe('Hello world');
  });
  it("should pass thrown errors to Bunshine's onError callback", async () => {
    const connectHandler: ConnectRouteHandler = (req, res, next) => {
      throw new Error('foobar');
    };
    app.get('/', connectToBunshine(connectHandler));
    const resp = await fetch(server.url);
    expect(resp.status).toBe(500);
    expect(error?.message).toBe('foobar');
  });
  it("should pass next() errors to Bunshine's onError callback", async () => {
    const connectHandler: ConnectRouteHandler = (req, res, next) => {
      next('foobar');
    };
    app.get('/', connectToBunshine(connectHandler));
    const resp = await fetch(server.url);
    expect(resp.status).toBe(500);
    expect(error?.message).toBe('foobar');
  });
  it('should handle 404s', async () => {
    const connectHandler: ConnectRouteHandler = (req, res, next) => {
      res.setHeader('fromFunction', 'handler');
      next();
    };
    app.get('/', connectToBunshine(connectHandler));
    const resp = await fetch(server.url);
    expect(resp.status).toBe(404);
    expect(resp.headers.has('fromFunction')).toBe(false);
  });
  it('should run 2 handlers', async () => {
    const connect1: ConnectRouteHandler = (req, res, next) => {
      res.setHeader('Content-type', 'text/html');
      next();
    };
    const connect2: ConnectRouteHandler = (req, res, next) => {
      res.statusCode = 201;
      res.end('<h1>Hello world</h1>');
    };
    app.get('/', connectToBunshine(connect1, connect2));
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(resp.status).toBe(201);
    expect(text).toBe('<h1>Hello world</h1>');
    expect(resp.headers.get('content-type')).toBe('text/html');
  });
  it('should flatten registered handlers', async () => {
    const connect1: ConnectRouteHandler = (req, res, next) => {
      res.setHeader('Content-type', 'text/html');
      next();
    };
    const connect2: ConnectRouteHandler = (req, res, next) => {
      res.statusCode = 201;
      res.end('<h1>Hello world</h1>');
    };
    app.get('/', connectToBunshine([connect1, [connect2]]));
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(resp.status).toBe(201);
    expect(text).toBe('<h1>Hello world</h1>');
    expect(resp.headers.get('content-type')).toBe('text/html');
  });
  it('should ignore "route" and "router" as errors', async () => {
    const connect1: ConnectRouteHandler = (req, res, next) => {
      next('route');
    };
    const connect2: ConnectRouteHandler = (req, res, next) => {
      next('router');
    };
    const connect3: ConnectRouteHandler = (req, res, next) => {
      res.statusCode = 301;
      res.setHeader('Location', '/home');
      res.end('Redirecting...');
    };
    app.get('/', connectToBunshine([connect1, connect2, connect3]));
    const resp = await fetch(server.url, {
      redirect: 'manual',
    });
    expect(resp.status).toBe(301);
    expect(resp.headers.get('Location')).toBe('/home');
  });
  it('should support res.writeHead', async () => {
    const connect1: ConnectRouteHandler = (req, res, next) => {
      res.writeHead(202, { Hello: 'world' });
      next();
    };
    const connect2: ConnectRouteHandler = (req, res, next) => {
      res.end('Hello world');
    };
    app.get('/', connectToBunshine([connect1, connect2]));
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(resp.status).toBe(202);
    expect(text).toBe('Hello world');
    expect(resp.headers.get('Hello')).toBe('world');
  });
  it('should have correct properties on req', async () => {
    const connectHandler: ConnectRouteHandler = (req, res, next) => {
      const body: Uint8Array[] = [];
      req
        .on('data', (chunk: Uint8Array) => {
          body.push(chunk);
        })
        .on('end', () => {
          const json = Buffer.concat(body).toString();
          const payload = JSON.parse(json);
          res.setHeader('Content-type', 'application/json');
          res.end(
            JSON.stringify({
              url: req.url,
              method: req.method,
              payload,
            })
          );
        });
    };
    app.post('/', connectToBunshine(connectHandler));
    const resp = await fetch(server.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foo: 'bar' }),
    });
    const data = await resp.json();
    expect(resp.status).toBe(200);
    expect(data).toEqual({
      url: '/',
      method: 'POST',
      payload: { foo: 'bar' },
    });
  });
  it('should allow registering error handlers', async () => {
    let was2Called = false;
    const connect1: ConnectRouteHandler = (req, res, next) => {
      next('myerror');
    };
    const connect2: ConnectRouteHandler = (req, res, next) => {
      // connect2 should be skipped
      was2Called = true;
      next();
    };
    const connect3: ConnectErrorHandler = (error, req, res, next) => {
      res.statusCode = 500;
      res.end('Caught error ' + error.message);
      next();
    };
    app.get('/', connectToBunshine([connect1, connect2, connect3]));
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(resp.status).toBe(500);
    expect(text).toBe('Caught error myerror');
    expect(was2Called).toBe(false);
  });
  it('should allow error handlers to catch thrown errors', async () => {
    let was2Called = false;
    const connect1: ConnectRouteHandler = (req, res, next) => {
      throw new Error('myerror');
    };
    const connect2: ConnectRouteHandler = (req, res, next) => {
      // connect2 should be skipped
      was2Called = true;
      next();
    };
    const connect3: ConnectErrorHandler = (error, req, res, next) => {
      res.statusCode = 500;
      res.end('Caught error ' + error.message);
      next();
    };
    app.get('/', connectToBunshine([connect1, connect2, connect3]));
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(resp.status).toBe(500);
    expect(text).toBe('Caught error myerror');
    expect(was2Called).toBe(false);
  });
  it('should skip error handlers when registered first', async () => {
    let was1Called = false;
    const connect1: ConnectErrorHandler = (error, req, res, next) => {
      was1Called = true;
      next();
    };
    const connect2: ConnectRouteHandler = (req, res, next) => {
      res.end('2');
    };
    app.get('/', connectToBunshine([connect1, connect2]));
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(resp.status).toBe(200);
    expect(text).toBe('2');
    expect(was1Called).toBe(false);
  });
  it('should pass to next bunshine handlers', async () => {
    let was1Called = false;
    const connect1: ConnectRouteHandler = (req, res, next) => {
      was1Called = true;
      next();
    };
    app.get('/', connectToBunshine(connect1), c => {
      return c.text('Bunshine!');
    });
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(resp.status).toBe(200);
    expect(text).toBe('Bunshine!');
    expect(was1Called).toBe(true);
  });
  it('should allow multiple groups of handlers', async () => {
    let was1Called = false;
    const connect1: ConnectRouteHandler = (req, res, next) => {
      was1Called = true;
      res.setHeader('Content-type', 'text/html');
      next();
    };
    app.get('/', connectToBunshine(connect1), c => {
      return c.text('Bunshine!');
    });
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(resp.status).toBe(200);
    expect(text).toBe('Bunshine!');
    expect(was1Called).toBe(true);
  });
});
