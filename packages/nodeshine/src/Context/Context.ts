import type { IncomingMessage, Server } from 'node:http';
import { Context as BaseContext } from 'routeshine';
import type NodeHttpRouter from '../HttpRouter/HttpRouter';

/**
 * Node.js-specific Context extends the platform-agnostic base Context with
 * Node http.Server typing and IP address access.
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
export default class NodeContext<
  ParamsShape extends Record<string, string> = Record<string, string>,
> extends BaseContext<ParamsShape, Server> {
  declare server: Server;
  declare app: NodeHttpRouter;
  /** The raw Node.js IncomingMessage for this request. */
  incomingMessage: IncomingMessage | null;

  constructor(
    request: Request,
    server: Server,
    app: NodeHttpRouter,
    incomingMessage: IncomingMessage | null = null
  ) {
    super(request, server, app);
    this.incomingMessage = incomingMessage;
  }

  /**
   * Get the client's IP address.
   *
   * Reads X-Forwarded-For first (set by proxies/load balancers),
   * then X-Real-IP, then falls back to the socket's remoteAddress.
   * Returns null if none are available.
   */
  get ip(): string | null {
    const forwarded = this.request.headers.get('X-Forwarded-For');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    const realIp = this.request.headers.get('X-Real-IP');
    if (realIp) {
      return realIp;
    }
    return this.incomingMessage?.socket?.remoteAddress ?? null;
  }
}
