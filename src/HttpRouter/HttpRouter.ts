import type { ServeOptions, Server } from 'bun';
// @ts-ignore
import bunshine from '../../package.json';
import Context from '../Context/Context';
import MatcherWithCache from '../MatcherWithCache/MatcherWithCache.ts';
import PathMatcher from '../PathMatcher/PathMatcher';
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

export type Middleware<
  ParamsShape extends Record<string, string> = Record<string, string>,
> = SingleHandler<ParamsShape>;

export type Handler<
  ParamsShape extends Record<string, string> = Record<string, string>,
> = SingleHandler<ParamsShape> | Handler<ParamsShape>[];

type RouteInfo = {
  verb: string;
  handler: Handler<any>;
};

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
};

export default class HttpRouter {
  version: string = bunshine.version;
  locals: Record<string, any> = {};
  server: Server | undefined;
  pathMatcher: MatcherWithCache<RouteInfo>;
  _wsRouter?: SocketRouter;
  _onErrors: any[] = [];
  _on404s: any[] = [];
  constructor(options: HttpRouterOptions = {}) {
    this.pathMatcher = new MatcherWithCache<RouteInfo>(
      new PathMatcher(),
      options.cacheSize || 4000
    );
  }
  respectSigTerm = ({ closeActiveConnections = true } = {}) => {
    ['SIGTERM', 'SIGINT'].forEach(signal => {
      process.once(signal, () => {
        console.log(`☀️ Received ${signal}, shutting down.`);
        this.server?.stop(closeActiveConnections);
      });
    });
  };
  listen = (options: Omit<ServeOptions, 'fetch'> = {}) => {
    const server = Bun.serve(this.getExport(options));
    this.server = server;
    return server;
  };
  emitUrl = (options: EmitUrlOptions = { verbose: false }) => {
    if (!this.server) {
      throw new Error(
        'Cannot emit URL before server has been started. Use .listen() to start the server first.'
      );
    }
    const servingAt = String(this.server.url);
    if (options.verbose) {
      const server = Bun.env.COMPUTERNAME || Bun.env.HOSTNAME;
      const mode = Bun.env.NODE_ENV || 'production';
      const took = Math.round(performance.now());
      console.log(
        `☀️ Bunshine v${bunshine.version} on Bun v${Bun.version} running at ${servingAt} on server "${server}" in ${mode} (${took}ms)`
      );
    } else {
      console.log(`☀️ Serving ${servingAt}`);
    }
  };
  getExport = (options: Omit<ServeOptions, 'fetch' | 'websocket'> = {}) => {
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
  };
  get socket() {
    if (!this._wsRouter) {
      this._wsRouter = new SocketRouter(this);
    }
    return this._wsRouter;
  }
  on = <ParamsShape extends Record<string, string> = Record<string, string>>(
    verbOrVerbs: HttpMethods | HttpMethods[],
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) => {
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
  };
  all = <ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) => this.on<ParamsShape>('ALL', path, handlers);
  get = <ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) => this.on<ParamsShape>('GET', path, handlers);
  put = <ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) => this.on<ParamsShape>('PUT', path, handlers);
  head = <ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) => this.on<ParamsShape>('HEAD', path, handlers);
  post = <ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) => this.on<ParamsShape>('POST', path, handlers);
  patch = <ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) => this.on<ParamsShape>('PATCH', path, handlers);
  trace = <ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) => this.on<ParamsShape>('TRACE', path, handlers);
  delete = <
    ParamsShape extends Record<string, string> = Record<string, string>,
  >(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) => this.on<ParamsShape>('DELETE', path, handlers);
  options = <
    ParamsShape extends Record<string, string> = Record<string, string>,
  >(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape>[]
  ) => this.on<ParamsShape>('OPTIONS', path, handlers);
  use = (...handlers: Handler<{}>[]) => {
    this.all('*', handlers);
    return this;
  };
  onError = (...handlers: Handler<Record<string, string>>[]) => {
    this._onErrors.push(...handlers.flat(9));
    return this;
  };
  on404 = (...handlers: Handler<Record<string, string>>[]) => {
    this._on404s.push(...handlers.flat(9));
    return this;
  };
  fetch = async (request: Request, server: Server) => {
    const context = new Context(request, server, this);
    const pathname = context.url.pathname;
    const method = (
      request.headers.get('X-HTTP-Method-Override') || request.method
    ).toUpperCase();
    // @ts-expect-error
    const filter = filters[method] || getPathMatchFilter(method);
    const matched = this.pathMatcher.match(pathname, filter, this._on404s);
    let i = 0;
    const next: NextFunction = async () => {
      const match = matched[i++];
      if (!match) {
        return fallback404(context);
      }
      context.params = match.params;
      const handler = match.target.handler as SingleHandler<
        Record<string, string>
      >;

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
