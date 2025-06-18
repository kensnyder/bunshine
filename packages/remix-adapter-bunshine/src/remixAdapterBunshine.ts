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

export type RemixAdapterBunshineConfig = {
  app: HttpRouter;
  buildPath: string;
  mode?: 'development' | 'production';
  logger?: Handler | boolean;
};

export default async function remixAdapterBunshine({
  app,
  mode = process.env.NODE_ENV === 'development' ? 'development' : 'production',
  buildPath,
  logger = true,
}: RemixAdapterBunshineConfig) {
  if (mode === 'development') {
    const viteDevServer = await import('vite').then(vite =>
      vite.createServer({
        server: {
          middlewareMode: true,
        },
        appType: 'custom',
      })
    );
    const build = async () => {
      return viteDevServer.ssrLoadModule(
        'virtual:remix/server-build'
      ) as unknown as ServerBuild;
      // const server = (await viteDevServer.ssrLoadModule(
      //   'virtual:remix/server-build'
      // )) as unknown as ServerBuild;
      // // const { routes, assets, ...other } = server;
      // // console.log('Vite dev server created', other);
      // return server;
    };
    app.use(connectToBunshine(viteDevServer.middlewares));
    app.use(c => console.log(c.request.method, c.url.pathname));
    if (logger === true) {
      app.use(devLogger({ writer: process.stdout }));
    } else if (logger) {
      app.use(logger);
    }
    const remixHandler = createRemixRequestHandler(build, mode);
    app.use(c => remixHandler(c.request, c.locals));
    // app.use(async c => {
    //   const resp = await remixHandler(c.request, c.locals);
    //   console.log('got response from remixHandler', c.url.pathname);
    //   return resp;
    // });
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
    if (logger === true) {
      app.use(prodLogger({ writer: process.stdout }));
    } else if (logger) {
      app.use(logger);
    }
    const remixHandler = createRemixRequestHandler(build, mode);
    app.use(c => remixHandler(c.request, c.locals));
  }
}
