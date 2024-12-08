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
