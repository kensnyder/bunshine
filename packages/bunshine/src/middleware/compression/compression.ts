import {
  type BrotliOptions,
  type ZlibOptions,
  type ZstdOptions,
} from 'node:zlib';
import type Context from '../../Context/Context';
import { Middleware } from '../../HttpRouter/HttpRouter';
import withTryCatch from '../../withTryCatch/withTryCatch';
import compressStreamResponse from './compressStreamResponse';
import compressWholeResponse from './compressWholeResponse';
import isCompressibleMime from './isCompressibleMime';

export const compressionTypes = ['zstd', 'gzip', 'br'];

export type CompressionType = (typeof compressionTypes)[number];

export type CompressionOptions = {
  prefer: CompressionType | CompressionType[] | 'none';
  br: BrotliOptions;
  gzip: ZlibOptions;
  zstd: ZstdOptions;
  minSize: number;
  maxSize: number;
  exceptWhen: (
    context: Context,
    response: Response
  ) => boolean | Promise<boolean>;
};

export const compressionDefaults: CompressionOptions = {
  prefer: compressionTypes,
  br: {} as BrotliOptions,
  gzip: {} as ZlibOptions,
  zstd: {} as ZstdOptions,
  // body must be large enough to be worth compressing
  // (54 bytes is minimum size of gzip after metadata; 100 is arbitrary choice)
  // see benchmarks/gzip.ts for more information
  minSize: 100, // arbitrary choice
  maxSize: 1024 * 1024 * 500, // 500 MB
  exceptWhen: () => false,
};

export function compression(
  options: Partial<CompressionOptions> = {}
): Middleware {
  if (options.prefer === 'none') {
    // empty middleware
    return () => {};
  }
  // convert string preferred options to arrays
  const resolvedOptions = { ...compressionDefaults, ...options };
  const preferred =
    typeof resolvedOptions.prefer === 'string'
      ? [resolvedOptions.prefer, ...compressionTypes]
      : resolvedOptions.prefer;
  if (!Bun.zstdCompress) {
    // zstd only available in Bun 1.3+
    // @ts-ignore We know that prefer is an Array at this point
    resolvedOptions.prefer = resolvedOptions.prefer.filter(
      (p: string) => p !== 'zstd'
    );
  }
  const exceptWhen = withTryCatch({
    label:
      'Bunshine compression middleware: your exceptWhen function threw an error',
    defaultReturn: false,
    func: resolvedOptions.exceptWhen,
  });
  return async (context, next) => {
    const resp = await next();
    const contentType = resp.headers.get('Content-Type') || '';
    if (
      // avoid compressing body-less responses
      !resp.body ||
      // already encoded by an upstream handler
      resp.headers.has('Content-Encoding') ||
      // some mimes are not compressible
      !isCompressibleMime(contentType) ||
      // check for exceptions
      (await exceptWhen(context, resp))
    ) {
      return resp;
    }

    const encoding = getPreferredEncoding(context.request, preferred);
    if (encoding === 'identity') {
      // "identity" means no encoding
      return resp;
    }

    const options =
      encoding === 'br'
        ? resolvedOptions.br
        : encoding === 'gzip'
          ? resolvedOptions.gzip
          : resolvedOptions.zstd;

    const transferEncoding = resp.headers.get('Transfer-Encoding');

    // Use streaming for:
    // 1. Chunked transfers
    // 2. Server-sent events
    // 4. Specific content types that are typically large or streaming
    // 3. Unknown content length
    if (
      transferEncoding === 'chunked' ||
      contentType.includes('event-stream') ||
      contentType.includes('video/') ||
      contentType.includes('audio/') ||
      !resp.headers.has('Content-Length')
    ) {
      return compressStreamResponse(resp, encoding, options as any);
    }

    const contentLength = parseInt(
      resp.headers.get('Content-Length') || '0',
      10
    );

    if (
      contentLength > resolvedOptions.maxSize ||
      contentLength < resolvedOptions.minSize
    ) {
      // will take too long to compress
      return resp;
    }

    return compressWholeResponse(resp, encoding, options as any);
  };
}

const bunshineRecognizedEncodings = [...compressionTypes, 'identity', '*'];

export type RecognizedEncoding = (typeof bunshineRecognizedEncodings)[number];

export function getPreferredEncoding(
  request: Request,
  preferred: CompressionType[]
) {
  // Parse Accept-Encoding with q-values; default identity=1.0 when header missing
  const accept = request.headers.get('Accept-Encoding') ?? '';
  if (!accept) {
    return 'identity';
  }
  const q: Record<string, number> = {
    gzip: 0,
    br: 0,
    zstd: 0,
    identity: 1,
    '*': 0,
  };
  if (accept) {
    // reset identity default when header present (RFC: if present and doesn't list identity, identity is implied except q=0 via *; we keep identity unless explicitly q=0)
    q.identity = 1;
    for (const part of accept
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)) {
      const [tokenRaw, params] = part.split(';', 2);
      const token = tokenRaw.toLowerCase();
      let quality = 1;
      if (params) {
        const m = params.match(/q\s*=\s*([0-9.]+)/i);
        if (m) {
          quality = Math.max(0, Math.min(1, parseFloat(m[1])));
        }
      }
      if (bunshineRecognizedEncodings.includes(token)) {
        q[token] = quality;
      }
    }
    // If * is specified, apply to unspecified tokens
    if (q['*'] > 0) {
      if (q.gzip === 0) {
        q.gzip = q['*'];
      }
      if (q.br === 0) {
        q.br = q['*'];
      }
      if (q.zstd === 0) {
        q.zstd = q['*'];
      }
    }
    // If identity is explicitly q=0 via header, honor it
    // (already captured if provided)
  }

  // Determine client-acceptable encodings (>0)
  const clientAllows = compressionTypes.filter(e => q[e] > 0);
  const serverAvailable = preferred.filter(t => clientAllows.includes(t));

  if (serverAvailable.length === 0) {
    // no acceptable encoding we can provide; return identity
    return 'identity';
  }
  if (serverAvailable.length === 1) {
    return serverAvailable[0];
  }

  // Choose encoding: highest q, then first in priority array
  serverAvailable.sort((encodingA, encodingB) => {
    return (
      q[encodingB] - q[encodingA] ||
      serverAvailable.indexOf(encodingA) - serverAvailable.indexOf(encodingB)
    );
  });
  return serverAvailable[0];
}
