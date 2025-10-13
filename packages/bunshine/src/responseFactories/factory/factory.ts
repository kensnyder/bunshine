export type Factory = (body: string, init?: ResponseInit) => Response;

export default function factory(contentType: string): Factory {
  return function (body: string, init: ResponseInit = {}) {
    init.headers = new Headers(init.headers || {});
    if (!init.headers.has('Content-Type')) {
      init.headers.set('Content-Type', `${contentType}; charset=utf-8`);
    }
    init.headers.set('Content-Length', String(body.length));
    return new Response(body, init);
  };
}

/** A shorthand for `new Response(text, { headers: { 'Content-type': 'text/plain' } })` */
export const plaintextResponse = factory('text/plain');
/** A shorthand for `new Response(js, { headers: { 'Content-type': 'text/javascript' } })` */
export const jsResponse = factory('text/javascript');
/** A shorthand for `new Response(html, { headers: { 'Content-type': 'text/html' } })` */
export const htmlResponse = factory('text/html');
/** A shorthand for `new Response(xml, { headers: { 'Content-type': 'text/xml' } })` */
export const xmlResponse = factory('text/xml');
/** A shorthand for `new Response(html, { headers: { 'Content-type': 'text/css' } })` */
export const cssResponse = factory('text/css');
