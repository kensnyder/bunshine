// see https://developer.mozilla.org/en-US/docs/Web/API/Response/Response
import { TypedArray } from 'type-fest';
import { AnyData } from '../../../any-data/src/AnyData';

export type ResponseBody =
  | Blob
  | ArrayBuffer
  | TypedArray
  | DataView
  | FormData
  | ReadableStream
  | URLSearchParams
  | string
  | Record<string, any>
  | null;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export default class ResponseLike {
  _body: ResponseBody;
  headers: Headers;
  bodyUsed = false;
  status: number;
  redirected: boolean;
  statusText: string;
  type: ResponseType;
  url: string;
  constructor(body?: ResponseBody, init: ResponseInit = {}) {
    this._body = new AnyData(body);
    this.headers = new Headers(init.headers);
    this.status = init.status || 200;
    this.statusText = init.statusText || '';
    this.redirected = false;
    this.type = 'default';
    this.url = '';
  }
  get body() {
    return this._body.data;
  }
  set body(body: ResponseBody) {
    this._body = new AnyData(body);
  }
  clone = () => {
    const cloned = new ResponseLike('');
    // make sure the body and headers objects are cloned
    cloned._body = this._body.clone();
    cloned.headers = new Headers(this.headers);
    // then copy all the properties
    cloned.status = this.status;
    cloned.statusText = this.statusText;
    cloned.redirected = this.redirected;
    cloned.type = this.type;
    cloned.url = this.url;
    return cloned;
  };
  get ok() {
    return this.status >= 200 && this.status < 300;
  }
  getBodyCategory = () => {
    return this._body.getDataCategory();
  };
  hasSupportedBodyType = () => {
    return this._body.getDataCategory() !== 'unknown';
  };
  isEmpty = () => {
    return this._body.isEmpty();
  };
  arrayBuffer = (): Promise<ArrayBuffer> => {
    if (this._body.isSupported()) {
      return new this.body.arrayBuffer();
    }
    this.bodyUsed = true;
    return new Response(this.body).arrayBuffer();
  };
  async blob() {
    if (this.body instanceof Blob) {
      return this.body;
    }
    if (typeof this.body === 'string') {
      return new Blob([Buffer.from(this.body, 'utf8')]);
    }
    if (
      this.body instanceof ArrayBuffer ||
      this.body instanceof DataView ||
      isTypedArray(this.body)
    ) {
      return new Blob([this.body]);
    }
    if (this.body instanceof FormData) {
      const text = await this.text();
      // @ts-expect-error  TypeScript can't know that text is a string
      return new Blob([text]);
    }
    if (this.body instanceof ReadableStream) {
      return new Blob([getStreamAsArrayBuffer(this.body)]);
    }
  }
  async bytes() {
    if (this.body instanceof Blob) {
      return this.body.bytes();
    }
    if (typeof this.body === 'string') {
      return textEncoder.encode(this.body);
    }
    if (this.body instanceof FormData) {
      return textEncoder.encode(await this.text());
    }
    if (this.body instanceof ArrayBuffer) {
      return new Uint8Array(this.body);
    }
    if (this.body instanceof DataView) {
      return new Blob([this.body]).bytes();
    }
    if (isTypedArray(this.body)) {
      return this.body;
    }
  }
  async formData() {
    if (this.body instanceof FormData) {
      return this.body;
    }
    const params = await this.text();
    const formData = new FormData();
    for (const pair of new URLSearchParams(params)) {
      formData.append(pair[0], pair[1]);
    }
    return formData;
  }
  async json() {
    if (this.body instanceof FormData) {
      throw new Error('Cannot convert FormData to JSON');
    }
    const text = await this.text();
    if (!text) {
      return undefined;
    }
    return JSON.parse(text);
  }
  async text() {
    if (this.body instanceof Blob) {
      return this.body.text();
    }
    if (this.body instanceof ReadableStream) {
      // return getStreamAsString(this.body);
    }
    if (typeof this.body === 'string') {
      return this.body;
    }
    if (this.body instanceof ArrayBuffer) {
      return textDecoder.decode(this.body);
    }
    if (isTypedArray(this.body) || this.body instanceof DataView) {
      return textDecoder.decode(this.body);
    }
    if (this.body instanceof FormData) {
      // use a response object here so it contains boundary information and such
      const tmp = new Response(this.body);
      return tmp.text();
    }
  }
  // async stream() {
  //   if (this.body instanceof ReadableStream) {
  //     return this.body;
  //   }
  //   if (this.body instanceof Buffer || isTypedArray(this.body)) {
  //     // @ts-expect-error  TypeScript can't know that this.body is a Buffer or TypedArray
  //     return getStream(this.body);
  //   }
  // }
  toResponse() {
    return new Response(this.body, {
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
    });
  }
}

function cloneBody(body: ResponseBody) {
  if (typeof body === 'string') {
    return body;
  }
  if (body instanceof Blob) {
    return body.slice();
  }
  return body;
}

function isTypedArray(value: any): value is TypedArray {
  return (
    (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) &&
    !(value instanceof DataView)
  );
}
