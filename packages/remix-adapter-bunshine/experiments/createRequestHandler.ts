import {
  createRequestHandler as createRemixRequestHandler,
  type ServerBuild,
} from '@remix-run/server-runtime';
import { SingleHandler, serveFiles } from 'bunshine';
import { connectToFetch } from 'connect-to-fetch';

type Options = {
  mode: 'development' | 'production';
  useVite?: boolean;
  buildFolderPath: string;
};

export async function createRequestHandler({
  mode = process.env.NODE_ENV === 'development' ? 'development' : 'production',
  useVite = false,
  buildFolderPath,
}: Options) {
  if (useVite) {
    return getViteHandler({ mode, buildFolderPath });
  } else {
    return getClassicHandler({ mode, buildFolderPath });
  }
}

export async function getViteHandler({
  mode,
  buildFolderPath,
}: Pick<Options, 'mode' | 'buildFolderPath'>) {
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
    const build: ServerBuild = await import(buildFolderPath);
    const remixHandler = createRemixRequestHandler(build, mode);
    const getAsset = serveFiles(
      `${buildFolderPath}/client/assets`,
      fileOptions
    );
    const getClient = serveFiles(buildFolderPath, fileOptions);
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
  buildFolderPath,
}: Pick<Options, 'mode' | 'buildFolderPath'>) {
  const fileOptions = {
    immutable: true,
    maxAge: '1y',
  };
  const getAsset = serveFiles(`${buildFolderPath}/build`, fileOptions);
  const getPublic = serveFiles(buildFolderPath, fileOptions);
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
      const build: ServerBuild = await import(buildFolderPath);
      return createRemixRequestHandler(build, mode)(c.request, c.locals);
    };
    return bunshineHandler;
  }
  const build: ServerBuild = await import(buildFolderPath);
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
