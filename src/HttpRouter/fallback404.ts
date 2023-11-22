import type Context from '../Context/Context';

export const fallback404 = (c: Context) => {
  const headers = new Headers();
  let body: string;
  if (Bun.env.NODE_ENV === 'development') {
    headers.append('Reason', 'Handlers failed to return a Response');
    headers.append('Content-Type', 'text/html');
    body = get404Html(c.url.pathname);
  } else {
    headers.append('Content-Type', 'text/plain');
    body = '404 Not Found';
  }
  return new Response(body, {
    headers,
    status: 404,
  });
};

export function get404Html(path: string) {
  return `<h1>404 Not Found</h1>
          <p>Nothing found at the following URL:</p>
          <pre>${path}</pre>`;
}
