import type { Server } from 'bun';
import { describe, expect, it } from 'bun:test';
import HttpRouter from '../HttpRouter/HttpRouter';
import {
  file,
  html,
  js,
  json,
  redirect,
  text,
  xml,
} from '../HttpRouter/responseFactories.ts';
import Context from './Context';

// @ts-expect-error
const server: Server = {};

describe('Context', () => {
  it('should be constructable', () => {
    const request = new Request('http://localhost/home');
    const app = new HttpRouter();
    const c = new Context(request, server, app);
    expect(c).toBeInstanceOf(Context);
    expect(c.request).toBe(request);
    expect(c.server).toBe(server);
    expect(c.app).toBe(app);
    expect(c.url).toBeInstanceOf(URL);
    expect(c.url.pathname).toBe('/home');
  });
  it('should handle files', async () => {
    const request = new Request('http://localhost/home.html');
    const app = new HttpRouter();
    const c = new Context(request, server, app);
    const resp = await c.file(`${import.meta.dir}/../testFixtures/home.html`);
    expect(resp).toBeInstanceOf(Response);
    expect(resp.headers.get('Accept-Ranges')).toBe('bytes');
    const file = await resp.blob();
    const text = await file.text();
    expect(text).toBe('<h1>Welcome home</h1>\n');
  });
  it('should handle files with range "bytes=0-3"', async () => {
    const request = new Request('http://localhost/home.html', {
      headers: { Range: 'bytes=0-3' },
    });
    const app = new HttpRouter();
    const c = new Context(request, server, app);
    const resp = await c.file(`${import.meta.dir}/../testFixtures/home.html`);
    expect(resp).toBeInstanceOf(Response);
    const file = await resp.blob();
    const text = await file.text();
    expect(resp.status).toBe(200);
    expect(text).toBe('<h1>');
  });
  it('should handle files with range "bytes=0-"', async () => {
    const request = new Request('http://localhost/home.html', {
      headers: { Range: 'bytes=0-' },
    });
    const app = new HttpRouter();
    const c = new Context(request, server, app);
    const resp = await c.file(`${import.meta.dir}/../testFixtures/home.html`);
    expect(resp).toBeInstanceOf(Response);
    const file = await resp.blob();
    const text = await file.text();
    expect(text).toBe('<h1>Welcome home</h1>\n');
  });
  it('should handle files with range "bytes=0-999"', async () => {
    const request = new Request('http://localhost/home.html', {
      headers: { Range: 'bytes=0-999' },
    });
    const app = new HttpRouter();
    const c = new Context(request, server, app);
    const resp = await c.file(`${import.meta.dir}/../testFixtures/home.html`);
    expect(resp).toBeInstanceOf(Response);
    expect(resp.status).toBe(416);
    expect(await resp.text()).toBe('416 Range not satisfiable');
  });
  it('should handle files with range "bytes=-3"', async () => {
    const request = new Request('http://localhost/home.html', {
      headers: { Range: 'bytes=-3' },
    });
    const app = new HttpRouter();
    const c = new Context(request, server, app);
    const resp = await c.file(`${import.meta.dir}/../testFixtures/home.html`);
    expect(resp).toBeInstanceOf(Response);
    expect(resp.status).toBe(200);
    expect(await resp.text()).toBe('<h1>');
  });
  it('should return 404 on file not found', async () => {
    const resp = await file(`${import.meta.dir}/invalidfile`);
    expect(resp.status).toBe(404);
  });
  it('should include text()', async () => {
    const resp = text('Hi');
    expect(await resp.text()).toBe('Hi');
    expect(resp.headers.get('Content-type')).toBe('text/plain');
  });
  it('should include js()', async () => {
    const resp = js('alert(42)');
    expect(await resp.text()).toBe('alert(42)');
    expect(resp.headers.get('Content-type')).toBe('text/javascript');
  });
  it('should include html()', async () => {
    const resp = html('<h1>Hi</h1>');
    expect(await resp.text()).toBe('<h1>Hi</h1>');
    expect(resp.headers.get('Content-type')).toBe('text/html');
  });
  it('should include xml()', async () => {
    const resp = xml('<greeting>Hi</greeting>');
    expect(await resp.text()).toBe('<greeting>Hi</greeting>');
    expect(resp.headers.get('Content-type')).toBe('text/xml');
  });
  it('should include json(data)', async () => {
    const resp = json({ hello: 'world' });
    // @ts-expect-error
    expect(await resp.json()).toEqual({ hello: 'world' });
    expect(resp.headers.get('Content-type')).toBe('application/json');
  });
  it('should include json(data, init)', async () => {
    const resp = json(
      { hello: 'world' },
      {
        headers: {
          'X-Hello': 'World',
        },
      }
    );
    // @ts-expect-error
    expect(await resp.json()).toEqual({ hello: 'world' });
    expect(resp.headers.get('Content-type')).toBe('application/json');
    expect(resp.headers.get('X-Hello')).toBe('World');
  });
  it('should include redirect(url)', () => {
    const resp = redirect('/home');
    expect(resp.headers.get('Location')).toBe('/home');
    expect(resp.status).toBe(302);
  });
  it('should include redirect(url, status)', () => {
    const resp = redirect('/home', 301);
    expect(resp.headers.get('Location')).toBe('/home');
    expect(resp.status).toBe(301);
  });
});
