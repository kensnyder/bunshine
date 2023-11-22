import os from 'os';
import type { Middleware } from '../../HttpRouter/HttpRouter.ts';

const machine = os.hostname();
const runtime = `Bun ${Bun.version}`;
export function prodLogger(): Middleware {
  return async (c, next) => {
    const start = performance.now();
    const { pathname, host, protocol } = c.url;
    const base = `${protocol}//${host}`;
    const date = new Date().toISOString();
    const id = crypto.randomUUID();
    // write request
    process.stdout.write(
      JSON.stringify({
        runtime,
        machine,
        pid: process.pid,
        date,
        id,
        method: c.request.method,
        base,
        pathname,
      }) + '\n'
    );
    // get response
    const resp = await next();
    // log response status
    const took = performance.now() - start;
    process.stdout.write(
      JSON.stringify({
        runtime,
        machine,
        pid: process.pid,
        date,
        id,
        method: c.request.method,
        base,
        pathname,
        took,
        status: resp.status,
      }) + '\n'
    );
    // return response
    return resp;
  };
}
