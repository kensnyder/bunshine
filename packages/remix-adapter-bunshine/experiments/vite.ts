import {
  createRequestHandler,
  type ServerBuild,
} from '@remix-run/server-runtime';
import {
  devLogger,
  HttpRouter,
  serveFiles,
  type Handler,
  type SingleHandler,
} from 'bunshine';
import connectToBunshine from './connectToBunshine';

type Options = {
  app: HttpRouter;
  // TODO: support non-vite builds
  mode: 'development' | 'production';
  buildPath: string;
};

export default async function remixAdapterBunshineVite({
  app,
  mode = process.env.NODE_ENV === 'development' ? 'development' : 'production',
  buildPath,
}: Options) {
  let remixRequestHandler: ReturnType<typeof createRequestHandler>;
  let registerAssetHandler: () => void = () => {};
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
    remixRequestHandler = createRequestHandler(build, mode);
  } else {
    const build: ServerBuild = await import(buildPath);
    remixRequestHandler = createRequestHandler(build, mode);
    registerAssetHandler = () => {
      const fileOptions = {
        immutable: true,
        maxAge: '1y',
      };
      // TODO: confirm these paths are correct
      app.headGet(
        '/assets/*',
        serveFiles(`${buildPath}/client/assets`, fileOptions)
      );
      app.headGet('/build/client/*', serveFiles(buildPath, fileOptions));
    };
  }
  const remixBunshineHandler: SingleHandler = c => {
    return remixRequestHandler(c.request, c.locals);
  };
  const registerRemixHandler = () => app.use(remixBunshineHandler);
  return {
    handler: remixBunshineHandler,
    registerAssetHandler,
    registerRemixHandler,
  };
}

type Options2 = {
  mode: 'development' | 'production';
  buildPath: string;
};

export async function getMiddlewareVite({
  mode = process.env.NODE_ENV === 'development' ? 'development' : 'production',
  buildPath,
}: Options2) {
  let build: ServerBuild | (() => ServerBuild);
  let middleware: Handler = [];
  if (mode === 'development') {
    const viteDevServer = await import('vite').then(vite =>
      vite.createServer({
        server: { middlewareMode: true },
      })
    );
    build = () => {
      return viteDevServer.ssrLoadModule(
        'virtual:remix/server-build'
      ) as unknown as ServerBuild;
    };
    middleware.push(connectToBunshine(viteDevServer.middlewares));
    middleware.push(devLogger());
  } else {
    // production: just import once
    build = await import(buildPath);
  }
  const remixRequestHandler = createRequestHandler(build, mode);
  middleware.push(c => remixRequestHandler(c.request, c.locals));
  return middleware;
}

export async function getMiddlewareClassic() {}

export async function serveAssetsVite(app: HttpRouter, buildPath: string) {
  const fileOptions = {
    immutable: true,
    maxAge: '1y',
  };
  app.headGet(
    '/assets/*',
    serveFiles(`${buildPath}/client/assets`, fileOptions)
  );
  app.headGet('/build/client/*', serveFiles(buildPath, fileOptions));
}

export async function serveAssetsClassic(app: HttpRouter, buildPath: string) {
  const fileOptions = {
    immutable: true,
    maxAge: '1y',
  };
  // TODO: update paths
  app.headGet(
    '/assets/*',
    serveFiles(`${buildPath}/client/assets`, fileOptions)
  );
  app.headGet('/build/client/*', serveFiles(buildPath, fileOptions));
}

/*
export async function createRequestHandler({
  mode = process.env.NODE_ENV === 'development' ? 'development' : 'production',
  useVite = false,
  buildPath,
}: Options) {
  if (useVite) {
    return getViteHandler({ mode, buildPath });
  } else {
    return getClassicHandler({ mode, buildPath });
  }
}

export async function getViteHandler({
  mode,
  buildPath,
}: Pick<Options, 'mode' | 'buildPath'>) {
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
    const getViteResponse = connectToFetch(viteDevServer.middlewares);
    const remixHandler = createRemixRequestHandler(build, mode);
    const bunshineHandler: SingleHandler = async c => {
      try {
        return await getViteResponse(c.request);
      } catch (e) {
        const error = e as Error;
        if (error.message === 'UNHANDLED') {
          return remixHandler(c.request, c.locals);
        } else {
          // send off to our 500 error handler
          throw error;
        }
      }
    };
    return bunshineHandler;
  } else if (mode === 'production') {
    const fileOptions = {
      immutable: true,
      maxAge: '1y',
    };
    const build: ServerBuild = await import(buildPath);
    const remixHandler = createRemixRequestHandler(build, mode);
    const getAsset = serveFiles(
      `${buildPath}/client/assets`,
      fileOptions
    );
    const getClient = serveFiles(buildPath, fileOptions);
    const bunshineHandler: SingleHandler = c => {
      const isGetOrHead =
        c.request.method === 'GET' || c.request.method === 'HEAD';
      if (isGetOrHead && c.url.pathname.startsWith('/assets/')) {
        return getAsset(c);
      }
      if (isGetOrHead && c.url.pathname.startsWith('/build/client/')) {
        return getClient(c);
      }
      remixHandler(c.request, c.locals);
    };
    return bunshineHandler;
  }
}

export async function getClassicHandler({
  mode,
  buildPath,
}: Pick<Options, 'mode' | 'buildPath'>) {
  const fileOptions = {
    immutable: true,
    maxAge: '1y',
  };
  const getAsset = serveFiles(`${buildPath}/build`, fileOptions);
  const getPublic = serveFiles(buildPath, fileOptions);
  if (mode === 'development') {
    const bunshineHandler: SingleHandler = async c => {
      const isGetOrHead =
        c.request.method === 'GET' || c.request.method === 'HEAD';
      if (isGetOrHead && c.url.pathname.startsWith('/build/')) {
        return getAsset(c);
      }
      if (isGetOrHead && c.url.pathname.startsWith('/public/')) {
        return getPublic(c);
      }
      const build: ServerBuild = await import(buildPath);
      return createRemixRequestHandler(build, mode)(c.request, c.locals);
    };
    return bunshineHandler;
  }
  const build: ServerBuild = await import(buildPath);
  const remixHandler = createRemixRequestHandler(build, mode);
  const bunshineHandler: SingleHandler = async c => {
    const isGetOrHead =
      c.request.method === 'GET' || c.request.method === 'HEAD';
    if (isGetOrHead && c.url.pathname.startsWith('/build/')) {
      return getAsset(c);
    }
    if (isGetOrHead && c.url.pathname.startsWith('/public/')) {
      return getPublic(c);
    }
    return remixHandler(c.request, c.locals);
  };
  return bunshineHandler;
}
 */
