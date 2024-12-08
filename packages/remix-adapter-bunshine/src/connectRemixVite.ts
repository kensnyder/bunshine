import {
  createRequestHandler as createRemixRequestHandler,
  type ServerBuild,
} from '@remix-run/server-runtime';
import {
  devLogger,
  type Handler,
  type HttpRouter,
  prodLogger,
  serveFiles,
} from 'bunshine';
import connectToBunshine from './connectToBunshine';

export type RemixViteConfig = {
  app: HttpRouter;
  buildPath: string;
  mode?: 'development' | 'production';
  logger?: Handler | boolean;
};

export async function connectRemixVite({
  app,
  mode = process.env.NODE_ENV === 'development' ? 'development' : 'production',
  buildPath,
  logger = true,
}: RemixViteConfig) {
  if (mode === 'development') {
    const viteDevServer = await import('vite').then(vite =>
      vite.createServer({
        server: { middlewareMode: true },
      })
    );
    const build = () => {
      return viteDevServer.ssrLoadModule(
        'virtual:remix/server-build'
      ) as unknown as ServerBuild;
    };
    app.use(connectToBunshine(viteDevServer.middlewares));
    // app.headGet('/*', serveFiles(`${buildPath}/../public`, { maxAge: '1h' }));
    if (logger === true) {
      app.use(devLogger());
    } else if (logger) {
      app.use(logger);
    }
    const remixHandler = createRemixRequestHandler(build, mode);
    app.use(c => remixHandler(c.request, c.locals));
  } else {
    const fileOptions = {
      immutable: true,
      maxAge: '1y',
    };
    const build: ServerBuild = await import(`${buildPath}/server/index.js`);
    app.headGet(
      '/assets/*',
      serveFiles(`${buildPath}/client/assets`, fileOptions)
    );
    app.headGet('/*', serveFiles(`${buildPath}/client`, { maxAge: '1h' }));
    // app.headGet('/build/client/*', serveFiles(buildPath, fileOptions));
    if (logger === true) {
      app.use(prodLogger());
    } else if (logger) {
      app.use(logger);
    }
    const remixHandler = createRemixRequestHandler(build, mode);
    app.use(c => remixHandler(c.request, c.locals));
  }
}
