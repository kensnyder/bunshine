import type { Middleware } from '../../HttpRouter/HttpRouter';
import withTryCatch from '../../withTryCatch/withTryCatch';
import { LoggerOptions } from '../LoggerOptions';

export function devLogger(options: LoggerOptions = {}): Middleware {
  const safeWriter = withTryCatch({
    label: 'Bunshine devLogger middleware writer error',
    func: options.writer || process.stdout.write.bind(process.stdout),
  });
  const exceptWhenResult = withTryCatch({
    label:
      'Bunshine devLogger middleware: your exceptWhen function threw an error',
    defaultReturn: false,
    func: options.exceptWhen || (() => false),
  });
  return async (c, next) => {
    const start = performance.now();
    const { pathname } = c.url;
    const time = new Date().toISOString().slice(11);
    // get response
    const resp = await next();
    if (exceptWhenResult(c, resp)) {
      return resp;
    }
    const range = c.request.headers.get('Range');
    let maybeRange = range ? ` ${gray(range)}` : '';
    // log response status
    const ms = (performance.now() - start).toFixed(1);
    safeWriter(
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
