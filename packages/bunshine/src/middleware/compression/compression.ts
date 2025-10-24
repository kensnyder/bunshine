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

export type CompressionOptions = {
  prefer: 'zstd' | 'br' | 'gzip' | 'none';
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

export const compressionDefaults = {
  prefer: 'gzip' as const,
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
    return () => {};
  }
  const resolvedOptions = { ...compressionDefaults, ...options };
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

    // Parse Accept-Encoding with q-values; default identity=1.0 when header missing
    const accept = context.request.headers.get('Accept-Encoding') ?? '';
    type Ae = 'gzip' | 'br' | 'zstd' | 'identity' | '*';
    const q: Record<Ae, number> = {
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
        const token = tokenRaw.toLowerCase() as Ae;
        let quality = 1;
        if (params) {
          const m = params.match(/q\s*=\s*([0-9.]+)/i);
          if (m) quality = Math.max(0, Math.min(1, parseFloat(m[1])));
        }
        if (
          token === '*' ||
          token === 'gzip' ||
          token === 'br' ||
          token === 'zstd' ||
          token === 'identity'
        ) {
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
    const clientAllows = new Set<Ae>(
      (['zstd', 'br', 'gzip'] as const).filter(e => q[e] > 0) as Ae[]
    );
    const hasZstdImpl = !!Bun.zstdCompress; // runtime support (Bun 1.3+)
    const serverAvailable: Array<'zstd' | 'br' | 'gzip'> = [];
    if (clientAllows.has('zstd') && hasZstdImpl) {
      serverAvailable.push('zstd');
    }
    if (clientAllows.has('br')) {
      serverAvailable.push('br');
    }
    if (clientAllows.has('gzip')) {
      serverAvailable.push('gzip');
    }

    if (serverAvailable.length === 0) {
      // no acceptable encoding we can provide; return identity
      return resp;
    }

    // Choose encoding: highest q, then prefer option if tie, else fallback precedence zstd > br > gzip
    let encoding: 'zstd' | 'br' | 'gzip' = serverAvailable[0];
    // Sort by client q descending, then by prefer match, then by fixed order
    const order = (e: 'zstd' | 'br' | 'gzip') => ({
      e,
      q: q[e],
      prefer: e === (resolvedOptions.prefer as any) ? 1 : 0,
      rank: e === 'zstd' ? 3 : e === 'br' ? 2 : 1,
    });
    serverAvailable.sort((a, b) => {
      const A = order(a);
      const B = order(b);
      if (B.q !== A.q) return B.q - A.q;
      if (B.prefer !== A.prefer) return B.prefer - A.prefer;
      return B.rank - A.rank;
    });
    encoding = serverAvailable[0];

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
      return compressStreamResponse(resp, encoding as any, options as any);
    }

    const contentLength = parseInt(
      resp.headers.get('Content-Length') || '0',
      10
    );

    if (
      contentLength > resolvedOptions.maxSize ||
      contentLength < resolvedOptions.minSize
    ) {
      return resp;
    }

    return compressWholeResponse(resp, encoding as any, options as any);
  };
}
