import { TypedArray } from 'type-fest';
import type Context from '../../Context/Context.ts';
import type { Middleware, NextFunction } from '../../HttpRouter/HttpRouter.ts';

export type EtagHashCalculator = (
  context: Context,
  response: Response
) => Promise<{ buffer: ArrayBuffer | TypedArray | Buffer; hash: string }>;

export type EtagOptions = {
  calculator?: EtagHashCalculator;
};

export default function etags({
  calculator = defaultHashCalculator,
}: EtagOptions = {}): Middleware {
  return async (context: Context, next: NextFunction) => {
    const resp = await next();
    if (context.request.method !== 'GET' || resp.status !== 200) {
      return resp;
    }
    const ifNoneMatch = context.request.headers.get('if-none-match');
    const { buffer, hash } = await calculator(context, resp);
    const etag = `"${hash}"`;
    resp.headers.set('Etag', etag);
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new Response('', {
        headers: resp.headers,
        status: 304,
        statusText: '',
      });
    }
    return new Response(buffer, {
      headers: resp.headers,
      status: 200,
      statusText: '',
    });
  };
}

export async function defaultHashCalculator(_: Context, resp: Response) {
  const buffer = await resp.arrayBuffer();
  if (buffer.byteLength === 0) {
    // empty Blob hash
    return { buffer, hash: 'dbad5038569b1467' };
  }
  return {
    buffer,
    hash: Bun.hash(buffer).toString(16),
  };
}
