import os from 'os';
import bunshinePkg from '../../../package.json';
import type { Middleware } from '../../HttpRouter/HttpRouter';

const machine = os.hostname();
const runtime = process.versions.bun
  ? `Bun v${process.versions.bun}`
  : `Node v${process.versions.node}`;
const poweredBy = `Bunshine v${bunshinePkg.version}`;

export function prodLogger(): Middleware {
  return async (c, next) => {
    const start = performance.now();
    const { pathname, host } = c.url;
    const date = new Date().toISOString();
    const id = crypto.randomUUID();
    // log request
    process.stdout.write(
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
    // wait for response
    const resp = await next();
    // log response info
    const took = Math.round((performance.now() - start) * 1000) / 1000;
    process.stdout.write(
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
    // return response
    return resp;
  };
}
