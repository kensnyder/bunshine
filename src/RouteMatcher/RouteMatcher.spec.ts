import { beforeEach, describe, expect, it } from 'bun:test';
// @ts-expect-error
import pretty from 'pretty-var-export';
import { RouteMatcher } from './RouteMatcher';

describe.skip('RouteMatcher', () => {
  let matcher: RouteMatcher<number>;
  beforeEach(() => {
    matcher = new RouteMatcher<number>();
  });
  it('should handle one segment', () => {
    matcher.add('/home', 123);
    const found = matcher.match('/home');
    expect(found).toEqual([{ payload: 123, params: {} }]);
  });
  it('should filter two routes with one segment', () => {
    matcher.add('/home', 123);
    matcher.add('/jobs', 456);
    const found = matcher.match('/home');
    expect(found).toEqual([{ payload: 123, params: {} }]);
  });
  it('should handle two segments', () => {
    matcher.add('/home/blog', 123);
    const found = matcher.match('/home/blog');
    expect(found).toEqual([{ payload: 123, params: {} }]);
  });
  it('should handle star', () => {
    matcher.add('*', 123);
    const found = matcher.match('/home/blog/list');
    expect(found).toEqual([
      { payload: 123, params: { '0': 'home/blog/list' } },
    ]);
  });
  it('should handle star in second segment', () => {
    matcher.add('/blog/*', 123);
    const found = matcher.match('/blog/author/123');
    expect(found).toEqual([{ payload: 123, params: { '0': 'author/123' } }]);
  });
  it('should handle named segment', () => {
    matcher.add('/blog/:id', 123);
    const found = matcher.match('/blog/abc');
    pretty.log(matcher.node);
    expect(found).toEqual([{ payload: 123, params: { id: 'abc' } }]);
  });
  it('should handle segments after the named segment', () => {
    matcher.add('/blog/:tag/posts', 123);
    const found = matcher.match('/blog/tech/posts');
    pretty.log(matcher.node);
    expect(found).toEqual([{ payload: 123, params: { tag: 'tech' } }]);
  });
});
