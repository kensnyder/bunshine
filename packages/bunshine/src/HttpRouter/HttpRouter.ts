import os from 'node:os';
import type { Serve, Server } from 'bun';
import bunshinePkg from '../../package.json' with { type: 'json' };

import {
  type Handler as BaseHandler,
  HttpRouter as BaseHttpRouter,
  MatcherWithCache,
  type Middleware as BaseMiddleware,
  type SingleHandler as BaseSingleHandler,
} from 'routeshine';
import BunContext from '../Context/Context';
import SocketRouter from '../SocketRouter/SocketRouter';
import { registerFileRoutes } from './registerFileRoutes';

export type NextFunction = () => Promise<Response>;

export type SingleHandler<
  ParamsShape extends Record<string, string> = Record<string, string>,
> = BaseSingleHandler<ParamsShape, BunContext>;

export type Handler<
  ParamsShape extends Record<string, string> = Record<string, string>,
> = BaseHandler<ParamsShape, BunContext>;

export type Middleware<
  ParamsShape extends Record<string, string> = Record<string, string>,
> = BaseMiddleware<ParamsShape, BunContext>;

export type ListenOptions =
  | Omit<Serve.Options<any, any>, 'fetch' | 'websocket'>
  | number;

export {
  type HttpMethods,
  type HttpRouterOptions,
  httpMethods,
} from 'routeshine';

export type EmitUrlOptions = {
  verbose?: boolean;
  to?: (message: string) => void;
  date?: boolean;
};

export default class HttpRouter extends BaseHttpRouter<BunContext> {
  readonly version: string = bunshinePkg.version;
  server: Server<any> | undefined;
  _wsRouter?: SocketRouter;
  startupTook: number = -1;
  /**
   * Create a new HttpRouter instance.
   *
   * @param options Optional configuration.
   * @param options.cacheSize Maximum number of compiled matchers to cache. Defaults to 4000.
   */
  constructor(options: { cacheSize?: number } = {}) {
    super(options);
    this.routeMatcher = new MatcherWithCache<SingleHandler>(
      options.cacheSize || 4000
    );
  }
  /**
   * Start the HTTP server.
   *
   * You can pass either a port number or a Bun.Serve options object (without fetch/websocket).
   *
   * @param portOrOptions Port number or Bun.serve options. Defaults to {}.
   *  Use port 0 or empty arguments to use a random port
   * @returns The created Bun server instance.
   */
  listen(portOrOptions: ListenOptions = {}) {
    if (typeof portOrOptions === 'number') {
      portOrOptions = { port: portOrOptions };
    }
    const start = Date.now();
    const server = Bun.serve(this.getExport(portOrOptions));
    this.server = server;
    this.startupTook = Date.now() - start;
    return server;
  }

  /**
   * Stop the HTTP server
   */
  async close(closeActiveConnections: boolean) {
    return this.server?.stop?.(closeActiveConnections);
  }
  /**
   * Emit the server URL to a logger function once the server is started.
   *
   * @param options Verbosity and formatting options.
   * @param options.verbose When true, include environment/runtime details.
   * @param options.to Logger function to write the message to. Defaults to console.log.
   * @param options.date When true, prefix the message with an ISO timestamp.
   */
  emitUrl({
    verbose = false,
    to = console.log,
    date = false,
  }: EmitUrlOptions = {}) {
    if (!this.server) {
      throw new Error(
        'Cannot emit URL before server has been started. Use .listen() to start the server first.'
      );
    }
    const servingAt = String(this.server.url);
    let message: string;
    if (verbose) {
      const server = os.hostname();
      const mode = Bun.env.NODE_ENV || 'production';
      const took = Math.round(this.startupTook);
      const runtime = process.versions.bun
        ? `Bun v${process.versions.bun}`
        : `Node v${process.versions.node}`;
      message = `☀️ Bunshine v${bunshinePkg.version} on ${runtime} serving at ${servingAt} on "${server}" in ${mode} after ${took}ms`;
    } else {
      message = `☀️ Serving ${servingAt}`;
    }
    if (date) {
      message = `[${new Date().toISOString()}] ${message}`;
    }
    to(message);
  }
  /**
   * Build a Bun.serve configuration object using this router's handlers.
   *
   * If a SocketRouter has been initialized, its websocket handlers are attached.
   *
   * @param options Bun.serve options (except fetch/websocket which bunshine adds).
   * @returns A Bun.Serve.Options object ready to be passed to Bun.serve.
   */
  getExport(
    options: Omit<Serve.Options<any, any>, 'fetch' | 'websocket'> = {}
  ) {
    const config = {
      port: 0,
      ...options,
      fetch: this.fetch,
    } as Serve.Options<any, any>;
    if (this._wsRouter) {
      config.websocket = this._wsRouter.handlers;
    }
    return config;
  }
  /**
   * Access the WebSocket router for this HTTP router.
   *
   * Lazily initializes a SocketRouter on first access and returns it.
   *
   * @returns The SocketRouter instance.
   */
  get socket() {
    if (!this._wsRouter) {
      this._wsRouter = new SocketRouter(this);
    }
    return this._wsRouter;
  }
  /**
   * Dynamically import and register route files from a directory using a glob.
   *
   * Each matched module whose default export is a function will be invoked with this router.
   *
   * @param path Path to scan. Can be absolute or directory relative to cwd.
   * @param glob Glob pattern for files to include. Defaults to a recursive TypeScript glob.
   * @returns List of absolute file paths that were registered.
   */
  async registerFileRoutes({
    path,
    glob = '**/*.ts',
  }: {
    path: string;
    glob?: string;
  }) {
    return registerFileRoutes(this, { path, glob });
  }
  /**
   * Bun.serve fetch handler bound to this router.
   *
   * Creates a BunContext for the incoming request and dispatches it based on the
   * HTTP method and URL pathname. Supports X-HTTP-Method-Override header.
   *
   * @param request The incoming Request object.
   * @param server The Bun server instance.
   * @returns A Response resolved from route or error handlers.
   */
  fetch = async (request: Request, server?: unknown) => {
    const context = new BunContext(request, server as Server<any>, this);
    const pathname = context.url.pathname;
    const method = (
      request.headers.get('X-HTTP-Method-Override') || request.method
    ).toUpperCase() as import('routeshine').HttpMethods;
    return this.dispatch(method, pathname, context);
  };
}
