import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { HttpRouter } from 'bunshine';
import connectToBunshine from './connectToBunshine';

describe('connectToBunshine', () => {
  let server: Server;
  let app: HttpRouter;
  let error: Error | null;
  beforeEach(() => {
    app = new HttpRouter();
    error = null;
    app.onError(c => {
      error = c.error;
      if (error.message !== 'foobar') {
        console.log(c.error);
      }
    });
    server = app.listen();
  });
  afterEach(() => {
    server.stop(true);
  });
  it('should run handler', async () => {
    const connectHandler = (req, res, next) => {
      res.end('Hello world');
    };
    app.get('/', connectToBunshine(connectHandler));
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(resp.status).toBe(200);
    expect(text).toBe('Hello world');
  });
  it('should run handler after timeout', async () => {
    const connectHandler = (req, res, next) => {
      setTimeout(() => res.end('Hello world'), 15);
    };
    app.get('/', connectToBunshine(connectHandler));
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(resp.status).toBe(200);
    expect(text).toBe('Hello world');
  });
  it("should pass errors to Bunshine's onError callback", async () => {
    const connectHandler = (req, res, next) => {
      throw new Error('foobar');
    };
    app.get('/', connectToBunshine(connectHandler));
    const resp = await fetch(server.url);
    expect(resp.status).toBe(500);
    expect(error.message).toBe('foobar');
  });
  it('should run 2 handlers', async () => {
    const connect1 = (req, res, next) => {
      res.setHeader('Content-type', 'text/html');
      next();
    };
    const connect2 = (req, res, next) => {
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
    const connect1 = (req, res, next) => {
      res.setHeader('Content-type', 'text/html');
      next();
    };
    const connect2 = (req, res, next) => {
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
    const connect1 = (req, res, next) => {
      next('route');
    };
    const connect2 = (req, res, next) => {
      next('router');
    };
    const connect3 = (req, res, next) => {
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
  it('should have correct properties on req', async () => {
    const connectHandler = (req, res, next) => {
      const body = [];
      req
        .on('data', (chunk: Buffer) => {
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
});
