import type { Server } from 'bun';
import { beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from '../HttpRouter/HttpRouter';
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
    expect(c.date).toBeInstanceOf(Date);
    expect(c.now).toBeNumber();
    expect(c.url).toBeInstanceOf(URL);
    expect(c.url.pathname).toBe('/home');
    expect(c.locals).toBeTypeOf('object');
  });
  describe('server', () => {
    let c: Context;
    beforeEach(() => {
      const request = new Request('http://localhost/thing');
      const app = new HttpRouter();
      c = new Context(request, server, app);
    });
    it('should return 404 on file not found', async () => {
      const resp = await c.file(`${import.meta.dir}/invalidfile`);
      expect(resp.status).toBe(404);
    });
    it('should include text()', async () => {
      const resp = c.text('Hi');
      expect(await resp.text()).toBe('Hi');
      expect(resp.headers.get('Content-type')).toStartWith('text/plain');
    });
    it('should include js()', async () => {
      const resp = c.js('alert(42)');
      expect(await resp.text()).toBe('alert(42)');
      expect(resp.headers.get('Content-type')).toStartWith('text/javascript');
    });
    it('should include html()', async () => {
      const resp = c.html('<h1>Hi</h1>');
      expect(await resp.text()).toBe('<h1>Hi</h1>');
      expect(resp.headers.get('Content-type')).toStartWith('text/html');
    });
    it('should include css()', async () => {
      const resp = c.css('* { min-width: 0 }');
      expect(await resp.text()).toBe('* { min-width: 0 }');
      expect(resp.headers.get('Content-type')).toStartWith('text/css');
    });
    it('should include xml()', async () => {
      const resp = c.xml('<greeting>Hi</greeting>');
      expect(await resp.text()).toBe('<greeting>Hi</greeting>');
      expect(resp.headers.get('Content-type')).toStartWith('text/xml');
    });
    it('should include json(data)', async () => {
      const resp = c.json({ hello: 'world' });
      expect(await resp.json()).toEqual({ hello: 'world' });
      expect(resp.headers.get('Content-type')).toStartWith('application/json');
    });
    it('should include json(data, init)', async () => {
      const resp = c.json(
        { hello: 'world' },
        {
          headers: {
            'X-Hello': 'World',
          },
        }
      );
      expect(await resp.json()).toEqual({ hello: 'world' });
      expect(resp.headers.get('Content-type')).toStartWith('application/json');
      expect(resp.headers.get('X-Hello')).toBe('World');
    });
    it('should indicate time elapsed', async () => {
      expect(c.took()).toBeGreaterThanOrEqual(0);
      expect(c.took()).toBeLessThanOrEqual(100);
    });
  });
});
