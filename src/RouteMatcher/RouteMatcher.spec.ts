import { beforeEach, describe, expect, it } from 'bun:test';
import RouteMatcher from './RouteMatcher';

describe('RouteMatcher', () => {
  let matcher: RouteMatcher<number>;
  beforeEach(() => {
    matcher = new RouteMatcher();
  });
  it('should be a class', () => {
    expect(matcher).toBeInstanceOf(RouteMatcher);
  });
  it('should require method to match', () => {
    matcher.add('POST', '*', 42);
    const found = matcher.match('GET', '/blog');
    expect(found).toEqual([]);
  });
  it('should match star', () => {
    matcher.add('GET', '*', 42);
    const found = matcher.match('GET', '/blog');
    expect(found).toEqual([[42, { '0': '/blog' }]]);
  });
  it('should match slash star', () => {
    matcher.add('OPTIONS', '/*', 42);
    const found = matcher.match('OPTIONS', '/blog');
    expect(found).toEqual([[42, { '0': 'blog' }]]);
  });
  it('should require match name to match \\d', () => {
    matcher.add('GET', '/embed/:name.js', 42);
    const found = matcher.match('GET', '/embed/123.js');
    expect(found).toEqual([[42, { name: '123' }]]);
  });
  it('should match RegExp', () => {
    matcher.add('GET', /^\/author\/([a-z]+)/, 42);
    const found = matcher.match('GET', '/author/bob');
    expect(found).toEqual([[42, { '0': 'bob' }]]);
  });
  it('should avoid match RegExp', () => {
    matcher.add('GET', /foo/, 42);
    const found = matcher.match('GET', '/author/123');
    expect(found).toEqual([]);
  });
  it('should handle fixed URLs', () => {
    matcher.add('GET', '/home', 123);
    const found = matcher.match('GET', '/home');
    expect(found).toEqual([[123, {}]]);
  });
  it('should support ALL method', () => {
    matcher.add('ALL', '/home', 123);
    const found = matcher.match('GET', '/home');
    expect(found).toEqual([[123, {}]]);
  });
  it('should match path plus star', () => {
    matcher.add('PATCH', '/blog/*', 42);
    const found = matcher.match('PATCH', '/blog/123');
    expect(found).toEqual([[42, { '0': '123' }]]);
  });
  it('should match multiple stars', () => {
    matcher.add('GET', '/author/*/blog/*', 42);
    const found = matcher.match('GET', '/author/123/blog/456');
    expect(found).toEqual([[42, { '0': '123', '1': '456' }]]);
  });
  it('should match multiple routes', () => {
    matcher.add('GET', '/home', 123);
    matcher.add('GET', '/home', 456);
    const found = matcher.match('GET', '/home');
    expect(found).toEqual([
      [123, {}],
      [456, {}],
    ]);
  });
  it('should match 1 named route', () => {
    matcher.add('GET', '/blog/:id', 42);
    const found = matcher.match('GET', '/blog/123');
    expect(found).toEqual([[42, { id: '123' }]]);
  });
  it('should match 2 named routes', () => {
    matcher.add('GET', '/author/:authorId/blog/:postId', 42);
    const found = matcher.match('GET', '/author/123/blog/456');
    expect(found).toEqual([[42, { authorId: '123', postId: '456' }]]);
  });
  it('should match mix of stars and named routes', () => {
    matcher.add('GET', '/author/:authorId/blog/*', 42);
    const found = matcher.match('GET', '/author/123/blog/title');
    expect(found).toEqual([[42, { authorId: '123', '0': 'title' }]]);
  });
  it('should treat trailing stars as true wildcards', () => {
    matcher.add('GET', '/author/:authorId/blog/*', 42);
    const found = matcher.match('GET', '/author/123/blog/title/2024');
    expect(found).toEqual([[42, { authorId: '123', '0': 'title/2024' }]]);
  });
  it('should match star in middle', () => {
    matcher.add('GET', '/blog/*/comments', 42);
    const found = matcher.match('GET', '/blog/123/comments');
    expect(found).toEqual([[42, { 0: '123' }]]);
  });
});
