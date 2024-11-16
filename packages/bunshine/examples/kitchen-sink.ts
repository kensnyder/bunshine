import {
  HttpRouter,
  applyHandlerIf,
  compression,
  cors,
  devLogger,
  etags,
  headers,
  performanceHeader,
  serveFiles,
  trailingSlashes,
} from '../index';

const app = new HttpRouter();

const htmlSecurityHeaders = headers({
  'Content-Security-Policy': `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;`,
  'Referrer-Policy': 'strict-origin',
  'Permissions-Policy':
    'accelerometer=(), ambient-light-sensor=(), autoplay=(*), battery=(), camera=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), gamepad=(), geolocation=(), gyroscope=(), hid=(), idle-detection=(), local-fonts=(), magnetometer=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-create=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=(), web-share=(self)',
});
app.use(performanceHeader());
app.use(devLogger());
app.use(trailingSlashes('remove'));
app.use(cors({ origin: '*' }));
app.use(etags());
app.use(compression());
app.headGet('/favicon.ico', cacheControl({ age: 365 * 24 * 60 * 60 }), c =>
  c.file(`${import.meta.dir}/../assets/favicon.ico`)
);
app.headGet(
  '/static/*',
  serveFiles(`${import.meta.dir}/../testFixtures/folder`, {
    maxAge: '1y',
  })
);
app.use(
  applyHandlerIf({
    requestCondition: () => true,
    responseCondition: (c, resp) => {
      return String(resp.headers.get('Content-Type')).includes(
        'application/json'
      );
    },
    handler: headers({ 'enjoy-your-json': 'please' }),
  })
);
app.get('/', c => c.redirect('/static/index.html'));
app.get('/bye', htmlSecurityHeaders, c => c.html('<h1>Bye World</h1>'));
app.get('/json', c => c.json({ hello: 'world' }));
app.get('/js', c => c.js('alert("Hello World")'));
app.get('/file', c => c.file(`${import.meta.dir}/server.ts`));
app.post('/parrot', async c =>
  c.json({
    receivedJson: await c.request.json(),
    withHeaders: Object.fromEntries(c.request.headers),
  })
);
app.onError(c => {
  console.log('caught error!', c.error);
  c.json({ error: c.error!.message }, { status: 500 });
});

app.listen({ port: 3300, reusePort: true });
app.emitUrl({ date: true });

function cacheControl({
  age,
  immutable,
}: {
  age: number;
  immutable?: boolean;
}) {
  return headers({
    'Cache-Control': `public, max-age=${age}${immutable ? ', immutable' : ''}`,
  });
}
