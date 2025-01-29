import type { Server } from 'bun';
import { afterEach, describe, expect, it } from 'bun:test';
import connectToFetch from './connectToFetch';
import { ConnectErrorHandler, ConnectRouteHandler } from './handler.types';

describe('connectToBunshine', () => {
  let server: Server;
  afterEach(() => {
    server.stop(true);
  });
  it('should run handler', async () => {
    const connectHandler: ConnectRouteHandler = (req, res, next) => {
      res.end('Hello world');
    };
    server = Bun.serve({
      fetch: connectToFetch(connectHandler),
      port: 0,
    });
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(resp.status).toBe(200);
    expect(text).toBe('Hello world');
  });
  it('should run handler after timeout', async () => {
    const connectHandler: ConnectRouteHandler = (req, res, next) => {
      setTimeout(() => res.end('Hello world'), 15);
    };
    server = Bun.serve({
      fetch: connectToFetch(connectHandler),
      port: 0,
    });
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(resp.status).toBe(200);
    expect(text).toBe('Hello world');
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
    server = Bun.serve({
      fetch: connectToFetch(connect1, connect2),
      port: 0,
    });
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
    server = Bun.serve({
      fetch: connectToFetch([connect1, [connect2]]),
      port: 0,
    });
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
    server = Bun.serve({
      fetch: connectToFetch(connect1, connect2, connect3),
      port: 0,
    });
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
    server = Bun.serve({
      fetch: connectToFetch([connect1, connect2]),
      port: 0,
    });
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(resp.status).toBe(202);
    expect(text).toBe('Hello world');
    expect(resp.headers.get('Hello')).toBe('world');
  });
  it('should support res.writeHead with status text', async () => {
    const connect1: ConnectRouteHandler = (req, res, next) => {
      res.writeHead(400, 'Bad Request', { Hello: 'world' });
      next();
    };
    const connect2: ConnectRouteHandler = (req, res, next) => {
      res.end('Hello world');
    };
    server = Bun.serve({
      fetch: connectToFetch([connect1, connect2]),
      port: 0,
    });
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(resp.status).toBe(400);
    expect(resp.statusText).toBe('Bad Request');
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
    server = Bun.serve({
      fetch: connectToFetch(connectHandler),
      port: 0,
    });
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
    server = Bun.serve({
      fetch: connectToFetch([connect1, connect2, connect3]),
      port: 0,
    });
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
    server = Bun.serve({
      fetch: connectToFetch([connect1, connect2, connect3]),
      port: 0,
    });
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(resp.status).toBe(500);
    expect(text).toBe('Caught error myerror');
    expect(was2Called).toBe(false);
  });
  it('should skip error handlers when registered first', async () => {
    let was1Called = false;
    const connect1: ConnectErrorHandler = (error, req, res, next) => {
      // connect1 should be skipped
      was1Called = true;
      next();
    };
    const connect2: ConnectRouteHandler = (req, res, next) => {
      res.end('2');
    };
    server = Bun.serve({
      fetch: connectToFetch([connect1, connect2]),
      port: 0,
    });
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(resp.status).toBe(200);
    expect(text).toBe('2');
    expect(was1Called).toBe(false);
  });
});
