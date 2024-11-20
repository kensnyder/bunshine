import { type Middleware } from 'bunshine';
import connectToFetch from './connectToFetch';
import { FlatHandlers } from './handler.types';

export default function connectToBunshine(
  ...connectHandlers: FlatHandlers[]
): Middleware {
  const getResponse = connectToFetch(...connectHandlers);
  return function (c) {
    return getResponse(c.request);
  };
}
