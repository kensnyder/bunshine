import type { BunFile } from 'bun';
import { LRUCache } from 'lru-cache';
import { type FileGzipper } from './FileGzipper.ts';
import { GzipCache } from './GzipCache.ts';
import { gzipFile } from './gzip.ts';

export default class MemoryCache extends GzipCache {
  private _cache: LRUCache<string, Uint8Array>;
  private _gzipper: FileGzipper;
  constructor(gzipper: FileGzipper) {
    super();
    this._gzipper = gzipper;
    this._cache = new LRUCache<string, Uint8Array>({
      maxSize: this._gzipper.config!.cache.maxBytes!,
      sizeCalculation: (value: Uint8Array, key: string) => {
        return key.length + value.length;
      },
    });
  }
  async fetch(file: BunFile) {
    const key = `${file.name}@${file.lastModified}`;
    let body: Uint8Array;
    if (this._cache.has(key)) {
      body = this._cache.get(key)!;
    } else {
      body = await gzipFile(file);
      this._cache.set(key, body);
    }
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Encoding': 'gzip',
        'Content-Type': file.type,
        'Content-Length': String(body!.length),
        'Last-Modified': new Date(file.lastModified).toUTCString(),
      },
    });
  }
}
