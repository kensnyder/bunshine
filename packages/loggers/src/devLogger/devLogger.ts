import type { Middleware } from '../../../src/HttpRouter/HttpRouter.ts';

export function devLogger(): Middleware {
  return async (c, next) => {
    const start = performance.now();
    const { pathname } = c.url;
    const time = new Date().toISOString().slice(11);
    // write request
    // get response
    const resp = await next();
    const range = c.request.headers.get('Range');
    let maybeRange = range ? ` ${gray(range)}` : '';
    // log response status
    const ms = (performance.now() - start).toFixed(1);
    process.stdout.write(
      `${gray(`[${time}]`)} ${c.request.method} ${green(pathname)} ` +
        `${cyan(String(resp.status))}${maybeRange} (${ms}ms)\n`
    );
    // return response
    return resp;
  };
}

const gray = (s: string) => `\x1b[90m${s}\x1b[0m`;
const green = (s: string) => `\x1b[92m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[96m${s}\x1b[0m`;
