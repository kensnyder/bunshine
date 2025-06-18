import { type Middleware } from 'bunshine';
import {
  connectToFetch,
  type FlatHandlers,
} from '../../connect-to-fetch/index';

export default function connectToBunshine(
  ...connectHandlers: FlatHandlers[]
): Middleware {
  const getResponse = connectToFetch(...connectHandlers);
  return async function (c) {
    try {
      return await getResponse(c.request);
    } catch (e) {
      const error = e as Error;
      if (error.message === 'UNHANDLED') {
        // handler called next(), but there are no other connect handlers
        // so continue to next bunshine handlers
      } else {
        // send off to our 500 error handler
        throw error;
      }
    }
  };
}
