import { bench, group, run } from 'mitata';
import MatcherWithCache from '../src/MatcherWithCache/MatcherWithCache.ts';
import PathMatcher from '../src/PathMatcher/PathMatcher.ts';

group('lru cache speed', () => {
  function withCacheSize(size: number) {
    const matcher =
      size === 0
        ? new PathMatcher()
        : new MatcherWithCache(new PathMatcher(), size);
    return setup(matcher);
  }
  // cache size of 5000 is best, averaging 40x faster than no cache
  bench('no cache', withCacheSize(0));
  bench('cache size 500', withCacheSize(500));
  bench('cache size 2500', withCacheSize(2500));
  bench('cache size 3000', withCacheSize(3000));
  bench('cache size 4000', withCacheSize(4000));
  bench('cache size 5000', withCacheSize(5000));
  bench('cache size 10000', withCacheSize(8000));
});

await run();

function setup(matcher: any) {
  const urls: string[] = [];

  function add(path: string, count?: number, min?: number, max?: number) {
    matcher.add(path, _getFn());
    generateUrls(path, count, min, max);
  }

  function _getFn() {
    const rand = Math.random();
    return () => rand;
  }

  // generate a number of urls
  function generateUrls(
    template: string,
    count?: number,
    min?: number,
    max?: number
  ) {
    if (!count || !min || !max) {
      return;
    }
    for (let i = 0; i < count; i++) {
      urls.push(
        template.replace(/(:\w+)/g, () => {
          return String(randomInt(min, max));
        })
      );
    }
  }

  // generate a random integer between min and max
  function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  add('/(.*)');
  add('/(.*)');
  add('/api/(.*)');
  add('/api/(.*)');
  add('/api/users', 100);
  add('/api/users');
  add('/api/users');
  add('/api/users/:id', 5000, 101, 200);
  add('/api/users/:id');
  add('/api/users/:id');
  add('/api/users/:id/groups', 100, 101, 200);
  add('/api/users/:id/roles', 100, 101, 200);
  add('/api/links');
  add('/api/links');
  add('/api/links/:id', 300, 101, 200);
  add('/api/links/:id');
  add('/api/links/:id');
  add('/api/posts', 50000);
  add('/api/posts');
  add('/api/posts');
  add('/api/posts');
  add('/api/posts/:id', 5000, 1001, 1500);
  add('/api/posts/:id');
  add('/api/posts/:id');
  add('/api/posts/:id/views', 10000, 1001, 1500);
  add('/api/posts/:id/comments', 300, 1001, 1500);
  add('/api/posts/:id/comments');
  add('/api/posts/:id/comments/:id', 500, 1001, 1500);
  add('/api/posts/:id/tags');
  add('/api/posts/:id/tags');
  add('/api/posts/:id/tags/:id', 500, 1001, 1500);
  add('/api/authors', 500);
  add('/api/authors');
  add('/api/authors/:id', 500, 101, 200);
  add('/api/authors/:id');
  add('/api/authors/:id');
  add('/api/authors/:id/posts', 500, 101, 200);
  add('/api/tags');
  add('/api/tags', 50);
  add('/api/tags/:id', 500, 101, 200);
  add('/api/tags/:id/posts', 500, 1001, 1500);
  add('/api/tags/:id/posts');
  add('/api/tags/:id/posts');
  add('/api/analytics/tags');
  add('/api/analytics/authors');
  add('/api/analytics/posts');
  add('/api/analytics/users');
  add('/api/(.*)');
  add('/(.*)');

  return () => {
    const fallbacks = [_getFn(), _getFn()];
    for (const url of urls) {
      matcher.match(url, () => true, fallbacks);
    }
  };
}
