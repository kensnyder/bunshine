import type { Middleware } from '../../HttpRouter/HttpRouter.ts';

interface Cache {
  get(key: string): any;
  set(key: string, value: { clone: () => Response }): void;
  has(key: string): boolean;
}

export function responseCache(cache: Cache): Middleware {
  return async (c, next) => {
    const key = c.url.href;
    if (cache.has(key)) {
      return cache.get(key).clone();
    }
    const response = await next();
    const cloned = response.clone();
    cloned.headers.set('Bunshine-Cached-At', new Date().toISOString());
    cache.set(key, cloned);
    return response;
  };
}
