import type { ZlibCompressionOptions } from 'bun';
import { promisify } from 'node:util';
import { BrotliOptions, brotliCompress, gzip } from 'node:zlib';
import type { TypedArray } from 'type-fest';
import { Middleware } from '../../HttpRouter/HttpRouter.ts';
import isCompressibleMime from './isCompressibleMime.ts';

const brPromise = promisify(brotliCompress);
const gzipPromise = promisify(gzip);

export const compressionOptions = {
  br: {} as BrotliOptions,
  gzip: {} as ZlibCompressionOptions,
  // body must be large enough to be worth compressing
  // (54 is minimum size of gzip after metadata; 100 is arbitrary choice)
  // see benchmarks/gzip.ts for more information
  minSize: 100,
};

const textEncoder = new TextEncoder();

export function compressText(text: string, type: string) {
  const buffer = Buffer.from(textEncoder.encode(text));
  if (type === 'br') {
    return brPromise(buffer, compressionOptions.br);
  } else {
    return gzipPromise(buffer, compressionOptions.gzip);
  }
}

export async function compressBytes(
  buffer: Buffer | TypedArray | DataView | ArrayBuffer,
  type: string
) {
  if (type === 'br') {
    return brPromise(buffer, compressionOptions.br);
  } else {
    return gzipPromise(buffer, compressionOptions.gzip);
  }
}

export function compression(): Middleware {
  return async (context, next) => {
    const resp = await next();

    if (
      resp.isEmpty() ||
      !isCompressibleMime(context.request.headers.get('Content-Type'))
    ) {
      return resp;
    }
    const accept = context.request.headers.get('Accept-Encoding') ?? '';
    const match = accept.match(/\b(br|gzip)\b/);
    if (!match) {
      return resp;
    }
    const encoding = match[1];
    const category = resp.getBodyCategory();
    if (category === 'text') {
      const text = await resp.text();
      if (text.length >= compressionOptions.minSize) {
        // large enough to worth compressing
        resp.headers.set('Content-Encoding', encoding);
        resp.body = await compressText(resp.body, encoding);
      }
    } else if (category === 'bytes') {
      const bytes = await resp.bytes();
      if (bytes.length >= compressionOptions.minSize) {
        // large enough to worth compressing
        resp.headers.set('Content-Encoding', encoding);
        resp.body = await compressBytes(resp.body, encoding);
      }
    }
    return resp;
  };
}
