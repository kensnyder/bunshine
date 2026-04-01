import http, { type IncomingMessage, type Server } from 'node:http';
import { Readable } from 'node:stream';
import {
  type Handler as BaseHandler,
  HttpRouter as BaseHttpRouter,
  type HttpMethods,
  MatcherWithCache,
  type Middleware as BaseMiddleware,
  type SingleHandler as BaseSingleHandler,
} from 'routeshine';
import NodeContext from '../Context/Context';

export type NextFunction = () => Promise<Response>;

export type SingleHandler<
  ParamsShape extends Record<string, string> = Record<string, string>,
> = BaseSingleHandler<ParamsShape, NodeContext>;

export type Handler<
  ParamsShape extends Record<string, string> = Record<string, string>,
> = BaseHandler<ParamsShape, NodeContext>;

export type Middleware<
  ParamsShape extends Record<string, string> = Record<string, string>,
> = BaseMiddleware<ParamsShape, NodeContext>;

export type ListenOptions = {
  port?: number;
  hostname?: string;
};

export {
  type HttpMethods,
  type HttpRouterOptions,
  httpMethods,
} from 'routeshine';

/**
 * Node.js HTTP router. Extends routeshine's platform-agnostic HttpRouter
 * with a Node.js http.Server-based listen/close interface.
 *
 * Typical usage:
 *
 * const app = new HttpRouter();
 * app.get('/', c => c.text('Hello from Node.js!'));
 * const server = await app.listen({ port: 3000 });
 */
export default class HttpRouter extends BaseHttpRouter<NodeContext> {
  server: Server | undefined;

  constructor(options: { cacheSize?: number } = {}) {
    super(options);
    this.routeMatcher = new MatcherWithCache<SingleHandler>(
      options.cacheSize || 4000
    );
  }

  /**
   * Start the HTTP server.
   *
   * @param portOrOptions Port number or listen options. Defaults to port 0 (random).
   * @returns A Promise that resolves to the Node.js http.Server once listening.
   */
  listen(portOrOptions: ListenOptions | number = {}): Promise<Server> {
    const opts: ListenOptions =
      typeof portOrOptions === 'number'
        ? { port: portOrOptions }
        : portOrOptions;

    const nodeServer = http.createServer(async (req, res) => {
      const host = req.headers.host || 'localhost';
      const protocol = 'http';
      const url = `${protocol}://${host}${req.url}`;

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            for (const v of value) {
              headers.append(key, v);
            }
          } else {
            headers.set(key, value);
          }
        }
      }

      const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
      const body = hasBody
        ? (Readable.toWeb(req) as unknown as ReadableStream)
        : undefined;

      const request = new Request(url, {
        method: req.method,
        headers,
        body,
        // @ts-ignore — duplex is needed for streaming request bodies in Node 18+
        duplex: hasBody ? 'half' : undefined,
      });

      try {
        const response = await this.fetch(request, nodeServer, req);

        res.statusCode = response.status;
        for (const [key, value] of response.headers.entries()) {
          res.setHeader(key, value);
        }

        if (response.body) {
          Readable.fromWeb(response.body as any).pipe(res);
        } else {
          res.end();
        }
      } catch (err) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });

    this.server = nodeServer;

    return new Promise((resolve, reject) => {
      nodeServer.once('error', reject);
      nodeServer.listen(opts.port ?? 0, opts.hostname, () => {
        nodeServer.removeListener('error', reject);
        resolve(nodeServer);
      });
    });
  }

  /**
   * Stop the HTTP server.
   */
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close(err => {
        if (err) {
          reject(err);
        }
        else resolve();
      });
    });
  }

  /**
   * Node.js fetch handler. Creates a NodeContext and dispatches the request.
   *
   * @param request The incoming Request object.
   * @param server The Node.js http.Server instance.
   * @returns A Response from the matched route handler.
   */
  fetch = async (
    request: Request,
    server?: unknown,
    incomingMessage?: IncomingMessage
  ): Promise<Response> => {
    const context = new NodeContext(
      request,
      server as Server,
      this,
      incomingMessage ?? null
    );
    const pathname = context.url.pathname;
    const method = (
      request.headers.get('X-HTTP-Method-Override') || request.method
    ).toUpperCase() as HttpMethods;
    return this.dispatch(method, pathname, context);
  };
}
