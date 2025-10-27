import { Server, ServerWebSocket, ServerWebSocketSendStatus } from 'bun';
import { WsDataShape } from './SocketRouter';

/**
 * Narrowly and correctly detect BufferSource values.
 * BufferSource is ArrayBuffer | ArrayBufferView (e.g., Buffer, Uint8Array, DataView, etc.).
 *
 * @param obj - Unknown value to test.
 * @returns True if the value is an ArrayBuffer or any ArrayBufferView (including Node/Bun Buffer).
 */
function isBufferSource(obj: unknown): obj is BufferSource {
  if (obj == null) {
    return false;
  }
  // Fast path for ArrayBufferView and Node/Bun Buffer (which extends Uint8Array)
  if (ArrayBuffer.isView(obj as any)) {
    return true;
  }
  // ArrayBuffer (and SharedArrayBuffer when available)
  if (obj instanceof ArrayBuffer) {
    return true;
  }
  // SharedArrayBuffer may not exist in some environments
  // eslint-disable-next-line no-undef
  const SAB = (globalThis as any).SharedArrayBuffer;
  // eslint-disable-next-line no-undef
  if (typeof SAB !== 'undefined' && obj instanceof SAB) {
    return true;
  }
  return false;
}

/**
 * SocketContext is the per-connection helper used by WebSocket route handlers.
 *
 * It wraps Bun's ServerWebSocket and exposes convenience methods for sending,
 * publishing, ping/pong, topic subscription, and connection control. It also
 * provides access to the request URL, route params, and user-provided upgrade data.
 *
 * @typeParam UpgradeShape - The shape of ws.data populated by the upgrade handler.
 * @typeParam ParamsShape - The shape of route params for the socket endpoint.
 */
export default class SocketContext<
  UpgradeShape = any,
  ParamsShape = Record<string, any>,
> {
  public ws?: ServerWebSocket<WsDataShape<UpgradeShape, ParamsShape>>;
  public server: Server<UpgradeShape>;
  public url: URL;
  public params: ParamsShape;
  public data: UpgradeShape;
  public type: SocketEventName;
  /**
   * Construct a new SocketContext instance for a WebSocket connection lifecycle.
   *
   * @param server - The Bun server handling this connection.
   * @param url - The request URL for this socket route.
   * @param params - Route params extracted from the URL pattern.
   * @param data - Arbitrary data attached during the upgrade handler.
   */
  constructor(
    server: Server<UpgradeShape>,
    url: URL,
    params: ParamsShape,
    data: UpgradeShape
  ) {
    this.type = 'upgrade';
    this.server = server;
    this.url = url;
    this.params = params;
    this.data = data;
  }
  /**
   * The client or load balancer IP address for this connection.
   */
  get remoteAddress() {
    return this.ws!.remoteAddress;
  }
  /**
   * The current ready state of the WebSocket.
   * 0 = connecting, 1 = open, 2 = closing, 3 = closed
   */
  get readyState() {
    return this.ws!.readyState;
  }
  /**
   * Set the preferred binary type for received messages.
   *
   * @param type - 'nodebuffer' | 'arraybuffer' | 'uint8array'
   */
  set binaryType(type: 'nodebuffer' | 'arraybuffer' | 'uint8array') {
    this.ws!.binaryType = type;
  }
  /**
   * Get the preferred binary type for received messages.
   */
  get binaryType(): 'nodebuffer' | 'arraybuffer' | 'uint8array' | undefined {
    return this.ws!.binaryType;
  }
  /**
   * Send a message to the connected client.
   *
   * - Strings are sent as text frames.
   * - Buffers/typed arrays are sent as binary frames.
   * - Other objects are JSON.stringified and sent as text frames.
   *
   * @param message - The payload to send.
   * @param compress - Whether to apply permessage-deflate compression.
   */
  send(message: any, compress: boolean = false) {
    if (typeof message === 'string') {
      return this.ws!.sendText(message, compress);
    } else if (message instanceof Buffer) {
      // Respect Buffer's byteOffset and byteLength to avoid sending extra bytes
      const view = new Uint8Array(
        message.buffer,
        message.byteOffset,
        message.byteLength
      );
      return this.ws!.sendBinary(view, compress);
    } else if (isBufferSource(message)) {
      // @ts-expect-error TypeScript can't tell that our isBufferSource works
      return this.ws!.send(message, compress);
    } else {
      return this.ws!.sendText(JSON.stringify(message), compress);
    }
  }
  /**
   * Close the connection with an optional status code and reason.
   *
   * @param status - WebSocket close code (1000-4999). Optional.
   * @param reason - Human-readable reason for closing. Optional.
   * @returns This SocketContext for chaining.
   */
  close(status?: number, reason?: string) {
    this.ws!.close(status, reason);
    return this;
  }
  /**
   * Immediately terminate the connection without a close frame.
   *
   * Use sparingly; the client will see an abrupt disconnect with no reason.
   *
   * @returns This SocketContext for chaining.
   */
  terminate() {
    this.ws!.terminate();
    return this;
  }
  /**
   * Subscribe this connection to a pub-sub topic.
   *
   * @param topic - The topic name.
   * @returns This SocketContext for chaining.
   */
  subscribe(topic: string) {
    this.ws!.subscribe(topic);
    return this;
  }
  /**
   * Unsubscribe this connection from a pub-sub topic.
   *
   * @param topic - The topic name.
   * @returns This SocketContext for chaining.
   */
  unsubscribe(topic: string) {
    this.ws!.unsubscribe(topic);
    return this;
  }
  /**
   * Check whether this connection is subscribed to a topic.
   *
   * @param topic - The topic name.
   * @returns True if subscribed.
   */
  isSubscribed(topic: string) {
    return this.ws!.isSubscribed(topic);
  }
  /**
   * Cork batches multiple sends into a single frame flush. Most users do not need this.
   *
   * If a callback is provided, all sends within the callback are batched.
   *
   * @param callback - Function within which to perform batched sends.
   */
  cork(
    callback: (ctx: SocketContext<UpgradeShape, ParamsShape>) => void
  ): void {
    this.ws!.cork(() => {
      callback(this);
    });
  }
  /**
   * Publish a message to all clients subscribed to a topic.
   *
   * - Strings and binary data are sent as-is.
   * - Other objects are JSON.stringified before publishing.
   *
   * @param topic - The topic name.
   * @param message - The payload to publish.
   * @param compress - Whether to apply compression for supported payloads.
   */
  publish(topic: string, message: any, compress: boolean = false) {
    if (
      typeof message === 'string' ||
      message instanceof Buffer ||
      isBufferSource(message)
    ) {
      // @ts-expect-error TypeScript doesn't trust our isBufferSource
      return this.ws!.publish(topic, message, compress);
    } else {
      return this.ws!.publish(topic, JSON.stringify(message), compress);
    }
  }
  /**
   * Send a ping frame (optionally with data) to keep the connection alive.
   *
   * If data is not a string or BufferSource, it is JSON.stringified.
   *
   * @param data - Optional ping payload.
   * @returns The send status from Bun.
   */
  ping(data?: string | BufferSource | any): ServerWebSocketSendStatus {
    if (
      typeof data === 'string' ||
      isBufferSource(data) ||
      data === undefined
    ) {
      return this.ws!.ping(data);
    } else {
      return this.ws!.ping(JSON.stringify(data));
    }
  }
  /**
   * Send a pong frame (optionally with data) in response to a ping.
   *
   * If data is not a string or BufferSource, it is JSON.stringified.
   *
   * @param data - Optional pong payload.
   * @returns The send status from Bun.
   */
  pong(data?: string | BufferSource | any): ServerWebSocketSendStatus {
    if (
      typeof data === 'string' ||
      isBufferSource(data) ||
      data === undefined
    ) {
      return this.ws!.pong(data);
    } else {
      return this.ws!.pong(JSON.stringify(data));
    }
  }
}

export type SocketEventName =
  | 'upgrade'
  | 'open'
  | 'message'
  | 'close'
  | 'drain'
  | 'ping'
  | 'pong'
  | 'error';

// T = Socket Event Name
/**
 * SocketMessage wraps the raw payload received for a given socket event and
 * provides helpers to access it as text, Buffer, ArrayBuffer, ReadableStream,
 * or parsed JSON.
 *
 * @typeParam T - The socket event type associated with this message.
 */
export class SocketMessage<T extends SocketEventName> {
  public readonly type: T;
  private readonly _rawMessage: string | Buffer;
  /**
   * Create a SocketMessage for a given event type.
   *
   * @param type - The socket event type that produced this message.
   * @param rawMessage - The raw payload: a string (text frame) or Buffer (binary frame).
   */
  constructor(type: T, rawMessage: string | Buffer) {
    this.type = type;
    this._rawMessage = rawMessage;
  }
  /**
   * Get the original raw payload (string or Buffer) without conversion.
   */
  raw() {
    return this._rawMessage;
  }
  /**
   * Get the payload as text using the specified encoding.
   *
   * @param encoding - The string encoding to use. Defaults to 'utf-8'.
   * @returns The payload as a string.
   */
  text(encoding: BufferEncoding = 'utf-8') {
    return this._rawMessage.toString(encoding);
  }
  /**
   * Alias for text(); allows using template string coercion as well.
   *
   * @param encoding - The string encoding to use. Defaults to 'utf-8'.
   * @returns The payload as a string.
   */
  toString(encoding: BufferEncoding = 'utf-8') {
    return this._rawMessage.toString(encoding);
  }
  /**
   * Get the payload as a Node/Bun Buffer.
   *
   * If the original payload was a string, a new Buffer is created.
   */
  buffer() {
    if (typeof this._rawMessage === 'string') {
      return Buffer.from(this._rawMessage);
    }
    return this._rawMessage as Buffer;
  }
  /**
   * Get the payload as a tightly-sized ArrayBuffer copy.
   *
   * This method copies only the message bytes to a new ArrayBuffer.
   */
  arrayBuffer() {
    const buf = this.buffer();
    // Create a new ArrayBuffer with exactly the bytes of the message
    const out = new ArrayBuffer(buf.byteLength);
    new Uint8Array(out).set(buf);
    return out;
  }
  /**
   * Get the payload as a ReadableStream.
   */
  readableStream() {
    // Return a standard ReadableStream; chunkSize is ignored for compatibility
    // @ts-expect-error Not sure why types are incorrect
    return new Blob([this.buffer()]).stream();
  }
  /**
   * Attempt to parse the payload as JSON.
   *
   * @returns The parsed object, or undefined if JSON.parse fails.
   */
  json() {
    try {
      return JSON.parse(String(this._rawMessage));
    } catch (e) {
      const error = e as Error;
      console.error(`Error parsing incoming message as json: ${error.message}`);
      return undefined;
    }
  }
}
