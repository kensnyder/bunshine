import path from 'path';
import type Context from '../../Context/Context';
import type { Middleware } from '../../HttpRouter/HttpRouter';
import ms from '../../ms/ms';
import withTryCatch from '../../withTryCatch/withTryCatch';

// see https://expressjs.com/en/4x/api.html#express.static
// and https://www.npmjs.com/package/send#dotfiles
export type ServeFilesOptions = {
  acceptRanges?: boolean;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  extensions?: string[];
  fallthrough?: boolean;
  immutable?: boolean;
  index?: string[];
  lastModified?: boolean;
  maxAge?: number | string;
  exceptWhen?: (context: Context, response: Response | null) => boolean;
};

export function serveFiles(
  directory: string,
  {
    acceptRanges = true,
    dotfiles = 'ignore',
    extensions = [],
    fallthrough = true,
    immutable = false,
    index = [],
    lastModified = true,
    maxAge = undefined,
    exceptWhen = () => false,
  }: ServeFilesOptions = {}
): Middleware {
  const cacheControlHeader =
    maxAge === undefined ? null : getCacheControl(maxAge, immutable);
  const exceptWhenResult = withTryCatch({
    label:
      'Bunshine serveFiles middleware: your exceptWhen function threw an error',
    defaultReturn: false,
    func: exceptWhen,
  });
  return async c => {
    if (c.request.method !== 'GET' && c.request.method !== 'HEAD') {
      return;
    }
    if (await exceptWhenResult(c, null)) {
      return;
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
    // get full file path
    const filePath = path.join(directory, filename);
    let file = Bun.file(filePath);
    let exists = await file.exists();
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
    // otherwise truly cannot find it
    if (!exists) {
      if (fallthrough) {
        return;
      }
      return new Response('404 Not Found', { status: 404 });
    }
    const response = await c.file(file, {
      acceptRanges,
    });
    // add Cache-Control header
    if (cacheControlHeader) {
      response.headers.set('Cache-Control', cacheControlHeader);
    }
    if (lastModified === false) {
      response.headers.delete('Last-Modified');
    }
    if (await exceptWhenResult(c, response)) {
      return;
    }
    return response;
  };
}

function getCacheControl(maxAge: string | number, immutable: boolean) {
  let cacheControl = 'public';
  if (maxAge || maxAge === 0) {
    const seconds = Math.floor(ms(maxAge) / 1000);
    cacheControl += `, max-age=${seconds}`;
  }
  if (immutable) {
    cacheControl += ', immutable';
  }
  return cacheControl;
}
