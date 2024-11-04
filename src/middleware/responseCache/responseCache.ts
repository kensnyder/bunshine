import type { Middleware } from '../../HttpRouter/HttpRouter.ts';

export interface ResponseCache {
  get(key: string): { clone: () => Response };
  set(key: string, value: Response): void;
  has(key: string): boolean;
}

export function responseCache(cache: ResponseCache): Middleware {
  return async (c, next) => {
    const key = c.url.href;
    if (cache.has(key)) {
      return cache.get(key).clone();
    }
    const response = await next();
    const cloned = response.clone();
    // TODO: add a max-age header to the response
    cloned.headers.set('Bunshine-Cached-At', new Date().toISOString());
    cache.set(key, cloned);
    return response;
  };
}
