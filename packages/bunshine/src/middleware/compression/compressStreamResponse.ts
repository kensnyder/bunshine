import { Readable } from 'node:stream';
import {
  type BrotliOptions,
  createBrotliCompress,
  createGzip,
  createZstdCompress,
  type ZlibOptions,
  type ZstdOptions,
} from 'node:zlib';

export default async function compressStreamResponse(
  response: Response,
  compressionType: 'gzip' | 'br' | 'zstd' = 'gzip',
  compressionOptions: BrotliOptions | ZlibOptions | ZstdOptions
): Promise<Response> {
  // Return early if there's no body to compress
  if (!response.body) {
    return response;
  }

  // Choose compressor based on requested encoding and availability
  let actualEncoding: 'gzip' | 'br' | 'zstd' = compressionType;
  let compressor: NodeJS.ReadWriteStream;

  if (compressionType === 'br') {
    compressor = createBrotliCompress(compressionOptions as BrotliOptions);
  } else if (compressionType === 'zstd') {
    if (createZstdCompress) {
      compressor = createZstdCompress(compressionOptions as ZstdOptions);
    } else {
      // Fallback to gzip if zstd streaming is not supported
      actualEncoding = 'gzip';
      compressor = createGzip(compressionOptions as ZlibOptions);
    }
  } else {
    compressor = createGzip(compressionOptions as ZlibOptions);
  }

  // Create new headers, copying from original response
  const headers = new Headers(response.headers);
  headers.set('Content-Encoding', actualEncoding);

  // If there was a Content-Length, delete it as it's no longer valid
  headers.delete('Content-Length');

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

  // Convert response.body ReadableStream to Node Readable
  // @ts-expect-error  Typings are incomplete
  const nodeReadable = Readable.fromWeb(response.body);

  // Pipe through compressor
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
