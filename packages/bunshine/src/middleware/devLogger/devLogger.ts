import type { Middleware } from '../../HttpRouter/HttpRouter';
import { LoggerOptions } from '../LoggerOptions';

export function devLogger({
  writer = process.stdout,
  exceptWhen = () => false,
}: LoggerOptions = {}): Middleware {
  return async (c, next) => {
    const start = performance.now();
    const { pathname } = c.url;
    const time = new Date().toISOString().slice(11);
    // get response
    const resp = await next();
    if (exceptWhen(c, resp)) {
      return resp;
    }
    const range = c.request.headers.get('Range');
    let maybeRange = range ? ` ${gray(range)}` : '';
    // log response status
    const ms = (performance.now() - start).toFixed(1);
    writer.write(
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
