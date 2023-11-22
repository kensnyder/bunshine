import path from 'path';
import type { Middleware } from '../../HttpRouter/HttpRouter.ts';

export function serveFiles(directory: string): Middleware {
  return c => {
    return c.file(path.join(directory, c.url.pathname));
  };
}
