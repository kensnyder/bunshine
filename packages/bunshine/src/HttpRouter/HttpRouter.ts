import { Serve, Server } from 'bun';
import os from 'node:os';
import path from 'node:path';
import bunshinePkg from '../../package.json' assert { type: 'json' };
import Context from '../Context/Context';
import MatcherWithCache from '../MatcherWithCache/MatcherWithCache';
import RouteMatcher from '../RouteMatcher/RouteMatcher';
import SocketRouter from '../SocketRouter/SocketRouter';
import { fallback404 } from './fallback404';
import { fallback500 } from './fallback500';

export type NextFunction = () => Promise<Response>;

export type SingleHandler<
  ParamsShape extends Record<string, string> = Record<string, string>,
> = (
  context: Context<ParamsShape>,
  next: NextFunction
) => Response | void | Promise<Response | void>;

export type Handler<
  ParamsShape extends Record<string, string> = Record<string, string>,
> = SingleHandler<ParamsShape> | Handler<ParamsShape>[];

export type Middleware<
  ParamsShape extends Record<string, string> = Record<string, string>,
> = SingleHandler<ParamsShape> | Handler<ParamsShape>[];

export type ListenOptions =
  | Omit<Serve.Options<any, any>, 'fetch' | 'websocket'>
  | number;

export const httpMethods = [
  'ALL',
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
  'TRACE',
];

export const methodsPlusAliases = [...httpMethods, 'HEADGET'];

export type HttpMethods = (typeof httpMethods)[number];

export type FileRouteShape = {
  filename: string;
  method: string;
  path: string;
  handler: Handler;
};

export type HttpRouterOptions = {
  cacheSize?: number;
};

export type EmitUrlOptions = {
  verbose?: boolean;
  to?: (message: string) => void;
  date?: boolean;
};

export default class HttpRouter {
  readonly version: string = bunshinePkg.version;
  locals: Record<string, any> = {};
  server: Server<any> | undefined;
  routeMatcher: MatcherWithCache<SingleHandler>;
  _wsRouter?: SocketRouter;
  onNotFound: (...handlers: Handler[]) => HttpRouter;
  onError: (...handlers: Handler[]) => HttpRouter;
  private _on404Handlers: SingleHandler[] = [];
  private _on500Handlers: SingleHandler[] = [];
  startupTook: number = -1;
  /**
   * Create a new HttpRouter instance.
   *
   * @param options Optional configuration.
   * @param options.cacheSize Maximum number of compiled matchers to cache. Defaults to 4000.
   */
  constructor(options: HttpRouterOptions = {}) {
    this.routeMatcher = new MatcherWithCache<SingleHandler>(
      options.cacheSize || 4000
    );
    this.onNotFound = this.on404;
    this.onError = this.on500;
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
   * @param scanPath Absolute or relative directory path to scan.
   * @param glob Glob pattern for files to include. Defaults to a recursive TypeScript glob.
   * @returns List of absolute file paths that were registered.
   */
  async registerFileRoutes({
    path: scanPath,
    glob = '**/*.ts',
  }: {
    path: string;
    glob?: string;
  }) {
    const scanner = new Bun.Glob(glob);
    const routes: FileRouteShape[] = [];
    for await (const file of scanner.scan(scanPath)) {
      const absolutePath = path.join(scanPath, file);
      const module = await import(absolutePath);
      const routePath =
        '/' +
        file
          .replace(/\.[^.]+$/, '') // remove extension
          .replaceAll('.', '/') // dots represent slashes
          .replaceAll('$', ':'); // $ means a dynamic segment
      for (const VERB of httpMethods) {
        if (
          typeof module[VERB] === 'function' ||
          (Array.isArray(module[VERB]) &&
            module[VERB].flat(9).every(f => typeof f === 'function'))
        ) {
          routes.push({
            filename: file,
            method: VERB,
            path: routePath,
            handler: module[VERB],
          });
        }
      }
    }

    routes.sort(RouteMatcher.sortBySpecificity).forEach(r => {
      this.on(r.method, r.path, r.handler);
    });

    return routes;
  }
  /**
   * Register one or more handlers for a route path and HTTP method(s).
   *
   * Handlers can be nested arrays; they will be flattened and added in order.
   *
   * @template ParamsShape The shape of route params available on the Context.
   * @param verbOrVerbs Single HTTP method or array of methods.
   * @param path Path pattern as a string or RegExp. RegExp is discouraged
   * because you may introduce Regex Denial of Service vulnerabilities
   * @param handlers One or more handler functions or arrays of handlers.
   * @returns This HttpRouter instance for chaining.
   */
  on<ParamsShape extends Record<string, string> = Record<string, string>>(
    verbOrVerbs: HttpMethods | HttpMethods[],
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    if (Array.isArray(verbOrVerbs)) {
      for (const verb of verbOrVerbs) {
        this.on<ParamsShape>(verb, path, handlers);
      }
      return this;
    }
    for (const handler of handlers.flat(9)) {
      this.routeMatcher.add(verbOrVerbs, path, handler as SingleHandler);
    }
    return this;
  }
  /**
   * Register handlers for all HTTP methods on a path.
   *
   * @template ParamsShape The shape of route params available on the Context.
   * @param path Path pattern as a string or RegExp. RegExp is discouraged
   * because you may introduce Regex Denial of Service vulnerabilities
   * @param handlers One or more handler functions or arrays of handlers.
   * @returns This HttpRouter instance for chaining.
   */
  all<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    return this.on<ParamsShape>('ALL', path, handlers);
  }
  /**
   * Register handlers for HTTP GET on a path.
   *
   * @template ParamsShape The shape of route params available on the Context.
   * @param path Path pattern as a string or RegExp.
   * @param handlers One or more handler functions or arrays of handlers.
   * @returns This HttpRouter instance for chaining.
   */
  get<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    return this.on<ParamsShape>('GET', path, handlers);
  }
  /**
   * Register handlers for HTTP PUT on a path.
   *
   * @template ParamsShape The shape of route params available on the Context.
   * @param path Path pattern as a string or RegExp.
   * @param handlers One or more handler functions or arrays of handlers.
   * @returns This HttpRouter instance for chaining.
   */
  put<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    return this.on<ParamsShape>('PUT', path, handlers);
  }
  /**
   * Register handlers for HTTP HEAD on a path.
   *
   * @template ParamsShape The shape of route params available on the Context.
   * @param path Path pattern as a string or RegExp.
   * @param handlers One or more handler functions or arrays of handlers.
   * @returns This HttpRouter instance for chaining.
   */
  head<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    return this.on<ParamsShape>('HEAD', path, handlers);
  }
  /**
   * Register handlers for HTTP POST on a path.
   *
   * @template ParamsShape The shape of route params available on the Context.
   * @param path Path pattern as a string or RegExp.
   * @param handlers One or more handler functions or arrays of handlers.
   * @returns This HttpRouter instance for chaining.
   */
  post<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    return this.on<ParamsShape>('POST', path, handlers);
  }
  /**
   * Register handlers for HTTP PATCH on a path.
   *
   * @template ParamsShape The shape of route params available on the Context.
   * @param path Path pattern as a string or RegExp.
   * @param handlers One or more handler functions or arrays of handlers.
   * @returns This HttpRouter instance for chaining.
   */
  patch<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    return this.on<ParamsShape>('PATCH', path, handlers);
  }
  /**
   * Register handlers for HTTP TRACE on a path.
   *
   * @template ParamsShape The shape of route params available on the Context.
   * @param path Path pattern as a string or RegExp.
   * @param handlers One or more handler functions or arrays of handlers.
   * @returns This HttpRouter instance for chaining.
   */
  trace<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    return this.on<ParamsShape>('TRACE', path, handlers);
  }
  /**
   * Register handlers for HTTP DELETE on a path.
   *
   * @template ParamsShape The shape of route params available on the Context.
   * @param path Path pattern as a string or RegExp.
   * @param handlers One or more handler functions or arrays of handlers.
   * @returns This HttpRouter instance for chaining.
   */
  delete<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    return this.on<ParamsShape>('DELETE', path, handlers);
  }
  /**
   * Register handlers for HTTP OPTIONS on a path.
   *
   * @template ParamsShape The shape of route params available on the Context.
   * @param path Path pattern as a string or RegExp.
   * @param handlers One or more handler functions or arrays of handlers.
   * @returns This HttpRouter instance for chaining.
   */
  options<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    return this.on<ParamsShape>('OPTIONS', path, handlers);
  }
  /**
   * Register handlers for HTTP HEAD and GET on a path.
   *
   * Useful for resources where HEAD should resolve to the same handlers as GET.
   *
   * @template ParamsShape The shape of route params available on the Context.
   * @param path Path pattern as a string or RegExp.
   * @param handlers One or more handler functions or arrays of handlers.
   * @returns This HttpRouter instance for chaining.
   */
  headGet<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    return this.on<ParamsShape>(['HEAD', 'GET'], path, handlers);
  }
  /**
   * Register global middleware for all routes and methods.
   *
   * This is equivalent to calling router.all('*', handlers).
   *
   * @param handlers One or more handler functions or arrays of handlers.
   * @returns This HttpRouter instance for chaining.
   */
  use = (...handlers: Handler[]) => {
    return this.all('*', handlers);
  };
  /**
   * Register handlers to run when no route matches (404).
   *
   * Handlers are executed in order; call next() to run the next 404 handler.
   * If none produce a Response, a default 404 response is returned.
   *
   * @param handlers One or more handler functions or arrays of handlers.
   * @returns This HttpRouter instance for chaining.
   */
  on404 = (...handlers: Handler[]) => {
    this._on404Handlers.push(...(handlers.flat(9) as SingleHandler[]));
    return this;
  };
  /**
   * Register handlers to run when an error occurs (500).
   *
   * If a handler throws a Response, it will be sent to the client immediately.
   * Handlers are executed in order until one returns a Response or all run.
   *
   * @param handlers One or more handler functions or arrays of handlers.
   * @returns This HttpRouter instance for chaining.
   */
  on500 = (...handlers: Handler[]) => {
    this._on500Handlers.push(...(handlers.flat(9) as SingleHandler[]));
    return this;
  };
  /**
   * Bun.serve fetch handler bound to this router.
   *
   * Creates a Context for the incoming request and dispatches it based on the
   * HTTP method and URL pathname. Supports X-HTTP-Method-Override header.
   *
   * @param request The incoming Request object.
   * @param server The Bun server instance.
   * @returns A Response resolved from route or error handlers.
   */
  fetch = async (request: Request, server: Server<any>) => {
    const context = new Context(request, server, this);
    const pathname = context.url.pathname;
    const method = (
      request.headers.get('X-HTTP-Method-Override') || request.method
    ).toUpperCase() as HttpMethods;
    return this.dispatch(method, pathname, context);
  };
  /**
   * Internal request dispatcher that runs matching route handlers and error handlers.
   *
   * - Routes are matched using the method and pathname against the route matcher.
   * - Handlers are invoked sequentially via a next() function until one returns a Response.
   * - If a handler throws a Response, it is returned directly to the client.
   * - If an error is thrown, 500 handlers registered via on500 are executed in order.
   * - If no route matches, 404 handlers registered via on404 are considered, otherwise a default 404 is returned.
   *
   * @param method HTTP method for the request.
   * @param pathname URL pathname to match.
   * @param context Request context object.
   * @returns A Response from a route, a 404 fallback, or a 500 fallback.
   */
  dispatch = (method: HttpMethods, pathname: string, context: Context) => {
    const matched = this.routeMatcher.match(
      method,
      pathname,
      this._on404Handlers
    );
    let i = 0;
    const next: NextFunction = async () => {
      const match = matched[i++];
      if (!match) {
        return fallback404(context);
      }
      const handler = match[0] as SingleHandler;
      context.params = match[1];

      try {
        let result = await handler(context, next);
        if (result instanceof Response) {
          return result;
        } else {
          return next();
        }
      } catch (e) {
        return errorHandler(e as Error);
      }
    };
    const errorHandler = (e: Error | Response) => {
      if (e instanceof Response) {
        // a response has been thrown; respond to client with it
        return e;
      }
      context.error = e as Error;
      let idx = 0;
      const nextError: NextFunction = async () => {
        const handler = this._on500Handlers[idx++];
        if (!handler) {
          return fallback500(context);
        }
        try {
          let result = handler(context, nextError);
          if (result instanceof Response) {
            return result;
          }
          if (typeof result?.then === 'function') {
            result = await result;
            if (result instanceof Response) {
              return result;
            }
          }
        } catch (e) {
          context.error = e as Error;
        }
        return nextError();
      };
      return nextError();
    };
    return next();
  };
}
