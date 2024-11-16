import { BunFile } from 'bun';
import path from 'node:path';
import buildFileResponse from './buildFileResponse';

export type FileResponseOptions = {
  range?: string;
  chunkSize?: number;
  disposition?: 'inline' | 'attachment';
  acceptRanges?: boolean;
};
export default async function file(
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
    acceptRanges: true,
    chunkSize: fileOptions.chunkSize,
    rangeHeader: fileOptions.range,
    method: 'GET',
  });
  if (fileOptions.acceptRanges !== false) {
    // tell the client that we are capable of handling range requests
    resp.headers.set('Accept-Ranges', 'bytes');
  }
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
