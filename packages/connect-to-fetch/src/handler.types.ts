import type { IncomingMessage, ServerResponse } from 'node:http';

export type ConnectRouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (error?: string | Error) => void
) => void;

export type ConnectErrorHandler = (
  error: Error,
  req: IncomingMessage,
  res: ServerResponse,
  next: (error?: string | Error) => void
) => void;

export type ConnectHandler = ConnectRouteHandler | ConnectErrorHandler;

export type FlatHandlers = ConnectHandler | FlatHandlers[];

export type MappedRouteHandler = {
  kind: 'route';
  fn: ConnectRouteHandler;
};

export type MappedErrorHandler = {
  kind: 'error';
  fn: ConnectErrorHandler;
};

export type MappedHandler = MappedRouteHandler | MappedErrorHandler;
