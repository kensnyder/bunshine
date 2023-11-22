import type { Server, ServerWebSocket } from 'bun';
import type Context from '../Context/Context';
import type HttpRouter from '../HttpRouter/HttpRouter';
import PathMatcher from '../PathMatcher/PathMatcher';

export type DefaultDataShape = {
  url: URL;
  params: Record<string, string>;
  server: Server;
};
export type SocketUpgradeHandler = (
  context: Context
) => Record<string, any> | Promise<Record<string, any>>;
export type SocketErrorHandler<WsDataShape> = (
  ws: ServerWebSocket<WsDataShape>,
  eventName: SocketEventName,
  error: Error
) => void;
export type SocketOpenHandler<WsDataShape> = (
  ws: ServerWebSocket<WsDataShape>
) => void;
export type SocketMessageHandler<WsDataShape> = (
  ws: ServerWebSocket<WsDataShape>,
  message: string | Buffer
) => void;
export type SocketCloseHandler<WsDataShape> = (
  ws: ServerWebSocket<WsDataShape>,
  status: number,
  reason: string
) => void;
export type SocketDrainHandler<WsDataShape> = (
  ws: ServerWebSocket<WsDataShape>
) => void;
export type SocketPingHandler<WsDataShape> = (
  ws: ServerWebSocket<WsDataShape>,
  message: Buffer
) => void;
export type SocketPongHandler<WsDataShape> = (
  ws: ServerWebSocket<WsDataShape>,
  message: Buffer
) => void;
export type Handlers<WsDataShape> = {
  upgrade?: SocketUpgradeHandler;
  error?: SocketErrorHandler<WsDataShape>;
  open?: SocketOpenHandler<WsDataShape>;
  message?: SocketMessageHandler<WsDataShape>;
  close?: SocketCloseHandler<WsDataShape>;
  drain?: SocketDrainHandler<WsDataShape>;
  ping?: SocketPingHandler<WsDataShape>;
  pong?: SocketPongHandler<WsDataShape>;
};
export type SocketEventName =
  | 'open'
  | 'message'
  | 'close'
  | 'drain'
  | 'ping'
  | 'pong';

export default class WsRouter {
  httpRouter: HttpRouter;
  pathMatcher: PathMatcher<Partial<Handlers<any>>>;
  handlers: Handlers<any>;
  constructor(router: HttpRouter) {
    this.httpRouter = router;
    this.httpRouter._wsRouter = this;
    this.pathMatcher = new PathMatcher<Handlers<any>>();
    this.handlers = {
      open: this._createHandler('open') as SocketOpenHandler<any>,
      message: this._createHandler('message') as SocketMessageHandler<any>,
      close: this._createHandler('close') as SocketCloseHandler<any>,
      drain: this._createHandler('drain') as SocketDrainHandler<any>,
      ping: this._createHandler('ping') as SocketPingHandler<any>,
      pong: this._createHandler('pong') as SocketPongHandler<any>,
    };
  }
  at = <UpgradeDataShape extends Record<string, any>>(
    path: string,
    handlers: Handlers<UpgradeDataShape & DefaultDataShape>
  ) => {
    // capture the matcher details
    this.pathMatcher.add(path, handlers);
    // console.log('ws handlers registered!', path);
    // create a router path that upgrades to a socket
    this.httpRouter.get(path, (c: Context) => {
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
            } as DefaultDataShape & UpgradeDataShape,
          })
        ) {
          // See https://bun.sh/guides/websocket/upgrade
          return new Response(null, { status: 101 });
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
        status: 400,
      });
    });
    // allow chaining
    return this;
  };
  fallbackError = <WsDataShape extends DefaultDataShape>(
    ws: ServerWebSocket<WsDataShape>,
    eventName: string,
    error: Error
  ) => {
    console.error(
      `Unhandled WebSocket handler error at "${ws.data.url.pathname}" for event "${eventName}"`,
      error
    );
  };
  _createHandler = (eventName: SocketEventName) => {
    return async (ws: ServerWebSocket<any>, ...args: any) => {
      const pathname = ws.data.url.pathname;
      const matched = this.pathMatcher.match(pathname);
      for (const { target } of matched) {
        try {
          // @ts-expect-error
          target[eventName]?.(ws, ...args);
        } catch (e) {
          const error = e as Error;
          if (typeof target?.error === 'function') {
            try {
              target?.error?.(ws, eventName, error);
            } catch (e) {
              const error = e as Error;
              this.fallbackError(ws, eventName, error);
            }
          } else {
            this.fallbackError(ws, eventName, error);
          }
        }
      }
    };
  };
}
