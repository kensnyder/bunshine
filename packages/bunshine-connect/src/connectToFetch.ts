import { type IncomingMessage, type ServerResponse } from 'http';
import { Readable } from 'node:stream';
import createIncomingMessage from './createIncomingMessage';
import createServerResponse from './createServerResponse';
import { flattenHeaders } from './headers';

type ConnectHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (error?: string | Error) => void
) => void;

type Flattenable = ConnectHandler | Flattenable[];

const statusCodesWithoutBody = [
  100, // Continue
  101, // Switching Protocols
  102, // Processing (WebDAV)
  103, // Early Hints
  204, // No Content
  205, // Reset Content
  304, // Not Modified
];

export function connectToFetch(...connectHandlers: Flattenable[]) {
  const handlers = connectHandlers.flat(9) as ConnectHandler[];
  return function (request: Request) {
    const req = createIncomingMessage(request);
    const { res, onReadable } = createServerResponse(
      req as unknown as IncomingMessage
    );

    return new Promise<Response | undefined>((resolve, reject) => {
      // onReadable is called when res.end(content) is called
      onReadable(({ readable, headers, statusCode }) => {
        const responseBody = statusCodesWithoutBody.includes(statusCode)
          ? null
          : (Readable.toWeb(readable) as unknown as ReadableStream);
        resolve(
          new Response(responseBody, {
            status: statusCode,
            headers: flattenHeaders(headers),
          })
        );
      });

      let handlerIndex = 0;
      const next = (error?: string | Error) => {
        if (error && error !== 'route' && error !== 'router') {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
        const handler = handlers[handlerIndex++];
        if (!handler) {
          // 404 because no handlers called next
          resolve(undefined);
        }
        try {
          handler(req, res, next);
        } catch (e) {
          const error = e as Error;
          reject(error);
        }
      };

      next();
    });
  };
}
