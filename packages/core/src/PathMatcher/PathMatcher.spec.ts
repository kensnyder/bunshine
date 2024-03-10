import { beforeEach, describe, expect, it } from 'bun:test';
import PathMatcher from './PathMatcher';

describe('PathMatcher', () => {
  let matcher: PathMatcher<number>;
  beforeEach(() => {
    matcher = new PathMatcher();
  });
  it('should handle fixed URLs', () => {
    matcher.add('/home', 123);
    const found = [...matcher.match('/home')];
    expect(found).toEqual([{ target: 123, params: {} }]);
  });
  it('should match multiple routes', () => {
    matcher.add('/home', 123);
    matcher.add('/home', 456);
    const found = [...matcher.match('/home')];
    expect(found).toEqual([
      { target: 123, params: {} },
      { target: 456, params: {} },
    ]);
  });
  it('should match star', () => {
    matcher.add('/blog/*', 42);
    const found = [...matcher.match('/blog/123')];
    expect(found).toEqual([{ target: 42, params: { 0: '123' } }]);
  });
  it('should match star in middle', () => {
    matcher.add('/blog/*/comments', 42);
    const found = [...matcher.match('/blog/123/comments')];
    expect(found).toEqual([{ target: 42, params: { 0: '123' } }]);
  });
  it('should match star in middle', () => {
    matcher.add('/blog/*/comments', 42);
    const found = [...matcher.match('/blog/123/comments')];
    expect(found).toEqual([{ target: 42, params: { 0: '123' } }]);
  });
  it('should match optional star in middle', () => {
    matcher.add('/blog/*?/comments', 42);
    const found = [
      ...matcher.match('/blog/123/comments'),
      ...matcher.match('/blog/comments'),
    ];
    expect(found).toEqual([
      { target: 42, params: { 0: '123' } },
      { target: 42, params: {} },
    ]);
  });
  it('should match \\d', () => {
    matcher.add('/blog/(\\d+)?/comments', 42);
    const found = [
      ...matcher.match('/blog/123/comments'),
      ...matcher.match('/blog/comments'),
      ...matcher.match('/blog/abc/comments'),
    ];
    expect(found).toEqual([
      { target: 42, params: { 0: '123' } },
      { target: 42, params: {} },
    ]);
  });
  it('should match [a-z]', () => {
    matcher.add('/author/([a-z]+)', 42);
    const found = [
      ...matcher.match('/author/bob'),
      ...matcher.match('/author/Bob'),
      ...matcher.match('/author/123'),
    ];
    expect(found).toEqual([{ target: 42, params: { 0: 'bob' } }]);
  });
  it('should handle pipes', () => {
    matcher.add('/(user|u)/:id', 42);
    const found = [...matcher.match('/user/123'), ...matcher.match('/u/123')];
    expect(found).toEqual([
      { target: 42, params: { 0: 'user', id: '123' } },
      { target: 42, params: { 0: 'u', id: '123' } },
    ]);
  });
  it('should handle optional named params', () => {
    matcher.add('/:attr1?{-:attr2}?{-:attr3}?', 42);
    const found = [
      ...matcher.match('/a'),
      ...matcher.match('/a-b'),
      ...matcher.match('/a-b-c'),
    ];
    expect(found).toEqual([
      { target: 42, params: { attr1: 'a' } },
      { target: 42, params: { attr1: 'a', attr2: 'b' } },
      { target: 42, params: { attr1: 'a', attr2: 'b', attr3: 'c' } },
    ]);
  });
});
