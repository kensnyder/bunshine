import { BunFile } from 'bun';
import getMimeType from '../getMimeType/getMimeType';

export default async function buildFileResponse({
  file,
  acceptRanges,
  chunkSize,
  rangeHeader,
  method,
}: {
  file: BunFile;
  acceptRanges: boolean;
  chunkSize?: number;
  rangeHeader?: string | null;
  method: string;
}) {
  let response: Response;
  const rangeMatch = String(rangeHeader).match(/^bytes=(\d*)-(\d*)$/);
  if (acceptRanges && rangeMatch) {
    const totalFileSize = file.size;
    const start = parseInt(rangeMatch[1]) || 0;
    let end = parseInt(rangeMatch[2]);
    if (isNaN(end)) {
      // Initial request: some browsers use "Range: bytes=0-"
      end = Math.min(start + (chunkSize || 3 * 1024 ** 2), totalFileSize - 1);
    }
    if (start > totalFileSize - 1) {
      return new Response('416 Range not satisfiable', { status: 416 });
    }
    // Bun has a bug when setting content-length and content-range automatically
    // so convert file to buffer
    let buffer = await file.arrayBuffer();
    let status = 200;
    // the range is less than the entire file
    if (end - 1 < totalFileSize) {
      buffer = buffer.slice(start, end + 1);
      status = 206;
    }
    response = new Response(buffer, { status });
    if (!response.headers.has('Content-Type')) {
      response.headers.set('Content-Type', 'application/octet-stream');
    }
    response.headers.set('Content-Length', String(buffer.byteLength));
    response.headers.set(
      'Content-Range',
      `bytes ${start}-${end}/${totalFileSize}`
    );
  } else {
    let body: null | ArrayBuffer;
    if (method === 'HEAD') {
      body = null;
    } else {
      body = await file.arrayBuffer();
    }
    response = new Response(body, {
      headers: {
        'Content-Length': String(body ? body.byteLength : 0),
        'Content-Type': getMimeType(file),
      },
      status: method === 'HEAD' ? 204 : 200,
    });
  }
  if (acceptRanges) {
    response.headers.set('Accept-Ranges', 'bytes');
  }
  return response;
}
