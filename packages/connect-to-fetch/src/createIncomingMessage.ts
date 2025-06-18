// Adapted from https://github.com/magne4000/universal-middleware/blob/603eed01235371cf106244e35700837fc7d9b04a/packages/adapter-express/src/utils.ts#L84
import type { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';

/**
 * Creates an IncomingMessage object from a web Request.
 *
 * @param {Request} request - The web Request object.
 * @returns {IncomingMessage} An IncomingMessage-like object compatible with Node.js HTTP module.
 */
export default function createIncomingMessage(
  request: Request
): IncomingMessage {
  const parsedUrl = new URL(request.url, 'http://localhost');
  const pathnameAndQuery =
    (parsedUrl.pathname || '') + (parsedUrl.search || '');
  const body = request.body
    ? Readable.fromWeb(request.body as any)
    : Readable.from([]);

  return Object.assign(body, {
    url: pathnameAndQuery,
    method: request.method,
    headers: Object.fromEntries(request.headers),
  }) as IncomingMessage;
}
