import type { Middleware } from '../../HttpRouter/HttpRouter';

export function performanceLogger(): Middleware {
  return async (_, next) => {
    const start = performance.now();
    const resp = await next();
    const ms = (performance.now() - start).toFixed(3);
    resp.headers.set('Took', ms);
    return resp;
  };
}
