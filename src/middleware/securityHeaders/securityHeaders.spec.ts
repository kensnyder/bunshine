import type { Server } from 'bun';
import { beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from '../../HttpRouter/HttpRouter.ts';
import { defaultSecurityHeaders, securityHeaders } from './securityHeaders.ts';

describe('securityHeaders middleware', () => {
  let app: HttpRouter;
  let server: Server;
  beforeEach(() => {
    app = new HttpRouter();
    server = app.listen();
  });
  it('should apply defaults', async () => {
    app.get('/', securityHeaders(defaultSecurityHeaders), ({ html }) =>
      html('')
    );
    const resp = await fetch(server.url);
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(resp.headers.get('Content-Security-Policy')).toBe(
      "frame-src 'self'; worker-src 'self'; connect-src 'self'; default-src 'self'; font-src *; img-src *; manifest-src 'self'; media-src 'self' data:; object-src 'self' data:; prefetch-src 'self'; script-src 'self'; script-src-elem 'self' 'unsafe-inline'; script-src-attr 'none'; style-src-attr 'self' 'unsafe-inline'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
    );
    expect(resp.headers.get('Cross-Origin-Embedder-Policy')).toBe(
      'unsafe-none'
    );
    expect(resp.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(resp.headers.get('Cross-Origin-Resource-Policy')).toBe(
      'same-origin'
    );
    expect(resp.headers.get('Permissions-Policy')).toBe(
      'accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), gamepad=(), geolocation=(), gyroscope=(), hid=(), identity-credentials-get=(), idle-detection=(), local-fonts=(), magnetometer=(), midi=(), otp-credentials=(), payment=(), picture-in-picture=(), publickey-credentials-create=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), speaker-selection=(), storage-access=(), usb=(), web-share=(), window-management=(), xr-spacial-tracking=()'
    );
    expect(resp.headers.get('Referrer-Policy')).toBe('strict-origin');
    expect(resp.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(resp.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(resp.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    // Note that we cannot check strict-transport-security because fetch
    //   does not allow it on non-https connections
  });
  it('should support adding/changing values', async () => {
    app.use(securityHeaders(defaultSecurityHeaders));
    app.get(
      '/',
      securityHeaders({
        contentSecurityPolicy: {
          frameAncestors: ['*'],
        },
      }),
      ({ html }) => html('')
    );
    const resp = await fetch(server.url);
    expect(resp.headers.get('Content-Security-Policy')).toContain(
      'frame-ancestors *'
    );
  });
  it('should skip non-interactive responses', async () => {
    app.use(securityHeaders(defaultSecurityHeaders));
    app.get('/', ({ js }) => js('alert("yo")'));
    const resp = await fetch(server.url);
    expect(resp.headers.has('Content-Security-Policy')).toBe(false);
  });
});
