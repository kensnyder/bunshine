import os from 'node:os';
import bunshinePkg from '../../../package.json' assert { type: 'json' };
import type { Middleware } from '../../HttpRouter/HttpRouter';
import { LoggerOptions } from '../LoggerOptions';

const machine = os.hostname();
const runtime = process.versions.bun
  ? `Bun v${process.versions.bun}`
  : `Node v${process.versions.node}`;
const poweredBy = `Bunshine v${bunshinePkg.version}`;

export function prodLogger({
  writer = process.stdout,
  exceptWhen = () => false,
}: LoggerOptions | undefined = {}): Middleware {
  return async (c, next) => {
    const start = performance.now();
    const { pathname, host } = c.url;
    const date = new Date().toISOString();
    const id = crypto.randomUUID();
    if (!exceptWhen(c, null)) {
      // log request
      writer.write(
        JSON.stringify({
          msg: `--> ${c.request.method} ${pathname}`,
          type: 'request',
          date,
          id,
          host,
          method: c.request.method,
          pathname,
          runtime,
          poweredBy,
          machine,
          userAgent: c.request.headers.get('user-agent'),
          pid: process.pid,
        }) + '\n'
      );
    }
    // wait for response
    const resp = await next();
    if (!exceptWhen(c, resp)) {
      // log response info
      const took = Math.round((performance.now() - start) * 1000) / 1000;
      writer.write(
        JSON.stringify({
          msg: `${resp.status} ${c.request.method} ${pathname}`,
          type: 'response',
          date,
          id,
          host,
          method: c.request.method,
          pathname,
          status: resp.status,
          runtime,
          poweredBy,
          machine,
          userAgent: c.request.headers.get('user-agent'),
          pid: process.pid,
          took,
        }) + '\n'
      );
    }
    // return response
    return resp;
  };
}
