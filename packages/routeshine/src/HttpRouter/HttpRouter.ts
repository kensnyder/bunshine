import Context from '../Context/Context';
import RouteMatcher from '../RouteMatcher/RouteMatcher';
import { fallback404 } from './fallback404';
import { fallback500 } from './fallback500';

export type NextFunction = () => Promise<Response>;

export type SingleHandler<
  ParamsShape extends Record<string, string> = Record<string, string>,
  TContext extends Context = Context,
> = (
  context: TContext & Context<ParamsShape>,
  next: NextFunction
) => Response | void | Promise<Response | void>;

export type Handler<
  ParamsShape extends Record<string, string> = Record<string, string>,
  TContext extends Context = Context,
> = SingleHandler<ParamsShape, TContext> | Handler<ParamsShape, TContext>[];

export type Middleware<
  ParamsShape extends Record<string, string> = Record<string, string>,
  TContext extends Context = Context,
> = SingleHandler<ParamsShape, TContext> | Handler<ParamsShape, TContext>[];

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
] as const;

export type HttpMethods = (typeof httpMethods)[number];

export type HttpRouterOptions = {
  cacheSize?: number;
};

export default class HttpRouter<TContext extends Context = Context> {
  locals: Record<string, any> = {};
  routeMatcher: RouteMatcher<SingleHandler<Record<string, string>, TContext>>;
  onNotFound: (
    ...handlers: Handler<Record<string, string>, TContext>[]
  ) => this;
  onError: (...handlers: Handler<Record<string, string>, TContext>[]) => this;
  private _on404Handlers: SingleHandler<Record<string, string>, TContext>[] =
    [];
  private _on500Handlers: SingleHandler<Record<string, string>, TContext>[] =
    [];
  /**
   * Create a new HttpRouter instance.
   *
   * @param options Optional configuration.
   * @param options.cacheSize Ignored in routeshine base class (used by bunshine's cached subclass).
   */
  constructor(_options: HttpRouterOptions = {}) {
    this.routeMatcher = new RouteMatcher<
      SingleHandler<Record<string, string>, TContext>
    >();
    this.onNotFound = this.on404;
    this.onError = this.on500;
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
    ...handlers: Handler<ParamsShape, TContext>[]
  ) {
    if (Array.isArray(verbOrVerbs)) {
      for (const verb of verbOrVerbs) {
        this.on<ParamsShape>(verb, path, handlers);
      }
      return this;
    }
    for (const handler of handlers.flat(9)) {
      this.routeMatcher.add(
        verbOrVerbs,
        path,
        handler as SingleHandler<Record<string, string>, TContext>
      );
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
    ...handlers: Handler<ParamsShape, TContext>[]
  ) {
    return this.on<ParamsShape>('ALL', path, handlers);
  }
  /**
   * Register handlers for HTTP GET on a path.
   *
   * HEAD requests to the same path are handled automatically: the GET handler
   * runs and the response body is stripped. Register an explicit `head()` handler
   * to override this behavior.
   *
   * @template ParamsShape The shape of route params available on the Context.
   * @param path Path pattern as a string or RegExp.
   * @param handlers One or more handler functions or arrays of handlers.
   * @returns This HttpRouter instance for chaining.
   */
  get<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape, TContext>[]
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
    ...handlers: Handler<ParamsShape, TContext>[]
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
    ...handlers: Handler<ParamsShape, TContext>[]
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
    ...handlers: Handler<ParamsShape, TContext>[]
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
    ...handlers: Handler<ParamsShape, TContext>[]
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
    ...handlers: Handler<ParamsShape, TContext>[]
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
    ...handlers: Handler<ParamsShape, TContext>[]
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
    ...handlers: Handler<ParamsShape, TContext>[]
  ) {
    return this.on<ParamsShape>('OPTIONS', path, handlers);
  }
  /**
   * Register handlers for HTTP HEAD and GET on a path.
   *
   * @deprecated Since v3.7.0, `get()` automatically handles HEAD requests.
   * Use `get()` instead. To define custom HEAD behavior, use `head()`.
   *
   * @template ParamsShape The shape of route params available on the Context.
   * @param path Path pattern as a string or RegExp.
   * @param handlers One or more handler functions or arrays of handlers.
   * @returns This HttpRouter instance for chaining.
   */
  headGet<ParamsShape extends Record<string, string> = Record<string, string>>(
    path: string | RegExp,
    ...handlers: Handler<ParamsShape, TContext>[]
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
  use = (...handlers: Handler<Record<string, string>, TContext>[]) => {
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
  on404 = (...handlers: Handler<Record<string, string>, TContext>[]) => {
    this._on404Handlers.push(
      ...(handlers.flat(9) as SingleHandler<Record<string, string>, TContext>[])
    );
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
  on500 = (...handlers: Handler<Record<string, string>, TContext>[]) => {
    this._on500Handlers.push(
      ...(handlers.flat(9) as SingleHandler<Record<string, string>, TContext>[])
    );
    return this;
  };
  /**
   * Fetch handler for the router. Compatible with any WinterCG/Fetch-based runtime.
   *
   * Creates a Context for the incoming request and dispatches it based on the
   * HTTP method and URL pathname. Supports X-HTTP-Method-Override header.
   *
   * @param request The incoming Request object.
   * @param server Optional server instance (runtime-specific, passed to Context).
   * @returns A Response resolved from route or error handlers.
   */
  fetch = async (request: Request, server?: unknown) => {
    const context = new Context(request, server, this) as unknown as TContext;
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
  dispatch = (method: HttpMethods, pathname: string, context: TContext) => {
    // Match route handlers first (without 404 fallbacks)
    let routeMatches = this.routeMatcher.match(method, pathname);
    // Auto-handle HEAD via GET when no explicit HEAD handler is registered
    if (method === 'HEAD' && routeMatches.length === 0) {
      routeMatches = this.routeMatcher.match('GET', pathname);
    }
    const matched: Array<
      [SingleHandler<Record<string, string>, TContext>, Record<string, string>]
    > = [
      ...routeMatches,
      ...this._on404Handlers.map(
        h =>
          [h, {}] as [
            SingleHandler<Record<string, string>, TContext>,
            Record<string, string>,
          ]
      ),
    ];
    let i = 0;
    const next: NextFunction = async () => {
      const match = matched[i++];
      if (!match) {
        return fallback404(context);
      }
      const handler = match[0];
      (context as Context).params = match[1];

      try {
        const result = await handler(
          context as TContext & Context<Record<string, string>>,
          next
        );
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
      (context as Context).error = e as Error;
      let idx = 0;
      const nextError: NextFunction = async () => {
        const handler = this._on500Handlers[idx++];
        if (!handler) {
          return fallback500(context);
        }
        try {
          let result = handler(
            context as TContext & Context<Record<string, string>>,
            nextError
          );
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
          (context as Context).error = e as Error;
        }
        return nextError();
      };
      return nextError();
    };
    return next();
  };
}
