import type { ZlibCompressionOptions } from 'bun';
import { Readable } from 'node:stream';
import {
  type BrotliOptions,
  createBrotliCompress,
  createGzip,
} from 'node:zlib';

export default async function compressStreamResponse(
  response: Response,
  compressionType: 'gzip' | 'br' = 'gzip',
  compressionOptions: BrotliOptions | ZlibCompressionOptions = {}
): Promise<Response> {
  // Return early if there's no body to compress
  if (!response.body) {
    return response;
  }

  // Create new headers, copying from original response
  const headers = new Headers(response.headers);
  headers.set('Content-Encoding', compressionType);

  // If there was a Content-Length, delete it as it's no longer valid
  headers.delete('Content-Length');

  // Create gzip transform stream
  const compressor =
    compressionType === 'br'
      ? // @ts-expect-error  we know compressionOptions are correct
        createBrotliCompress(compressionOptions)
      : createGzip(compressionOptions);

  // Convert response.body ReadableStream to Node Readable
  // @ts-expect-error  Typings are incomplete
  const nodeReadable = Readable.fromWeb(response.body);

  // Pipe through gzip
  const compressedStream = nodeReadable.pipe(compressor);

  // Convert back to web ReadableStream
  // @ts-expect-error  Readable.toWeb is not yet in the Node.js typings
  const webStream = Readable.toWeb(compressedStream) as ReadableStream;

  // Return new response with compressed body
  return new Response(webStream, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
