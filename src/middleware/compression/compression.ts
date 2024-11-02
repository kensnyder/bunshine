import type { ZlibCompressionOptions } from 'bun';
import { promisify } from 'node:util';
import { type BrotliOptions, brotliCompress, gzip } from 'node:zlib';
import { Middleware } from '../../HttpRouter/HttpRouter.ts';
import isCompressibleMime from './isCompressibleMime.ts';

const brPromise = promisify(brotliCompress);
const gzipPromise = promisify(gzip);

export type CompressionOptions = {
  prefer: 'br' | 'gzip' | 'none';
  br: BrotliOptions;
  gzip: ZlibCompressionOptions;
  minSize: number;
};

export const defaultOptions = {
  prefer: 'gzip' as const,
  br: {} as BrotliOptions,
  gzip: {} as ZlibCompressionOptions,
  // body must be large enough to be worth compressing
  // (54 is minimum size of gzip after metadata; 100 is arbitrary choice)
  // see benchmarks/gzip.ts for more information
  minSize: 100,
};

export default function compression(
  options: Partial<CompressionOptions>
): Middleware {
  if (options.prefer === 'none') {
    return () => {};
  }
  const resolvedOptions = { ...defaultOptions, ...options };
  return async (context, next) => {
    const resp = await next();
    try {
      if (!isCompressibleMime(context.request.headers.get('Content-Type'))) {
        return resp;
      }
      const accept = context.request.headers.get('Accept-Encoding') ?? '';
      const canBr = /\bbr\b/.test(accept);
      const canGz = /\bgzip\b/.test(accept);
      if (!canBr && !canGz) {
        return resp;
      }
      const encoding = resolvedOptions.prefer === 'br' && canBr ? 'br' : 'gzip';
      const newBody = await compressBytes(
        await resp.arrayBuffer(),
        encoding,
        resolvedOptions
      );
      resp.headers.set('Content-Encoding', encoding);
      return new Response(newBody, {
        status: resp.status,
        statusText: resp.statusText,
        headers: resp.headers,
      });
    } catch (e) {
      const error = e as Error;
      console.error(`bunshine compression() error: ${error.message}`);
      return resp;
    }
  };
}

async function compressBytes(
  buffer: ArrayBuffer,
  type: string,
  options: CompressionOptions
) {
  if (buffer.byteLength < options.minSize) {
    return buffer;
  }
  if (type === 'br') {
    return brPromise(buffer, options.br);
  } else {
    return gzipPromise(buffer, options.gzip);
  }
}
