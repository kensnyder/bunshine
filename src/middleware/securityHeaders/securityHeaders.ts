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
      urls: string[];
    }
  | {
      nonces: string[];
    }
  | {
      hashes: string[];
    }
  | "'strict-dynamic'"
  | "'report-sample'"
  | "'inline-speculation-rules'";

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
  sandbox?: SandboxOptions;
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

const defaultOptions: SecurityHeaderOptions = {
  contentSecurityPolicy: '',
  crossOriginEmbedderPolicy: '',
  crossOriginOpenerPolicy: '',
  crossOriginResourcePolicy: '',
  permissionsPolicy: '',
  referrerPolicy: '',
  server: null,
  strictTransportSecurity: '',
  xContentTypeOptions: '',
  xFrameOptions: '',
  xPoweredBy: null,
  xXssProtection: '',
};

const contentSecurityPolicyDefaults: CSPDirectives = {
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
      if (name === 'content-security-policy') {
        resp.headers.set(name, getCspHeader(value));
      } else if (name === 'permissions-policy') {
        resp.headers.set(name, getPpHeader(value));
      } else if (typeof value === 'string') {
        resp.headers.set(name, value);
      }
    }
    return resp;
  };
}

function dasherize(str: string): string {
  return str.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
}

function getCspHeader(directives: CSPDirectives) {
  const final = { ...contentSecurityPolicyDefaults, ...directives };
  const items = [];
  for (const [key, value] of Object.entries(final)) {
    if (key === 'sandbox') {
      items.push(getSandboxString(value));
    } else {
      items.push(`${key} ${value.join(' ')}`);
    }
  }
  return items.join('; ');
}

function getPpHeader(apis: AllowedApis) {
  const final = { ...permissionsPolicyDefaults, ...apis };
  const items = [];
  for (const [name, value] of Object.entries(final)) {
    items.push(`${name}=(${value.join(' ')})`);
  }
  return items.join(', ');
}

function getSandboxString(options: SandboxOptions) {
  const items = [];
  for (const [name, value] of Object.entries(options)) {
    if (value === true) {
      items.push(name);
    }
  }
  return items.join(' ');
}
