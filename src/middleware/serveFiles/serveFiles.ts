import path from 'path';
import type { Middleware } from '../../HttpRouter/HttpRouter.ts';

// see https://expressjs.com/en/4x/api.html#express.static
// and https://www.npmjs.com/package/send#dotfiles
export type StaticOptions = {
  acceptRanges?: boolean;
  cacheControl?: boolean;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  etag?: boolean;
  extensions?: string[];
  fallthrough?: boolean;
  immutable?: boolean;
  index?: boolean | string | string[];
  lastModified?: boolean;
  maxAge?: number | string;
  redirect?: boolean;
  setHeaders?: Middleware;
};

export function serveFiles(
  directory: string,
  {
    acceptRanges = true,
    cacheControl = true,
    dotfiles = 'ignore',
    etag = true,
    extensions = [],
    fallthrough = true,
    immutable = false,
    index = false,
    lastModified = true,
    maxAge = undefined,
    redirect = true,
    setHeaders,
  }: StaticOptions = {}
): Middleware {
  return c => {
    return c.file(path.join(directory, c.params[0] || c.url.pathname));
  };
}
