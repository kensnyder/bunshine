import type { BunFile, Server } from 'bun';
import type HttpRouter from '../HttpRouter/HttpRouter';
import {
  file,
  html,
  js,
  json,
  redirect,
  sse,
  text,
  xml,
  type FileResponseOptions,
  type SseSetupFunction,
} from '../HttpRouter/responseFactories';

export default class Context {
  request: Request;
  server: Server;
  app: HttpRouter;
  params: Record<string, string> = {};
  locals: Record<string, any> = {};
  error: Error | undefined;
  url: URL;
  constructor(request: Request, server: Server, app: HttpRouter) {
    this.request = request;
    this.server = server;
    this.app = app;
    this.url = new URL(request.url);
  }
  text = text;
  js = js;
  html = html;
  xml = xml;
  json = json;
  redirect = redirect;
  file = async (
    filenameOrBunFile: string | BunFile,
    responseOptions: FileResponseOptions = {}
  ) => {
    return file(filenameOrBunFile, {
      range: this.request.headers.get('Range') || undefined,
      ...responseOptions,
    });
  };
  sse = (setup: SseSetupFunction, init: ResponseInit = {}) => {
    return sse(this.request.signal, setup, init);
  };
}
