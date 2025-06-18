// Adapted from https://github.com/vikejs/vike-node/blob/main/packages/vike-node/src/runtime/adapters/connectToWeb.ts
import { type IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
import createIncomingMessage from './createIncomingMessage';
import createServerResponse from './createServerResponse';
import { FlatHandlers, MappedHandler } from './handler.types';
import { flattenHeaders } from './headers';

const statusCodesWithoutBody = [
  100, // Continue
  101, // Switching Protocols
  102, // Processing (WebDAV)
  103, // Early Hints
  204, // No Content
  205, // Reset Content
  304, // Not Modified
];

export default function connectToFetch(...connectHandlers: FlatHandlers[]) {
  // flatten and assign a "kind" for TypeScript discriminated union
  const handlers = connectHandlers.flat(9).map(fn => ({
    kind: fn.length === 4 ? 'error' : 'route',
    fn,
  })) as MappedHandler[];
  // function that takes a Request and returns a Promise<Response> by running handlers
  return function (request: Request) {
    const req = createIncomingMessage(request);
    console.log('connectToFetch request', req.url, req.method);
    const { res, onReadable } = createServerResponse(
      req as unknown as IncomingMessage
    );
    console.log('connectToFetch response', res.statusCode, typeof res);

    return new Promise<Response>((resolve, reject) => {
      // onReadable is called when res.end(content) is called
      onReadable(({ readable, headers, statusCode }) => {
        const responseBody = statusCodesWithoutBody.includes(statusCode)
          ? null
          : (Readable.toWeb(readable) as unknown as ReadableStream);
        // console.log('onReadable response body', {
        //   statusCode,
        //   headers,
        //   responseBody,
        // });
        resolve(
          new Response(responseBody, {
            status: statusCode,
            headers: flattenHeaders(headers),
          })
        );
      });

      // see similar code in connect codebase https://github.com/senchalabs/connect/blob/master/index.js#L232
      let handlerIndex = 0;
      let globalError: Error;
      const next = (error?: string | Error) => {
        if (error && error !== 'route' && error !== 'router') {
          globalError =
            error instanceof Error ? error : new Error(String(error));
        }
        const handler = handlers[handlerIndex++];
        if (!handler) {
          // no more handlers
          if (globalError) {
            // unhandled error
            reject(globalError);
          } else {
            // unhandled route (e.g. 404)
            res.destroy();
            reject(new Error('UNHANDLED'));
          }
          return;
        }
        try {
          if (globalError) {
            if (handler.kind === 'error') {
              handler.fn(globalError, req, res, next);
            } else {
              // don't call non-error handlers with error
              next();
            }
          } else {
            if (handler.kind === 'error') {
              // don't call error handlers without error
              console.log(
                'connectToFetch() skipping error handler',
                handler.fn
              );
              next();
            } else {
              console.log('connectToFetch() handler', handlerIndex);
              handler.fn(req, res, next);
            }
          }
        } catch (e) {
          console.log('connectToFetch() handler error', e);
          next(e as Error);
        }
      };

      next();
    });
  };
}
