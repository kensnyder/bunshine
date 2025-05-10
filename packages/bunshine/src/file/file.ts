import Context from '../Context/Context';
import parseRangeHeader from '../parseRangeHeader/parseRangeHeader';
import {
  FileLike,
  getFileBaseName,
  getFileChunk,
  getFileFull,
  getFileMime,
  getFileStats,
  isFileLike,
} from './file-io';
import isModifiedSince from './isModifiedSince';

export type FileResponseOptions = {
  chunkSize?: number;
  disposition?: 'inline' | 'attachment' | 'form-data';
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
  if (fileOptions.disposition && /^attachment$/.test(fileOptions.disposition)) {
    const filename = getFileBaseName(fileLike);
    let disposition = 'attachment';
    if (filename) {
      disposition += `; filename="${filename}"`;
    }
    resp.headers.set('Content-Disposition', disposition);
  } else if (
    fileOptions.disposition &&
    /^inline|form-data$/.test(fileOptions.disposition)
  ) {
    resp.headers.set('Content-Disposition', fileOptions.disposition);
  }
  // optionally add headers
  if (fileOptions.headers) {
    const headers = new Headers(fileOptions.headers);
    for (const [name, value] of headers.entries()) {
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
  if (!file || !isFileLike(file)) {
    return new Response('File not found', { status: 404 });
  }
  const { size, lastModified, doesExist } = await getFileStats(file);
  if (!doesExist) {
    return new Response('File not found', { status: 404 });
  }
  if (lastModified instanceof Date && !isModifiedSince(request, lastModified)) {
    return new Response(null, { status: 304 });
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
        // see https://github.com/oven-sh/bun/issues/15355
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
            // Content-length set automatically based on the string length of error message
          },
        }
      );
    }
    if (slice) {
      const buffer = await getFileChunk(
        file,
        slice.start,
        slice.end - slice.start + 1
      );
      return new Response(buffer, {
        status: 206,
        headers: {
          'Content-Type': await getFileMime(file),
          // Content-length will get sent automatically
          ...maybeModifiedHeader,
          'Content-Range': `bytes ${slice.start}-${slice.end}/${size}`,
          'Accept-Ranges': 'bytes',
        },
      });
    }
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
