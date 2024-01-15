import { BunFile } from 'bun';
import Context from '../Context/Context.ts';

export type Factory = (body: string, init?: ResponseInit) => Response;

const textEncoder = new TextEncoder();

// body must be large enough to be worth compressing
// (54 is minimum size of gzip after metadata; 100 is arbitrary choice)
export let minGzipSize = 100;

export function json(this: Context, data: any, init: ResponseInit = {}) {
  let body: string | Uint8Array = JSON.stringify(data);
  // @ts-expect-error
  init.headers = new Headers(init.headers || {});
  init.headers.set('Content-type', `application/json; charset=utf-8`);
  // body must be large enough to be worth compressing
  if (body.length >= minGzipSize) {
    body = Bun.gzipSync(Buffer.from(textEncoder.encode(body)));
    init.headers.set('Content-Encoding', 'gzip');
    init.headers.set('Content-Length', String(body.length));
  }
  // @ts-expect-error
  return new Response(body, init);
}

export function factory(contentType: string): Factory {
  return function (this: Context, body: string, init: ResponseInit = {}) {
    // @ts-expect-error
    init.headers = new Headers(init.headers || {});
    init.headers.set('Content-type', `${contentType}; charset=utf-8`);
    if (
      // client must expect gzip
      this.request.headers.get('Accept-Encoding')?.includes('gzip') &&
      // body must be large enough to be worth compressing
      body.length >= minGzipSize
    ) {
      // @ts-expect-error
      body = Bun.gzipSync(Buffer.from(textEncoder.encode(body)));
      init.headers.set('Content-Encoding', 'gzip');
    }
    init.headers.set('Content-Length', String(body.length));
    // @ts-expect-error
    return new Response(body, init);
  };
}

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
};
export const file = async (
  filenameOrBunFile: string | BunFile,
  fileOptions: FileResponseOptions = {}
) => {
  let file =
    typeof filenameOrBunFile === 'string'
      ? Bun.file(filenameOrBunFile)
      : filenameOrBunFile;
  const totalFileSize = file.size;
  if (totalFileSize === 0) {
    return new Response('File not found', { status: 404 });
  }
  const resp = await buildFileResponse({
    file,
    acceptRanges: true,
    chunkSize: fileOptions.chunkSize,
    rangeHeader: fileOptions.range,
    method: 'GET',
  });
  // tell the client that we are capable of handling range requests
  resp.headers.set('Accept-Ranges', 'bytes');
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
  file,
  acceptRanges,
  chunkSize,
  rangeHeader,
  method,
}: {
  file: BunFile;
  acceptRanges: boolean;
  chunkSize?: number;
  rangeHeader?: string | null;
  method: string;
}) {
  let response: Response;
  const rangeMatch = String(rangeHeader).match(/^bytes=(\d*)-(\d*)$/);
  if (acceptRanges && rangeMatch) {
    const totalFileSize = file.size;
    const start = parseInt(rangeMatch[1]) || 0;
    let end = parseInt(rangeMatch[2]);
    if (isNaN(end)) {
      // Initial request: some browsers use "Range: bytes=0-"
      end = Math.min(start + (chunkSize || 3 * 1024 ** 2), totalFileSize - 1);
    }
    if (end > totalFileSize - 1) {
      return new Response('416 Range not satisfiable', { status: 416 });
    }
    // Bun has a bug when setting content-length and content-range automatically
    // so convert file to buffer
    let buffer = await file.arrayBuffer();
    let status = 206;
    // the range is less than the entire file
    if (end - 1 < totalFileSize) {
      buffer = buffer.slice(start, end + 1);
      status = 200;
    }
    response = new Response(buffer, { status });
    if (!response.headers.has('Content-Type')) {
      response.headers.set('Content-Type', 'application/octet-stream');
    }
    response.headers.set('Content-Length', String(buffer.byteLength));
    response.headers.set(
      'Content-Range',
      `bytes ${start}-${end}/${totalFileSize}`
    );
  } else {
    // Bun will automatically set content-type and content-length,
    //   but delays until the response is actually sent, but middleware might
    //   want to know the file details ahead of time
    response = new Response(file, {
      headers: {
        'Content-Length': String(file.size),
        'Content-Type': file.type || 'application/octet-stream',
      },
      status: method === 'HEAD' ? 204 : 200,
    });
  }
  if (acceptRanges) {
    response.headers.set('Accept-Ranges', 'bytes');
  }
  return response;
}
