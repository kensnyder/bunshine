import Context from '../../Context/Context';
import parseRangeHeader from '../../parseRangeHeader/parseRangeHeader';
import {
  FileLike,
  getBufferMime,
  getFileBaseName,
  getFileChunk,
  getFileFull,
  getFileMime,
  getFileStats,
} from './file-io';

export type FileResponseOptions = {
  chunkSize?: number;
  disposition?: 'inline' | 'attachment';
  acceptRanges?: boolean;
  sendLastModified?: boolean;
  headers?: HeadersInit;
};

const headersWeAdd = [
  'content-type',
  'content-length',
  'x-content-length',
  'content-range',
  'accept-ranges',
  'last-modified',
  'content-disposition',
];

export default async function file(
  this: Context,
  fileLike: FileLike,
  fileOptions: FileResponseOptions = {}
) {
  const resp = await getFileResponse(this.request, fileLike, fileOptions);
  if (fileOptions.disposition === 'attachment') {
    const filename = getFileBaseName(fileLike);
    resp.headers.set(
      'Content-Disposition',
      `${fileOptions.disposition}; filename="${filename}"`
    );
  } else if (fileOptions.disposition === 'inline') {
    resp.headers.set('Content-Disposition', 'inline');
  }
  // optionally add headers
  if (fileOptions.headers) {
    const headers = new Headers(fileOptions.headers);
    for (const [name, value] of Object.entries(headers)) {
      if (headersWeAdd.includes(name.toLowerCase())) {
        resp.headers.set(name, value);
      } else {
        resp.headers.append(name, value);
      }
    }
  }
  return resp;
}

async function getFileResponse(
  request: Request,
  file: FileLike,
  fileOptions: FileResponseOptions
) {
  if (!file) {
    return new Response('File not found', { status: 404 });
  }
  const { size, lastModified, doesExist } = await getFileStats(file);
  if (!doesExist) {
    return new Response('File not found', { status: 404 });
  }
  const supportRangedRequest = fileOptions.acceptRanges !== false;
  const maybeModifiedHeader: ResponseInit['headers'] =
    lastModified instanceof Date && fileOptions.sendLastModified !== false
      ? { 'Last-Modified': lastModified.toUTCString() }
      : {};
  const maybeAcceptRangesHeader: ResponseInit['headers'] = supportRangedRequest
    ? { 'Accept-Ranges': 'bytes' }
    : {};
  if (request.method === 'HEAD') {
    const mime = await getFileMime(file);
    return new Response(null, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(size),
        ...maybeModifiedHeader,
        ...maybeAcceptRangesHeader,
        // Currently Bun overrides the Content-Length header to be 0
        'X-Content-Length': String(size),
      },
    });
  }
  const rangeHeader = request.headers.get('Range');
  if (supportRangedRequest && rangeHeader) {
    const { slice, status } = parseRangeHeader({
      rangeHeader: rangeHeader,
      totalFileSize: size || 0,
      defaultChunkSize: fileOptions.chunkSize,
    });
    if (status === 416) {
      return new Response(
        `Requested range is not satisfiable. Total size is ${size} bytes.`,
        {
          status: 416,
          headers: {
            'Content-Type': await getFileMime(file),
            'Content-Range': `bytes */${size}`,
            ...maybeModifiedHeader,
            'Accept-Ranges': 'bytes',
            // Content-length set automatically based on the size of error message
          },
        }
      );
    }

    const buffer = slice
      ? await getFileChunk(file, slice.start, slice.end - slice.start + 1)
      : await getFileFull(file);
    const maybeContentRange: ResponseInit['headers'] = slice
      ? { 'Content-Range': `bytes ${slice.start}-${slice.end}/${size}` }
      : {};
    return new Response(buffer, {
      status, // could be 200 or 206
      headers: {
        'Content-Type': slice
          ? await getFileMime(file)
          : await getBufferMime(buffer),
        // Content-length will get sent automatically
        ...maybeModifiedHeader,
        ...maybeContentRange,
        'Accept-Ranges': 'bytes',
      },
    });
  }
  const buffer = await getFileFull(file);
  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': await getFileMime(file, buffer),
      // Content-length will get sent automatically
      ...maybeModifiedHeader,
      ...maybeAcceptRangesHeader,
    },
  });
}
