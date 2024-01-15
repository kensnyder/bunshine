import { ZlibCompressionOptions } from 'bun';
import ms from 'ms';
import path from 'path';
import type { Middleware } from '../../HttpRouter/HttpRouter.ts';
import { buildFileResponse } from '../../HttpRouter/responseFactories.ts';
import { FileGzipper } from '../../gzip/FileGzipper.ts';

// see https://expressjs.com/en/4x/api.html#express.static
// and https://www.npmjs.com/package/send#dotfiles
export type StaticOptions = {
  acceptRanges?: boolean;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  etag?: boolean;
  extensions?: string[];
  fallthrough?: boolean;
  immutable?: boolean;
  index?: string[];
  lastModified?: boolean;
  maxAge?: number | string;
  gzip?: GzipOptions;
};

export type GzipOptions = {
  minFileSize?: number;
  maxFileSize?: number;
  mimeTypes?: Array<string | RegExp>;
  zlibOptions?: ZlibCompressionOptions;
  cache: {
    type: 'file' | 'precompress' | 'memory' | 'never';
    maxBytes?: number;
    path?: string;
  };
};

const defaultGzipOptions: GzipOptions = {
  minFileSize: 1024,
  maxFileSize: 1024 * 1024 * 25,
  mimeTypes: [
    /^text\/.*/,
    /^application\/json/,
    /^image\/svg/,
    /^font\/(otf|ttf|eot)/,
  ],
  zlibOptions: {},
  cache: {
    type: 'never',
  },
};

export function serveFiles(
  directory: string,
  {
    acceptRanges = true,
    dotfiles = 'ignore',
    etag = true, // Not yet implemented
    extensions = [],
    fallthrough = true,
    immutable = false,
    index = [],
    lastModified = true,
    maxAge = undefined,
    gzip = undefined,
  }: StaticOptions = {}
): Middleware {
  const cacheControlHeader =
    maxAge === undefined ? null : getCacheControl(maxAge, immutable);
  const gzipper = gzip
    ? new FileGzipper(directory, { ...defaultGzipOptions, ...gzip })
    : undefined;
  return async c => {
    if (gzipper) {
      // wait for setup cache if not done already
      await gzipper.setupPromise;
    }
    const filename = c.params[0] || c.url.pathname;
    if (filename.startsWith('.')) {
      if (dotfiles === 'ignore') {
        // fall through to next handler
        return;
      }
      if (dotfiles === 'deny') {
        return new Response('403 Forbidden', { status: 403 });
      }
    }
    if (extensions.length > 0) {
      const ext = path.extname(filename).slice(1);
      if (!extensions.includes(ext)) {
        // fall through to next handler
        return;
      }
    }
    // get file path
    const filePath = path.join(directory, filename);
    // init file
    let file = Bun.file(filePath);
    // handle existence
    let exists = await file.exists();
    // console.log('----------=========------- exists?', { exists, filePath });
    // handle index files
    if (!exists && index.length > 0) {
      // try to find index file such as index.html or index.js
      for (const indexFile of index) {
        const indexFilePath = path.join(filePath, indexFile);
        file = Bun.file(indexFilePath);
        exists = await file.exists();
        if (exists) {
          break;
        }
      }
    }
    if (!exists) {
      if (fallthrough) {
        return;
      }
      return new Response('404 Not Found', { status: 404 });
    }
    const rangeHeader = c.request.headers.get('range');
    let response: Response;
    if (rangeHeader || !gzipper) {
      // get base response
      response = await buildFileResponse({
        file,
        acceptRanges,
        chunkSize: 0,
        rangeHeader,
        method: c.request.method,
        gzip: false,
      });
    } else {
      response = await gzipper.fetch(file);
    }
    // add current date
    response.headers.set('Date', new Date().toUTCString());
    // add last modified
    if (lastModified) {
      response.headers.set(
        'Last-Modified',
        new Date(file.lastModified).toUTCString()
      );
    }
    // add Cache-Control header
    if (cacheControlHeader) {
      response.headers.set('Cache-Control', cacheControlHeader);
    }
    return response;
  };
}

function getCacheControl(maxAge: string | number, immutable: boolean) {
  let cacheControl = 'public, ';
  if (typeof maxAge === 'string') {
    const milliseconds = ms(maxAge);
    if (milliseconds === undefined) {
      throw new Error(`Invalid maxAge: ${maxAge}`);
    }
    maxAge = milliseconds;
  }
  if (typeof maxAge === 'number' && maxAge >= 0) {
    const seconds = Math.floor(maxAge / 1000);
    cacheControl += `max-age=${seconds}`;
  }
  if (immutable) {
    cacheControl += ', immutable';
  }
  return cacheControl;
}
