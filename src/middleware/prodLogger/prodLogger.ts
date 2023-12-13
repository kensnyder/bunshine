import os from 'os';
import type { Middleware } from '../../HttpRouter/HttpRouter.ts';

const machine = os.hostname();
const runtime = `Bun ${Bun.version}`;
export function prodLogger(): Middleware {
  return async (c, next) => {
    const start = performance.now();
    const { pathname, host, protocol } = c.url;
    const date = new Date().toISOString();
    const id = crypto.randomUUID();
    // write request
    process.stdout.write(
      JSON.stringify({
        date,
        method: c.request.method,
        pathname,
        runtime,
        machine,
        pid: process.pid,
        id,
      }) + '\n'
    );
    // get response
    const resp = await next();
    // log response status
    const took = performance.now() - start;
    process.stdout.write(
      JSON.stringify({
        date,
        method: c.request.method,
        pathname,
        status: resp.status,
        runtime,
        machine,
        pid: process.pid,
        id,
        took,
      }) + '\n'
    );
    // return response
    return resp;
  };
}
