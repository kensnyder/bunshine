import { Server, TLSServeOptions } from 'bun';
import os from 'node:os';
import { HttpRouter } from 'request-class-router';
import { version } from '../../package.json' assert { type: 'json' };
import SocketRouter from '../SocketRouter/SocketRouter';

export default HttpRouter;

export type ListenOptions =
  | Omit<TLSServeOptions, 'fetch' | 'websocket'>
  | number;

export type EmitUrlOptions = {
  verbose?: boolean;
  to?: (message: string) => void;
  date?: boolean;
};

declare module 'request-class-router' {
  interface HttpRouter {
    _wsRouter?: SocketRouter;
    server: Server | undefined;
    version: string;
    locals: Record<string, any>;
    listen: (portOrOptions?: ListenOptions) => Server | undefined;
    emitUrl: (options?: EmitUrlOptions) => void;
    getExport: (
      options: Omit<TLSServeOptions, 'fetch' | 'websocket'>
    ) => TLSServeOptions;
    socket: SocketRouter;
  }
}

Object.defineProperty(HttpRouter.prototype, 'server', {
  value: undefined,
  writable: true,
});

Object.defineProperty(HttpRouter.prototype, 'version', {
  get: () => version,
});

Object.defineProperty(HttpRouter.prototype, 'locals', {
  value: {},
  writable: true,
});

Object.defineProperty(HttpRouter.prototype, 'listen', {
  value: function listen(this: HttpRouter, portOrOptions: ListenOptions = {}) {
    if (typeof portOrOptions === 'number') {
      portOrOptions = { port: portOrOptions };
    }
    const server = Bun.serve(this.getExport(portOrOptions));
    this.server = server;
    return server;
  },
});

Object.defineProperty(HttpRouter.prototype, 'emitUrl', {
  value: function emitUrl(
    this: HttpRouter,
    { verbose = false, to = console.log, date = false }: EmitUrlOptions = {}
  ) {
    if (!this.server) {
      throw new Error(
        'Cannot emit URL before server has been started. Use .listen() to start the server first.'
      );
    }
    const servingAt = String(this.server.url);
    let message: string;
    if (verbose) {
      const server = os.hostname();
      const mode = Bun.env.NODE_ENV || 'production';
      const took = Math.round(performance.now());
      const runtime = process.versions.bun
        ? `Bun v${process.versions.bun}`
        : `Node v${process.versions.node}`;
      message = `☀️ Bunshine v${version} on ${runtime} serving at ${servingAt} on "${server}" in ${mode} (${took}ms)`;
    } else {
      message = `☀️ Serving ${servingAt}`;
    }
    if (date) {
      message = `[${new Date().toISOString()}] ${message}`;
    }
    to(message);
  },
});

Object.defineProperty(HttpRouter.prototype, 'socket', {
  get: function socket(this: HttpRouter) {
    if (!this._wsRouter) {
      this._wsRouter = new SocketRouter(this);
    }
    return this._wsRouter;
  },
});

Object.defineProperty(HttpRouter.prototype, 'getExport', {
  value: function getExport(
    this: HttpRouter,
    options: Omit<TLSServeOptions, 'fetch' | 'websocket'> = {}
  ) {
    const config = {
      port: 0,
      ...options,
      fetch: this.fetch,
    } as TLSServeOptions;
    if (this._wsRouter) {
      // @ts-expect-error
      config.websocket = this._wsRouter.handlers;
    }
    return config;
  },
});
