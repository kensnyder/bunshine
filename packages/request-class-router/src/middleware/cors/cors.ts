import type Context from '../../Context/Context';
import type { Middleware } from '../../HttpRouter/HttpRouter';
import withTryCatch from '../../withTryCatch/withTryCatch';

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
  exceptWhen?: (
    context: Context,
    response: Response
  ) => boolean | Promise<boolean>;
};

type OriginResolver = (incoming: string, c: Context) => string | null;

export const corsDefaults = {
  origin: '*',
  allowMethods: ['GET', 'HEAD', 'PUT', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  maxAge: undefined,
  credentials: undefined,
  allowHeaders: [],
  exposeHeaders: [],
  exceptWhen: () => false,
};

export function cors(options: CorsOptions = {}): Middleware {
  const opts = {
    ...corsDefaults,
    ...options,
  };
  const originResolver = getOriginResolver(opts.origin);
  const optionsRequestHandler = getOptionsRequestHandler(opts, originResolver);
  const maybeAddAccessHeaders = getAccessHeaderHandler(opts, originResolver);
  const exceptWhen = withTryCatch({
    label: 'Bunshine cors middleware: your exceptWhen function threw an error',
    defaultReturn: false,
    func: opts.exceptWhen,
  });
  return async (c, next) => {
    if (c.request.method === 'OPTIONS') {
      return optionsRequestHandler(c);
    }
    const resp = await next();
    if (await exceptWhen(c, resp)) {
      return resp;
    }
    maybeAddAccessHeaders(c, resp);
    return resp;
  };
}

function getOriginResolver(optsOrigin: CorsOptions['origin']): OriginResolver {
  if (typeof optsOrigin === 'string') {
    return () => optsOrigin;
  } else if (optsOrigin instanceof RegExp) {
    return (incoming: string) => (optsOrigin.test(incoming) ? incoming : null);
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
}

function getOptionsRequestHandler(
  opts: CorsOptions,
  originResolver: OriginResolver
) {
  return function handleOptionsRequest(c: Context) {
    const respHeaders = new Headers();
    const incomingOrigin = c.request.headers.get('origin');
    const allowOrigin = incomingOrigin
      ? originResolver(incomingOrigin, c)
      : null;
    if (allowOrigin) {
      respHeaders.set('Access-Control-Allow-Origin', allowOrigin);
    } else {
      return new Response(null, { status: 403 });
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
    return new Response(null, {
      headers: respHeaders,
      status: 200,
    });
  };
}

function getAccessHeaderHandler(
  opts: CorsOptions,
  originResolver: OriginResolver
) {
  return function maybeAddAccessHeaders(c: Context, response: Response) {
    const incomingOrigin = c.request.headers.get('origin');
    const allowOrigin = incomingOrigin
      ? originResolver(incomingOrigin, c)
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
  };
}
