import { promisify } from 'node:util';
import {
  brotliCompress,
  gzip,
  zstdCompress,
  type BrotliOptions,
  type ZlibOptions,
  type ZstdOptions,
} from 'node:zlib';

const brPromise = promisify(brotliCompress);
const gzipPromise = promisify(gzip);
const zstdPromise = zstdCompress ? promisify(zstdCompress) : null;

export default async function compressWholeResponse(
  response: Response,
  compressionType: 'br' | 'gzip' | 'zstd' = 'gzip',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compressionOptions: BrotliOptions | ZlibOptions | Record<string, any> = {}
): Promise<Response> {
  // Get the entire body as a buffer
  const oldBody = await response.arrayBuffer();

  let compressed: Buffer | Uint8Array;
  let actualEncoding: 'br' | 'gzip' | 'zstd' = compressionType;

  if (compressionType === 'br') {
    compressed = await brPromise(oldBody, compressionOptions as BrotliOptions);
  } else if (compressionType === 'zstd' && zstdPromise) {
    compressed = await zstdPromise(oldBody, compressionOptions as ZstdOptions);
  } else {
    compressed = await gzipPromise(oldBody, compressionOptions as ZlibOptions);
  }

  const headers = new Headers(response.headers);
  headers.set('Content-Encoding', actualEncoding);
  headers.set('Content-Length', compressed.length.toString());
  // Append Vary: Accept-Encoding (preserve existing values)
  const vary = headers.get('Vary');
  if (vary) {
    if (
      !vary
        .split(',')
        .map(v => v.trim().toLowerCase())
        .includes('accept-encoding')
    ) {
      headers.set('Vary', `${vary}, Accept-Encoding`);
    }
  } else {
    headers.set('Vary', 'Accept-Encoding');
  }

  // @ts-expect-error  bun-types is wrong
  return new Response(compressed, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
