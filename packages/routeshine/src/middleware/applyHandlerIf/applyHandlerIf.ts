import Context from '../../Context/Context';
import {
  Handler,
  Middleware,
  SingleHandler,
} from '../../HttpRouter/HttpRouter';

export type ApplyHandlerIfArgs = {
  requestCondition?: (c: Context) => Promise<boolean> | boolean;
  responseCondition?: (
    c: Context,
    resp: Response
  ) => Promise<boolean> | boolean;
  handler: Handler;
};

export function applyHandlerIf(conditions: ApplyHandlerIfArgs): Middleware {
  if (!conditions.requestCondition && !conditions.responseCondition) {
    return () => {};
  } else if (!conditions.requestCondition) {
    conditions.requestCondition = () => true;
  } else if (!conditions.responseCondition) {
    conditions.responseCondition = () => true;
  }
  const handlers = [conditions.handler].flat(9) as SingleHandler[];
  return async (c, next) => {
    if (await conditions.requestCondition!(c)) {
      const conditionalNext = async () => {
        const resp = await next();
        if (await conditions.responseCondition!(c, resp)) {
          return resp;
        }
        // throwing will give control to the next registered handler that awaits `next()`
        throw resp;
      };
      for (const handler of handlers) {
        const resp = await handler(c, conditionalNext);
        if (resp instanceof Response) {
          return resp;
        }
      }
    }
  };
}
