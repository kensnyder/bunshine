import { type Middleware } from 'bunshine';
import type { IncomingMessage, ServerResponse } from 'http';
import { connectToFetch } from './connectToFetch';

type ConnectHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (error?: string | Error) => void
) => void;

type Flattenable = ConnectHandler | Flattenable[];

export default function connectToBunshine(
  ...connectHandlers: Flattenable[]
): Middleware {
  const getResponse = connectToFetch(...connectHandlers);
  return function (c) {
    return getResponse(c.request);
  };
}
