import type { Server, ServerWebSocket } from 'bun';
import type { Merge } from 'type-fest';
import type Context from '../Context/Context';
import type HttpRouter from '../HttpRouter/HttpRouter';
import PathMatcher from '../PathMatcher/PathMatcher';

export type DefaultDataShape = {
  url: URL;
  params: Record<string, string>;
  server: Server;
};

export type FinalWsDataShape<ParamsShape, UpgradeShape> = Merge<
  Merge<DefaultDataShape, { params: ParamsShape }>,
  UpgradeShape
>;

export type SocketUpgradeHandler<
  ParamsShape extends Record<string, string> = Record<string, string>,
  UpgradeShape extends Record<string, any> = Record<string, any>,
> = (context: Context<ParamsShape>) => UpgradeShape | Promise<UpgradeShape>;
export type SocketErrorHandler<
  WsDataShape extends Record<string, any> = Record<string, any>,
> = (
  ws: ServerWebSocket<WsDataShape>,
  eventName: SocketEventName,
  error: Error
) => void;
export type SocketOpenHandler<
  WsDataShape extends Record<string, any> = Record<string, any>,
> = (ws: ServerWebSocket<WsDataShape>) => void;
export type SocketMessageHandler<
  WsDataShape extends Record<string, any> = Record<string, any>,
> = (ws: ServerWebSocket<WsDataShape>, message: string | Buffer) => void;
export type SocketCloseHandler<
  WsDataShape extends Record<string, any> = Record<string, any>,
> = (ws: ServerWebSocket<WsDataShape>, status: number, reason: string) => void;
export type SocketDrainHandler<
  WsDataShape extends Record<string, any> = Record<string, any>,
> = (ws: ServerWebSocket<WsDataShape>) => void;
export type SocketPingHandler<
  WsDataShape extends Record<string, any> = Record<string, any>,
> = (ws: ServerWebSocket<WsDataShape>, message: Buffer) => void;
export type SocketPongHandler<
  WsDataShape extends Record<string, any> = Record<string, any>,
> = (ws: ServerWebSocket<WsDataShape>, message: Buffer) => void;

export type WsHandlers<
  ParamsShape extends Record<string, string> = Record<string, string>,
  UpgradeShape extends Record<string, any> = Record<string, any>,
> = {
  upgrade?: SocketUpgradeHandler<ParamsShape, UpgradeShape>;
  error?: SocketErrorHandler<FinalWsDataShape<ParamsShape, UpgradeShape>>;
  open?: SocketOpenHandler<FinalWsDataShape<ParamsShape, UpgradeShape>>;
  message?: SocketMessageHandler<FinalWsDataShape<ParamsShape, UpgradeShape>>;
  close?: SocketCloseHandler<FinalWsDataShape<ParamsShape, UpgradeShape>>;
  drain?: SocketDrainHandler<FinalWsDataShape<ParamsShape, UpgradeShape>>;
  ping?: SocketPingHandler<FinalWsDataShape<ParamsShape, UpgradeShape>>;
  pong?: SocketPongHandler<FinalWsDataShape<ParamsShape, UpgradeShape>>;
};
export type SocketEventName =
  | 'open'
  | 'message'
  | 'close'
  | 'drain'
  | 'ping'
  | 'pong';

export default class SocketRouter {
  httpRouter: HttpRouter;
  pathMatcher: PathMatcher<WsHandlers>;
  handlers: WsHandlers;
  constructor(router: HttpRouter) {
    this.httpRouter = router;
    this.httpRouter._wsRouter = this;
    this.pathMatcher = new PathMatcher<WsHandlers>();
    this.handlers = {
      open: this._createHandler('open'),
      message: this._createHandler('message'),
      close: this._createHandler('close'),
      drain: this._createHandler('drain'),
      ping: this._createHandler('ping'),
      pong: this._createHandler('pong'),
    };
  }
  at = <
    ParamsShape extends Record<string, string> = Record<string, string>,
    UpgradeShape extends Record<string, any> = Record<string, any>,
  >(
    path: string,
    handlers: WsHandlers<ParamsShape, UpgradeShape>
  ) => {
    // capture the matcher details
    // @ts-expect-error
    this.pathMatcher.add(path, handlers);
    // console.log('ws handlers registered!', path);
    // create a router path that upgrades to a socket
    this.httpRouter.get<ParamsShape>(path, c => {
      const upgradeData = handlers.upgrade?.(c) || {};
      try {
        // upgrade the request to a WebSocket
        if (
          c.server.upgrade(c.request, {
            data: {
              server: c.server,
              url: c.url,
              params: c.params,
              ...upgradeData,
            },
          })
        ) {
          // See https://bun.sh/guides/websocket/upgrade
          return undefined;
        }
      } catch (e) {
        const error = e as Error;
        console.error('WebSocket upgrade error', error);
        return c.text('Internal server error', {
          status: 500,
        });
      }
      console.error(
        'WebSocket upgrade failed: Client does not support WebSocket'
      );
      return c.text('Client does not support WebSocket', {
        status: 426, // 426 Upgrade Required
      });
    });
    // allow chaining
    return this;
  };
  _fallbackError = (
    ws: ServerWebSocket<Record<string, any>>,
    eventName: string,
    error: Error
  ) => {
    console.error(
      `Unhandled WebSocket handler error at "${ws.data.url.pathname}" for event "${eventName}"`,
      error
    );
  };
  _createHandler = (eventName: SocketEventName) => {
    return async (ws: ServerWebSocket<Record<string, any>>, ...args: any) => {
      const pathname = ws.data.url.pathname;
      const matched = this.pathMatcher.match(pathname);
      for (const { target } of matched) {
        try {
          // @ts-expect-error
          target[eventName]?.(ws, ...args);
        } catch (e) {
          const error = e as Error;
          // @ts-expect-error
          if (typeof target?.error === 'function') {
            try {
              // @ts-expect-error
              target.error(ws, eventName, error);
            } catch (e) {
              const error = e as Error;
              this._fallbackError(ws, eventName, error);
            }
          } else {
            this._fallbackError(ws, eventName, error);
          }
        }
      }
    };
  };
}
