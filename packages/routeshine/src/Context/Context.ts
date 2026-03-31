import type HttpRouter from '../HttpRouter/HttpRouter';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHttpRouter = HttpRouter<any>;
import {
  cssResponse,
  htmlResponse,
  jsResponse,
  plaintextResponse,
  xmlResponse,
} from '../responseFactories/factory/factory';
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
 * - TServer: type of the server instance (runtime-specific). Defaults to `unknown`.
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
  TServer = unknown,
> {
  /** The raw request object */
  request: Request;
  /**
   * Alias for `request`.
   * Provided for convenience if you prefer shorter property names.
   */
  req: Request;
  /**
   * The server instance that accepted this request.
   * The type is runtime-specific (e.g. Bun's Server, Cloudflare's ExecutionContext).
   */
  server: TServer;
  /**
   * The HttpRouter instance handling this request.
   * You typically won't need this inside handlers, but it can be useful for advanced patterns.
   */
  app: AnyHttpRouter;
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
   * @param server - The server instance handling the request (runtime-specific).
   * @param app - The HttpRouter instance your routes are registered on.
   */
  constructor(request: Request, server: TServer, app: AnyHttpRouter) {
    this.request = request;
    this.req = request;
    this.server = server;
    this.app = app;
    this.url = new URL(request.url);
    this.date = new Date();
    this.now = Date.now();
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
