import type { BunFile } from 'bun';
import { LRUCache } from 'lru-cache';
import fs from 'node:fs/promises';
import path from 'node:path';
import { type FileGzipper } from './FileGzipper.ts';
import { GzipCache } from './GzipCache.ts';

export default class FileCache extends GzipCache {
  private _cache: LRUCache<
    string,
    { pathToGzipFile: string; zippedSize: number }
  >;
  private _gzipper: FileGzipper;
  constructor(gzipper: FileGzipper) {
    super();
    this._gzipper = gzipper;
    this._cache = new LRUCache<
      string,
      { pathToGzipFile: string; zippedSize: number }
    >({
      maxSize: this._gzipper.config!.cache.maxBytes!,
      sizeCalculation: (
        value: { pathToGzipFile: string; zippedSize: number },
        key: string
      ) => {
        return key.length + value.pathToGzipFile.length + value.zippedSize + 10; // 'zippedSize'.length === 10;
      },
      dispose: (
        value: { pathToGzipFile: string; zippedSize: number },
        key: string
      ) => {
        // dispose of the gzip file when it's evicted from the cache
        fs.unlink(value.pathToGzipFile);
      },
    });
  }
  async fetch(file: BunFile) {
    const key = `${file.name}@${file.lastModified}`;
    if (!this._cache.has(key)) {
      const body = await this._gzipper.compress(file);
      const tildized = file.name!.replace(/\//g, '~');
      const cacheName = `${tildized}.${file.lastModified}.gz`;
      const pathToGzipFile = path.join(
        this._gzipper.config!.cache.path!,
        cacheName
      );
      await fs.writeFile(pathToGzipFile, body);
      this._cache.set(key, { pathToGzipFile, zippedSize: body.length });
      // we have the zipped file in memory, so let's return it directly
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
    const cached = this._cache.get(key);
    const { pathToGzipFile, zippedSize } = cached!;
    const zippedFile = Bun.file(pathToGzipFile!);
    return new Response(zippedFile, {
      status: 200,
      headers: {
        'Content-Encoding': 'gzip',
        'Content-Type': file.type,
        'Content-Length': String(zippedSize),
        'Last-Modified': new Date(file.lastModified).toUTCString(),
      },
    });
  }
}
