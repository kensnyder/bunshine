import type { Middleware } from '../../HttpRouter/HttpRouter';

export function performanceHeader(headerName: string = 'X-Took'): Middleware {
  return async (c, next) => {
    const resp = await next();
    const ms = (performance.now() - c.now).toFixed(3);
    resp.headers.set(headerName, ms);
    return resp;
  };
}
