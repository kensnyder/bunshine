import { describe, expect, it } from 'bun:test';
import factory from './factory';

describe('factory()', () => {
  it('should add content-type', async () => {
    const html = factory('text/html');
    const resp = html('<p>Hello</p>');
    expect(resp.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(resp.headers.get('Content-Length')).toBe('12');
    expect(await resp.text()).toBe('<p>Hello</p>');
  });
  it('should allow custom mime types', async () => {
    const custom = factory('foo/bar');
    const resp = custom('yes');
    expect(resp.headers.get('Content-Type')).toBe('foo/bar; charset=utf-8');
    expect(resp.headers.get('Content-Length')).toBe('3');
    expect(await resp.text()).toBe('yes');
  });
});
