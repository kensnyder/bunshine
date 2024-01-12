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

export default class Context<
  ParamsShape extends Record<string, string> = Record<string, string>,
> {
  /** The raw request object */
  request: Request;
  /** The Bun server instance */
  server: Server;
  /** The HttpRouter instance */
  app: HttpRouter;
  /** The request params from URL placeholders */
  params: ParamsShape = {} as ParamsShape;
  /** A place to persist data between handlers for the duration of the request */
  locals: Record<string, any> = {};
  /** Handlers registered with app.on500() can see this Error object */
  error: Error | undefined;
  /** A URL object constructed with `new URL(request.url)` */
  url: URL;
  /** The date the request was received */
  date: Date;
  /** The milliseconds between server start and this request, as float (from performance.now()) */
  now: number;
  // construct this Context object
  constructor(request: Request, server: Server, app: HttpRouter) {
    this.request = request;
    this.server = server;
    this.app = app;
    this.url = new URL(request.url);
    this.date = new Date();
    this.now = performance.now();
  }
  /** Get the IP address info of the client */
  get ip(): { address: string; family: string; port: number } | null {
    return this.server.requestIP(this.request);
  }
  /** A shorthand for `new Response(text, { headers: { 'Content-type': 'text/plain' } })` */
  text = text;
  /** A shorthand for `new Response(js, { headers: { 'Content-type': 'text/javascript' } })` */
  js = js;
  /** A shorthand for `new Response(html, { headers: { 'Content-type': 'text/html' } })` */
  html = html;
  /** A shorthand for `new Response(xml, { headers: { 'Content-type': 'text/xml' } })` */
  xml = xml;
  /** A shorthand for `new Response(JSON.stringify(data), { headers: { 'Content-type': 'application/json' } })` */
  json = json;
  /** A shorthand for `new Response(null, { headers: { Location: url }, status: 301 })` */
  redirect = redirect;
  /** A shorthand for `new Response(fileBody, fileHeaders)` */
  file = async (
    filenameOrBunFile: string | BunFile,
    fileOptions: FileResponseOptions = {}
  ) => {
    return file(filenameOrBunFile, {
      range: this.request.headers.get('Range') || undefined,
      ...fileOptions,
    });
  };
  /** A shorthand for `new Response({ headers: { 'Content-type': 'text/event-stream' } })` */
  sse = (setup: SseSetupFunction, init: ResponseInit = {}) => {
    return sse(this.request.signal, setup, init);
  };
}
