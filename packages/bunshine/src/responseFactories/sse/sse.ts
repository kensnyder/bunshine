import type { Context } from '../../Context/Context';

const textEncoder = new TextEncoder();

export type SseSend = (
  eventName: string,
  data?: string | object,
  id?: string,
  retry?: number
) => void | Promise<void>;

export type SseClose = () => void | Promise<void>;

export type SseSetupFunction = (
  send: SseSend,
  close: SseClose
) => void | (() => void);

export default function sse(
  this: Context,
  signal: AbortSignal,
  setup: SseSetupFunction,
  init: ResponseInit = {}
) {
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
}
