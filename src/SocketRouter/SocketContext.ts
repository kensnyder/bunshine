import { Server, ServerWebSocket, ServerWebSocketSendStatus } from 'bun';
import { WsDataShape } from './SocketRouter.ts';

const isBufferSource = (function () {
  const TypedArray = Object.getPrototypeOf(Uint8Array);
  return (obj: any) => {
    return (
      obj instanceof TypedArray ||
      obj instanceof ArrayBuffer ||
      ArrayBuffer.isView(obj)
    );
  };
})();

export default class SocketContext<
  UpgradeShape = any,
  ParamsShape = Record<string, any>,
> {
  public ws?: ServerWebSocket<WsDataShape<UpgradeShape, ParamsShape>>;
  public server: Server;
  public url: URL;
  public params: ParamsShape;
  public data: UpgradeShape;
  public type: SocketEventName;
  constructor(
    server: Server,
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
  get remoteAddress() {
    return this.ws!.remoteAddress;
  }
  get readyState() {
    return this.ws!.readyState;
  }
  set binaryType(type: 'nodebuffer' | 'arraybuffer' | 'uint8array') {
    this.ws!.binaryType = type;
  }
  get binaryType(): 'nodebuffer' | 'arraybuffer' | 'uint8array' | undefined {
    return this.ws!.binaryType;
  }
  send(message: any, compress: boolean = false) {
    if (typeof message === 'string') {
      return this.ws!.sendText(message, compress);
    } else if (message instanceof Buffer) {
      return this.ws!.sendBinary(message, compress);
    } else if (isBufferSource(message)) {
      return this.ws!.send(message, compress);
    } else {
      return this.ws!.sendText(JSON.stringify(message), compress);
    }
  }
  close(status?: number, reason?: string) {
    this.ws!.close(status, reason);
    return this;
  }
  terminate() {
    this.ws!.terminate();
    return this;
  }
  subscribe(topic: string) {
    this.ws!.subscribe(topic);
    return this;
  }
  unsubscribe(topic: string) {
    this.ws!.unsubscribe(topic);
    return this;
  }
  isSubscribed(topic: string) {
    return this.ws!.isSubscribed(topic);
  }
  cork(
    callback: (
      ws: ServerWebSocket<WsDataShape<UpgradeShape, ParamsShape>>
    ) => WsDataShape<UpgradeShape, ParamsShape>
  ): WsDataShape<UpgradeShape, ParamsShape> {
    return this.ws!.cork(callback);
  }
  publish(topic: string, message: any, compress: boolean = false) {
    if (
      typeof message === 'string' ||
      message instanceof Buffer ||
      isBufferSource(message)
    ) {
      return this.ws!.publish(topic, message, compress);
    } else {
      return this.ws!.publish(topic, JSON.stringify(message), compress);
    }
  }
  ping(data?: string | Bun.BufferSource): ServerWebSocketSendStatus {
    if (
      typeof data === 'string' ||
      data instanceof Buffer ||
      isBufferSource(data)
    ) {
      return this.ws!.ping(data);
    } else {
      return this.ws!.ping(JSON.stringify(data));
    }
  }
  pong(data?: string | Bun.BufferSource): ServerWebSocketSendStatus {
    if (
      typeof data === 'string' ||
      data instanceof Buffer ||
      isBufferSource(data)
    ) {
      return this.ws!.pong(data);
    } else {
      return this.ws!.pong(JSON.stringify(data));
    }
  }
  /** Get the search params as an object */
  getQueryObject() {
    return Object.fromEntries(this.url.searchParams);
  }
  /** Get the search params as an array of key-value arrays */
  getQueryEntries() {
    return this.url.searchParams.entries();
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
export class SocketMessage<T extends SocketEventName> {
  public readonly type: T;
  private readonly _rawMessage: string | Buffer;
  constructor(type: T, rawMessage: string | Buffer) {
    this.type = type;
    this._rawMessage = rawMessage;
  }
  raw() {
    return this._rawMessage;
  }
  text(encoding: BufferEncoding = 'utf-8') {
    return this._rawMessage.toString(encoding);
  }
  toString(encoding: BufferEncoding = 'utf-8') {
    return this._rawMessage.toString(encoding);
  }
  buffer() {
    return Buffer.from(this._rawMessage);
  }
  arrayBuffer() {
    return this.buffer().buffer;
  }
  readableStream(chunkSize: number = 1024) {
    // @ts-expect-error
    return new Blob([this.buffer()]).stream(chunkSize);
  }
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
