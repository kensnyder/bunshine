import type Context from '../../Context/Context.ts';
import type { Middleware, NextFunction } from '../../HttpRouter/HttpRouter.ts';

export type HeaderValue =
  | string
  | ((c: Context, resp: Response) => string | null | Promise<string | null>);
export type HeaderValues = Record<string, HeaderValue>;
export type HeaderCondition = (
  c: Context,
  resp: Response
) => boolean | Promise<boolean>;

export function headers(
  headers: HeaderValues,
  condition?: HeaderCondition
): Middleware {
  return async (context: Context, next: NextFunction) => {
    const resp = await next();
    let shouldAdd = true;
    if (typeof condition === 'function') {
      try {
        shouldAdd = await condition(context, resp);
      } catch (e) {
        shouldAdd = false;
      }
    }
    if (!shouldAdd) {
      return resp;
    }
    for (const [name, value] of Object.entries(headers)) {
      const resolved = await resolveHeaderValue(value, context, resp);
      if (typeof resolved === 'string') {
        resp.headers.set(name, resolved);
      }
    }
    return resp;
  };
}

async function resolveHeaderValue(
  value: HeaderValue,
  context: Context,
  resp: Response
) {
  if (typeof value === 'string') {
    return value;
  } else {
    try {
      const resolved = await value(context, resp);
      return resolved || null;
    } catch (e) {
      return null;
    }
  }
}
