import Context from '../../Context/Context';

export type Factory = (body: string, init?: ResponseInit) => Response;

export default function factory(contentType: string): Factory {
  return function (this: Context, body: string, init: ResponseInit = {}) {
    init.headers = new Headers(init.headers || {});
    if (!init.headers.has('Content-Type')) {
      init.headers.set('Content-Type', `${contentType}; charset=utf-8`);
    }
    init.headers.set('Content-Length', String(body.length));
    return new Response(body, init);
  };
}
