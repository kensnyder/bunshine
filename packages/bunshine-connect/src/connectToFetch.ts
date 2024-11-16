import { type Middleware } from 'bunshine';
import { Readable } from 'stream';

type ConnectHandler = (
  req: Request,
  res: Response,
  next: (error?: Error) => void
) => void;

function connectToFetch(connectHandler: ConnectHandler): Middleware {
  return async function (c, bunshineNext) {
    const req = {
      app: c.app,
      url: c.url,
      fresh: true,
      stale: false,
      host: c.url.host,
      hostname: c.url.hostname,
      ip: c.ip,
      method: c.request.method,
      body: c.request.body ? Readable.fromWeb(c.request.body) : c.request.body,
      get: (name: string) => c.request.headers.get(name),
      get xhr() {
        return c.request.headers.get('X-Requested-With') === 'XMLHttpRequest';
      },
      get subdomains() {
        return c.url.hostname.split('.').slice(0, -2);
      },
      get query() {
        return Object.fromEntries(c.url.searchParams);
      },
    };
    const res = {
      app: c.app,
      headersSent: false,
      locals: {},
      _headers: new Headers(),
      set: (name: string, value: string) => res._headers.set(name, value),
      append: (name: string, value: string) => res._headers.append(name, value),
      attachment: () => {},
    };
    const next = {};
    // await connectHandler(req, res, next);
    // return new Response(res.body, {
    //   status: res._status,
    //   statusText: res._statusText,
    //   headers: res._headers,
    // })
  };
  // return async function (req, res, next) {
  //   // Convert Node.js request to Fetch API Request
  //   const fetchRequest = new Request(req.url, {
  //     method: req.method,
  //     headers: req.headers,
  //     body: req.method !== 'GET' && req.method !== 'HEAD' ? Readable.toWeb(req) : undefined,
  //   });
  //
  //   try {
  //     const fetchResponse = await fetchHandler(fetchRequest);
  //
  //     // Set status code and headers
  //     res.statusCode = fetchResponse.status;
  //     fetchResponse.headers.forEach((value, name) => {
  //       res.setHeader(name, value);
  //     });
  //
  //     // Stream the response body
  //     if (fetchResponse.body) {
  //       const nodeStream = Readable.fromWeb(fetchResponse.body);
  //       nodeStream.pipe(res);
  //       nodeStream.on('end', () => res.end());
  //     } else {
  //       res.end();
  //     }
  //   } catch (error) {
  //     next(error);
  //   }
  // };
}
