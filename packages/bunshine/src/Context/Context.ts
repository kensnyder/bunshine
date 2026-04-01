import type { Server } from 'bun';
import { Context as BaseContext } from 'routeshine';
import type HttpRouter from '../HttpRouter/HttpRouter';
import file, { type FileResponseOptions } from '../responseFactories/file/file';
import type { FileLike } from '../responseFactories/file/file-io';

/**
 * Bun-specific Context extends the platform-agnostic base Context with
 * Bun Server typing, IP address access, and file serving helpers.
 *
 * Generics:
 * - ParamsShape: shape of the `params` object extracted from the matched route placeholders.
 *
 * Typical usage:
 *
 * app.get('/hello/:name', (c) => {
 *   const { name } = c.params;
 *   return c.text(`Hello ${name}!`);
 * });
 */
export default class Context<
  ParamsShape extends Record<string, string> = Record<string, string>,
> extends BaseContext<ParamsShape, Server<any>> {
  declare server: Server<any>;
  declare app: HttpRouter;

  /**
   * Construct a new Context for a single incoming request.
   *
   * @param request - The native Request object received by the server.
   * @param server - The Bun Server instance handling the request.
   * @param app - The HttpRouter instance your routes are registered on.
   */
  constructor(request: Request, server: Server<any>, app: HttpRouter) {
    super(request, server, app);
  }

  /**
   * Get the client's remote address information, if available.
   *
   * Returns null when Bun cannot determine the client IP (e.g., Unix sockets).
   * Note: If your app is behind a reverse proxy or load balancer, prefer
   * using the appropriate forwarded headers from `c.request.headers`.
   */
  get ip(): { address: string; family: string; port: number } | null {
    return this.server.requestIP(this.request);
  }

  /**
   * Send a file or arbitrary binary/text content with appropriate headers.
   *
   * - Supports HTTP range requests automatically when the incoming request
   *   contains a `Range` header.
   * - When given a file path or BunFile, will infer Content-Type from extension
   *   if not provided in options.
   *
   * @param pathOrData - A filesystem path, BunFile, Blob, ArrayBuffer, or string content.
   * @param fileOptions - Options such as contentType, downloadName, etag, cache control, etc.
   * @returns Response
   */
  file = async (
    pathOrData: FileLike,
    fileOptions: FileResponseOptions = {}
  ) => {
    return file.call(this, pathOrData, {
      range: this.request.headers.get('Range') || undefined,
      ...fileOptions,
    });
  };
}
