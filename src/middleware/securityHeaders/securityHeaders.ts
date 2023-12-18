import Context from '../../Context/Context.ts';
import type { Middleware, NextFunction } from '../../HttpRouter/HttpRouter.ts';
// @ts-ignore
import bunshine from '../../../package.json';

export type SecurityHeaderValue = string | null | undefined | boolean;
export type SecurityHeader =
  | SecurityHeaderValue
  | ((context: Context) => SecurityHeaderValue)
  | ((context: Context) => Promise<SecurityHeaderValue>);

export type SecurityHeaderOptions = {
  accessControlAllowOrigin?: SecurityHeader | true;
  contentSecurityPolicy?: CSPDirectives | true;
  crossOriginEmbedderPolicy?: SecurityHeader | true;
  crossOriginOpenerPolicy?: SecurityHeader | true;
  crossOriginResourcePolicy?: SecurityHeader | true;
  permissionsPolicy?: AllowedApis | true;
  referrerPolicy?: SecurityHeader | true;
  server?: SecurityHeader | true;
  strictTransportSecurity?: SecurityHeader | true;
  xContentTypeOptions?: SecurityHeader | true;
  xFrameOptions?: SecurityHeader | true;
  xPoweredBy?: SecurityHeader | true;
  xXssProtection?: SecurityHeader | true;
};

type SandboxOptions = {
  allowForms?: boolean;
  allowModals?: boolean;
  allowOrientationLock?: boolean;
  allowPointerLock?: boolean;
  allowPopups?: boolean;
  allowPopupsToEscapeSandbox?: boolean;
  allowPresentation?: boolean;
  allowSameOrigin?: boolean;
  allowScripts?: boolean;
  allowTopNavigation?: boolean;
};

type ReportOptions = {
  uri?: string;
  to?: string;
};

type CSPDirectives = {
  frameSrc?: CSPSource[];
  workerSrc?: CSPSource[];
  connectSrc?: CSPSource[];
  defaultSrc?: CSPSource[];
  fontSrc?: CSPSource[];
  imgSrc?: CSPSource[];
  manifestSrc?: CSPSource[];
  mediaSrc?: CSPSource[];
  objectSrc?: CSPSource[];
  prefetchSrc?: CSPSource[];
  scriptSrc?: CSPSource[];
  scriptSrcElem?: CSPSource[];
  scriptSrcAttr?: CSPSource[];
  styleSrcAttr?: CSPSource[];
  baseUri?: CSPSource[];
  formAction?: CSPSource[];
  frameAncestors?: CSPSource[];
  sandbox?: SandboxOptions | true;
  report?: ReportOptions | true;
};

type ApiSource =
  | '*'
  | '"data:*"'
  | '"mediastream:*"'
  | '"blob:*"'
  | '"filesystem:*"'
  | 'self'
  | 'unsafe-eval'
  | 'wasm-unsafe-eval'
  | 'unsafe-hashes'
  | 'unsafe-inline'
  | 'none'
  | {
      urls: string[];
    }
  | {
      nonces: string[];
    }
  | {
      hashes: string[];
    };

type AllowedApis = {
  accelerometer?: ApiSource[];
  ambientLightSensor?: ApiSource[];
  autoplay?: ApiSource[];
  battery?: ApiSource[];
  camera?: ApiSource[];
  displayCapture?: ApiSource[];
  documentDomain?: ApiSource[];
  encryptedMedia?: ApiSource[];
  executionWhileNotRendered?: ApiSource[];
  executionWhileOutOfViewport?: ApiSource[];
  fullscreen?: ApiSource[];
  gamepad?: ApiSource[];
  geolocation?: ApiSource[];
  gyroscope?: ApiSource[];
  hid?: ApiSource[];
  identityCredentialsGet?: ApiSource[];
  idleDetection?: ApiSource[];
  localFonts?: ApiSource[];
  magnetometer?: ApiSource[];
  midi?: ApiSource[];
  otpCredentials?: ApiSource[];
  payment?: ApiSource[];
  pictureInPicture?: ApiSource[];
  publickeyCredentialsCreate?: ApiSource[];
  publickeyCredentialsGet?: ApiSource[];
  screenWakeLock?: ApiSource[];
  serial?: ApiSource[];
  speakerSelection?: ApiSource[];
  storageAccess?: ApiSource[];
  usb?: ApiSource[];
  webShare?: ApiSource[];
  windowManagement?: ApiSource[];
  xrSpacialTracking?: ApiSource[];
};

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

function resolveHeaderValue(
  name: string,
  value: SecurityHeaderValue | AllowedApis | CSPDirectives
) {
  if (value === false || value === null || value === undefined) {
    return;
  }
  if (name === 'xPoweredBy' && value === true) {
    return `Bunshine v${bunshine.version}`;
  } else if (value === true) {
    // @ts-expect-error
    value = defaultValues[name];
  }
  if (name === 'contentSecurityPolicy') {
    return getCspHeader(value as CSPDirectives);
  } else if (name === 'permissionsPolicy') {
    return getPpHeader(value as AllowedApis);
  }
  return value;
}

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
      const resolved = resolveHeaderValue(name, value);
      if (resolved) {
        headers.values.push([dasherize(name), resolved]);
      }
    }
  }
  return async (context: Context, next: NextFunction) => {
    const resp = await next();
    if (!resp.headers.get('content-type')?.includes('text/html')) {
      // no need to set security headers for non-html responses
      return resp;
    }
    for (let [dasherizedName, value] of headers.values) {
      resp.headers.set(dasherizedName, value);
    }
    for (let [rawName, value] of headers.functions) {
      try {
        let resolved = resolveHeaderValue(rawName, value(context));
        // @ts-expect-error
        if (resolved && typeof resolved.then === 'function') {
          resolved = await resolved;
        }
        if (typeof resolved === 'string' && resolved !== '') {
          resp.headers.set(dasherize(rawName), resolved);
        }
      } catch (e) {}
    }
    return resp;
  };
}

function dasherize(str: string): string {
  return str.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
}

function getCspHeader(directives: CSPDirectives) {
  const items = [];
  for (let [key, originalValue] of Object.entries(directives)) {
    let value:
      | true
      | CSPSource[]
      | SandboxOptions
      | ReportOptions
      | string
      | undefined = originalValue;
    if (key === 'sandbox' && typeof value === 'object') {
      value = getSandboxString(value as SandboxOptions);
    } else if (key === 'report' && typeof value === 'object') {
      value = getReportString(value as ReportOptions);
    } else if (Array.isArray(value) && value.length > 0) {
      items.push(`${dasherize(key)} ${value.map(getCspItem).join(' ')}`);
    }
    if (typeof value === 'string' && value !== '') {
      items.push(value);
    }
  }
  return items.join('; ');
}

type CSPSource =
  | '*'
  | 'data:'
  | 'mediastream:'
  | 'blob:'
  | 'filesystem:'
  | "'self'"
  | "'unsafe-eval'"
  | "'wasm-unsafe-eval'"
  | "'unsafe-hashes'"
  | "'unsafe-inline'"
  | "'none'"
  | {
      uri: string;
    }
  | {
      uris: string[];
    }
  | {
      nonce: string;
    }
  | {
      nonces: string[];
    }
  | {
      hash: string;
    }
  | {
      hashes: string[];
    }
  | "'strict-dynamic'"
  | "'report-sample'"
  | "'inline-speculation-rules'"
  | string;

function getCspItem(source: CSPSource) {
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

function getPpHeader(apis: AllowedApis) {
  const final = { ...permissionsPolicyDefaults, ...apis };
  const items = [];
  for (const [name, value] of Object.entries(final)) {
    items.push(`${dasherize(name)}=(${value.join(' ')})`);
  }
  return items.join(', ');
}

function getSandboxString(options: SandboxOptions) {
  const items = [];
  for (const [name, value] of Object.entries(options)) {
    if (value) {
      items.push(dasherize(name));
    }
  }
  if (items.length === 0) {
    return '';
  }
  items.unshift('sandbox');
  return items.join(' ');
}

function getReportString(reportOption: ReportOptions) {
  if (reportOption.uri) {
    return `report-uri ${reportOption.uri}`;
  }
  if (reportOption.to) {
    return `report-to ${reportOption.to}`;
  }
}
