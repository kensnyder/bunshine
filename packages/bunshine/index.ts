import jsonResponse from './src/responseFactories/json/json';

export { default as Context } from './src/Context/Context';
export {
  default as HttpRouter,
  type EmitUrlOptions,
  type Handler,
  type HttpMethods,
  type HttpRouterOptions,
  type ListenOptions,
  type Middleware,
  type NextFunction,
  type SingleHandler,
} from './src/HttpRouter/HttpRouter';
export {
  applyHandlerIf,
  type ApplyHandlerIfArgs,
} from './src/middleware/applyHandlerIf/applyHandlerIf';
export {
  compression,
  compressionDefaults,
  type CompressionOptions,
} from './src/middleware/compression/compression';
export {
  cors,
  corsDefaults,
  type CorsOptions,
} from './src/middleware/cors/cors';
export { devLogger } from './src/middleware/devLogger/devLogger';
export {
  defaultEtagsCalculator,
  etags,
  type EtagHashCalculator,
  type EtagOptions,
} from './src/middleware/etags/etags';
export {
  headers,
  type HeaderCondition,
  type HeaderValue,
  type HeaderValues,
} from './src/middleware/headers/headers';
export { type LoggerOptions } from './src/middleware/LoggerOptions';
export { performanceHeader } from './src/middleware/performanceHeader/performanceHeader';
export { prodLogger } from './src/middleware/prodLogger/prodLogger';
export {
  serveFiles,
  type ServeFilesOptions,
} from './src/middleware/serveFiles/serveFiles';
export { trailingSlashes } from './src/middleware/trailingSlashes/trailingSlashes';
export { default as ms } from './src/ms/ms';
export { default as parseRangeHeader } from './src/parseRangeHeader/parseRangeHeader';
export {
  cssResponse,
  htmlResponse,
  jsResponse,
  plaintextResponse,
  xmlResponse,
  default as factory,
} from './src/responseFactories/factory/factory';
export { default as jsonResponse
} from './src/responseFactories/json/json';
export { type FileResponseOptions } from './src/responseFactories/file/file';
export {
  type SseClose,
  type SseSend,
  type SseSetupFunction,
} from './src/responseFactories/sse/sse';
export {
  default as SocketRouter,
  type BunHandlers,
  type BunshineHandlers,
  type SocketCloseHandler,
  type SocketErrorHandler,
  type SocketEventType,
  type SocketMessageHandler,
  type SocketPlainHandler,
  type SocketUpgradeHandler,
  type WsDataShape,
} from './src/SocketRouter/SocketRouter';
