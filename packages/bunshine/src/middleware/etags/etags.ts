import { TypedArray } from 'type-fest';
import type Context from '../../Context/Context';
import type { Middleware, NextFunction } from '../../HttpRouter/HttpRouter';

export type EtagHashCalculator = (
  context: Context,
  response: Response
) => Promise<{ buffer: ArrayBuffer | TypedArray | Buffer; hash: string }>;

export type EtagOptions = {
  calculator?: EtagHashCalculator;
};

export function etags({
  calculator = defaultEtagsCalculator,
}: EtagOptions = {}): Middleware {
  return async (context: Context, next: NextFunction) => {
    const resp = await next();
    if (context.request.method !== 'GET' || resp.status !== 200) {
      // Only use Etags for successful GET requests
      return resp;
    }
    const ifNoneMatch = context.request.headers.get('if-none-match');
    const { buffer, hash } = await calculator(context, resp);
    const etag = `"${hash}"`;
    resp.headers.set('Etag', etag);
    if (ifNoneMatch && _includesEtag(ifNoneMatch, etag)) {
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

function _includesEtag(ifNoneMatch: string, etag: string) {
  const matches = ifNoneMatch.split(',').map(s => s.trim());
  return matches.includes(etag);
}

export async function defaultEtagsCalculator(_: Context, resp: Response) {
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
