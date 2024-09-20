import type { ServeOptions, Server } from 'bun';
import os from 'os';
import bunshine from '../../package.json';
import Context, { type ContextWithError } from '../Context/Context';
import MatcherWithCache from '../MatcherWithCache/MatcherWithCache.ts';
import SocketRouter from '../SocketRouter/SocketRouter.ts';
import { fallback404 } from './fallback404';
import { fallback500 } from './fallback500';

export type NextFunction = () => Promise<Response>;

export type SingleHandler<
  ParamsShape extends Record<string, string> = Record<string, string>,
> = (
  context: Context<ParamsShape>,
  next: NextFunction
) => Response | void | Promise<Response | void>;

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
  routeMatcher: MatcherWithCache<SingleHandler>;
  _wsRouter?: SocketRouter;
  private _onErrors: any[] = [];
  private _on404s: any[] = [];
  constructor(options: HttpRouterOptions = {}) {
    this.routeMatcher = new MatcherWithCache<SingleHandler>(
      options.cacheSize || 4000
    );
  }
  listen(portOrOptions: ListenOptions = {}) {
    if (typeof portOrOptions === 'number') {
      portOrOptions = { port: portOrOptions };
    }
    const server = Bun.serve(this.getExport(portOrOptions));
    this.server = server;
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
      const runtime = process.versions.bun
        ? `Bun v${process.versions.bun}`
        : `Node v${process.versions.node}`;
      message = `☀️ Bunshine v${bunshine.version} on ${runtime} serving at ${servingAt} on "${server}" in ${mode} (${took}ms)`;
    } else {
      message = `☀️ Serving ${servingAt}`;
    }
    if (date) {
      message = `[${new Date().toISOString()}] ${message}`;
    }
    to(message);
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
      this.routeMatcher.add(
        verbOrVerbs,
        path,
        handler as SingleHandler<ParamsShape>
      );
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
    const matched = this.routeMatcher.match(method, pathname, this._on404s);
    let i = 0;
    const next: NextFunction = async () => {
      const match = matched[i++];
      if (!match) {
        return fallback404(context);
      }
      const handler = match[0].handler as SingleHandler;
      context.params = match[1];

      try {
        let result = handler(context, next);
        if (result instanceof Response) {
          return result;
        }
        if (typeof result?.then === 'function') {
          result = await result;
          if (result instanceof Response) {
            return result;
          }
        }
        return next();
      } catch (e) {
        // @ts-expect-error
        return errorHandler(e);
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
        const handler = this._onErrors[idx++];
        if (!handler) {
          return fallback500(context as ContextWithError);
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
