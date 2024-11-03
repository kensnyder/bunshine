export type SecurityHeaderValue = string | null | undefined | boolean;

export type SecurityHeaderShape = {
  accessControlAllowOrigin?: SecurityHeaderValue;
  contentSecurityPolicy?: CSPDirectives;
  crossOriginEmbedderPolicy?: SecurityHeaderValue;
  crossOriginOpenerPolicy?: SecurityHeaderValue;
  crossOriginResourcePolicy?: SecurityHeaderValue;
  permissionsPolicy?: PermittedApis;
  referrerPolicy?: SecurityHeaderValue;
  server?: SecurityHeaderValue;
  strictTransportSecurity?: SecurityHeaderValue;
  xContentTypeOptions?: SecurityHeaderValue;
  xFrameOptions?: SecurityHeaderValue;
  xPoweredBy?: SecurityHeaderValue;
  xXssProtection?: SecurityHeaderValue;
};

export type SandboxOptions = {
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

export type ReportOptions = {
  uri?: string;
  to?: string;
};

export type CSPDirectives = {
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
  report?: ReportOptions;
};

export type ApiSource =
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

// see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy
export type PermittedApis = {
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

export type CSPSource =
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
