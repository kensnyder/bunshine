import type Context from '../../Context/Context.ts';
import { Middleware, NextFunction } from '../../HttpRouter/HttpRouter.ts';
import ResponseLike from '../../ResponseLike/ResponseLike.ts';

export type EtagHashCalculator = (
  context: Context,
  response: ResponseLike
) => string | Promise<string>;

export type EtagOptions = {
  calculator?: EtagHashCalculator;
};

export function etags({
  calculator = calculateHash,
}: EtagOptions = {}): Middleware {
  return async (context: Context, next: NextFunction) => {
    let resp = await next();
    if (context.request.method === 'GET' && resp.status === 200) {
      const ifNoneMatch = context.request.headers.get('if-none-match');
      const hash = await calculator(context, resp);
      const etag = `"${hash}"`;
      if (ifNoneMatch) {
        console.log('final etags', etag);
        if (etag && etag === ifNoneMatch) {
          resp = new ResponseLike(null, {
            headers: resp.headers,
            status: 304,
            statusText: '',
          });
        }
      }
      if (etag) {
        resp.headers.set('Etag', etag);
      }
    }
    return resp;
  };
}

export async function calculateHash(_: Context, resp: ResponseLike) {
  if (resp.isEmpty()) {
    // same hash as an empty string or empty Blob
    return 'dbad5038569b1467';
  }
  if (!resp.hasSupportedDataType() || resp._body instanceof FormData) {
    return '';
  }
  try {
    const category = resp.getBodyCategory();
    const toHash =
      category === 'bytes' ? await resp.bytes() : await resp.text();
    return Bun.hash(toHash).toString(16);
  } catch (err) {
    return '';
  }
}
