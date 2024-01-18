import { BunFile } from 'bun';
import type { GzipOptions } from '../middleware/serveFiles/serveFiles.ts';
import FileCache from './FileCache.ts';
import { GzipCache } from './GzipCache.ts';
import MemoryCache from './MemoryCache.ts';
import NeverCache from './NeverCache.ts';
import PrecompressCache from './PrecompressCache.ts';

export class FileGzipper {
  public setupPromise: Promise<void>;
  public config: GzipOptions;
  public directory: string;
  private _cache: GzipCache;
  constructor(directory: string, config: GzipOptions) {
    this.directory = directory;
    this.config = config;
    if (config.cache === false || config.cache.type === 'never') {
      // never cache i.e. always compress on the fly
      this._cache = new NeverCache(this);
    } else if (config.cache?.type === 'file') {
      // cached zip files on disk with LRU cache
      this._cache = new FileCache(this);
    } else if (config.cache?.type === 'precompress') {
      // zip files up front and store them on disk
      this._cache = new PrecompressCache(this);
    } else if (config.cache?.type === 'memory') {
      // keep zipped file data in memory with LRUCache
      this._cache = new MemoryCache(this);
    } else {
      throw new Error(`Invalid cache type: ${config.cache?.type}`);
    }
    this.setupPromise = this._cache.setup();
  }
  async fetch(file: BunFile) {
    if (
      // @ts-expect-error
      file.size < this.config.minFileSize ||
      // @ts-expect-error
      file.size > this.config.maxFileSize ||
      !this.isAllowedMimeType(file.type)
    ) {
      const body = process.versions.bun ? file : await file.arrayBuffer();
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': file.type,
          'Content-Length': String(file.size),
          'Last-Modified': new Date(file.lastModified).toUTCString(),
        },
      });
    }
    return this._cache.fetch(file);
  }
  isAllowedMimeType(mimeType: string) {
    for (const allowed of this.config.mimeTypes!) {
      if (allowed instanceof RegExp) {
        if (allowed.test(mimeType)) {
          return true;
        }
      } else if (allowed === mimeType) {
        return true;
      }
    }
    return false;
  }
}
