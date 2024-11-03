import { SecurityHeaderShape } from './securityHeaders.types.ts';

export const baselineHeaders: SecurityHeaderShape = {
  accessControlAllowOrigin: null,
  contentSecurityPolicy: {
    frameSrc: ["'self'"],
    workerSrc: ["'self'"],
    connectSrc: ["'self'"],
    defaultSrc: ["'self'"],
    fontSrc: ["'self'"],
    imgSrc: ["'self'"],
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
  xPoweredBy: null,
  xXssProtection: '1; mode=block',
};

export const allowExternalAssets: SecurityHeaderShape = {
  contentSecurityPolicy: {
    fontSrc: ['*'],
    imgSrc: ['*'],
    mediaSrc: ['*'],
  },
};

export const allowExternalJavaScript: SecurityHeaderShape = {
  contentSecurityPolicy: {
    fontSrc: ['*'],
    imgSrc: ['*'],
    mediaSrc: ['*'],
  },
};

export const allowIframing: SecurityHeaderShape = {
  contentSecurityPolicy: {
    frameAncestors: ['*'],
  },
};

export const allowAutoplay: SecurityHeaderShape = {
  permissionsPolicy: {
    autoplay: ['self'],
  },
};

export const allowFullscreen: SecurityHeaderShape = {
  permissionsPolicy: {
    fullscreen: ['self'],
  },
};

export const allowCamera: SecurityHeaderShape = {
  permissionsPolicy: {
    camera: ['self'],
  },
};

/*
Sources:

https://developer.mozilla.org/en-US/docs/Web/HTTP/Permissions_Policy

accelerometer: Controls access to device acceleration information.
ambient-light-sensor: Controls access to ambient light sensor data.
attribution-reporting: Controls use of the Attribution Reporting API.
autoplay: Controls automatic playback of media.
bluetooth: Controls access to Bluetooth devices.
browsing-topics: Controls access to the Topics API.
camera: Controls access to video input devices.
ch-device-memory: Controls access to device memory information.
ch-downlink: Controls access to network downlink information.
ch-ect: Controls access to effective connection type information.
ch-prefers-color-scheme: Controls access to user’s preferred color scheme.
ch-prefers-reduced-motion: Controls access to user’s motion preference.
ch-rtt: Controls access to network round-trip time information.
ch-save-data: Controls access to user’s data saving preference.
ch-ua: Controls access to user agent information.
ch-ua-arch: Controls access to user agent architecture information.
ch-ua-bitness: Controls access to user agent bitness information.
ch-ua-full: Controls access to full user agent string.
ch-ua-full-version: Controls access to full user agent version.
ch-ua-full-version-list: Controls access to full user agent version list.
ch-ua-mobile: Controls access to user agent mobile indicator.
ch-ua-model: Controls access to user agent model information.
ch-ua-platform: Controls access to user agent platform information.
ch-ua-platform-version: Controls access to user agent platform version.
ch-ua-wow64: Controls access to user agent WOW64 status.
ch-viewport-height: Controls access to viewport height information.
ch-viewport-width: Controls access to viewport width information.
ch-width: Controls access to device width information.
clipboard-read: Controls read access to the clipboard.
clipboard-write: Controls write access to the clipboard.
compute-pressure: Controls access to the Compute Pressure API.
cross-origin-isolated: Controls whether a document is allowed to use cross-origin isolation features.
display-capture: Controls access to display capture APIs.
document-domain: Controls the ability to set document.domain.
encrypted-media: Controls access to Encrypted Media Extensions.
execution-while-not-rendered: Controls execution of scripts when the document is not rendered.
execution-while-out-of-viewport: Controls execution of scripts when the document is out of the viewport.
focus-without-user-activation: Controls the ability to focus elements without user activation.
fullscreen: Controls access to fullscreen mode.
gamepad: Controls access to gamepad devices.
geolocation: Controls access to geolocation data.
gyroscope: Controls access to gyroscope data.
hid: Controls access to Human Interface Devices.
idle-detection: Controls access to idle detection features.
interest-cohort: Controls access to interest cohort information.
keyboard-map: Controls access to the Keyboard Map API.
local-fonts: Controls access to local fonts.
magnetometer: Controls access to magnetometer data.
microphone: Controls access to audio input devices.
midi: Controls access to MIDI devices.
otp-credentials: Controls access to OTP credentials.
payment: Controls access to the Payment Request API.
picture-in-picture: Controls access to Picture-in-Picture mode.
publickey-credentials-get: Controls access to public key credentials.
screen-wake-lock: Controls access to the Screen Wake Lock API.
serial: Controls access to serial devices.
speaker-selection: Controls access to speaker selection features.
sync-xhr: Controls the use of synchronous XMLHttpRequest.
trust-token-redemption: Controls access to Trust Token redemption.
usb: Controls access to USB devices.
vertical-scroll: Controls vertical scroll behavior.
web-share: Controls access to the Web Share API.
window-management: Controls access to window management features.
xr-spatial-tracking: Controls access to spatial tracking features for XR devices.



https://www.w3.org/TR/CSP3/#directives-fetch

base-uri: Restricts the URLs which can be used in a document's <base> element.
block-all-mixed-content: Prevents loading any assets using HTTP when the page is loaded using HTTPS.
child-src: Controls the valid sources for web workers and nested browsing contexts. Note that this directive is deprecated in CSP Level 3 in favor of worker-src and frame-src.
connect-src: Restricts the URLs which can be loaded using script interfaces such as fetch, XMLHttpRequest, WebSocket, and EventSource.
default-src: Serves as a fallback for other fetch directives when they are not explicitly defined. It specifies the default sources for all content types.
font-src: Specifies the valid sources for web fonts.
form-action: Restricts the URLs which can be used as the action of HTML form elements.
frame-ancestors: Specifies the valid parents that may embed a page using <frame>, <iframe>, <object>, <embed>, or <applet>.
frame-src: Determines the valid sources for nested browsing contexts loading using elements such as <frame> and <iframe>.
img-src: Determines the valid sources for images and favicons.
manifest-src: Defines the valid sources for application manifest files.
media-src: Specifies the valid sources for media files like audio and video.
navigate-to: Restricts the URLs to which a document can navigate by any means, including <form> submissions, <a> element clicks, window.location changes, etc.
object-src: Defines the valid sources for the <object>, <embed>, and <applet> elements.
plugin-types: Specifies the set of plugins that can be invoked by the document.
prefetch-src: Specifies the valid sources to be prefetched or prerendered.
report-to: Specifies the group to which the user agent sends reports about policy violations, as defined in the Reporting API.
report-uri: Specifies the URI to which the user agent sends reports about policy violations. Note that this directive is deprecated in CSP Level 3 in favor of report-to.
require-sri-for: Requires the use of Subresource Integrity for scripts or styles on the page.
require-trusted-types-for: Enforces that only Trusted Types can be used in specific DOM XSS sinks.
sandbox: Enables a sandbox for the requested resource, with the option to specify exceptions.
script-src: Defines the valid sources for JavaScript. This includes both inline scripts and external script files.
style-src: Specifies the valid sources for stylesheets. This includes both inline styles and external CSS files.
trusted-types: Restricts the creation of Trusted Types policies and the usage of functions that create DOM XSS sinks.
upgrade-insecure-requests: Instructs user agents to treat all of a site's insecure URLs (those served over HTTP) as though they have been replaced with secure URLs (those served over HTTPS).
worker-src: Specifies the valid sources for Worker, SharedWorker, or ServiceWorker scripts.

 */
