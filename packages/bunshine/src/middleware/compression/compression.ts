import type { ZlibCompressionOptions } from 'bun';
import { promisify } from 'node:util';
import { type BrotliOptions, brotliCompress, gzip } from 'node:zlib';
import { Middleware } from '../../HttpRouter/HttpRouter';
import isCompressibleMime from './isCompressibleMime';

const brPromise = promisify(brotliCompress);
const gzipPromise = promisify(gzip);

export type CompressionOptions = {
  prefer: 'br' | 'gzip' | 'none';
  br: BrotliOptions;
  gzip: ZlibCompressionOptions;
  minSize: number;
  maxSize: number;
};

export const compressionDefaults = {
  prefer: 'gzip' as const,
  br: {} as BrotliOptions,
  gzip: {} as ZlibCompressionOptions,
  // body must be large enough to be worth compressing
  // (54 bytes is minimum size of gzip after metadata; 100 is arbitrary choice)
  // see benchmarks/gzip.ts for more information
  minSize: 100,
  maxSize: 1024 * 1024 * 500, // 500 MB
};

export function compression(
  options: Partial<CompressionOptions> = {}
): Middleware {
  if (options.prefer === 'none') {
    return () => {};
  }
  const resolvedOptions = { ...compressionDefaults, ...options };
  return async (context, next) => {
    const resp = await next();
    if (
      // no compression for streams such as text/stream
      /stream/i.test(resp.headers.get('Content-Type') || '') ||
      context.request.method === 'HEAD' ||
      !isCompressibleMime(resp.headers.get('Content-Type'))
    ) {
      return resp;
    }
    const accept = context.request.headers.get('Accept-Encoding') ?? '';
    const canBr = /\bbr\b/.test(accept);
    const canGz = /\bgzip\b/.test(accept);
    if (!canBr && !canGz) {
      return resp;
    }
    const oldBody = await resp.arrayBuffer();
    if (
      oldBody.byteLength < resolvedOptions.minSize ||
      oldBody.byteLength > resolvedOptions.maxSize
    ) {
      return new Response(oldBody, {
        status: resp.status,
        statusText: resp.statusText,
        headers: resp.headers,
      });
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
    const newBody = await compressBytes(oldBody, encoding, resolvedOptions);
    resp.headers.set('Content-Encoding', encoding);
    resp.headers.delete('Content-Length');
    return new Response(newBody, {
      status: resp.status,
      statusText: resp.statusText,
      headers: resp.headers,
    });
  };
}

async function compressBytes(
  buffer: ArrayBuffer,
  type: 'br' | 'gzip',
  options: CompressionOptions
) {
  if (type === 'br') {
    return brPromise(buffer, options.br);
  } else {
    return gzipPromise(buffer, options.gzip);
  }
}
