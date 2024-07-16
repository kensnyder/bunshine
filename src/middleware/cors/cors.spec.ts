import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from '../../HttpRouter/HttpRouter.ts';
import { cors } from './cors.ts';

describe('headers middleware', () => {
  let server: Server;
  let app: HttpRouter;
  let fetchInit: RequestInit;
  beforeEach(() => {
    app = new HttpRouter();
    server = app.listen();
    fetchInit = {
      method: 'OPTIONS',
      headers: {
        Origin: 'google.com',
      },
    };
  });
  afterEach(() => {
    server.stop(true);
  });
  it('should have proper defaults', async () => {
    app.use(cors(), c => c.text('hello'));
    const resp = await fetch(server.url, fetchInit);
    const text = await resp.text();
    expect(text).toBe('');
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(resp.headers.get('Access-Control-Allow-Methods')).toBe(
      'GET,HEAD,PUT,POST,PATCH,DELETE'
    );
  });
  it('should add specific origin', async () => {
    const options = {
      origin: 'example.com',
    };
    app.use(cors(options), c => c.text('hello'));
    const resp = await fetch(server.url, fetchInit);
    const text = await resp.text();
    expect(text).toBe('');
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('example.com');
  });
  it('should add origin on RegExp', async () => {
    const options = {
      origin: /^google.(com|net)$/,
    };
    app.use(cors(options), c => c.text('hello'));
    const resp = await fetch(server.url, fetchInit);
    const text = await resp.text();
    expect(text).toBe('');
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('google.com');
  });
  it('should add origin on Array<string | RegExp>', async () => {
    const options = {
      origin: ['dev.example.com', 'prod.example.com', /^google.(com|net)$/],
    };
    app.use(cors(options), c => c.text('hello'));
    const resp = await fetch(server.url, fetchInit);
    const text = await resp.text();
    expect(text).toBe('');
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('google.com');
  });
  it('should parrot origin if true', async () => {
    const options = {
      origin: true,
    };
    app.use(cors(options), c => c.text('hello'));
    const resp = await fetch(server.url, fetchInit);
    const text = await resp.text();
    expect(text).toBe('');
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('google.com');
  });
  it('should omit origin if false', async () => {
    const options = {
      origin: false,
    };
    app.use(cors(options), c => c.text('hello'));
    const resp = await fetch(server.url, fetchInit);
    const text = await resp.text();
    expect(text).toBe('');
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe(null);
  });
  it('should allow function that returns true', async () => {
    const options = {
      origin: () => true,
    };
    app.use(cors(options), c => c.text('hello'));
    const resp = await fetch(server.url, fetchInit);
    const text = await resp.text();
    expect(text).toBe('');
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('google.com');
  });
  it('should allow function that returns false', async () => {
    const options = {
      origin: () => false,
    };
    app.use(cors(options), c => c.text('hello'));
    const resp = await fetch(server.url, fetchInit);
    const text = await resp.text();
    expect(text).toBe('');
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe(null);
  });
  it('should add other headers', async () => {
    const options = {
      allowMethods: ['GET', 'POST'],
      allowHeaders: ['Foo', 'Bar'],
      exposeHeaders: ['Baz', 'Qux'],
      maxAge: 60 * 30,
    };
    app.use(cors(options), c => c.text('hello'));
    const resp = await fetch(server.url, fetchInit);
    const text = await resp.text();
    expect(text).toBe('');
    expect(resp.headers.get('Access-Control-Allow-Methods')).toBe('GET,POST');
    expect(resp.headers.get('Access-Control-Max-Age')).toBe('1800');
  });
});
