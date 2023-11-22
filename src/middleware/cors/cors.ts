import type {Middleware} from '../../HttpRouter/HttpRouter';
import type Context from '../../Context/Context';

export type CorsOptions = {
  origin: string | string[] | ((origin: string) => string | undefined | null);
  allowMethods?: string[];
  allowHeaders?: string[];
  maxAge?: number;
  credentials?: boolean;
  exposeHeaders?: string[];
};

export const CorsDefaults = {
  origin: '*',
  allowMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH'],
  allowHeaders: [],
  exposeHeaders: [],
};

export function cors(options: CorsOptions): Middleware {
  const opts = {
    ...CorsDefaults,
    ...options,
  };
  const findAllowOrigin = (optsOrigin => {
    if (typeof optsOrigin === 'string') {
      return () => optsOrigin;
    } else if (typeof optsOrigin === 'function') {
      return optsOrigin;
    } else {
      return (origin: string) =>
        optsOrigin.includes(origin) ? origin : optsOrigin[0];
    }
  })(opts.origin);
  function handleOptionsRequest(c: Context) {
    const respHeaders = new Headers();
    if (opts.maxAge != null) {
      respHeaders.set('Access-Control-Max-Age', opts.maxAge.toString());
    }
    if (opts.allowMethods?.length) {
      respHeaders.set(
        'Access-Control-Allow-Methods',
        opts.allowMethods.join(',')
      );
    }
    let headerNames = opts.allowHeaders;
    if (!headerNames?.length) {
      const requestHeaders = c.request.headers.get(
        'Access-Control-Request-Headers'
      );
      if (requestHeaders) {
        headerNames = requestHeaders.split(/\s*,\s*/);
      }
    }
    if (headerNames?.length) {
      respHeaders.set('Access-Control-Allow-Headers', headerNames.join(','));
      respHeaders.set('Vary', 'Access-Control-Request-Headers');
    }
    // TODO: is this deletion necessary?
    respHeaders.delete('Content-Length');
    respHeaders.delete('Content-Type');
    return new Response(null, {
      headers: respHeaders,
      status: 204,
    });
  }
  function addAccessHeaders(c: Context, response: Response) {
    const allowOrigin = findAllowOrigin(c.request.headers.get('origin') || '');
    if (allowOrigin) {
      response.headers.set('Access-Control-Allow-Origin', allowOrigin);
    }
    if (opts.origin !== '*') {
      response.headers.set('Vary', 'Origin');
    }
    if (opts.credentials) {
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    if (opts.exposeHeaders?.length) {
      response.headers.set(
        'Access-Control-Expose-Headers',
        opts.exposeHeaders.join(',')
      );
    }
  }
  return async (c, next) => {
    if (c.request.method === 'OPTIONS') {
      return handleOptionsRequest(c);
    }
    const response = await next();
    addAccessHeaders(c, response);
    return response;
  };
}
