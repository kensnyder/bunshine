import { LRUCache } from 'lru-cache';
import { bench, group, run } from 'mitata';
import { match } from 'path-to-regexp';

const { findAll, getLruFinder, urls } = setup();

group('lru cache speed', () => {
  function finder(find: (url: string) => void) {
    return function () {
      for (const url of urls) {
        find(url);
      }
    };
  }
  // cache size of 5000 is best, averaging 40x faster than no cache
  bench('no cache', finder(findAll));
  bench('cache size 500', finder(getLruFinder(500)));
  bench('cache size 5000', finder(getLruFinder(5000)));
  bench('cache size 50000', finder(getLruFinder(50000)));
  bench('cache size 500000', finder(getLruFinder(500000)));
});

// group('trie speed', () => { });

await run();

function setup() {
  const registry: Registration[] = [];

  function register(path: string, target: () => void) {
    registry.push({
      matcher: match(path, {
        decode: decodeURIComponent,
        sensitive: true,
      }),
      target,
    });
  }

  function findAll(urlPath: string) {
    const found = [];
    for (const reg of registry) {
      if (reg.matcher(urlPath)) {
        found.push(reg);
      }
    }
    return found;
  }

  function getLruFinder(size: number) {
    const cache = new LRUCache<string, Registration[]>({ max: size });
    return function findAllLru(urlPath: string) {
      if (cache.has(urlPath)) {
        return cache.get(urlPath);
      }
      const found = [];
      for (const reg of registry) {
        if (reg.matcher(urlPath)) {
          found.push(reg);
        }
      }
      cache.set(urlPath, found);
      return found;
    };
  }

  const urls: string[] = [];

  function add(path: string, count?: number, min?: number, max?: number) {
    register(path, _getFn());
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

  return { findAll, getLruFinder, urls };
}

type Registration = {
  matcher: ReturnType<typeof match<Record<string, string>>>;
  target: () => void;
};
