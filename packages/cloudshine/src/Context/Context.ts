import { Context as BaseContext } from 'routeshine';
import type HttpRouter from '../HttpRouter/HttpRouter';

/**
 * Minimal ExecutionContext interface matching Cloudflare Workers' ExecutionContext.
 * Structurally compatible with @cloudflare/workers-types ExecutionContext.
 */
export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

export const getEmptyContext = () => ({ waitUntil: () => {}, passThroughOnException: () => {} }) as ExecutionContext;

/**
 * Cloudflare Workers-specific Context extends the platform-agnostic base Context.
 *
 * Generics:
 * - ParamsShape: shape of the `params` object extracted from the matched route placeholders.
 * - TEnv: shape of the Cloudflare Workers environment bindings (KV, D1, secrets, etc.).
 *
 * Typical usage:
 *
 * app.get('/hello/:name', (c) => {
 *   const { name } = c.params;
 *   const value = await c.env.MY_KV.get('key');
 *   return c.text(`Hello ${name}!`);
 * });
 */
export default class CfwContext<
  ParamsShape extends Record<string, string> = Record<string, string>,
  TEnv = Record<string, unknown>,
> extends BaseContext<ParamsShape, ExecutionContext> {
  declare server: ExecutionContext;
  declare app: HttpRouter<TEnv>;

  /** The Cloudflare Workers environment bindings (KV namespaces, D1 databases, secrets, etc.) */
  env: TEnv;

  /**
   * Construct a new CfwContext for a single incoming request.
   *
   * @param request - The native Request object received by the worker.
   * @param env - The Cloudflare Workers environment bindings.
   * @param ctx - The Cloudflare Workers ExecutionContext.
   * @param app - The HttpRouter instance your routes are registered on.
   */
  constructor(
    request: Request,
    env: TEnv,
    ctx: ExecutionContext,
    app: HttpRouter<TEnv>
  ) {
    super(request, ctx, app);
    this.env = env;
  }

  /**
   * Get the client's IP address from the CF-Connecting-IP header.
   *
   * Returns null if the header is not present (e.g., local dev without wrangler).
   * Note: This header is set by Cloudflare's edge network.
   */
  get ip(): string | null {
    return this.request.headers.get('CF-Connecting-IP');
  }
}
