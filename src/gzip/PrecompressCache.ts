import type { BunFile } from 'bun';
import fs from 'node:fs/promises';
import path from 'node:path';
import getMimeType from '../getMimeType/getMimeType.ts';
import { type FileGzipper } from './FileGzipper.ts';
import { GzipCache } from './GzipCache.ts';
import { gzipFile } from './gzip.ts';

export default class PrecompressCache extends GzipCache {
  private _gzipper: FileGzipper;
  private _registry: Record<string, string> = {};
  constructor(gzipper: FileGzipper) {
    super();
    this._gzipper = gzipper;
  }
  async setup() {
    let size = 0;
    const entries = await fs.readdir(this._gzipper.directory, {
      withFileTypes: true,
      recursive: true,
    });
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      const fullPath = path.join(this._gzipper.directory, entry.name);
      const file = Bun.file(fullPath);
      if (
        // @ts-expect-error
        file.size < this._gzipper.config.minFileSize ||
        // @ts-expect-error
        file.size > this._gzipper.config.maxFileSize ||
        !this._gzipper.isAllowedMimeType(file.type)
      ) {
        continue;
      }
      size += file.size;
      const maxBytes = this._gzipper.config!.cache
        ? this._gzipper.config!.cache.maxBytes || -1
        : -1;
      if (size > maxBytes) {
        break;
      }
      const data = await gzipFile(file);
      const tildized = fullPath.replace(/\//g, '~');
      const cacheName = `${tildized}.${file.lastModified}.gz`;
      // @ts-expect-error
      const cachePath = path.join(this._gzipper.config.cache.path, cacheName);
      await fs.writeFile(cachePath, data);
      this._registry[`${file.name}@${file.lastModified}`] = cachePath;
    }
  }
  async fetch(file: BunFile) {
    const key = `${file.name}@${file.lastModified}`;
    const zippedFilePath = this._registry[key];
    if (zippedFilePath) {
      // found in zipped cache; return zipped file
      const zippedFile = Bun.file(zippedFilePath);
      return new Response(zippedFile, {
        status: 200,
        headers: {
          'Content-Encoding': 'gzip',
          'Content-Type': getMimeType(file),
          'Content-Length': String(zippedFile.size),
          'Last-Modified': new Date(file.lastModified).toUTCString(),
        },
      });
    } else {
      const body = process.versions.bun ? file : await file.arrayBuffer();
      // not in zipped cache; return original file
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': getMimeType(file),
          'Content-Length': String(file.size),
          'Last-Modified': new Date(file.lastModified).toUTCString(),
        },
      });
    }
  }
}
