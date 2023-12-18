import { beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from '../../HttpRouter/HttpRouter.ts';
import { securityHeaders } from './securityHeaders.ts';

// @ts-expect-error
const server: Server = {};

describe('securityHeaders middleware', () => {
  let req: Request;
  let resp: Response;
  let app: HttpRouter;
  let oldEnv: string | undefined;
  beforeEach(() => {
    req = new Request('http://localhost/');
    resp = new Response('', {
      headers: new Headers({ 'Content-type': 'text/html' }),
    });
    app = new HttpRouter();
  });
  it('should apply defaults', async () => {
    app.get('/', securityHeaders(), () => resp);
    const finalResp = await app.fetch(req, server);
    expect(finalResp).toBe(resp);
    expect(finalResp.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(finalResp.headers.get('Content-Security-Policy')).toBe(
      "frame-src 'self'; worker-src 'self'; connect-src 'self'; default-src 'self'; font-src *; img-src *; manifest-src 'self'; media-src 'self' data:; object-src 'self' data:; prefetch-src 'self'; script-src 'self'; script-src-elem 'self' 'unsafe-inline'; script-src-attr 'none'; style-src-attr 'self' 'unsafe-inline'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
    );
    expect(finalResp.headers.get('Cross-Origin-Embedder-Policy')).toBe(
      'unsafe-none'
    );
    expect(finalResp.headers.get('Cross-Origin-Opener-Policy')).toBe(
      'same-origin'
    );
    expect(finalResp.headers.get('Cross-Origin-Resource-Policy')).toBe(
      'same-origin'
    );
    expect(finalResp.headers.get('Permissions-Policy')).toBe(
      'accelerometer=(), ambient-light-sensor=(), autoplay=(self), battery=(), camera=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), gamepad=(), geolocation=(), gyroscope=(), hid=(), identity-credentials-get=(), idle-detection=(), local-fonts=(), magnetometer=(), midi=(), otp-credentials=(), payment=(), picture-in-picture=(), publickey-credentials-create=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), speaker-selection=(), storage-access=(), usb=(), web-share=(self), window-management=(), xr-spacial-tracking=()'
    );
    expect(finalResp.headers.get('Referrer-Policy')).toBe('strict-origin');
    expect(finalResp.headers.get('Strict-Transport-Security')).toBe(
      'max-age=86400; includeSubDomains; preload'
    );
    expect(finalResp.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(finalResp.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(finalResp.headers.get('X-XSS-Protection')).toBe('1; mode=block');
  });
  it('should apply defaults when given "true"', async () => {
    app.get(
      '/',
      securityHeaders({
        accessControlAllowOrigin: true,
        contentSecurityPolicy: true,
        crossOriginEmbedderPolicy: true,
        crossOriginOpenerPolicy: true,
        crossOriginResourcePolicy: true,
        permissionsPolicy: true,
        referrerPolicy: true,
        strictTransportSecurity: true,
        xContentTypeOptions: true,
        xFrameOptions: true,
        xXssProtection: true,
        xPoweredBy: true,
      }),
      () => resp
    );
    const finalResp = await app.fetch(req, server);
    expect(finalResp).toBe(resp);
    expect(finalResp.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(finalResp.headers.get('Content-Security-Policy')).toBe(
      "frame-src 'self'; worker-src 'self'; connect-src 'self'; default-src 'self'; font-src *; img-src *; manifest-src 'self'; media-src 'self' data:; object-src 'self' data:; prefetch-src 'self'; script-src 'self'; script-src-elem 'self' 'unsafe-inline'; script-src-attr 'none'; style-src-attr 'self' 'unsafe-inline'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
    );
    expect(finalResp.headers.get('Cross-Origin-Embedder-Policy')).toBe(
      'unsafe-none'
    );
    expect(finalResp.headers.get('Cross-Origin-Opener-Policy')).toBe(
      'same-origin'
    );
    expect(finalResp.headers.get('Cross-Origin-Resource-Policy')).toBe(
      'same-origin'
    );
    expect(finalResp.headers.get('Permissions-Policy')).toBe(
      'accelerometer=(), ambient-light-sensor=(), autoplay=(self), battery=(), camera=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), gamepad=(), geolocation=(), gyroscope=(), hid=(), identity-credentials-get=(), idle-detection=(), local-fonts=(), magnetometer=(), midi=(), otp-credentials=(), payment=(), picture-in-picture=(), publickey-credentials-create=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), speaker-selection=(), storage-access=(), usb=(), web-share=(self), window-management=(), xr-spacial-tracking=()'
    );
    expect(finalResp.headers.get('Referrer-Policy')).toBe('strict-origin');
    expect(finalResp.headers.get('Strict-Transport-Security')).toBe(
      'max-age=86400; includeSubDomains; preload'
    );
    expect(finalResp.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(finalResp.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(finalResp.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    expect(finalResp.headers.get('X-Powered-By')).toContain('Bunshine');
  });
  it('should build out partial CSP Headers', async () => {
    app.get(
      '/',
      securityHeaders({
        contentSecurityPolicy: {
          frameSrc: [{ uris: ['https://example.com'] }],
          workerSrc: ["'self'", { uri: 'https://example.com' }],
          connectSrc: [{ nonce: 'a' }],
          defaultSrc: [{ nonces: ['a', 'b'] }],
          fontSrc: [{ hash: 'a' }],
          imgSrc: [{ hashes: ['a', 'b'] }],
        },
        xPoweredBy: 'Magic',
      }),
      () => resp
    );
    const finalResp = await app.fetch(req, server);
    expect(finalResp).toBe(resp);
    expect(finalResp.headers.get('Content-Security-Policy')).toBe(
      [
        'frame-src https://example.com',
        "worker-src 'self' https://example.com",
        'connect-src nonce-a',
        'default-src nonce-a nonce-b',
        'font-src a',
        'img-src a b',
      ].join('; ')
    );
    expect(finalResp.headers.get('X-Powered-By')).toContain('Magic');
  });
  it('should not add headers if not html', async () => {
    const emptyResp = new Response();
    app.get('/', securityHeaders(), () => emptyResp);
    const finalResp = await app.fetch(req, server);
    expect(finalResp).toBe(emptyResp);
    expect(finalResp.headers.get('Content-Security-Policy')).toBe(null);
    expect(finalResp.headers.get('Cross-Origin-Embedder-Policy')).toBe(null);
    expect(finalResp.headers.get('Cross-Origin-Opener-Policy')).toBe(null);
    expect(finalResp.headers.get('Cross-Origin-Resource-Policy')).toBe(null);
    expect(finalResp.headers.get('Permissions-Policy')).toBe(null);
    expect(finalResp.headers.get('Referrer-Policy')).toBe(null);
    expect(finalResp.headers.get('Strict-Transport-Security')).toBe(null);
    expect(finalResp.headers.get('X-Content-Type-Options')).toBe(null);
    expect(finalResp.headers.get('X-Frame-Options')).toBe(null);
    expect(finalResp.headers.get('X-XSS-Protection')).toBe(null);
  });
  it('should allow functions', async () => {
    app.get(
      '/',
      securityHeaders({
        xXssProtection: () => '1',
      }),
      () => resp
    );
    const finalResp = await app.fetch(req, server);
    expect(finalResp).toBe(resp);
    expect(finalResp.headers.get('X-XSS-Protection')).toBe('1');
  });
  it('should allow functions that return promises', async () => {
    app.get(
      '/',
      securityHeaders({
        xXssProtection: async () => '1',
      }),
      () => resp
    );
    const finalResp = await app.fetch(req, server);
    expect(finalResp).toBe(resp);
    expect(finalResp.headers.get('X-XSS-Protection')).toBe('1');
  });
  it('should support sandbox', async () => {
    app.get(
      '/',
      securityHeaders({
        contentSecurityPolicy: {
          sandbox: {
            allowForms: true,
            allowModals: true,
            allowOrientationLock: true,
            allowPointerLock: true,
            allowPopups: true,
            allowPopupsToEscapeSandbox: true,
            allowPresentation: true,
            allowSameOrigin: true,
            allowScripts: true,
            allowTopNavigation: true,
          },
        },
      }),
      () => resp
    );
    const finalResp = await app.fetch(req, server);
    // expect(finalResp).toBe(resp);
    expect(finalResp.headers.get('Content-Security-Policy')).toBe(
      'sandbox allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-top-navigation'
    );
  });
  it('should support report.uri', async () => {
    app.get(
      '/',
      securityHeaders({
        contentSecurityPolicy: {
          report: {
            uri: 'http://example.com/report',
          },
        },
      }),
      () => resp
    );
    const finalResp = await app.fetch(req, server);
    // expect(finalResp).toBe(resp);
    expect(finalResp.headers.get('Content-Security-Policy')).toBe(
      'report-uri http://example.com/report'
    );
  });
  it('should support report.to', async () => {
    app.get(
      '/',
      securityHeaders({
        contentSecurityPolicy: {
          report: {
            to: 'endpoint-1',
          },
        },
      }),
      () => resp
    );
    const finalResp = await app.fetch(req, server);
    // expect(finalResp).toBe(resp);
    expect(finalResp.headers.get('Content-Security-Policy')).toBe(
      'report-to endpoint-1'
    );
  });
});
