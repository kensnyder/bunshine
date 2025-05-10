import Context from '../../Context/Context';

export default function json(
  this: Context,
  data: any,
  init: ResponseInit = {}
) {
  const body = JSON.stringify(data === undefined ? null : data);
  init.headers = new Headers(init.headers || {});
  if (!init.headers.has('Content-Type')) {
    init.headers.set('Content-Type', `application/json; charset=utf-8`);
  }
  return new Response(body, init);
}
