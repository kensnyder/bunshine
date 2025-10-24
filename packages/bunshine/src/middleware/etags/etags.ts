import { TypedArray } from 'type-fest';
import type Context from '../../Context/Context';
import type { Middleware, NextFunction } from '../../HttpRouter/HttpRouter';
import withTryCatch from '../../withTryCatch/withTryCatch';

export type EtagHashCalculator = (
  context: Context,
  response: Response
) => Promise<{ buffer: ArrayBuffer | TypedArray | Buffer; hash: string }>;

export type EtagOptions = {
  calculator?: EtagHashCalculator;
  maxSize?: number;
  exceptWhen?: (context: Context, response: Response) => boolean;
  overwrite?: boolean; // if true, always (re)calculate and set ETag
};

export function etags({
  calculator = defaultEtagsCalculator,
  maxSize = 2 * 1024 * 1024 * 1024, // 2GB
  exceptWhen = () => false,
  overwrite = false,
}: EtagOptions = {}): Middleware {
  const exceptWhenResult = withTryCatch({
    label: 'Bunshine etags middleware exceptWhen error',
    defaultReturn: false,
    func: exceptWhen,
  });

  // safe calculator wrapper: on error, return null to fall back gracefully
  const safeCalculator = withTryCatch({
    label: 'Bunshine etags middleware calculator error',
    defaultReturn: null as unknown as {
      buffer: ArrayBuffer | TypedArray | Buffer;
      hash: string;
    } | null,
    func: calculator as any,
  });

  return async (context: Context, next: NextFunction) => {
    const resp = await next();

      // Normalize header casing if upstream used non-standard 'Etag'
    const existingLower = resp.headers.get('Etag');
    if (existingLower) {
      // Set canonical header without deleting, since header names are case-insensitive
      resp.headers.set('ETag', existingLower);
    }

    const method = context.request.method.toUpperCase();

    // If middleware is excepted, just return original response
    if (await exceptWhenResult(context, resp)) {
      return resp;
    }

    // Determine if we should attempt to generate an ETag (if not already present)
    const canGenerate = _shouldGenerateEtag(context.request, resp, maxSize);

    // Prefer existing ETag unless overwrite requested
    let etag = resp.headers.get('ETag') || undefined;
    let computedBuffer: ArrayBuffer | TypedArray | Buffer | undefined;
    let computedEtag = false;

    // Don't compute on HEAD (avoid consuming body); still respect existing ETag
    const mayCompute = canGenerate && method !== 'HEAD';

    if ((!etag || overwrite) && mayCompute) {
      const calc = await safeCalculator(context, resp).catch(() => null as any);
      if (calc && (calc as any).hash) {
        const { buffer, hash } = calc as any;
        // Enforce maxSize even if Content-Length was missing
        const size =
          (buffer as ArrayBuffer).byteLength ?? (buffer as any).length ?? 0;
        if (maxSize > 0 && size > maxSize) {
          // Too large to buffer safely: return the computed buffer but skip setting ETag.
          // Preserve status and statusText and avoid stale Content-Length.
          const status = resp.status;
          const statusText = (resp as any).statusText;
          resp.headers.delete('Content-Length');
          // Do not set ETag in this path
          // @ts-expect-error bun-types may not include statusText
          return new Response(buffer, { headers: resp.headers, status, statusText });
        }
        computedBuffer = buffer;
        etag = `"${hash}"`;
        computedEtag = true;
      } else {
        // On calculator error, fall back to original response without changes
        return resp;
      }
    }

    // If we now have an ETag, set it (canonical casing)
    if (etag) {
      resp.headers.set('ETag', etag);
      // Our default calculator hashes the encoded bytes, so vary by Content-Encoding
      if (computedEtag) {
        // append or set Vary: Content-Encoding
        const vary = resp.headers.get('Vary');
        if (vary) {
          if (
            !vary
              .split(',')
              .map(v => v.trim().toLowerCase())
              .includes('content-encoding')
          ) {
            resp.headers.set('Vary', `${vary}, Content-Encoding`);
          }
        } else {
          resp.headers.set('Vary', 'Content-Encoding');
        }
      }

      // Evaluate preconditions
      const ifMatchOutcome = evaluateIfMatch(
        context.request.headers.get('If-Match'),
        etag
      );
      if (ifMatchOutcome === 'fail') {
        // 412 Precondition Failed
        resp.headers.delete('Content-Length');
        return new Response(null, { status: 412, headers: resp.headers });
      }

      const ifNoneOutcome = evaluateIfNoneMatch(
        context.request.headers.get('If-None-Match'),
        etag
      );
      if (ifNoneOutcome === 'match') {
        const status = method === 'GET' || method === 'HEAD' ? 304 : 412;
        // No body for 304/412 in this path
        resp.headers.delete('Content-Length');
        return new Response(null, { status, headers: resp.headers });
      }
    }

    // No conditional short-circuit. If we computed a new buffer (consumed original), rewrap it.
    if (computedBuffer) {
      // Preserve status and statusText, and prevent stale Content-Length
      const status = resp.status;
      const statusText = (resp as any).statusText;
      resp.headers.delete('Content-Length');
      // @ts-expect-error bun-types may not include statusText
      return new Response(computedBuffer, {
        headers: resp.headers,
        status,
        statusText,
      });
    }

    // Pass-through
    return resp;
  };
}

// ---- ETag/Conditional helpers ----
function parseEtagsList(header: string): string[] {
  return header
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function isWeakTag(tag: string): boolean {
  return tag.startsWith('W/');
}

function stripWeak(tag: string): string {
  return isWeakTag(tag) ? tag.slice(2) : tag;
}

// Strong comparison per RFC: both must be strong and opaque-tag equal
function strongEquals(a: string, b: string): boolean {
  return stripWeak(a) === stripWeak(b) && !isWeakTag(a) && !isWeakTag(b);
}

// Weak comparison per RFC: opaque-tag equality ignoring weakness
function weakEquals(a: string, b: string): boolean {
  return stripWeak(a) === stripWeak(b);
}

function evaluateIfMatch(
  ifMatchHeader: string | null,
  currentETag: string
): 'fail' | 'pass' | 'not-present' {
  if (!ifMatchHeader) return 'not-present';
  const list = parseEtagsList(ifMatchHeader);
  if (list.includes('*')) return 'pass';
  return list.some(tag => strongEquals(tag, currentETag)) ? 'pass' : 'fail';
}

function evaluateIfNoneMatch(
  ifNoneMatchHeader: string | null,
  currentETag: string
): 'match' | 'no-match' | 'not-present' {
  if (!ifNoneMatchHeader) return 'not-present';
  const list = parseEtagsList(ifNoneMatchHeader);
  if (list.includes('*')) return 'match';
  return list.some(tag => weakEquals(tag, currentETag)) ? 'match' : 'no-match';
}

function _shouldGenerateEtag(
  request: Request,
  response: Response,
  maxSize: number
) {
  // Check against maxSize (if Content-Length known)
  const contentLength = parseInt(response.headers.get('Content-Length') || '');
  if (contentLength && maxSize > 0 && contentLength > maxSize) {
    return false;
  }

  // Do not generate ETag for status codes that don't make sense
  // Technically 404 could be included, but each application should use custom logic
  const validStatusCodes = [200, 201, 203, 410];
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

  // Methods allowed to generate ETag (HEAD is allowed but we avoid computing for it later)
  const method = request.method;
  const methodsThatSupportEtag = ['GET', 'HEAD', 'PUT', 'POST', 'PATCH'];
  if (!methodsThatSupportEtag.includes(method.toUpperCase())) {
    return false;
  }

  // Do not generate ETag on empty bodies or explicit 204
  if (response.status === 204 || contentLength === 0) {
    return false; // No body, no ETag
  }

  return true;
}

export async function defaultEtagsCalculator(_: Context, resp: Response) {
  const buffer = await resp.arrayBuffer();
  return {
    buffer,
    hash: Bun.hash(buffer).toString(16),
  };
}
