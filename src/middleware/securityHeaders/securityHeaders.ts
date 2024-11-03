import Context from '../../Context/Context.ts';
import dasherize from '../../dasherize/dasherize.ts';
import deepMerge from '../../deepMerge/deepMerge.ts';
import type { Middleware, NextFunction } from '../../HttpRouter/HttpRouter.ts';
import { SecurityHeaderShape } from './securityHeaders.types.ts';
import serialize from './securityHeaderSerializer.ts';

export const defaultSecurityHeaders: SecurityHeaderShape = {
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
    autoplay: [],
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
    webShare: [],
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

export function securityHeaders(spec: SecurityHeaderShape): Middleware {
  return async (context: Context, next: NextFunction) => {
    if (context.locals.securityHeaders) {
      deepMerge(context.locals.securityHeaders, spec);
    } else {
      context.locals.securityHeaders = structuredClone(spec);
    }
    const resp = await next();
    if (isInteractiveResponse(resp)) {
      // we only need security headers for interactive responses and redirects
      addHeaders(resp, context.locals.securityHeaders);
    }
    return resp;
  };
}

function addHeaders(response: Response, spec: SecurityHeaderShape) {
  for (const [name, value] of Object.entries(spec)) {
    const dasherizedName = dasherize(name);
    // if (response.headers.has(dasherizedName)) {
    //   continue;
    // }
    const resolved = serialize(dasherizedName, value);
    if (typeof resolved === 'string') {
      response.headers.set(dasherizedName, resolved);
    }
  }
}

const types = [
  'text/html',
  'image/svg+xml',
  'application/atom+xml',
  'application/rss+xml',
];

export function isInteractiveResponse(response: Response) {
  // browsers only accept security headers for interactive responses
  //   or 3xx redirects
  return (
    (response.status >= 300 && response.status <= 399) ||
    types.some(type => response.headers.get('content-type')?.includes(type))
  );
}
