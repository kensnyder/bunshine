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
    if (!_shouldGenerateEtag(resp)) {
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

function _shouldGenerateEtag(response: Response) {
  // Ensure the response object is valid
  if (!(response instanceof Response)) {
    return false;
  }

  // List of status codes where ETags generally make sense
  // Technically 404 could be included, but the application should use custom logic
  const validStatusCodes = [200, 201, 203, 204, 206, /*404,*/ 410];

  // Check if the response status code is in the valid list
  if (!validStatusCodes.includes(response.status)) {
    return false;
  }

  // Check if the response is cacheable
  const cacheControl = response.headers.get('Cache-Control');
  if (cacheControl && /no-store/i.test(cacheControl)) {
    return false; // Do not generate ETag for non-cacheable responses
  }

  // Check if the response method supports ETag generation
  const method = response.headers.get('X-Request-Method') || 'GET'; // Custom header to track the request method
  const methodsThatSupportEtag = ['GET', 'HEAD', 'PUT', 'POST', 'PATCH'];
  if (!methodsThatSupportEtag.includes(method.toUpperCase())) {
    return false;
  }

  // Check if the response has a body or meaningful representation
  const contentLength = response.headers.get('Content-Length');
  if (
    response.status === 204 ||
    (contentLength && parseInt(contentLength, 10) === 0)
  ) {
    return false; // No body, no ETag
  }

  // If all conditions are met, it makes sense to generate an ETag
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
