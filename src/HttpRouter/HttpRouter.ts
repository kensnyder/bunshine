import type { ServeOptions, Server } from 'bun';
import Context from '../Context/Context';
import PathMatcher from '../PathMatcher/PathMatcher';
import WsRouter from '../WsRouter/WsRouter.ts';
import { fallback404 } from './fallback404';
import { fallback500 } from './fallback500';

export type NextFunction = () => Promise<Response>;

export type SingleHandler = (
  context: Context,
  next: NextFunction
) => Response | void | Promise<Response | void>;

export type Middleware = SingleHandler;

export type Handler = SingleHandler | Handler[];

type RouteInfo = {
  verb: string;
  handler: Handler;
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

export default class HttpRouter {
  locals: Record<string, any> = {};
  pathMatcher: PathMatcher<RouteInfo> = new PathMatcher<RouteInfo>();
  _wsRouter?: WsRouter;
  _onErrors: any[] = [];
  _on404s: any[] = [];
  listen = (options: Omit<ServeOptions, 'fetch'> = {}) => {
    return Bun.serve(this.getExport(options));
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
      this._wsRouter = new WsRouter(this);
    }
    return this._wsRouter;
  }
  on = (
    verbOrVerbs: HttpMethods | HttpMethods[],
    path: string | RegExp,
    ...handlers: Handler[]
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
        handler: handler as SingleHandler,
      });
    }
    return this;
  };
  all = (path: string | RegExp, ...handlers: Handler[]) =>
    this.on('ALL', path, handlers);
  get = (path: string | RegExp, ...handlers: Handler[]) =>
    this.on('GET', path, handlers);
  put = (path: string | RegExp, ...handlers: Handler[]) =>
    this.on('PUT', path, handlers);
  head = (path: string | RegExp, ...handlers: Handler[]) =>
    this.on('HEAD', path, handlers);
  post = (path: string | RegExp, ...handlers: Handler[]) =>
    this.on('POST', path, handlers);
  patch = (path: string | RegExp, ...handlers: Handler[]) =>
    this.on('PATCH', path, handlers);
  trace = (path: string | RegExp, ...handlers: Handler[]) =>
    this.on('TRACE', path, handlers);
  delete = (path: string | RegExp, ...handlers: Handler[]) =>
    this.on('DELETE', path, handlers);
  options = (path: string | RegExp, ...handlers: Handler[]) =>
    this.on('OPTIONS', path, handlers);
  use = (...handlers: Handler[]) => {
    this.all('*', handlers);
    return this;
  };
  onError = (...handlers: Handler[]) => {
    this._onErrors.push(...handlers.flat(9));
    return this;
  };
  on404 = (...handlers: Handler[]) => {
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
    const next: NextFunction = async () => {
      const generated = matched.next();
      if (generated.done) {
        return fallback404(context);
      }
      const match = generated.value;
      context.params = match!.params;
      const handler = match!.target.handler as SingleHandler;

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
