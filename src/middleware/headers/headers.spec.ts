import type { Server } from 'bun';
import { beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from '../../HttpRouter/HttpRouter';
import { headers } from './headers';

describe('headers middleware', () => {
  let server: Server;
  let app: HttpRouter;
  beforeEach(() => {
    app = new HttpRouter();
    server = app.listen();
  });
  it('should add string header', async () => {
    app.get('/', headers({ 'Foo-Bar': 'Baz' }), c => c.text('hello'));
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(text).toBe('hello');
    expect(resp.headers.get('Foo-Bar')).toBe('Baz');
  });
  it('should add resolved header (string)', async () => {
    app.get('/', headers({ 'X-Method': c => c.request.method }), c =>
      c.text('hello')
    );
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(text).toBe('hello');
    expect(resp.headers.get('X-Method')).toBe('GET');
  });
  it('should NOT add resolved header (null)', async () => {
    app.get('/', headers({ 'X-Method': () => null }), c => c.text('hello'));
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(text).toBe('hello');
    expect(resp.headers.has('X-Method')).toBe(false);
  });
  it('should conditionally add headers (with false)', async () => {
    app.get(
      '/',
      headers({ Foo: 'bar' }, () => false),
      c => c.text('hello')
    );
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(text).toBe('hello');
    expect(resp.headers.get('Foo')).toBe(null);
  });
  it('should conditionally add headers (with true)', async () => {
    app.get(
      '/',
      headers({ Foo: 'bar' }, () => true),
      c => c.text('hello')
    );
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(text).toBe('hello');
    expect(resp.headers.get('Foo')).toBe('bar');
  });
  it('should conditionally add headers (with Promise(true))', async () => {
    app.get(
      '/',
      headers({ Foo: 'bar' }, () => Promise.resolve(true)),
      c => c.text('hello')
    );
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(text).toBe('hello');
    expect(resp.headers.get('Foo')).toBe('bar');
  });
  it('should ignore resolvers that throw', async () => {
    const doThrow = () => {
      throw new Error('');
    };
    app.get('/', headers({ Foo: doThrow }), c => c.text('hello'));
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(text).toBe('hello');
    expect(resp.headers.has('Foo')).toBe(false);
  });
  it('should catch conditional function exceptions', async () => {
    const doThrow = () => {
      throw new Error('');
    };
    app.get('/', headers({ Foo: 'bar' }, doThrow), c => c.text('hello'));
    const resp = await fetch(server.url);
    const text = await resp.text();
    expect(text).toBe('hello');
    expect(resp.headers.has('Foo')).toBe(false);
  });
});
