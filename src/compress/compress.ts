import type { ZlibCompressionOptions } from 'bun';
import { promisify } from 'node:util';
import { BrotliOptions, brotliCompress, gzip } from 'node:zlib';
import type { TypedArray } from 'type-fest';
import { BodyProcessor } from '../HttpRouter/HttpRouter.ts';
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

export function compressString(text: string, type: string) {
  const buffer = Buffer.from(textEncoder.encode(text));
  if (type === 'br') {
    return brPromise(buffer, compressionOptions.br);
  } else {
    return gzipPromise(buffer, compressionOptions.gzip);
  }
}

export async function compressBlob(blob: Blob, type: string) {
  return compressBuffer(new Uint8Array(await blob.arrayBuffer()), type);
}

export async function compressBuffer(
  buffer: Buffer | TypedArray | DataView | ArrayBuffer,
  type: string
) {
  if (type === 'br') {
    return brPromise(buffer, compressionOptions.br);
  } else {
    return gzipPromise(buffer, compressionOptions.gzip);
  }
}

export async function maybeCompressResponseBody(
  requestHeaders,
  responseHeaders,
  body
) {
  if (!isCompressibleMime(responseHeaders.get('Content-Type'))) {
    return body;
  }
  const accept = requestHeaders.get('Accept-Encoding') ?? '';
  const match = accept.match(/\b(br|gzip)\b/);
  if (!match) {
    return body;
  }
  const encoding = match[1];
  if (typeof body === 'string') {
    if (body.length < compressionOptions.minSize) {
      // too small to worth compressing
      return body;
    }
    responseHeaders.set('Content-Encoding', encoding);
    return compressString(body, encoding);
  } else if (body instanceof Blob) {
    if (body.size < compressionOptions.minSize) {
      // too small to worth compressing
      return body;
    }
    responseHeaders.set('Content-Encoding', encoding);
    return compressBlob(body, encoding);
  } else {
    if (body.byteLength < compressionOptions.minSize) {
      // too small to worth compressing
      return body;
    }
    responseHeaders.set('Content-Encoding', encoding);
    return compressBuffer(body, encoding);
  }
}

export function compression(): BodyProcessor {
  return async (context, body, init) => {
    const requestHeaders = context.request.headers;
    const responseHeaders = init.headers;
    if (
      body === null ||
      body === '' ||
      !isCompressibleMime(responseHeaders.get('Content-Type'))
    ) {
      return body;
    }
    const accept = requestHeaders.get('Accept-Encoding') ?? '';
    const match = accept.match(/\b(br|gzip)\b/);
    if (!match) {
      return body;
    }
    const encoding = match[1];
    if (typeof body === 'string') {
      if (body.length < compressionOptions.minSize) {
        // too small to worth compressing
        return body;
      }
      responseHeaders.set('Content-Encoding', encoding);
      return compressString(body, encoding);
    } else if (body instanceof Blob) {
      if (body.size < compressionOptions.minSize) {
        // too small to worth compressing
        return body;
      }
      responseHeaders.set('Content-Encoding', encoding);
      return compressBlob(body, encoding);
    } else {
      return body;
    }
  };
}
