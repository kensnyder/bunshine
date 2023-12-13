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
  /** The raw request object */
  request: Request;
  /** The Bun server instance */
  server: Server;
  /** The HttpRouter instance */
  app: HttpRouter;
  /** The request params from URL placeholders */
  params: Record<string, string> = {};
  /** A place to persist data between handlers for the duration of the request */
  locals: Record<string, any> = {};
  /** Handlers registered with app.on500() can see this Error object */
  error: Error | undefined;
  /** A URL object constructed with `new URL(request.url)` */
  url: URL;
  constructor(request: Request, server: Server, app: HttpRouter) {
    this.request = request;
    this.server = server;
    this.app = app;
    this.url = new URL(request.url);
  }
  /** A shorthand for `new Response({ body: text, headers: { 'Content-type': 'text/plain' } })` */
  text = text;
  /** A shorthand for `new Response({ body: js, headers: { 'Content-type': 'text/javascript' } })` */
  js = js;
  /** A shorthand for `new Response({ body: html, headers: { 'Content-type': 'text/html' } })` */
  html = html;
  /** A shorthand for `new Response({ body: xml, headers: { 'Content-type': 'text/xml' } })` */
  xml = xml;
  /** A shorthand for `new Response({ body: JSON.stringify(data), headers: { 'Content-type': 'application/json' } })` */
  json = json;
  /** A shorthand for `new Response({ headers: { Location: url }, status: 301 })` */
  redirect = redirect;
  /** A shorthand for `new Response(fileInfo)` */
  file = async (
    filenameOrBunFile: string | BunFile,
    fileOptions: FileResponseOptions = {},
    responseInit: ResponseInit = {}
  ) => {
    return file(
      filenameOrBunFile,
      {
        range: this.request.headers.get('Range') || undefined,
        ...fileOptions,
      },
      responseInit
    );
  };
  /** A shorthand for `new Response({ headers: { 'Content-type': 'text/event-stream' } })` */
  sse = (setup: SseSetupFunction, init: ResponseInit = {}) => {
    return sse(this.request.signal, setup, init);
  };
}
