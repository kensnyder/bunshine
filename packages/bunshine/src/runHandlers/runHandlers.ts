import Context from '../Context/Context';
import { Handler, NextFunction, SingleHandler } from '../HttpRouter/HttpRouter';

export type FallbackHandler = (c: Context) => Response | Promise<Response>;

export type RunShape = {
  context: Context;
  handlers: Handler;
  on404?: FallbackHandler;
  on500?: FallbackHandler;
};

export default function runHandlers({
  context,
  handlers,
  on404,
  on500,
}: RunShape) {
  const toRun = (Array.isArray(handlers) ? handlers : [handlers]).flat(9);
  let i = 0;
  const next: NextFunction = async () => {
    const handler = toRun[i++] as SingleHandler;
    if (!handler) {
      if (on404) {
        return on404(context);
      } else {
        throw new Error('UNHANDLED');
      }
    }
    try {
      let result = await handler(context, next);
      if (result instanceof Response) {
        return result;
      } else {
        return next();
      }
    } catch (e) {
      if (e instanceof Response) {
        return e;
      }
      if (on500) {
        return on500(context);
      } else {
        throw e;
      }
    }
  };
  return next();
}

export function getResponder<Context = any>(
  on404: (ctx: Context) => Response,
  on500: (ctx: Context) => Response
) {
  return function responder(
    context: Context,
    toRun: Array<(ctx: Context, next: () => any) => any>
  ) {
    let i = 0;
    const next: NextFunction = async () => {
      const handler = toRun[i++];
      if (!handler) {
        return on404(context);
      }
      try {
        let result = await handler(context, next);
        if (result instanceof Response) {
          return result;
        }
        return next();
      } catch (e) {
        if (e instanceof Response) {
          return e;
        }
        return on500(context);
      }
    };
    return next();
  };
}

export function getResponderMulti<Context = any>(
  on404s: Array<(ctx: Context, next: () => any) => Response>,
  on500s: Array<(ctx: Context, next: () => any) => Response>
) {
  return function responder(
    context: Context,
    toRun: Array<(ctx: Context, next: () => any) => any>
  ) {
    let toRunIndex = 0;
    let on404Index = 0;
    let on500Index = 0;
    const next: NextFunction = async () => {
      const handler = context.error
        ? on500s[on500Index++]
        : toRun[toRunIndex++];
      if (!handler) {
        return on404s[on404Index++](context, next);
      }
      try {
        let result = await handler(context, next);
        if (result instanceof Response) {
          return result;
        }
        return next();
      } catch (e) {
        if (e instanceof Response) {
          return e;
        }
        context.error = e;
        return next();
      }
    };
    return next();
  };
}
