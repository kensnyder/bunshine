import type { ServerWebSocket } from 'bun';
import type { NextFunction } from 'request-class-router';
import { RouteMatcher } from 'request-class-router';
import { RequireAtLeastOne } from 'type-fest';
import Context from '../Context/Context';
import HttpRouter from '../HttpRouter/HttpRouter';
import SocketContext, { SocketMessage } from './SocketContext';

// U = UpgradeShape
// P = ParamsShape
// T = Type i.e. SocketEventType

export type WsDataShape<U = any, P = Record<string, any>> = {
  sc: SocketContext<U, P>;
};

export type SocketUpgradeHandler<
  U,
  P extends Record<string, any> = Record<string, any>,
> = (context: Context<P>, next: NextFunction) => U | Promise<U>;

export type SocketPlainHandler<U, P> = (context: SocketContext<U, P>) => void;

export type SocketMessageHandler<U, P, T extends SocketEventType> = (
  context: SocketContext<U, P>,
  message: SocketMessage<T>
) => void;

export type SocketErrorHandler<U, P> = (
  context: SocketContext<U, P>,
  error: Error
) => void;

export type SocketCloseHandler<U, P> = (
  context: SocketContext<U, P>,
  status: number,
  reason: string
) => void;

export type BunshineHandlers<
  U,
  P extends Record<string, string> = Record<string, string>,
> = RequireAtLeastOne<{
  upgrade: SocketUpgradeHandler<U, P>;
  error: SocketErrorHandler<U, P>;
  open: SocketPlainHandler<U, P>;
  message: SocketMessageHandler<U, P, 'message'>;
  close: SocketCloseHandler<U, P>;
  drain: SocketPlainHandler<U, P>;
  ping: SocketMessageHandler<U, P, 'ping'>;
  pong: SocketMessageHandler<U, P, 'pong'>;
}>;

export type BunHandlers = {
  open: (ws: ServerWebSocket<WsDataShape>) => void;
  message: (ws: ServerWebSocket<WsDataShape>, data: any) => void;
  close: (
    ws: ServerWebSocket<WsDataShape>,
    code: number,
    reason: string
  ) => void;
  drain: (ws: ServerWebSocket<WsDataShape>) => void;
  ping: (ws: ServerWebSocket<WsDataShape>, data: any) => void;
  pong: (ws: ServerWebSocket<WsDataShape>, data: any) => void;
};

export type SocketEventType =
  | 'open'
  | 'message'
  | 'close'
  | 'drain'
  | 'ping'
  | 'pong';

export default class SocketRouter {
  httpRouter: HttpRouter;
  routeMatcher: RouteMatcher<BunshineHandlers<any>>;
  handlers: BunHandlers;
  constructor(router: HttpRouter) {
    this.httpRouter = router;
    this.httpRouter._wsRouter = this;
    this.routeMatcher = new RouteMatcher<BunshineHandlers<any>>();
    this.handlers = {
      open: this._createHandler('open'),
      message: this._createHandler('message'),
      close: this._createHandler('close'),
      drain: this._createHandler('drain'),
      ping: this._createHandler('ping'),
      pong: this._createHandler('pong'),
    };
  }
  at = <P extends Record<string, string> = Record<string, string>, U = any>(
    path: string,
    handlers: BunshineHandlers<U, P>
  ) => {
    if (!handlers.upgrade) {
      handlers.upgrade = function () {
        return {} as U;
      };
    }
    // capture the matcher details
    // @ts-expect-error  Handlers are more specific than any
    this.routeMatcher.add('ALL', path, handlers);
    // create a router path that upgrades to a socket
    this.httpRouter.get<P>(path, async (c, next) => {
      const upgradeData = await handlers.upgrade?.(c, next);
      const sc = new SocketContext(c.server, c.url, c.params, upgradeData);
      try {
        // upgrade the request to a WebSocket
        if (
          c.server.upgrade(c.request, {
            data: {
              sc,
            },
          })
        ) {
          // See https://bun.sh/guides/websocket/upgrade
          return undefined;
        }
      } catch (e) {
        const error = e as Error;
        return c.text('Internal server error', {
          status: 500,
        });
      }
      return c.text('Client does not support WebSocket', {
        status: 426, // 426 Upgrade Required
      });
    });
    // allow chaining
    return this;
  };
  private _fallbackError = (context: SocketContext, error: Error) => {
    console.error(
      `Unhandled WebSocket handler error at "${context.url.pathname}" in handler "${context.type}": ${error.message}`
    );
  };
  private _createHandler = (eventName: SocketEventType) => {
    return async (ws: ServerWebSocket<WsDataShape>, ...args: any) => {
      const sc = ws.data.sc as SocketContext;
      sc.ws = ws;
      sc.type = eventName;
      const pathname = sc.url.pathname;
      const matched = this.routeMatcher.match('', pathname);
      const rest: any[] = [];
      if (['message', 'ping', 'pong'].includes(eventName)) {
        rest.push(new SocketMessage(eventName, args[0]));
      } else if (eventName === 'close') {
        rest.push(args[0], args[1]);
      }
      for (const [target] of matched) {
        if (!target[eventName]) {
          continue;
        }
        try {
          target[eventName](sc, rest[0], rest[1]);
        } catch (e) {
          const handlerError = e as Error;
          if (typeof target.error === 'function') {
            try {
              target.error(sc, handlerError);
            } catch (e) {
              const errorError = e as Error;
              sc.type = 'error';
              this._fallbackError(sc, errorError);
            }
          } else {
            this._fallbackError(sc, handlerError);
          }
        }
      }
    };
  };
}
