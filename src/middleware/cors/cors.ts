import type Context from '../../Context/Context';
import type { Middleware } from '../../HttpRouter/HttpRouter';

export type CorsOptions = {
  origin?:
    | string
    | RegExp
    | Array<string | RegExp>
    | boolean
    | ((
        incomingOrigin: string,
        context: Context
      ) => string | string[] | boolean | undefined | null);
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

export function cors(options: CorsOptions = {}): Middleware {
  const opts = {
    ...CorsDefaults,
    ...options,
  };
  const findAllowOrigin = (optsOrigin => {
    if (typeof optsOrigin === 'string') {
      return () => optsOrigin;
    } else if (optsOrigin instanceof RegExp) {
      return (incoming: string) =>
        optsOrigin.test(incoming) ? incoming : null;
    } else if (Array.isArray(optsOrigin)) {
      return (incoming: string) => {
        for (const origin of optsOrigin) {
          if (
            (typeof origin === 'string' && origin === incoming) ||
            (origin instanceof RegExp && origin.test(incoming))
          ) {
            return incoming;
          }
        }
        return null;
      };
    } else if (optsOrigin === true) {
      return (incoming: string) => incoming;
    } else if (optsOrigin === false) {
      return () => null;
    } else if (typeof optsOrigin === 'function') {
      return (incoming: string, c: Context) => {
        const origins = optsOrigin(incoming, c);
        if (origins === true) {
          return incoming;
        } else if (origins === false) {
          return null;
        } else if (Array.isArray(origins)) {
          return origins.includes(incoming) ? incoming : null;
        } else if (typeof origins === 'string') {
          return origins;
        } else {
          return null;
        }
      };
    } else {
      throw new Error('Invalid cors origin option');
    }
  })(opts.origin);
  function handleOptionsRequest(c: Context) {
    const respHeaders = new Headers();
    const incomingOrigin = c.request.headers.get('origin');
    const allowOrigin = incomingOrigin
      ? findAllowOrigin(incomingOrigin, c)
      : null;
    if (allowOrigin) {
      respHeaders.set('Access-Control-Allow-Origin', allowOrigin);
    } else {
      // TODO: find out if we should send a 4xx instead?
    }
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
  function maybeAddAccessHeaders(c: Context, response: Response) {
    const incomingOrigin = c.request.headers.get('origin');
    const allowOrigin = incomingOrigin
      ? findAllowOrigin(incomingOrigin, c)
      : null;
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
    maybeAddAccessHeaders(c, response);
    return response;
  };
}
