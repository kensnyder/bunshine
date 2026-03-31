/** A shorthand for `new Response(JSON.stringify(data), { headers: { 'Content-type': 'application/json' } })` */
export default function jsonResponse(data: any, init: ResponseInit = {}) {
  const body = JSON.stringify(data);
  init.headers = new Headers(init.headers || {});
  if (!init.headers.has('Content-Type')) {
    init.headers.set('Content-Type', `application/json; charset=utf-8`);
  }
  return new Response(body, init);
}
