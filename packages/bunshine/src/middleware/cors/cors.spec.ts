import type { Server } from 'bun';
import { beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from '../../HttpRouter/HttpRouter';
import { cors } from './cors';

describe('cors middleware', () => {
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
  it('should have proper defaults', async () => {
    app.use(cors(), c => c.text('hello'));
    const resp = await fetch(server.url, fetchInit);
    const text = await resp.text();
    expect(text).toBe('');
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(resp.headers.get('Access-Control-Allow-Methods')).toBe(
      'GET,HEAD,PUT,POST,PATCH,DELETE,OPTIONS'
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
  it('should allow function that returns string', async () => {
    const options = {
      origin: () => 'google.com',
    };
    app.use(cors(options), c => c.text('hello'));
    const resp = await fetch(server.url, fetchInit);
    const text = await resp.text();
    expect(text).toBe('');
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('google.com');
  });
  it('should ignore function that returns invalid value', async () => {
    const options = {
      origin: () => 123,
    };
    // @ts-expect-error - testing invalid input
    app.use(cors(options), c => c.text('hello'));
    const resp = await fetch(server.url, fetchInit);
    const text = await resp.text();
    expect(text).toBe('');
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe(null);
  });
  it('should allow function-returning arrays (with match)', async () => {
    const options = {
      origin: () => ['example.com', 'google.com'],
    };
    app.use(cors(options), c => c.text('hello'));
    const resp = await fetch(server.url, fetchInit);
    const text = await resp.text();
    expect(text).toBe('');
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('google.com');
  });
  it('should allow arrays (without match)', async () => {
    const options = {
      origin: ['some-other-thing'],
    };
    app.use(cors(options), c => c.text('hello'));
    const resp = await fetch(server.url, fetchInit);
    const text = await resp.text();
    expect(text).toBe('');
    expect(resp.headers.has('Access-Control-Allow-Origin')).toBe(false);
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
    expect(resp.headers.get('Access-Control-Allow-Headers')).toBe('Foo,Bar');
    expect(resp.headers.get('Access-Control-Max-Age')).toBe('1800');
  });
  it('should add headers on GET', async () => {
    const options = {
      origin: '*',
      allowMethods: ['GET', 'POST'],
      allowHeaders: ['Foo', 'Bar'],
      exposeHeaders: ['Baz', 'Qux'],
      maxAge: 60 * 30,
    };
    app.use(cors(options), c => c.text('hello'));
    const resp = await fetch(server.url, {
      headers: {
        Origin: 'google.com',
      },
    });
    const text = await resp.text();
    expect(text).toBe('hello');
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(resp.headers.has('Access-Control-Allow-Methods')).toBe(false);
    expect(resp.headers.get('Access-Control-Expose-Headers')).toBe('Baz,Qux');
  });
  it('should throw on invalid origin option', async () => {
    const thrower = () => {
      const options = {
        origin: new Date(),
      };
      // @ts-expect-error - testing invalid input
      app.use(cors(options), c => c.text('hello'));
    };
    expect(thrower).toThrowError('Invalid cors origin option');
  });
});
