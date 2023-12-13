import { BunFile } from 'bun';

export const text = getResponseFactory('text/plain');
export const js = getResponseFactory('text/javascript');
export const html = getResponseFactory('text/html');
export const xml = getResponseFactory('text/xml');
export const json = (data: Record<string, any>, init: ResponseInit = {}) => {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...(init.headers || {}),
      'Content-Type': 'application/json',
    },
  });
};

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
  fileOptions: FileResponseOptions = {},
  responseInit: ResponseInit = {}
) => {
  let file =
    typeof filenameOrBunFile === 'string'
      ? Bun.file(filenameOrBunFile)
      : filenameOrBunFile;
  const totalFileSize = file.size;
  if (totalFileSize === 0) {
    return new Response('File not found', { status: 404 });
  }
  let resp: Response;
  const rangeMatch = fileOptions.range?.match(/^bytes=(\d*)-(\d*)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1]) || 0;
    let end = parseInt(rangeMatch[2]);
    if (isNaN(end)) {
      // Initial request: some browsers use "Range: bytes=0-"
      end = Math.min(
        start + (fileOptions.chunkSize || 3 * 1024 ** 2),
        totalFileSize - 1
      );
    }
    if (end > totalFileSize - 1) {
      return new Response('416 Range not satisfiable', { status: 416 });
    }
    // the range is less than the entire file
    if (end - 1 < totalFileSize) {
      file = file.slice(start, end + 1);
    }
    // Bun has a bug when setting content-length and content-range automatically
    // so convert file to buffer
    const buffer = await file.arrayBuffer();
    resp = new Response(buffer, { ...responseInit, status: 206 });
    if (!resp.headers.has('Content-Type')) {
      resp.headers.set('Content-Type', 'application/octet-stream');
    }
    resp.headers.set('Content-Length', String(buffer.byteLength));
    resp.headers.set('Content-Range', `bytes ${start}-${end}/${totalFileSize}`);
  } else {
    // Bun will automatically set content-type and length
    resp = new Response(file);
  }
  if (!resp.headers.has('Accept-Ranges')) {
    // tell the client that we are capable of handling range requests
    resp.headers.set('Accept-Ranges', 'bytes');
  }
  return resp;
};

export type SseSend = (
  eventName: string,
  data?: string,
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
      // create encoder to handle utf8
      const encoder = new TextEncoder();
      // define the send and close functions
      function send(
        eventName: string,
        data?: string | any,
        id?: string,
        retry?: number
      ) {
        let encoded: Uint8Array;
        if (arguments.length === 1) {
          encoded = encoder.encode(`data: ${eventName}\n\n`);
        } else {
          if (typeof data !== 'string') {
            data = JSON.stringify(data);
          }
          let message = `event: ${eventName}\ndata:${data}`;
          if (id) {
            message += `\nid: ${id}`;
          }
          if (retry) {
            message += `\nretry: ${retry}`;
          }
          message += '\n\n';
          encoded = encoder.encode(message);
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
        close();
      }
    },
  });
  let headers = new Headers(init.headers);
  if (headers.has('Content-Type')) {
    console.warn('Overriding Content-Type header to `text/event-stream`');
  }
  if (headers.has('Cache-Control')) {
    console.warn('Overriding Cache-Control header to `no-cache`');
  }
  if (headers.has('Connection')) {
    console.warn('Overriding Connection header to `keep-alive`');
  }
  headers.set('Content-Type', 'text/event-stream');
  headers.set('Cache-Control', 'no-cache');
  headers.set('Connection', 'keep-alive');
  return new Response(stream, { ...init, headers });
};

function getResponseFactory(contentType: string) {
  return function (content: any, init: ResponseInit = {}) {
    return new Response(content, {
      ...init,
      headers: {
        ...(init.headers || {}),
        'Content-Type': contentType,
      },
    });
  };
}
