import type { BunFile } from 'bun';
import getMimeType from '../getMimeType/getMimeType.ts';
import { type FileGzipper } from './FileGzipper.ts';
import { GzipCache } from './GzipCache.ts';
import { gzipFile } from './gzip.ts';

export default class NeverCache extends GzipCache {
  private _gzipper: FileGzipper;
  constructor(gzipper: FileGzipper) {
    super();
    this._gzipper = gzipper;
  }
  async fetch(file: BunFile) {
    const body = await gzipFile(file);
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Encoding': 'gzip',
        'Content-Type': getMimeType(file),
        'Content-Length': String(body.length),
        'Last-Modified': new Date(file.lastModified).toUTCString(),
      },
    });
  }
}
