import isPromise from 'is-promise';
import bunshine from '../../../package.json';
import Context from '../../Context/Context.ts';
import type { Middleware, NextFunction } from '../../HttpRouter/HttpRouter.ts';
import type {
  AllowedApis,
  CSPDirectives,
  CSPSource,
  ReportOptions,
  SandboxOptions,
  SecurityHeaderOptions,
  SecurityHeaderValue,
} from './securityHeaders.types.ts';

const defaultValues: SecurityHeaderOptions = {
  accessControlAllowOrigin: '*',
  contentSecurityPolicy: {
    frameSrc: ["'self'"],
    workerSrc: ["'self'"],
    connectSrc: ["'self'"],
    defaultSrc: ["'self'"],
    fontSrc: ['*'],
    imgSrc: ['*'],
    manifestSrc: ["'self'"],
    mediaSrc: ["'self'", 'data:'],
    objectSrc: ["'self'", 'data:'],
    prefetchSrc: ["'self'"],
    scriptSrc: ["'self'"],
    scriptSrcElem: ["'self'", "'unsafe-inline'"],
    scriptSrcAttr: ["'none'"],
    styleSrcAttr: ["'self'", "'unsafe-inline'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'self'"],
    sandbox: {},
    report: {},
  },
  crossOriginEmbedderPolicy: 'unsafe-none',
  crossOriginOpenerPolicy: 'same-origin',
  crossOriginResourcePolicy: 'same-origin',
  permissionsPolicy: {
    // only include special APIs that you use
    accelerometer: [],
    ambientLightSensor: [],
    autoplay: ['self'],
    battery: [],
    camera: [],
    displayCapture: [],
    documentDomain: [],
    encryptedMedia: [],
    executionWhileNotRendered: [],
    executionWhileOutOfViewport: [],
    fullscreen: [],
    gamepad: [],
    geolocation: [],
    gyroscope: [],
    hid: [],
    identityCredentialsGet: [],
    idleDetection: [],
    localFonts: [],
    magnetometer: [],
    midi: [],
    otpCredentials: [],
    payment: [],
    pictureInPicture: [],
    publickeyCredentialsCreate: [],
    publickeyCredentialsGet: [],
    screenWakeLock: [],
    serial: [],
    speakerSelection: [],
    storageAccess: [],
    usb: [],
    webShare: ['self'],
    windowManagement: [],
    xrSpacialTracking: [],
  },
  referrerPolicy: 'strict-origin',
  strictTransportSecurity: 'max-age=86400; includeSubDomains; preload',
  xContentTypeOptions: 'nosniff',
  xFrameOptions: 'SAMEORIGIN',
  xPoweredBy: false,
  xXssProtection: '1; mode=block',
};

const permissionsPolicyDefaults: AllowedApis = {
  accelerometer: [],
  ambientLightSensor: [],
  autoplay: ['self'],
  battery: [],
  camera: [],
  displayCapture: [],
  documentDomain: [],
  encryptedMedia: [],
  executionWhileNotRendered: [],
  executionWhileOutOfViewport: [],
  fullscreen: [],
  gamepad: [],
  geolocation: [],
  gyroscope: [],
  hid: [],
  identityCredentialsGet: [],
  idleDetection: [],
  localFonts: [],
  magnetometer: [],
  midi: [],
  otpCredentials: [],
  payment: [],
  pictureInPicture: [],
  publickeyCredentialsCreate: [],
  publickeyCredentialsGet: [],
  screenWakeLock: [],
  serial: [],
  speakerSelection: [],
  storageAccess: [],
  usb: [],
  webShare: ['self'],
  windowManagement: [],
  xrSpacialTracking: [],
};

export function securityHeaders(
  options: SecurityHeaderOptions = {}
): Middleware {
  const headers: Record<string, any> = {
    values: [],
    functions: [],
  };
  const resolved = {
    ...defaultValues,
    ...options,
  };
  for (const [name, value] of Object.entries(resolved)) {
    if (typeof value === 'function') {
      headers.functions.push([name, value]);
    } else {
      const resolved = _resolveHeaderValue(name, value);
      if (resolved) {
        headers.values.push([_dasherize(name), resolved]);
      }
    }
  }
  return async (context: Context, next: NextFunction) => {
    const resp = await next();
    if (!_needsHeaders(resp)) {
      // browsers ignore security headers for some responses
      return resp;
    }
    for (let [dasherizedName, value] of headers.values) {
      resp.headers.set(dasherizedName, value);
    }
    for (let [rawName, value] of headers.functions) {
      try {
        let resolved = _resolveHeaderValue(rawName, value(context));
        if (isPromise(resolved)) {
          // @ts-expect-error
          resolved = await resolved;
        }
        if (typeof resolved === 'string' && resolved !== '') {
          resp.headers.set(_dasherize(rawName), resolved);
        }
      } catch (e) {}
    }
    return resp;
  };
}

export function _needsHeaders(response: Response) {
  const types = [
    'text/html',
    'image/svg+xml',
    'application/atom+xml',
    'application/rss+xml',
  ];
  // browsers only accept security headers for interactive responses
  //   or 3xx redirects
  return (
    (response.status >= 300 && response.status <= 399) ||
    types.some(type => response.headers.get('content-type')?.includes(type))
  );
}

export function _resolveHeaderValue(
  name: string,
  value: SecurityHeaderValue | AllowedApis | CSPDirectives
) {
  if (value === false || value === null || value === undefined) {
    return;
  }
  if (name === 'xPoweredBy' && value === true) {
    return `Bunshine v${bunshine.version}`;
  } else if (value === true) {
    value = defaultValues[name];
  }
  if (name === 'contentSecurityPolicy') {
    return _getCspHeader(value as CSPDirectives);
  } else if (name === 'permissionsPolicy') {
    return _getPpHeader(value as AllowedApis);
  }
  return value;
}

export function _dasherize(str: string): string {
  return str.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
}

export function _getCspHeader(directives: CSPDirectives) {
  const items: string[] = [];
  for (let [key, originalValue] of Object.entries(directives)) {
    let value:
      | true
      | CSPSource[]
      | SandboxOptions
      | ReportOptions
      | string
      | undefined = originalValue;
    if (key === 'sandbox' && typeof value === 'object') {
      value = _getSandboxString(value as SandboxOptions);
    } else if (key === 'report' && typeof value === 'object') {
      value = _getReportString(value as ReportOptions);
    } else if (Array.isArray(value) && value.length > 0) {
      items.push(`${_dasherize(key)} ${value.map(_getCspItem).join(' ')}`);
    }
    if (typeof value === 'string' && value !== '') {
      items.push(value);
    }
  }
  return items.join('; ');
}

export function _getCspItem(source: CSPSource) {
  if (typeof source === 'string') {
    return source;
  } else if ('uris' in source) {
    return source.uris.join(' ');
  } else if ('uri' in source) {
    return source.uri;
  } else if ('nonce' in source) {
    return `nonce-${source.nonce}`;
  } else if ('nonces' in source) {
    return source.nonces.map(n => `nonce-${n}`).join(' ');
  } else if ('hash' in source) {
    return source.hash;
  } else if ('hashes' in source) {
    return source.hashes.join(' ');
  }
}

export function _getPpHeader(apis: AllowedApis) {
  const final = { ...permissionsPolicyDefaults, ...apis };
  const items: string[] = [];
  for (const [name, value] of Object.entries(final)) {
    items.push(`${_dasherize(name)}=(${value.join(' ')})`);
  }
  return items.join(', ');
}

export function _getSandboxString(options: SandboxOptions) {
  const items: string[] = [];
  for (const [name, value] of Object.entries(options)) {
    if (value) {
      items.push(_dasherize(name));
    }
  }
  if (items.length === 0) {
    return '';
  }
  items.unshift('sandbox');
  return items.join(' ');
}

export function _getReportString(reportOption: ReportOptions) {
  if (reportOption.uri) {
    return `report-uri ${reportOption.uri}`;
  }
  if (reportOption.to) {
    return `report-to ${reportOption.to}`;
  }
}
