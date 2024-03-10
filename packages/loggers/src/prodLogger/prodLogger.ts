import os from 'os';
// @ts-ignore
import bunshine from '../../core/package.json';
import type { Middleware } from '../../../src/HttpRouter/HttpRouter.ts';

const machine = os.hostname();
const runtime = process.versions.bun
  ? `Bun v${process.versions.bun}`
  : `Node v${process.versions.node}`;
const poweredBy = `Bunshine v${bunshine.version}`;

export function prodLogger(): Middleware {
  return async (c, next) => {
    const start = performance.now();
    const { pathname, host } = c.url;
    const date = new Date().toISOString();
    const id = crypto.randomUUID();
    // log request
    process.stdout.write(
      JSON.stringify({
        msg: 'HTTP request',
        date,
        id,
        host,
        method: c.request.method,
        pathname,
        runtime,
        poweredBy,
        machine,
      }) + '\n'
    );
    // wait for response
    const resp = await next();
    // log response info
    const took = Math.round((performance.now() - start) * 1000) / 1000;
    process.stdout.write(
      JSON.stringify({
        msg: 'HTTP response',
        date,
        id,
        host,
        method: c.request.method,
        pathname,
        status: resp.status,
        runtime,
        poweredBy,
        machine,
        took,
      }) + '\n'
    );
    // return response
    return resp;
  };
}