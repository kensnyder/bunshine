import { BunFile } from 'bun';
import path from 'node:path';
import Context from '../Context/Context.ts';
import { maybeCompressResponseBody } from '../compress/compress.ts';
import getMimeType from '../getMimeType/getMimeType.ts';
import ms from '../ms/ms.ts';
import { MaybeHeadersAndStatus } from './HttpRouter.ts';

export type Factory = (
  body: string,
  init?: ResponseInit
) => Response | Promise<Response>;

const textEncoder = new TextEncoder();

export async function json(
  this: Context,
  data: unknown,
  init: ResponseInit = {}
) {
  return applicationJson.call(this, JSON.stringify(data), init);
}

export function factory(contentType: string): Factory {
  return async function (
    this: Context,
    body: string,
    init: MaybeHeadersAndStatus = {}
  ) {
    const finalInit = {
      headers: new Headers(init.headers),
      status: init.status || 200,
      statusText: init.statusText || 'OK',
    };
    const finalBody = await this.runBodyProcessors(body, finalInit);
    finalInit.headers.set('Content-Type', contentType);
    return new Response(finalBody, finalInit);
  };
}

export const textPlain = factory('text/plain');
export const textJs = factory('text/javascript');
export const textHtml = factory('text/html');
export const textXml = factory('text/xml');
export const textCss = factory('text/css');
export const applicationJson = factory('application/json; charset=utf-8');

export const redirect = (url: string, status = 302) => {
  return new Response('', {
    status,
    headers: {
      Location: url,
    },
  });
};

export type FileResponseOptions = {
  range?: string;
  chunkSize?: number;
  compress?: boolean; // default true
  disposition?: 'inline' | 'attachment';
  acceptRanges?: boolean;
  noCache?: boolean;
  maxAge?: string | number;
  headers?: HeadersInit;
};
export const file = async (
  requestHeaders: Headers,
  filenameOrBunFile: string | BunFile,
  fileOptions: FileResponseOptions = {}
) => {
  let file =
    typeof filenameOrBunFile === 'string'
      ? Bun.file(filenameOrBunFile)
      : filenameOrBunFile;
  if (!(await file.exists())) {
    return new Response('File not found', { status: 404 });
  }
  const resp = await buildFileResponse({
    requestHeaders,
    file,
    acceptRanges: true,
    chunkSize: fileOptions.chunkSize,
    rangeHeader: fileOptions.range,
    method: 'GET',
    compress: fileOptions.compress,
  });
  if (fileOptions.acceptRanges !== false) {
    // tell the client that we are capable of handling range requests
    resp.headers.set('Accept-Ranges', 'bytes');
  }
  if (fileOptions.disposition === 'attachment') {
    const filename = path.basename(file.name!);
    resp.headers.set(
      'Content-Disposition',
      `${fileOptions.disposition}; filename="${filename}"`
    );
  } else if (fileOptions.disposition === 'inline') {
    resp.headers.set('Content-Disposition', 'inline');
  }
  if (fileOptions.noCache) {
    resp.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    resp.headers.set('Expires', '0');
    resp.headers.set('Pragma', 'no-cache');
  } else if (fileOptions.maxAge !== 'undefined') {
    const seconds =
      typeof fileOptions.maxAge === 'string'
        ? Math.floor(ms(fileOptions.maxAge) / 1000)
        : fileOptions.maxAge;
    resp.headers.set('Cache-Control', `public, max-age=${seconds}`);
  }
  for (const [name, value] of new Headers(fileOptions.headers)) {
    if (name.toLowerCase() === 'cache-control') {
      resp.headers.set('Cache-Control', value);
    } else {
      resp.headers.append(name, value);
    }
  }
  return resp;
};

export type SseSend = (
  eventName: string,
  data?: string | object,
  id?: string,
  retry?: number
) => void;
export type SseClose = () => void;
export type SseSetupFunction = (
  send: SseSend,
  close: SseClose
) => void | (() => void);

export const sse = (
  signal: AbortSignal,
  setup: SseSetupFunction,
  init: ResponseInit = {}
) => {
  const stream = new ReadableStream({
    async start(controller: ReadableStreamDefaultController) {
      function send(
        eventName: string,
        data?: string | object,
        id?: string,
        retry?: number
      ) {
        let encoded: Uint8Array;
        if (arguments.length === 1) {
          encoded = textEncoder.encode(`data: ${eventName}\n\n`);
        } else {
          if (data && typeof data !== 'string') {
            data = JSON.stringify(data);
          }
          let message = `event: ${eventName}\ndata:${String(data)}`;
          if (id) {
            message += `\nid: ${id}`;
          }
          if (retry) {
            message += `\nretry: ${retry}`;
          }
          message += '\n\n';
          encoded = textEncoder.encode(message);
        }
        if (signal.aborted) {
          // client disconnected already
          close();
        } else {
          controller.enqueue(encoded);
        }
      }
      function close() {
        if (closed) {
          return;
        }
        closed = true;
        cleanup?.();
        signal.removeEventListener('abort', close);
        controller.close();
      }

      // setup and listen for abort signal
      const cleanup = setup(send, close);
      let closed = false;
      signal.addEventListener('abort', close);
      // close now if somehow it is already aborted
      if (signal.aborted) {
        /* c8 ignore next */
        close();
      }
    },
  });

  let headers = new Headers(init.headers);
  if (
    headers.has('Content-Type') &&
    !/^text\/event-stream/.test(headers.get('Content-Type')!)
  ) {
    console.warn(
      'Overriding Content-Type header to `text/event-stream; charset=utf-8`'
    );
  }
  if (
    headers.has('Cache-Control') &&
    headers.get('Cache-Control') !== 'no-cache'
  ) {
    console.warn('Overriding Cache-Control header to `no-cache`');
  }
  if (headers.has('Connection') && headers.get('Connection') !== 'keep-alive') {
    console.warn('Overriding Connection header to `keep-alive`');
  }
  headers.set('Content-Type', 'text/event-stream; charset=utf-8');
  headers.set('Cache-Control', 'no-cache');
  headers.set('Connection', 'keep-alive');
  // @ts-ignore
  return new Response(stream, { ...init, headers });
};

export async function buildFileResponse({
  requestHeaders,
  file,
  acceptRanges,
  chunkSize,
  rangeHeader,
  method,
  compress,
}: {
  requestHeaders?: Headers;
  file: BunFile;
  acceptRanges: boolean;
  chunkSize?: number;
  rangeHeader?: string | null;
  method: string;
  compress?: boolean;
}) {
  const rangeMatch = String(rangeHeader).match(/^bytes=(\d*)-(\d*)$/);
  const responseHeaders = new Headers({
    'Content-Type': getMimeType(file),
    Date: new Date().toUTCString(),
    'Last-Modified': new Date(file.lastModified).toUTCString(),
  });
  if (acceptRanges) {
    responseHeaders.set('Accept-Ranges', 'bytes');
  }
  if (acceptRanges && rangeMatch) {
    const totalFileSize = file.size;
    const start = parseInt(rangeMatch[1]) || 0;
    let end = parseInt(rangeMatch[2]);
    if (isNaN(end)) {
      // Initial request: some browsers use "Range: bytes=0-"
      end = Math.min(start + (chunkSize || 3 * 1024 ** 2), totalFileSize - 1);
    }
    if (start > totalFileSize - 1) {
      return new Response('416 Range not satisfiable', { status: 416 });
    }
    // Bun has a bug when setting content-length and content-range automatically
    // so convert file to buffer
    let buffer = await file.arrayBuffer();
    let status = 200;
    // the range is less than the entire file
    if (end - 1 < totalFileSize) {
      buffer = buffer.slice(start, end + 1);
      status = 206;
    }
    responseHeaders.set(
      'Content-Range',
      `bytes ${start}-${end}/${totalFileSize}`
    );
    responseHeaders.set('Content-Length', String(buffer.byteLength));
    if (compress && requestHeaders) {
      // @ts-expect-error  We know that Response allows an ArrayBuffer or Buffer
      buffer = await maybeCompressResponseBody(
        requestHeaders,
        responseHeaders,
        buffer
      );
    }
    return new Response(buffer, { headers: responseHeaders, status });
  } else {
    // Although Bun will automatically set content-type and content-length,
    //   it delays setting it until the response is actually sent.
    //   Since middleware might want to know the file details ahead of time,
    //   we set it here.
    responseHeaders.set('Content-Length', String(file.size));
    let body: null | ArrayBuffer | BunFile;
    if (method === 'HEAD') {
      body = null;
    } else {
      body = process.versions.bun ? file : await file.arrayBuffer();
      if (compress && requestHeaders) {
        // @ts-expect-error  We know that Response allows an ArrayBuffer or Buffer
        body = await maybeCompressResponseBody(
          requestHeaders,
          responseHeaders,
          body
        );
      }
    }
    return new Response(body, {
      headers: responseHeaders,
      status: 200,
    });
  }
}
