import {
  type Handler as BaseHandler,
  HttpRouter as BaseHttpRouter,
  type Middleware as BaseMiddleware,
  type SingleHandler as BaseSingleHandler,
} from 'routeshine';
import CfwContext, {
  type ExecutionContext, getEmptyContext,
} from '../Context/Context';

export type NextFunction = () => Promise<Response>;

export type SingleHandler<
  ParamsShape extends Record<string, string> = Record<string, string>,
  TEnv = Record<string, unknown>,
> = BaseSingleHandler<ParamsShape, CfwContext<ParamsShape, TEnv>>;

export type Handler<
  ParamsShape extends Record<string, string> = Record<string, string>,
  TEnv = Record<string, unknown>,
> = BaseHandler<ParamsShape, CfwContext<ParamsShape, TEnv>>;

export type Middleware<
  ParamsShape extends Record<string, string> = Record<string, string>,
  TEnv = Record<string, unknown>,
> = BaseMiddleware<ParamsShape, CfwContext<ParamsShape, TEnv>>;

export {
  type HttpMethods,
  type HttpRouterOptions,
  httpMethods,
} from 'routeshine';

/**
 * Cloudflare Workers HTTP router. Extends routeshine's platform-agnostic
 * HttpRouter with a CF Workers-compatible fetch entry point.
 *
 * No listen()/close() — Cloudflare Workers export a fetch handler instead.
 * Use getExport() to obtain the module-syntax export for your worker.
 *
 * Typical usage:
 *
 * const router = new HttpRouter<Env>();
 * router.get('/', c => c.text('Hello from CF Workers!'));
 * export default router.getExport();
 */
export default class HttpRouter<
  TEnv = Record<string, unknown>,
> extends BaseHttpRouter<CfwContext<Record<string, string>, TEnv>> {
  /**
   * Cloudflare Workers fetch entry point.
   *
   * Accepts the three-argument signature used by CF Workers module syntax:
   * `fetch(request, env, ctx)`. Creates a CfwContext and dispatches the request.
   *
   * This method is also compatible with the base class's two-argument signature
   * for test environments where env/ctx are not provided.
   *
   * @param request - The incoming Request object.
   * @param envOrServer - The CF Workers environment bindings (or server for base compat).
   * @param ctx - The CF Workers ExecutionContext.
   * @returns A Response from the matched route handler.
   */
  fetch = async (
    request: Request,
    envOrServer?: unknown,
    ctx?: ExecutionContext
  ): Promise<Response> => {
    const env = (envOrServer ?? {}) as TEnv;
    const context = new CfwContext<Record<string, string>, TEnv>(
      request,
      env,
      ctx ?? getEmptyContext(),
      this
    );
    const pathname = context.url.pathname;
    const method = (
      request.headers.get('X-HTTP-Method-Override') || request.method
    ).toUpperCase() as import('routeshine').HttpMethods;
    return this.dispatch(method, pathname, context);
  };
}
