export { default as Context } from './src/Context/Context';
export {
  html,
  js,
  json,
  redirect,
  text,
  xml,
} from './src/HttpRouter/responseFactories';
export { default as SocketRouter } from './src/WsRouter/WsRouter';
export { cors } from './src/middleware/cors/cors';
export { devLogger } from './src/middleware/devLogger/devLogger';
export { performanceLogger } from './src/middleware/performanceLogger/performanceLogger';
export { prodLogger } from './src/middleware/prodLogger/prodLogger';
export { securityHeaders } from './src/middleware/securityHeaders/securityHeaders';
export { serveFiles } from './src/middleware/serveFiles/serveFiles';
export { Router as HttpRouter };
import HttpRouter from './src/HttpRouter/HttpRouter';

const Router = HttpRouter;

export default HttpRouter;
