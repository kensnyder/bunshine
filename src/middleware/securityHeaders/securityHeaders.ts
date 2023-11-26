import Context from '../../Context/Context.ts';
import type { Middleware } from '../../HttpRouter/HttpRouter.ts';

export type SecurityHeader =
  | string
  | null
  | false
  | undefined
  | number
  | ((context: Context) => string | null | false | undefined | number);

export type SecurityHeaderOptions = {
  server?: SecurityHeader;
  xPoweredBy?: SecurityHeader;
  strictTransportSecurity?: SecurityHeader;
  xXssProtection?: SecurityHeader;
  xContentTypeOptions?: SecurityHeader;
  xFrameOptions?: SecurityHeader;
  referrerPolicy?: SecurityHeader;
  contentSecurityPolicy?: SecurityHeader;
  accessControlAllowOrigin?: SecurityHeader;
  permissionsPolicy?: SecurityHeader;
  crossOriginEmbedderPolicy?: SecurityHeader;
  crossOriginOpenerPolicy?: SecurityHeader;
  crossOriginResourcePolicy?: SecurityHeader;
};

const defaultOptions: SecurityHeaderOptions = {
  server: false,
  xPoweredBy: false,
  strictTransportSecurity: '',
  xXssProtection: '',
  xContentTypeOptions: '',
  xFrameOptions: '',
  referrerPolicy: '',
  contentSecurityPolicy: '',
  accessControlAllowOrigin: '',
  permissionsPolicy: '',
  crossOriginEmbedderPolicy: '',
  crossOriginOpenerPolicy: '',
  crossOriginResourcePolicy: '',
};

export function securityHeaders(options: SecurityHeaderOptions): Middleware {
  const headers: Array<[string, SecurityHeader]> = Object.entries({
    ...defaultOptions,
    ...options,
  }).map(([name, value]) => {
    return [dasherize(name), value];
  });
  return async (context, next) => {
    const resp = await next();
    if (!resp.headers.get('content-type')?.startsWith('text/html')) {
      // no need to set security headers for non-html responses
      return resp;
    }
    for (const [name, value] of headers) {
      const finalValue = typeof value === 'function' ? value(context) : value;
      if (finalValue) {
        resp.headers.set(name, String(finalValue));
      } else {
        resp.headers.delete(name);
      }
    }
    return resp;
  };
}

function dasherize(str: string): string {
  return str.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
}
