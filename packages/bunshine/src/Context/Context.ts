import type { Server } from 'bun';
import type HttpRouter from '../HttpRouter/HttpRouter';
import {
  cssResponse,
  htmlResponse,
  jsResponse,
  plaintextResponse,
  xmlResponse,
} from '../responseFactories/factory/factory';
import file, { type FileResponseOptions } from '../responseFactories/file/file';
import { FileLike } from '../responseFactories/file/file-io';
import jsonResponse from '../responseFactories/json/json';
import redirect from '../responseFactories/redirect/redirect';
import sse, { type SseSetupFunction } from '../responseFactories/sse/sse';

/**
 * Context is created per incoming request and is passed to every route handler and middleware.
 * It provides convenient access to the Request, related server/router objects, parsed URL,
 * route params, a locals bag for per-request state, and several response factory helpers.
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
> {
  /** The raw request object */
  request: Request;
  /**
   * Alias for `request`.
   * Provided for convenience if you prefer shorter property names.
   */
  req: Request;
  /**
   * The Bun server instance that accepted this request.
   * Useful for low-level information like `c.ip` via `server.requestIP()`.
   */
  server: Server<any>;
  /**
   * The HttpRouter instance handling this request.
   * You typically won't need this inside handlers, but it can be useful for advanced patterns.
   */
  app: HttpRouter;
  /**
   * The request params parsed from the matched route's placeholder segments.
   * Example: for route "/users/:id" and path "/users/123", params.id === "123".
   */
  params: ParamsShape = {} as ParamsShape;
  /**
   * A per-request mutable store for middleware/handlers to share data.
   * Cleared after the request is completed.
   */
  locals: Record<string, any> = {};
  /**
   * A URL object constructed with `new URL(request.url)`.
   * Handy for accessing pathname, searchParams, origin, etc.
   */
  url: URL;
  /**
   * The Date when the request was received and the Context was created.
   * Useful for logging and response headers.
   */
  date: Date;
  /** Epoch milliseconds captured when the request was received (from Date.now()) */
  now: number;
  /**
   * If an error was thrown while handling the request, it can be stored here
   * by error-handling middleware for inspection/logging.
   */
  error: Error | null = null;
  /**
   * Construct a new Context for a single incoming request.
   *
   * @param request - The native Request object received by the server.
   * @param server - The Bun Server instance handling the request.
   * @param app - The HttpRouter instance your routes are registered on.
   */
  constructor(request: Request, server: Server<any>, app: HttpRouter) {
    this.request = request;
    this.req = request;
    this.server = server;
    this.app = app;
    this.url = new URL(request.url);
    this.date = new Date();
    this.now = Date.now();
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
   * Create a plain text Response with Content-Type: text/plain; charset=utf-8.
   *
   * @param body - The response body as a string.
   * @param init - Optional ResponseInit (headers, status, etc). Existing headers are preserved.
   * @returns Response
   */
  text = plaintextResponse;
  /**
   * Create a JavaScript Response with Content-Type: text/javascript; charset=utf-8.
   *
   * @param body - The JS source as a string.
   * @param init - Optional ResponseInit to override status/headers.
   * @returns Response
   */
  js = jsResponse;
  /**
   * Create an HTML Response with Content-Type: text/html; charset=utf-8.
   *
   * @param body - The HTML markup as a string.
   * @param init - Optional ResponseInit to override status/headers.
   * @returns Response
   */
  html = htmlResponse;
  /**
   * Create a CSS Response with Content-Type: text/css; charset=utf-8.
   *
   * @param body - The CSS stylesheet as a string.
   * @param init - Optional ResponseInit to override status/headers.
   * @returns Response
   */
  css = cssResponse;
  /**
   * Create an XML Response with Content-Type: text/xml; charset=utf-8.
   *
   * @param body - The XML document as a string.
   * @param init - Optional ResponseInit to override status/headers.
   * @returns Response
   */
  xml = xmlResponse;
  /**
   * Create a JSON Response with Content-Type: application/json; charset=utf-8.
   *
   * Internally stringifies the provided data with JSON.stringify.
   * @param data - Any JSON-serializable value.
   * @param init - Optional ResponseInit to override status/headers.
   * @returns Response
   */
  json = jsonResponse;
  /**
   * Create a redirect Response with a Location header.
   *
   * @param url - The absolute or relative URL to redirect to.
   * @param status - HTTP status code (default 302). Common values: 301, 302, 303, 307, 308.
   * @returns Response
   */
  redirect = redirect;
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
  /**
   * Create a Server-Sent Events (SSE) Response with Content-Type: text/event-stream.
   *
   * The provided setup callback will be invoked with an SSE controller that lets you
   * send events. The stream will close automatically when the request's AbortSignal
   * is aborted (client disconnect) or when you close it from the setup.
   *
   * @param setup - A function to set up event emission and lifecycle.
   * @param init - Optional ResponseInit to add/override headers such as Cache-Control.
   * @returns Response
   */
  sse = (setup: SseSetupFunction, init: ResponseInit = {}) => {
    return sse.call(this, this.request.signal, setup, init);
  };
  /**
   * Get the elapsed time in milliseconds since the Context was created.
   *
   * @param precision - Number of decimal places to include (default 0).
   * @returns Milliseconds elapsed, rounded to the given precision.
   */
  took = (precision = 0) => {
    const elapsed = Date.now() - this.now;
    const factor = Math.pow(10, precision);
    return Math.round(elapsed * factor) / factor;
  };
}
