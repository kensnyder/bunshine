import type { Middleware} from "../../HttpRouter/HttpRouter.ts";

export const devLogger: Middleware = async (c, next) => {
  const start = performance.now();
  const { pathname } = c.url;
  const time = new Date().toISOString().slice(11);
  // write request
  // get response
  const resp = await next();
  const range = c.request.headers.get('Range');
  let maybeRange = range ? ` \x1b[37m${range}\x1b[0m` : '';
  // log response status
  const ms = (performance.now() - start).toFixed(1);
  process.stdout.write(
    `\x1b[0m\x1b[37m[${time}]\x1b[0m ${c.request.method} \x1b[92m${pathname}\x1b[0m `
  );
  console.log(`\x1b[0m\x1b[96m${resp.status}\x1b[0m${maybeRange} (${ms}ms)`);
  // return response
  return resp;
};
