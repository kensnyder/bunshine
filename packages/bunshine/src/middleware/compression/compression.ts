import type { ZlibCompressionOptions } from 'bun';
import { type BrotliOptions } from 'node:zlib';
import { withTryCatch, type Middleware } from 'request-class-router';
import type Context from '../../Context/Context';
import compressStreamResponse from './compressStreamResponse';
import compressWholeResponse from './compressWholeResponse';
import isCompressibleMime from './isCompressibleMime';

export type CompressionOptions = {
  prefer: 'br' | 'gzip' | 'none';
  br: BrotliOptions;
  gzip: ZlibCompressionOptions;
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
  gzip: {} as ZlibCompressionOptions,
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
      // some mimes are not compressible
      !isCompressibleMime(contentType) ||
      // check for exceptions
      (await exceptWhen(context, resp))
    ) {
      return resp;
    }
    const accept = context.request.headers.get('Accept-Encoding') ?? '';
    const canBr = /\bbr\b/.test(accept);
    const canGz = /\bgzip\b/.test(accept);
    if (!canBr && !canGz) {
      return resp;
    }
    let encoding: 'br' | 'gzip';
    if (!canGz) {
      encoding = 'br';
    } else if (!canBr) {
      encoding = 'gzip';
    } else {
      // @ts-expect-error TypeScript isn't smart enough
      //   to know that prefer can't be "none" at this point
      encoding = resolvedOptions.prefer;
    }
    const options =
      encoding === 'br' ? resolvedOptions.br : resolvedOptions.gzip;

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
      return compressStreamResponse(resp, encoding, options);
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

    return compressWholeResponse(resp, encoding, options);
  };
}
