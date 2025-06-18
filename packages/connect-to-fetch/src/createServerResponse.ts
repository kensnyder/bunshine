// Adapted from https://github.com/magne4000/universal-middleware/blob/603eed01235371cf106244e35700837fc7d9b04a/packages/adapter-express/src/utils.ts#L84
import {
  ServerResponse,
  type IncomingMessage,
  type OutgoingHttpHeader,
  type OutgoingHttpHeaders,
} from 'node:http';
import { PassThrough, Readable } from 'node:stream';

/**
 * Creates a custom ServerResponse object that allows for intercepting and streaming the response.
 *
 * @param {IncomingMessage} incomingMessage - The incoming HTTP request message.
 * @returns {{
 *   res: ServerResponse;
 *   onReadable: (cb: (result: { readable: Readable; headers: OutgoingHttpHeaders; statusCode: number }) => void) => void
 * }} An object containing:
 *   - `res`: The custom ServerResponse object.
 *   - `onReadable`: A function that takes a callback. The callback is invoked when the response is readable,
 *     providing an object with the readable stream, headers, and status code.
 */
export default function createServerResponse(incomingMessage: IncomingMessage) {
  const res = new ServerResponse(incomingMessage);
  const passThrough = new PassThrough();
  let handled = false;

  const onReadable = (
    cb: (result: {
      readable: Readable;
      headers: OutgoingHttpHeaders;
      statusCode: number;
    }) => void
  ) => {
    const handleReadable = () => {
      if (handled) return;
      handled = true;
      cb({
        readable: Readable.from(passThrough),
        headers: res.getHeaders(),
        statusCode: res.statusCode,
      });
    };

    passThrough.once('readable', handleReadable);
    passThrough.once('end', handleReadable);
  };

  passThrough.once('finish', () => {
    res.emit('finish');
  });
  passThrough.once('close', () => {
    res.destroy();
    res.emit('close');
  });
  passThrough.on('drain', () => {
    res.emit('drain');
  });

  res.write = passThrough.write.bind(passThrough);
  res.end = passThrough.end.bind(passThrough) as any;

  res.writeHead = function writeHead(
    statusCode: number,
    statusMessage?: string | OutgoingHttpHeaders | OutgoingHttpHeader[],
    headers?: OutgoingHttpHeaders | OutgoingHttpHeader[]
  ): ServerResponse {
    res.statusCode = statusCode;
    if (typeof statusMessage === 'object') {
      headers = statusMessage;
      statusMessage = undefined;
    } else if (typeof statusMessage === 'string') {
      res.statusMessage = statusMessage;
    }
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        if (value !== undefined) {
          res.setHeader(key, value);
        }
      }
    }
    return res;
  };

  return {
    res,
    onReadable,
  };
}
// export default function createServerResponse(incomingMessage: IncomingMessage) {
//   const res = new ServerResponse(incomingMessage);
//   const passThrough = new PassThrough();
//   let handled = false;
//
//   const onReadable = (
//     cb: (result: {
//       readable: Readable;
//       headers: OutgoingHttpHeaders;
//       statusCode: number;
//     }) => void
//   ) => {
//     const handleReadable = () => {
//       if (handled) {
//         return;
//       }
//       handled = true;
//       cb({
//         readable: Readable.from(passThrough),
//         // readable: toMultiReadable(passThrough) as unknown as Readable,
//         headers: res.getHeaders(),
//         statusCode: res.statusCode,
//       });
//     };
//
//     passThrough.once('readable', handleReadable);
//     passThrough.once('end', handleReadable);
//   };
//
//   passThrough.once('finish', () => {
//     res.emit('finish');
//   });
//   passThrough.once('close', () => {
//     res.destroy();
//     res.emit('close');
//   });
//   passThrough.on('drain', () => {
//     res.emit('drain');
//   });
//
//   res.write = passThrough.write.bind(passThrough);
//   res.end = (passThrough as any).end.bind(passThrough);
//
//   res.writeHead = function writeHead(
//     statusCode: number,
//     statusMessage?: string | OutgoingHttpHeaders,
//     headers?: OutgoingHttpHeaders
//   ): ServerResponse {
//     res.statusCode = statusCode;
//     if (typeof statusMessage === 'object') {
//       headers = statusMessage;
//     } else if (typeof statusMessage === 'string') {
//       res.statusMessage = statusMessage;
//     }
//     if (headers) {
//       Object.entries(headers).forEach(([key, value]) => {
//         if (value !== undefined) {
//           res.setHeader(key, value);
//         }
//       });
//     }
//     return res;
//   };
//
//   return {
//     res,
//     onReadable,
//   };
// }
