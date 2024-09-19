import { type SupportedData } from 'any-data';
import type { ServeOptions, Server } from 'bun';
import os from 'os';
import bunshine from '../../package.json';
import Context, { type ContextWithError } from '../Context/Context';
import MatcherWithCache from '../MatcherWithCache/MatcherWithCache.ts';
import PathMatcher from '../PathMatcher/PathMatcher';
import ResponseLike from '../ResponseLike/ResponseLike.ts';
import SocketRouter from '../SocketRouter/SocketRouter.ts';
import { fallback404 } from './fallback404';
import { fallback500 } from './fallback500';

export type NextFunction = () => Promise<ResponseLike>;

export type SingleHandler<
  ParamsShape extends Record<string, string> = Record<string, string>,
> = (
  context: Context<ParamsShape>,
  next: NextFunction
) =>
  | ResponseLike
  | Response
  | SupportedData
  | void
  | Promise<ResponseLike | Response | SupportedData | void>;

export type SingleErrorHandler<
  ParamsShape extends Record<string, string> = Record<string, string>,
> = (
  context: ContextWithError<ParamsShape>,
  next: NextFunction
) => Response | void | Promise<Response | void>;

export type Middleware<
  ParamsShape extends Record<string, string> = Record<string, string>,
> = SingleHandler<ParamsShape>;

export type Handler<
  ParamsShape extends Record<string, string> = Record<string, string>,
> = SingleHandler<ParamsShape> | Handler<ParamsShape>[];

export type ErrorHandler<
  ParamsShape extends Record<string, string> = Record<string, string>,
> = SingleErrorHandler<ParamsShape> | ErrorHandler<ParamsShape>[];

type RouteInfo = {
  verb: string;
  handler: Handler<any>;
};

// Note that BunFile is a subclass of Blob
export type ResponseBody =
  | string
  | null
  | Blob
  | Buffer
  | ArrayBuffer
  | Record<string, any>
  | Array<any>;

export type HeadersAndStatus = {
  headers: Headers;
  status: number;
  statusText: string;
};
export type MaybeHeadersAndStatus = {
  headers?: Headers | Record<string, string> | Array<[string, string]>;
  status?: number;
  statusText?: string;
};

export type ListenOptions = Omit<ServeOptions, 'fetch' | 'websocket'> | number;

export type HttpMethods =
  | 'ALL'
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'
  | 'TRACE';

const runtime = process.versions.bun
  ? `Bun v${process.versions.bun}`
  : `Node v${process.versions.node}`;

const poweredBy = `Bunshine/${bunshine.version}; ${runtime.replace(' v', '/')}`;

const getPathMatchFilter = (verb: string) => (target: RouteInfo) => {
  return target.verb === verb || target.verb === 'ALL';
};

const filters = {
  ALL: () => true,
  GET: getPathMatchFilter('GET'),
  POST: getPathMatchFilter('POST'),
  PUT: getPathMatchFilter('PUT'),
  PATCH: getPathMatchFilter('PATCH'),
  DELETE: getPathMatchFilter('DELETE'),
  HEAD: getPathMatchFilter('HEAD'),
  OPTIONS: getPathMatchFilter('OPTIONS'),
  TRACE: getPathMatchFilter('TRACE'),
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
  version: string = bunshine.version;
  locals: Record<string, any> = {};
  server: Server | undefined;
  isRunning = false;
  pathMatcher: MatcherWithCache<RouteInfo>;
  _wsRouter?: SocketRouter;
  private _onErrors: any[] = [];
  private _on404s: any[] = [];
  constructor(options: HttpRouterOptions = {}) {
    this.pathMatcher = new MatcherWithCache<RouteInfo>(
      new PathMatcher(),
      options.cacheSize || 4000
    );
  }
  listen(portOrOptions: ListenOptions = {}) {
    if (typeof portOrOptions === 'number') {
      portOrOptions = { port: portOrOptions };
    }
    const server = Bun.serve(this.getExport(portOrOptions));
    this.server = server;
    this.isRunning = true;
    return server;
  }
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
      const took = Math.round(performance.now());
      message = `☀️ Bunshine v${bunshine.version} on ${runtime} serving at ${servingAt} on "${server}" in ${mode} (${took}ms)`;
    } else {
      message = `☀️ Serving ${servingAt}`;
    }
    if (date) {
      message = `[${new Date().toISOString()}] ${message}`;
    }
    to(message);
  }
  getPoweredByString() {
    return poweredBy;
  }
  getExport(options: Omit<ServeOptions, 'fetch' | 'websocket'> = {}) {
    const config = {
      port: 0,
      ...options,
      fetch: this.fetch,
    } as ServeOptions;
    if (this._wsRouter) {
      // @ts-expect-error
      config.websocket = this._wsRouter.handlers;
    }
    return config;
  }
  stop() {
    if (!this.isRunning) {
      console.warn('😮 Cant stop server because it has not been started yet.');
    }
    try {
      this.server?.stop();
    } catch (e) {}
    this.isRunning = false;
    console.warn('⛅️ Bunshine was stopped');
  }
  enableGracefulShutdown() {
    // handle graceful shutdown
    const onExit = (code: string | number) => {
      this.stop();
      console.warn(`🌩️ Bunshine exited after receiving exit code: ${code}`);
      process.exit(typeof code === 'number' ? code : 1);
    };
    process.on('SIGTERM', onExit);
    process.on('SIGINT', onExit);
  }
  get socket() {
    if (!this._wsRouter) {
      this._wsRouter = new SocketRouter(this);
    }
    return this._wsRouter;
  }
  on<ParamsShape extends Record<string, string> = Record<string, string>>(
    verbOrVerbs: HttpMethods | HttpMethods[],
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    if (Array.isArray(verbOrVerbs)) {
      for (const verb of verbOrVerbs) {
        this.on(verb, path, handlers);
      }
      return this;
    }
    for (const handler of handlers.flat(9)) {
      this.pathMatcher.add(path, {
        verb: verbOrVerbs as string,
        handler: handler as SingleHandler<ParamsShape>,
      });
    }
    return this;
  }
  all<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    return this.on<ParamsShape>('ALL', path, handlers);
  }
  get<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    return this.on<ParamsShape>('GET', path, handlers);
  }
  put<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    return this.on<ParamsShape>('PUT', path, handlers);
  }
  head<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    return this.on<ParamsShape>('HEAD', path, handlers);
  }
  post<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    return this.on<ParamsShape>('POST', path, handlers);
  }
  patch<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    return this.on<ParamsShape>('PATCH', path, handlers);
  }
  trace<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    return this.on<ParamsShape>('TRACE', path, handlers);
  }
  delete<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    return this.on<ParamsShape>('DELETE', path, handlers);
  }
  options<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    return this.on<ParamsShape>('OPTIONS', path, handlers);
  }
  headGet<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) {
    return this.on<ParamsShape>(['HEAD', 'GET'], path, handlers);
  }
  use(...handlers: Handler<{}>[]) {
    return this.all('*', handlers);
  }
  onError(...handlers: ErrorHandler<Record<string, string>>[]) {
    this._onErrors.push(...handlers.flat(9));
    return this;
  }
  on404(...handlers: Handler<Record<string, string>>[]) {
    this._on404s.push(...handlers.flat(9));
    return this;
  }
  fetch = async (request: Request, server: Server) => {
    const context = new Context(request, server, this);
    const pathname = context.url.pathname;
    const method = (
      request.headers.get('X-HTTP-Method-Override') || request.method
    ).toUpperCase();
    const filter = filters[method] || getPathMatchFilter(method);
    const matched = this.pathMatcher.match(pathname, filter, this._on404s);
    let i = 0;
    const next: NextFunction = async () => {
      const match = matched[i++];
      if (!match) {
        return fallback404(context);
      }
      context.params = match.params;
      const handler = match.target.handler as SingleHandler;

      try {
        const result = await handler(context, next);
        if (result === undefined) {
          return next();
        }
        return ResponseLike.fromAny(result);
      } catch (e) {
        // @ts-expect-error
        return errorHandler(e);
      }
    };
    const errorHandler = (e: Error | ResponseLike) => {
      if (!(e instanceof Error)) {
        // a response has been thrown; respond to client with it
        return ResponseLike.fromAny(e);
      }
      context.error = e as Error;
      let idx = 0;
      const nextError: NextFunction = async () => {
        const handler = this._onErrors[idx++];
        if (!handler) {
          return fallback500(context as ContextWithError);
        }
        try {
          const result = await handler(context, next);
          return ResponseLike.fromAny(result);
        } catch (e) {
          context.error = e as Error;
        }
        return nextError();
      };
      return nextError();
    };
    const responseLike = await next();
    return responseLike.toResponse();
  };
}
