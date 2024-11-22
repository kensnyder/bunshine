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
  const { slice, status } = parseRangeHeader({
    range: acceptRanges ? String(rangeHeader) : '',
    totalFileSize: file.size,
    defaultChunkSize: chunkSize,
  });
  if (status === 416) {
    return new Response(
      method === 'HEAD'
        ? ''
        : `Requested range is not satisfiable. Total size is ${file.size} bytes.`,
      {
        status: 416,
        // statusText: 'Range Not Satisfiable',
        headers: {
          'Content-Range': `bytes */${file.size}`,
        },
      }
    );
  }
  if (method === 'HEAD') {
    return new Response(null, {
      status,
      headers: {
        'Content-Type': getMimeType(file),
        'Content-Length': String(file.size),
        ...(acceptRanges ? { 'Accept-Ranges': 'bytes' } : {}),
      },
    });
  }
  let buffer = await file.arrayBuffer();
  if (slice) {
    buffer = buffer.slice(slice.start, slice.end + 1);
  }
  return new Response(method === 'HEAD' ? null : buffer, {
    status,
    headers: {
      'Content-Type': getMimeType(file),
      'Content-Length': String(buffer.byteLength),
      ...(slice
        ? { 'Content-Range': `bytes ${slice.start}-${slice.end}/${file.size}` }
        : {}),
      ...(acceptRanges ? { 'Accept-Ranges': 'bytes' } : {}),
    },
  });
}
