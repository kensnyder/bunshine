import {
  createRequestHandler,
  type ServerBuild,
} from '@remix-run/server-runtime';
import { HttpRouter, serveFiles, type SingleHandler } from 'bunshine';
import connectToBunshine from './connectToBunshine';

type Options = {
  app: HttpRouter;
  mode: 'development' | 'production';
  buildFolderPath: string;
  logger?: SingleHandler;
};

const logTypes = /text\/html|application\/json/;

export default async function remixAdapterBunshineVite({
  app,
  mode = process.env.NODE_ENV === 'development' ? 'development' : 'production',
  buildFolderPath,
  logger = undefined,
}: Options) {
  if (logger) {
    app.use(async (c, next) => {
      const resp = await next();
      if (logTypes.test(resp.headers.get('content-type') || '')) {
        return logger(c, () => Promise.resolve(resp));
      }
      return resp;
    });
  }
  if (mode === 'development') {
    const viteDevServer = await import('vite').then(vite =>
      vite.createServer({
        server: { middlewareMode: true },
      })
    );
    app.use(connectToBunshine(viteDevServer.middlewares));
    const build = () => {
      return viteDevServer.ssrLoadModule(
        'virtual:remix/server-build'
      ) as unknown as ServerBuild;
    };
    const remixHandler = createRequestHandler(build, mode);
    app.all('*', c => {
      return remixHandler(c.request, c.locals);
    });
  } else {
    const build: ServerBuild = await import(buildFolderPath);
    const remixHandler = createRequestHandler(build, mode);
    app.all('*', c => {
      return remixHandler(c.request, c.locals);
    });
    const fileOptions = {
      immutable: true,
      maxAge: '1y',
    };
    app.headGet(
      '/assets/*',
      serveFiles(`${buildFolderPath}/client/assets`, fileOptions)
    );
    app.headGet('/build/client/*', serveFiles(buildFolderPath, fileOptions));
  }
}
