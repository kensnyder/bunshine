import type { BunFile, Server } from 'bun';
import type HttpRouter from '../HttpRouter/HttpRouter';
import {
  factory,
  file,
  json,
  redirect,
  sse,
  type FileResponseOptions,
  type SseSetupFunction,
} from '../HttpRouter/responseFactories';

const textPlain = factory('text/plain');
const textJs = factory('text/javascript');
const textHtml = factory('text/html');
const textXml = factory('text/xml');
const textCss = factory('text/css');

export type ContextWithError<
  ParamsShape extends Record<string, string> = Record<string, string>,
> = Context<ParamsShape> & { error: Error };

export default class Context<
  ParamsShape extends Record<string, string> = Record<string, string>,
> {
  /** The raw request object */
  request: Request;
  /** Alias for `request` */
  req: Request;
  /** The Bun server instance */
  server: Server;
  /** The HttpRouter instance */
  app: HttpRouter;
  /** The request params from URL placeholders */
  params: ParamsShape = {} as ParamsShape;
  /** A place to persist data between handlers for the duration of the request */
  locals: Record<string, any> = {};
  /** A URL object constructed with `new URL(request.url)` */
  url: URL;
  /** The date the request was received */
  date: Date;
  /** The milliseconds between server start and this request, as float (from performance.now()) */
  now: number;
  /** If an error has been thrown, the error Object */
  error: Error | null = null;
  // construct this Context object
  constructor(request: Request, server: Server, app: HttpRouter) {
    this.request = request;
    this.req = request;
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
  text(text: string, init: ResponseInit = {}) {
    return textPlain.call(this, text, init);
  }
  /** A shorthand for `new Response(js, { headers: { 'Content-type': 'text/javascript' } })` */
  js(js: string, init: ResponseInit = {}) {
    return textJs.call(this, js, init);
  }
  /** A shorthand for `new Response(html, { headers: { 'Content-type': 'text/html' } })` */
  html(html: string, init: ResponseInit = {}) {
    return textHtml.call(this, html, init);
  }
  /** A shorthand for `new Response(html, { headers: { 'Content-type': 'text/css' } })` */
  css(css: string, init: ResponseInit = {}) {
    return textCss.call(this, css, init);
  }
  /** A shorthand for `new Response(xml, { headers: { 'Content-type': 'text/xml' } })` */
  xml(xml: string, init: ResponseInit = {}) {
    return textXml.call(this, xml, init);
  }
  /** A shorthand for `new Response(JSON.stringify(data), { headers: { 'Content-type': 'application/json' } })` */
  json(data: any, init: ResponseInit = {}) {
    return json.call(this, data, init);
  }
  /** A shorthand for `new Response(null, { headers: { Location: url }, status: 301 })` */
  redirect(url: string, status = 302) {
    return redirect(url, status);
  }
  /** A shorthand for `new Response(bunFile, fileHeaders)` */
  async file(
    filenameOrBunFile: string | BunFile,
    fileOptions: FileResponseOptions = {}
  ) {
    return file(filenameOrBunFile, {
      range: this.request.headers.get('Range') || undefined,
      ...fileOptions,
    });
  }
  /** A shorthand for `new Response({ headers: { 'Content-type': 'text/event-stream' } })` */
  sse(setup: SseSetupFunction, init: ResponseInit = {}) {
    return sse(this.request.signal, setup, init);
  }
}
