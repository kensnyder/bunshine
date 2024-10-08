// Generated by dts-bundle-generator v9.5.1

import { BunFile, ServeOptions, Server, ServerWebSocket, ServerWebSocketSendStatus, ZlibCompressionOptions } from 'bun';
import { LRUCache } from 'lru-cache';
import { RequireAtLeastOne } from 'type-fest';

export type Registration<T> = {
	matcher: (subject: string) => null | Record<string, string>;
	pattern: string;
	regex: RegExp;
	methodFilter: null | ((subject: string) => boolean);
	target: T;
};
export type Result<T> = Array<[
	T,
	Record<string, string>
]>;
declare class RouteMatcher<Target extends any> {
	registered: Registration<Target>[];
	match(method: string, subject: string, fallbacks?: Target[]): Result<Target>;
	add(method: string, pattern: string | RegExp, target: Target): this;
	detectPotentialDos(detector: any, config?: any): void;
}
declare class MatcherWithCache<Target = any> extends RouteMatcher<Target> {
	cache: LRUCache<string, any>;
	constructor(size?: number);
	match(method: string, subject: string, fallbacks?: Target[]): any;
}
declare class SocketContext<UpgradeShape = any, ParamsShape = Record<string, any>> {
	ws?: ServerWebSocket<WsDataShape<UpgradeShape, ParamsShape>>;
	server: Server;
	url: URL;
	params: ParamsShape;
	data: UpgradeShape;
	type: SocketEventName;
	constructor(server: Server, url: URL, params: ParamsShape, data: UpgradeShape);
	get remoteAddress(): string;
	get readyState(): import("bun").WebSocketReadyState;
	set binaryType(type: "nodebuffer" | "arraybuffer" | "uint8array");
	get binaryType(): "nodebuffer" | "arraybuffer" | "uint8array" | undefined;
	send(message: any, compress?: boolean): number;
	close(status?: number, reason?: string): this;
	terminate(): this;
	subscribe(topic: string): this;
	unsubscribe(topic: string): this;
	isSubscribed(topic: string): boolean;
	cork(callback: (ws: ServerWebSocket<WsDataShape<UpgradeShape, ParamsShape>>) => WsDataShape<UpgradeShape, ParamsShape>): WsDataShape<UpgradeShape, ParamsShape>;
	publish(topic: string, message: any, compress?: boolean): number;
	ping(data?: string | Bun.BufferSource): ServerWebSocketSendStatus;
	pong(data?: string | Bun.BufferSource): ServerWebSocketSendStatus;
}
export type SocketEventName = "upgrade" | "open" | "message" | "close" | "drain" | "ping" | "pong" | "error";
declare class SocketMessage<T extends SocketEventName> {
	readonly type: T;
	private readonly _rawMessage;
	constructor(type: T, rawMessage: string | Buffer);
	raw(): string | Buffer;
	text(encoding?: BufferEncoding): string;
	toString(encoding?: BufferEncoding): string;
	buffer(): Buffer;
	arrayBuffer(): ArrayBufferLike;
	readableStream(chunkSize?: number): ReadableStream<Uint8Array>;
	json(): any;
}
export type WsDataShape<U = any, P = Record<string, any>> = {
	sc: SocketContext<U, P>;
};
export type SocketUpgradeHandler<U, P extends Record<string, any> = Record<string, any>> = (context: Context<P>, next: NextFunction) => U | Promise<U>;
export type SocketPlainHandler<U, P> = (context: SocketContext<U, P>) => void;
export type SocketMessageHandler<U, P, T extends SocketEventName$1> = (context: SocketContext<U, P>, message: SocketMessage<T>) => void;
export type SocketErrorHandler<U, P> = (context: SocketContext<U, P>, error: Error) => void;
export type SocketCloseHandler<U, P> = (context: SocketContext<U, P>, status: number, reason: string) => void;
export type BunshineHandlers<U, P extends Record<string, string> = Record<string, string>> = RequireAtLeastOne<{
	upgrade: SocketUpgradeHandler<U, P>;
	error: SocketErrorHandler<U, P>;
	open: SocketPlainHandler<U, P>;
	message: SocketMessageHandler<U, P, "message">;
	close: SocketCloseHandler<U, P>;
	drain: SocketPlainHandler<U, P>;
	ping: SocketMessageHandler<U, P, "ping">;
	pong: SocketMessageHandler<U, P, "pong">;
}>;
export type BunHandlers = {
	open: (ws: ServerWebSocket<WsDataShape>) => void;
	message: (ws: ServerWebSocket<WsDataShape>, data: any) => void;
	close: (ws: ServerWebSocket<WsDataShape>, code: number, reason: string) => void;
	drain: (ws: ServerWebSocket<WsDataShape>) => void;
	ping: (ws: ServerWebSocket<WsDataShape>, data: any) => void;
	pong: (ws: ServerWebSocket<WsDataShape>, data: any) => void;
};
type SocketEventName$1 = "open" | "message" | "close" | "drain" | "ping" | "pong";
export declare class SocketRouter {
	httpRouter: HttpRouter;
	routeMatcher: RouteMatcher<BunshineHandlers<any>>;
	handlers: BunHandlers;
	constructor(router: HttpRouter);
	at: <P extends Record<string, string> = Record<string, string>, U = any>(path: string, handlers: BunshineHandlers<U, P>) => this;
	private _fallbackError;
	private _createHandler;
}
export type NextFunction = () => Promise<Response>;
export type SingleHandler<ParamsShape extends Record<string, string> = Record<string, string>> = (context: Context<ParamsShape>, next: NextFunction) => Response | void | Promise<Response | void>;
export type SingleErrorHandler<ParamsShape extends Record<string, string> = Record<string, string>> = (context: ContextWithError<ParamsShape>, next: NextFunction) => Response | void | Promise<Response | void>;
export type Middleware<ParamsShape extends Record<string, string> = Record<string, string>> = SingleHandler<ParamsShape>;
export type Handler<ParamsShape extends Record<string, string> = Record<string, string>> = SingleHandler<ParamsShape> | Handler<ParamsShape>[];
export type ErrorHandler<ParamsShape extends Record<string, string> = Record<string, string>> = SingleErrorHandler<ParamsShape> | ErrorHandler<ParamsShape>[];
export type ListenOptions = Omit<ServeOptions, "fetch" | "websocket"> | number;
export type HttpMethods = "ALL" | "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" | "TRACE";
export type HttpRouterOptions = {
	cacheSize?: number;
};
export type EmitUrlOptions = {
	verbose?: boolean;
	to?: (message: string) => void;
	date?: boolean;
};
export declare class HttpRouter {
	version: string;
	locals: Record<string, any>;
	server: Server | undefined;
	routeMatcher: MatcherWithCache<SingleHandler>;
	_wsRouter?: SocketRouter;
	private _onErrors;
	private _on404s;
	constructor(options?: HttpRouterOptions);
	listen(portOrOptions?: ListenOptions): Server;
	emitUrl({ verbose, to, date, }?: EmitUrlOptions): void;
	getExport(options?: Omit<ServeOptions, "fetch" | "websocket">): ServeOptions;
	get socket(): SocketRouter;
	on<ParamsShape extends Record<string, string> = Record<string, string>>(verbOrVerbs: HttpMethods | HttpMethods[], path: string | RegExp, ...handlers: Handler<ParamsShape>[]): this;
	all<ParamsShape extends Record<string, string> = Record<string, string>>(path: string | RegExp, ...handlers: Handler<ParamsShape>[]): this;
	get<ParamsShape extends Record<string, string> = Record<string, string>>(path: string | RegExp, ...handlers: Handler<ParamsShape>[]): this;
	put<ParamsShape extends Record<string, string> = Record<string, string>>(path: string | RegExp, ...handlers: Handler<ParamsShape>[]): this;
	head<ParamsShape extends Record<string, string> = Record<string, string>>(path: string | RegExp, ...handlers: Handler<ParamsShape>[]): this;
	post<ParamsShape extends Record<string, string> = Record<string, string>>(path: string | RegExp, ...handlers: Handler<ParamsShape>[]): this;
	patch<ParamsShape extends Record<string, string> = Record<string, string>>(path: string | RegExp, ...handlers: Handler<ParamsShape>[]): this;
	trace<ParamsShape extends Record<string, string> = Record<string, string>>(path: string | RegExp, ...handlers: Handler<ParamsShape>[]): this;
	delete<ParamsShape extends Record<string, string> = Record<string, string>>(path: string | RegExp, ...handlers: Handler<ParamsShape>[]): this;
	options<ParamsShape extends Record<string, string> = Record<string, string>>(path: string | RegExp, ...handlers: Handler<ParamsShape>[]): this;
	headGet<ParamsShape extends Record<string, string> = Record<string, string>>(path: string | RegExp, ...handlers: Handler<ParamsShape>[]): this;
	use(...handlers: Handler<{}>[]): this;
	onError(...handlers: ErrorHandler<Record<string, string>>[]): this;
	on404(...handlers: Handler<Record<string, string>>[]): this;
	fetch: (request: Request, server: Server) => Promise<Response>;
}
export type Factory = (body: string, init?: ResponseInit) => Response;
export declare let minGzipSize: number;
export declare function json(this: Context, data: any, init?: ResponseInit): Response;
export declare function factory(contentType: string): Factory;
export declare const redirect: (url: string, status?: number) => Response;
export type FileResponseOptions = {
	range?: string;
	chunkSize?: number;
	gzip?: boolean;
	disposition?: "inline" | "attachment";
	acceptRanges?: boolean;
};
export type SseSend = (eventName: string, data?: string | object, id?: string, retry?: number) => void | Promise<void>;
export type SseClose = () => void | Promise<void>;
export type SseSetupFunction = (send: SseSend, close: SseClose) => void | (() => void);
export type ContextWithError<ParamsShape extends Record<string, string> = Record<string, string>> = Context<ParamsShape> & {
	error: Error;
};
export declare class Context<ParamsShape extends Record<string, string> = Record<string, string>> {
	/** The raw request object */
	request: Request;
	/** Alias for `request` */
	req: Request;
	/** The Bun server instance */
	server: Server;
	/** The HttpRouter instance */
	app: HttpRouter;
	/** The request params from URL placeholders */
	params: ParamsShape;
	/** A place to persist data between handlers for the duration of the request */
	locals: Record<string, any>;
	/** A URL object constructed with `new URL(request.url)` */
	url: URL;
	/** The date the request was received */
	date: Date;
	/** The milliseconds between server start and this request, as float (from performance.now()) */
	now: number;
	/** If an error has been thrown, the error Object */
	error: Error | null;
	constructor(request: Request, server: Server, app: HttpRouter);
	/** Get the IP address info of the client */
	get ip(): {
		address: string;
		family: string;
		port: number;
	} | null;
	/** A shorthand for `new Response(text, { headers: { 'Content-type': 'text/plain' } })` */
	text(text: string, init?: ResponseInit): Response;
	/** A shorthand for `new Response(js, { headers: { 'Content-type': 'text/javascript' } })` */
	js(js: string, init?: ResponseInit): Response;
	/** A shorthand for `new Response(html, { headers: { 'Content-type': 'text/html' } })` */
	html(html: string, init?: ResponseInit): Response;
	/** A shorthand for `new Response(html, { headers: { 'Content-type': 'text/css' } })` */
	css(css: string, init?: ResponseInit): Response;
	/** A shorthand for `new Response(xml, { headers: { 'Content-type': 'text/xml' } })` */
	xml(xml: string, init?: ResponseInit): Response;
	/** A shorthand for `new Response(JSON.stringify(data), { headers: { 'Content-type': 'application/json' } })` */
	json(data: any, init?: ResponseInit): Response;
	/** A shorthand for `new Response(null, { headers: { Location: url }, status: 301 })` */
	redirect(url: string, status?: number): Response;
	/** A shorthand for `new Response(bunFile, fileHeaders)` */
	file(filenameOrBunFile: string | BunFile, fileOptions?: FileResponseOptions): Promise<Response>;
	/** A shorthand for `new Response({ headers: { 'Content-type': 'text/event-stream' } })` */
	sse(setup: SseSetupFunction, init?: ResponseInit): Response;
}
export type CorsOptions = {
	origin?: string | RegExp | Array<string | RegExp> | boolean | ((incomingOrigin: string, context: Context) => string | string[] | boolean | undefined | null);
	allowMethods?: string[];
	allowHeaders?: string[];
	maxAge?: number;
	credentials?: boolean;
	exposeHeaders?: string[];
};
export declare function cors(options?: CorsOptions): Middleware;
export declare function devLogger(): Middleware;
export declare function performanceHeader(headerName?: string): Middleware;
export declare function prodLogger(): Middleware;
export type SecurityHeaderValue = string | null | undefined | boolean;
export type SecurityHeader = SecurityHeaderValue | ((context: Context) => SecurityHeaderValue) | ((context: Context) => Promise<SecurityHeaderValue>);
export type SecurityHeaderOptions = {
	accessControlAllowOrigin?: SecurityHeader | true;
	contentSecurityPolicy?: CSPDirectives | true;
	crossOriginEmbedderPolicy?: SecurityHeader | true;
	crossOriginOpenerPolicy?: SecurityHeader | true;
	crossOriginResourcePolicy?: SecurityHeader | true;
	permissionsPolicy?: AllowedApis | true;
	referrerPolicy?: SecurityHeader | true;
	server?: SecurityHeader | true;
	strictTransportSecurity?: SecurityHeader | true;
	xContentTypeOptions?: SecurityHeader | true;
	xFrameOptions?: SecurityHeader | true;
	xPoweredBy?: SecurityHeader | true;
	xXssProtection?: SecurityHeader | true;
};
export type SandboxOptions = {
	allowForms?: boolean;
	allowModals?: boolean;
	allowOrientationLock?: boolean;
	allowPointerLock?: boolean;
	allowPopups?: boolean;
	allowPopupsToEscapeSandbox?: boolean;
	allowPresentation?: boolean;
	allowSameOrigin?: boolean;
	allowScripts?: boolean;
	allowTopNavigation?: boolean;
};
export type ReportOptions = {
	uri?: string;
	to?: string;
};
export type CSPDirectives = {
	frameSrc?: CSPSource[];
	workerSrc?: CSPSource[];
	connectSrc?: CSPSource[];
	defaultSrc?: CSPSource[];
	fontSrc?: CSPSource[];
	imgSrc?: CSPSource[];
	manifestSrc?: CSPSource[];
	mediaSrc?: CSPSource[];
	objectSrc?: CSPSource[];
	prefetchSrc?: CSPSource[];
	scriptSrc?: CSPSource[];
	scriptSrcElem?: CSPSource[];
	scriptSrcAttr?: CSPSource[];
	styleSrcAttr?: CSPSource[];
	baseUri?: CSPSource[];
	formAction?: CSPSource[];
	frameAncestors?: CSPSource[];
	sandbox?: SandboxOptions | true;
	report?: ReportOptions | true;
};
export type ApiSource = "*" | "\"data:*\"" | "\"mediastream:*\"" | "\"blob:*\"" | "\"filesystem:*\"" | "self" | "unsafe-eval" | "wasm-unsafe-eval" | "unsafe-hashes" | "unsafe-inline" | "none" | {
	urls: string[];
} | {
	nonces: string[];
} | {
	hashes: string[];
};
export type AllowedApis = {
	accelerometer?: ApiSource[];
	ambientLightSensor?: ApiSource[];
	autoplay?: ApiSource[];
	battery?: ApiSource[];
	camera?: ApiSource[];
	displayCapture?: ApiSource[];
	documentDomain?: ApiSource[];
	encryptedMedia?: ApiSource[];
	executionWhileNotRendered?: ApiSource[];
	executionWhileOutOfViewport?: ApiSource[];
	fullscreen?: ApiSource[];
	gamepad?: ApiSource[];
	geolocation?: ApiSource[];
	gyroscope?: ApiSource[];
	hid?: ApiSource[];
	identityCredentialsGet?: ApiSource[];
	idleDetection?: ApiSource[];
	localFonts?: ApiSource[];
	magnetometer?: ApiSource[];
	midi?: ApiSource[];
	otpCredentials?: ApiSource[];
	payment?: ApiSource[];
	pictureInPicture?: ApiSource[];
	publickeyCredentialsCreate?: ApiSource[];
	publickeyCredentialsGet?: ApiSource[];
	screenWakeLock?: ApiSource[];
	serial?: ApiSource[];
	speakerSelection?: ApiSource[];
	storageAccess?: ApiSource[];
	usb?: ApiSource[];
	webShare?: ApiSource[];
	windowManagement?: ApiSource[];
	xrSpacialTracking?: ApiSource[];
};
export type CSPSource = "*" | "data:" | "mediastream:" | "blob:" | "filesystem:" | "'self'" | "'unsafe-eval'" | "'wasm-unsafe-eval'" | "'unsafe-hashes'" | "'unsafe-inline'" | "'none'" | {
	uri: string;
} | {
	uris: string[];
} | {
	nonce: string;
} | {
	nonces: string[];
} | {
	hash: string;
} | {
	hashes: string[];
} | "'strict-dynamic'" | "'report-sample'" | "'inline-speculation-rules'" | string;
export declare function securityHeaders(options?: SecurityHeaderOptions): Middleware;
export type StaticOptions = {
	acceptRanges?: boolean;
	dotfiles?: "allow" | "deny" | "ignore";
	etag?: boolean;
	extensions?: string[];
	fallthrough?: boolean;
	immutable?: boolean;
	index?: string[];
	lastModified?: boolean;
	maxAge?: number | string;
	gzip?: GzipOptions;
};
export type GzipOptions = {
	minFileSize?: number;
	maxFileSize?: number;
	mimeTypes?: Array<string | RegExp>;
	zlibOptions?: ZlibCompressionOptions;
	cache: false | {
		type: "file" | "precompress" | "memory" | "never";
		maxBytes?: number;
		path?: string;
	};
};
export declare function serveFiles(directory: string, { acceptRanges, dotfiles, etag, extensions, fallthrough, immutable, index, lastModified, maxAge, gzip, }?: StaticOptions): Middleware;
export declare function trailingSlashes(mode: "add" | "remove"): Middleware;

export {
	SocketEventName$1 as SocketEventName,
};

export {};
