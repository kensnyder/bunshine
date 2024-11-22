import { BunFile } from 'bun';
import path from 'node:path';
import Context from '../../Context/Context';
import getMimeType from '../../getMimeType/getMimeType';
import parseRangeHeader from '../../parseRangeHeader/parseRangeHeader';

export type FileResponseOptions = {
  chunkSize?: number;
  disposition?: 'inline' | 'attachment';
  acceptRanges?: boolean;
};

export default async function file(
  this: Context,
  filenameOrBunFile: string | BunFile,
  fileOptions: FileResponseOptions = {}
) {
  let file =
    typeof filenameOrBunFile === 'string'
      ? Bun.file(filenameOrBunFile)
      : filenameOrBunFile;
  if (!(await file.exists())) {
    return new Response('File not found', { status: 404 });
  }
  const resp = await buildFileResponse({
    file,
    acceptRanges: fileOptions.acceptRanges !== false,
    chunkSize: fileOptions.chunkSize,
    rangeHeader: this.request.headers.get('Range'),
    method: this.request.method,
  });
  if (fileOptions.disposition === 'attachment') {
    const filename = path.basename(file.name!);
    resp.headers.set(
      'Content-Disposition',
      `${fileOptions.disposition}; filename="${filename}"`
    );
  } else if (fileOptions.disposition === 'inline') {
    resp.headers.set('Content-Disposition', 'inline');
  }
  return resp;
}

async function buildFileResponse({
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
    rangeHeader: acceptRanges ? rangeHeader : null,
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
  return new Response(buffer, {
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
