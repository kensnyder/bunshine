// see https://developer.mozilla.org/en-US/docs/Web/API/Response/Response
import { AnyData } from 'any-data';
import { isPlainObject } from 'is-plain-object';
import { TypedArray } from 'type-fest';

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

export default class ResponseLike {
  _body: AnyData;
  headers: Headers;
  bodyUsed = false;
  status: number;
  redirected: boolean;
  statusText: string;
  type: ResponseType;
  url: string;
  static fromAny = (
    body: ResponseBody,
    init: ResponseInit = {}
  ): ResponseLike => {
    if (body instanceof ResponseLike) {
      return body;
    } else if (body instanceof Response) {
      return new ResponseLike(body.body, {
        status: body.status,
        statusText: body.statusText,
        headers: body.headers,
      });
    } else {
      return new ResponseLike(body, init);
    }
  };
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
  clone = async () => {
    const cloned = new ResponseLike('');
    // make sure the body and headers objects are cloned
    cloned._body = await this._body.clone();
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
      return this._body.arrayBuffer();
    }
    // probably ReadableStream
    this.bodyUsed = true;
    // @ts-expect-error  TypeScript can't know that isSupported() rules out unsupported types
    return new Response(this._body.data).arrayBuffer();
  };
  blob = (): Promise<Blob> => {
    if (this._body.isSupported()) {
      return this._body.blob();
    }
    // probably ReadableStream
    this.bodyUsed = true;
    // @ts-expect-error  TypeScript can't know that isSupported() rules out unsupported types
    return new Response(this._body.data).blob();
  };
  text = (): Promise<string> => {
    if (this._body.isSupported()) {
      return this._body.text();
    }
    // probably ReadableStream
    this.bodyUsed = true;
    // @ts-expect-error  TypeScript can't know that isSupported() rules out unsupported types
    return new Response(this._body.data).text();
  };
  bytes = (): Promise<TypedArray> => {
    if (this._body.isSupported()) {
      return this._body.bytes();
    }
    // probably ReadableStream
    this.bodyUsed = true;
    // @ts-expect-error  TypeScript can't know that isSupported() rules out unsupported types
    return new Response(this._body.data).bytes();
  };
  json = (): Promise<unknown> => {
    if (this._body.isSupported()) {
      return this._body.json();
    }
    // probably ReadableStream
    this.bodyUsed = true;
    // @ts-expect-error  TypeScript can't know that isSupported() rules out unsupported types
    return new Response(this._body.data).json();
  };
  formData = (): Promise<FormData> => {
    if (this._body.isSupported()) {
      return this._body.formData();
    }
    // probably ReadableStream
    this.bodyUsed = true;
    // @ts-expect-error  TypeScript can't know that isSupported() rules out unsupported types
    return new Response(this._body.data).formData();
  };
  toResponse = async () => {
    let body: ResponseBody;
    switch (this._body.getDataCategory()) {
      case 'bytes':
        body = await this._body.bytes();
        break;
      case 'text':
        body = await this._body.text();
        break;
      case 'unknown':
      default:
        body = this._body.data;
        break;
    }
    if (isPlainObject(this._body.data) || Array.isArray(this._body.data)) {
      this.headers.set('Content-Type', 'application/json');
    }
    // @ts-expect-error  If body is unknown, it's probably a ReadableStream
    return new Response(body, {
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
    });
  };
}
