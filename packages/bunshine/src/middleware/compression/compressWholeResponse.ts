import type { ZlibCompressionOptions } from 'bun';
import { promisify } from 'node:util';
import { brotliCompress, type BrotliOptions, gzip } from 'node:zlib';

const brPromise = promisify(brotliCompress);
const gzipPromise = promisify(gzip);

export default async function compressWholeResponse(
  response: Response,
  compressionType: 'br' | 'gzip' = 'gzip',
  compressionOptions: BrotliOptions | ZlibCompressionOptions = {}
): Promise<Response> {
  // Get the entire body as a buffer
  const oldBody = await response.arrayBuffer();

  // Compress in one go
  const compressor = compressionType === 'br' ? brPromise : gzipPromise;
  const compressed = await compressor(oldBody, compressionOptions);

  const headers = new Headers(response.headers);
  headers.set('Content-Encoding', compressionType);
  headers.set('Content-Length', compressed.length.toString());

  return new Response(compressed, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
