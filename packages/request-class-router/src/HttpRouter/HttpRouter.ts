import Context from '../Context/Context';
import MatcherWithCache from '../MatcherWithCache/MatcherWithCache';
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
  locals: Record<string, any> = {};
  routeMatcher: MatcherWithCache<SingleHandler>;
  onNotFound: (...handlers: Handler[]) => HttpRouter;
  onError: (...handlers: Handler[]) => HttpRouter;
  private _on404Handlers: SingleHandler[] = [];
  private _on500Handlers: SingleHandler[] = [];
  constructor(options: HttpRouterOptions = {}) {
    this.routeMatcher = new MatcherWithCache<SingleHandler>(
      options.cacheSize || 4000
    );
    this.onNotFound = this.on404;
    this.onError = this.on500;
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
      this.routeMatcher.add(verbOrVerbs, path, handler as SingleHandler);
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
  use = (...handlers: Handler[]) => {
    return this.all('*', handlers);
  };
  on404 = (...handlers: Handler[]) => {
    this._on404Handlers.push(...(handlers.flat(9) as SingleHandler[]));
    return this;
  };
  on500 = (...handlers: Handler[]) => {
    this._on500Handlers.push(...(handlers.flat(9) as SingleHandler[]));
    return this;
  };
  fetch = async <Server = any>(request: Request, server: Server) => {
    const context = new Context(request, server, this);
    const pathname = context.url.pathname;
    const method = (
      request.headers.get('X-HTTP-Method-Override') || request.method
    ).toUpperCase();
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
