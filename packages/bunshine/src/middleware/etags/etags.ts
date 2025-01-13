import { TypedArray } from 'type-fest';
import type Context from '../../Context/Context';
import type { Middleware, NextFunction } from '../../HttpRouter/HttpRouter';

export type EtagHashCalculator = (
  context: Context,
  response: Response
) => Promise<{ buffer: ArrayBuffer | TypedArray | Buffer; hash: string }>;

export type EtagOptions = {
  calculator?: EtagHashCalculator;
  maxSize?: number;
};

export function etags({
  calculator = defaultEtagsCalculator,
  maxSize = 2 * 1024 * 1024 * 1024, // 2GB
}: EtagOptions = {}): Middleware {
  return async (context: Context, next: NextFunction) => {
    const resp = await next();
    if (!_shouldGenerateEtag(context.request, resp)) {
      return resp;
    }
    const { buffer, hash } = await calculator(context, resp);
    const etag = `"${hash}"`;
    resp.headers.set('Etag', etag);
    if (_matches(context.request.headers, etag)) {
      resp.headers.set('Vary', 'Content-Encoding');
      const status = ['GET', 'HEAD'].includes(context.request.method)
        ? 204 // No content
        : 412; // Precondition failed
      return new Response('', {
        headers: resp.headers,
        status,
      });
    }
    return new Response(buffer, {
      headers: resp.headers,
      status: 200,
    });
  };
}

function _matches(headers: Headers, etag: string) {
  const ifNoneMatch = headers.get('if-none-match');
  if (ifNoneMatch) {
    return (
      !_includesEtag(ifNoneMatch, etag) || !_includesEtag(ifNoneMatch, '*')
    );
  }
  const ifMatch = headers.get('if-match');
  if (ifMatch) {
    return _includesEtag(ifMatch, etag) || _includesEtag(ifMatch, '*');
  }
  return false;
}

function _includesEtag(header: string, etag: string) {
  const matches = header.split(',').map(s => s.trim());
  return matches.includes(etag);
}

function _shouldGenerateEtag(request: Request, response: Response) {
  // Ensure the response object is valid
  if (!(response instanceof Response)) {
    return false;
  }

  // Do not generate ETag for status codes that don't make sense
  // Technically 404 could be included, but each application should use custom logic
  const validStatusCodes = [200, 201, 203, 204, 206, /*404,*/ 410];
  if (!validStatusCodes.includes(response.status)) {
    return false;
  }

  // Do not generate ETag for non-cacheable responses
  const cacheControl = response.headers.get('Cache-Control');
  if (cacheControl && /no-store/i.test(cacheControl)) {
    return false;
  }

  // Do not generate ETag for streams
  const contentType = response.headers.get('Content-Type');
  if (contentType && /stream/i.test(contentType)) {
    return false;
  }

  // Do not generate ETag for HEAD nor DELETE
  const method = request.headers.get('X-Request-Method') || request.method;
  const methodsThatSupportEtag = ['GET', 'PUT', 'POST', 'PATCH'];
  if (!methodsThatSupportEtag.includes(method.toUpperCase())) {
    return false;
  }

  // Do not generate Etag on empty bodies
  const contentLength = response.headers.get('Content-Length');
  if (
    response.status === 204 ||
    (contentLength && parseInt(contentLength, 10) === 0)
  ) {
    return false; // No body, no ETag
  }

  return true;
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
