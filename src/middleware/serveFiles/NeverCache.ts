import type { BunFile } from 'bun';
import { type FileGzipper } from './FileGzipper.ts';
import { GzipCache } from './GzipCache.ts';

export default class NeverCache extends GzipCache {
  private _gzipper: FileGzipper;
  constructor(gzipper: FileGzipper) {
    super();
    this._gzipper = gzipper;
  }
  async fetch(file: BunFile) {
    const body = await this._gzipper.compress(file);
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Encoding': 'gzip',
        'Content-Type': file.type,
        'Content-Length': String(body.length),
        'Last-Modified': new Date(file.lastModified).toUTCString(),
      },
    });
  }
}
