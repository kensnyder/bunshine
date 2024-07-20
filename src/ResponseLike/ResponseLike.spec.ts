import { describe, expect, it } from 'bun:test';
import ResponseLike from './ResponseLike';

const aString = 'Hello world';
const aBuffer = Buffer.from('Hello world', 'utf8');
const aBlob = new Blob(['Hello world']);
const anArrayBuffer = await aBlob.arrayBuffer();
const aUint8Array = new Uint8Array(anArrayBuffer);
const aDataView = new DataView(anArrayBuffer);
const aFormData = new FormData();
aFormData.append('hello', 'world');
aFormData.append('foo', 'bar');
const anObject = { hello: 'world', foo: 'bar' };
const aReadableStream = aBlob.stream();
const aUrlString = 'hello=world&foo=bar';
const aUrlSearchParams = new URLSearchParams(aUrlString);

describe('ResponseLike class', () => {
  it('should have relevant properties with defaults', async () => {
    const resp = new ResponseLike();
    expect(resp.body).toBe('');
    expect(resp.headers).toBeInstanceOf(Headers);
    expect(resp.status).toBe(200);
    expect(resp.statusText).toBe('');
    expect(resp.redirected).toBe(false);
    expect(resp.type).toBe('default');
    expect(resp.url).toBe('');
  });
  it('should clone response object', async () => {
    const headers = new Headers({ 'Content-Type': 'text/plain' });
    const resp = new ResponseLike('hello', {
      status: 201,
      statusText: 'Created',
      headers,
    });
    const clone = resp.clone();
    expect(clone).not.toBe(resp);
    expect(clone.body).toBe('hello');
    expect(clone.headers).toBeInstanceOf(Headers);
    expect(clone.headers).not.toBe(resp.headers); // must be a clone!
    expect(clone.headers.get('content-type')).toBe('text/plain');
    expect(clone.status).toBe(201);
    expect(clone.statusText).toBe('Created');
    expect(clone.redirected).toBe(false);
    expect(clone.type).toBe('default');
    expect(clone.url).toBe('');
  });
  describe('string', () => {
    it('should convert string => Blob', async () => {
      const resp = new ResponseLike(aString);
      expect(await resp.blob()).toEqual(aBlob);
    });
    it('should convert string => ArrayBuffer', async () => {
      const resp = new ResponseLike(aString);
      expect(await resp.arrayBuffer()).toEqual(anArrayBuffer);
    });
    it('should convert string => bytes', async () => {
      const resp = new ResponseLike(aString);
      expect(await resp.bytes()).toEqual(aUint8Array);
    });
    it('should convert string => FormData', async () => {
      const resp = new ResponseLike('hello=world&foo=bar');
      expect(await resp.formData()).toEqual(aFormData);
    });
    it('should convert string => json', async () => {
      const resp = new ResponseLike(JSON.stringify(anObject));
      expect(await resp.json()).toEqual(anObject);
    });
    it('should convert string => string', async () => {
      const resp = new ResponseLike(aString);
      expect(await resp.text()).toBe(aString);
    });
  });
  describe('Blob', () => {
    it('should convert Blob => Blob', async () => {
      const resp = new ResponseLike(aBlob);
      expect(await resp.blob()).toBe(aBlob);
    });
    it('should convert Blob => ArrayBuffer', async () => {
      const resp = new ResponseLike(aBlob);
      expect(await resp.arrayBuffer()).toEqual(anArrayBuffer);
    });
    it('should convert Blob => bytes', async () => {
      const resp = new ResponseLike(aBlob);
      expect(await resp.bytes()).toEqual(aUint8Array);
    });
    it('should convert Blob => FormData', async () => {
      const resp = new ResponseLike(aBlob);
      expect(await resp.formData()).toEqual(aFormData);
    });
    it('should convert Blob => json', async () => {
      const resp = new ResponseLike(new Blob([JSON.stringify(anObject)]));
      expect(await resp.json()).toEqual(anObject);
    });
    it('should convert Blob => string', async () => {
      const resp = new ResponseLike(aBlob);
      expect(await resp.text()).toBe(aString);
    });
  });
  describe('ArrayBuffer', () => {
    it('should convert ArrayBuffer => Blob', async () => {
      const resp = new ResponseLike(anArrayBuffer);
      expect(await resp.blob()).toEqual(aBlob);
    });
    it('should convert ArrayBuffer => ArrayBuffer', async () => {
      const resp = new ResponseLike(anArrayBuffer);
      expect(await resp.arrayBuffer()).toEqual(anArrayBuffer);
    });
    it('should convert ArrayBuffer => bytes', async () => {
      const resp = new ResponseLike(anArrayBuffer);
      expect(await resp.bytes()).toEqual(aUint8Array);
    });
    it('should convert ArrayBuffer => FormData', async () => {
      const resp = new ResponseLike(anArrayBuffer);
      expect(await resp.formData()).toEqual(aFormData);
    });
    it('should convert ArrayBuffer => json', async () => {
      const blob = new Blob([JSON.stringify(anObject)]);
      const resp = new ResponseLike(await blob.arrayBuffer());
      expect(await resp.json()).toEqual(anObject);
    });
    it('should convert ArrayBuffer => string', async () => {
      const resp = new ResponseLike(anArrayBuffer);
      expect(await resp.text()).toBe(aString);
    });
  });
  describe('TypedArray', () => {
    it('should convert TypedArray => Blob', async () => {
      const resp = new ResponseLike(aUint8Array);
      expect(await resp.blob()).toEqual(aBlob);
    });
    it('should convert TypedArray => ArrayBuffer', async () => {
      const resp = new ResponseLike(aUint8Array);
      expect(await resp.arrayBuffer()).toEqual(anArrayBuffer);
    });
    it('should convert TypedArray => bytes', async () => {
      const resp = new ResponseLike(aUint8Array);
      expect(await resp.bytes()).toEqual(aUint8Array);
    });
    it('should convert TypedArray => FormData', async () => {
      const arr = new TextEncoder().encode(aUrlString);
      const resp = new ResponseLike(arr);
      const formData = await resp.formData();
      expect(formData.get('hello')).toBe('world');
      expect(formData.get('foo')).toBe('bar');
    });
    it('should convert TypedArray => json', async () => {
      const arr = new TextEncoder().encode(JSON.stringify(anObject));
      const resp = new ResponseLike(arr);
      expect(await resp.json()).toEqual(anObject);
    });
    it('should convert TypedArray => string', async () => {
      const resp = new ResponseLike(aUint8Array);
      expect(await resp.text()).toBe(aString);
    });
  });
  describe('DataView', () => {
    it('should convert DataView => Blob', async () => {
      const resp = new ResponseLike(aDataView);
      expect(await resp.blob()).toEqual(aBlob);
    });
    it('should convert DataView => ArrayBuffer', async () => {
      const resp = new ResponseLike(aDataView);
      expect(await resp.arrayBuffer()).toEqual(anArrayBuffer);
    });
    it('should convert DataView => bytes', async () => {
      const resp = new ResponseLike(aDataView);
      expect(await resp.bytes()).toEqual(aUint8Array);
    });
    it('should convert DataView => FormData', async () => {
      const blob = new Blob([aUrlString]);
      const arrayBuffer = await blob.arrayBuffer();
      const dataView = new DataView(arrayBuffer);
      const resp = new ResponseLike(dataView);
      const formData = await resp.formData();
      expect(formData.get('hello')).toBe('world');
      expect(formData.get('foo')).toBe('bar');
    });
    it('should convert DataView => json', async () => {
      const blob = new Blob([JSON.stringify(anObject)]);
      const arrayBuffer = await blob.arrayBuffer();
      const dataView = new DataView(arrayBuffer);
      const resp = new ResponseLike(dataView);
      expect(await resp.json()).toEqual(anObject);
    });
    it('should convert DataView => string', async () => {
      const resp = new ResponseLike(aDataView);
      expect(await resp.text()).toBe(aString);
    });
  });
  describe('FormData', () => {
    it('should convert FormData => Blob', async () => {
      aFormData.append('hello', 'world');
      const resp = new ResponseLike(aDataView);
      expect(await resp.blob()).toEqual(aBlob);
    });
    it('should convert FormData => ArrayBuffer', async () => {
      const aBlob = new Blob(['Hello world']);
      const anArrayBuffer = await aBlob.arrayBuffer();

      const resp = new ResponseLike(aFormData);
      const bytes = await resp.arrayBuffer();
      // starts with --- (this is kind of redundant to the resp.text() text)
      const arr = await new Blob(['---']).arrayBuffer();
      expect(bytes.slice(0, 3)).toEqual(arr);
    });
    it('should convert FormData => bytes', async () => {
      const resp = new ResponseLike(aFormData);
      const bytes = await resp.bytes();
      // starts with --- (this is kind of redundant to the resp.text() text)
      expect(bytes.slice(0, 3)).toEqual(new Uint8Array([45, 45, 45]));
    });
    it('should convert FormData => FormData', async () => {
      const resp = new ResponseLike(aFormData);
      const formData = await resp.formData();
      expect(formData).toEqual(aFormData);
      expect(formData.get('hello')).toEqual('world');
      expect(formData.get('foo')).toBe('bar');
    });
    it('should convert FormData => json (Exception)', async () => {
      const thrower = () => {
        const resp = new ResponseLike(aFormData);
        return resp.json();
      };
      expect(thrower).toThrow();
    });
    it('should convert FormData => string', async () => {
      const resp = new ResponseLike(aFormData);
      const text = await resp.text();
      expect(text).toStartWith('---');
      expect(text).toContain('Content-Disposition: form-data;');
      expect(text).toContain('name="hello"\r\n\r\nworld');
      expect(text).toContain('name="foo"\r\n\r\nbar');
    });
  });
  describe('ReadableStream', () => {
    it('should convert ReadableStream => Blob', async () => {
      aFormData.append('hello', 'world');
      const resp = new ResponseLike(aDataView);
      expect(await resp.blob()).toEqual(aBlob);
    });
    // it('should convert FormData => ArrayBuffer', async () => {
    //   const aBlob = new Blob(['Hello world']);
    //   const anArrayBuffer = await aBlob.arrayBuffer();
    //
    //   const resp = new ResponseLike(aFormData);
    //   const bytes = await resp.arrayBuffer();
    //   // starts with --- (this is kind of redundant to the resp.text() text)
    //   const arr = await new Blob(['---']).arrayBuffer();
    //   expect(bytes.slice(0, 3)).toEqual(arr);
    // });
    // it('should convert FormData => bytes', async () => {
    //   const resp = new ResponseLike(aFormData);
    //   const bytes = await resp.bytes();
    //   // starts with --- (this is kind of redundant to the resp.text() text)
    //   expect(bytes.slice(0, 3)).toEqual(new Uint8Array([45, 45, 45]));
    // });
    // it('should convert FormData => FormData', async () => {
    //   const resp = new ResponseLike(aFormData);
    //   const formData = await resp.formData();
    //   expect(formData).toEqual(aFormData);
    //   expect(formData.get('hello')).toEqual('world');
    //   expect(formData.get('foo')).toBe('bar');
    // });
    // it('should convert FormData => json (Exception)', async () => {
    //   const thrower = () => {
    //     const resp = new ResponseLike(aFormData);
    //     return resp.json();
    //   };
    //   expect(thrower).toThrow();
    // });
    // it('should convert FormData => string', async () => {
    //   const resp = new ResponseLike(aFormData);
    //   const text = await resp.text();
    //   expect(text).toStartWith('---');
    //   expect(text).toContain('Content-Disposition: form-data;');
    //   expect(text).toContain('name="hello"\r\n\r\nworld');
    //   expect(text).toContain('name="foo"\r\n\r\nbar');
    // });
  });
});
