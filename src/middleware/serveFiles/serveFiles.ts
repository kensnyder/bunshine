import path from 'path';
import type { Middleware } from '../../HttpRouter/HttpRouter.ts';

// see https://expressjs.com/en/4x/api.html#express.static
// and https://www.npmjs.com/package/send#dotfiles
export type StaticOptions = {
  dotfiles?: 'allow' | 'deny' | 'ignore';
  extensions?: string[];
  fallthrough?: boolean;
  immutable?: boolean;
  index?: string[];
  maxAge?: number | string;
  headers?: HeadersInit;
  addPoweredBy?: boolean; // default true
};

export function serveFiles(
  directory: string,
  {
    dotfiles = 'ignore',
    extensions = [],
    fallthrough = true,
    index = [],
    maxAge = undefined,
    headers = undefined,
    addPoweredBy = true,
  }: StaticOptions = {}
): Middleware {
  return async c => {
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
      for (const indexFilename of index) {
        const indexFilePath = path.join(filePath, indexFilename);
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
    const response = await c.file(file, {
      maxAge,
      headers,
    });
    if (addPoweredBy) {
      response.headers.set('X-Powered-By', c.app.getPoweredByString());
    }
    return response;
  };
}
