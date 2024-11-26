import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from '../../HttpRouter/HttpRouter';

describe('c.file()', () => {
  let port = 50400;
  let app: HttpRouter;
  let server: Server;
  beforeEach(() => {
    app = new HttpRouter();
    app.onError(c => console.log(c.error));
    server = app.listen({ port: port++ });
  });
  afterEach(() => {
    server.stop(true);
  });
  it('should handle files with disposition="attachment', async () => {
    app.get('/home.html', c =>
      c.file(`${import.meta.dir}/../../../testFixtures/home.html`, {
        disposition: 'attachment',
      })
    );
    const resp = await fetch(`${server.url}home.html`);
    expect(resp).toBeInstanceOf(Response);
    expect(resp.headers.get('Content-Disposition')).toBe(
      'attachment; filename="home.html"'
    );
    const file = await resp.blob();
    const text = await file.text();
    expect(text).toBe('<h1>Welcome home</h1>\n');
  });
  it('should allow headGet', async () => {
    app.headGet('/', c => {
      if (c.request.method === 'GET') {
        return c.file(`${import.meta.dirname}/../../../testFixtures/home.html`);
      } else {
        return new Response('', {
          headers: {
            'Content-type': 'text/html',
            'Content-length': '22',
          },
        });
      }
    });
    const getResp = await app.fetch(new Request('http://localhost/'), server);
    expect(getResp.status).toBe(200);
    expect(await getResp.text()).toInclude('Welcome home');
    const headResp = await app.fetch(
      new Request('http://localhost/', { method: 'HEAD' }),
      server
    );
    expect(headResp.status).toBe(200);
    expect(await headResp.text()).toBe('');
  });
  it('should return correct statuses, headers, and bytes for range requests', async () => {
    app.headGet('/bun-logo.jpg', c => {
      return c.file(
        `${import.meta.dirname}/../../../testFixtures/bun-logo.jpg`
      );
    });
    const url = `${server.url}bun-logo.jpg?foo=bar`;

    // Step 1: Fetch entire file
    const fullResponse = await fetch(url);
    const fullFileBytes = await fullResponse.blob();
    const fileSize = Number(fullResponse.headers.get('content-length'));

    expect(fullResponse.status).toBe(200);
    expect(fullFileBytes.size).toBe(fileSize);
    expect(fullResponse.headers.get('accept-ranges')).toBe('bytes');
    expect(fullResponse.headers.get('content-type')).toBe('image/jpeg');

    // Step 2: Fetch HEAD and validate
    const headResponse = await fetch(url, { method: 'HEAD' });

    expect(headResponse.status).toBe(200);
    expect(headResponse.headers.get('accept-ranges')).toBe('bytes');
    expect(headResponse.headers.get('content-length')).toBe(
      // currently Bun always sets Content-Length to 0 for HEAD responses
      // https://github.com/oven-sh/bun/issues/15355
      '0'
      // String(fullFileBytes.size)
    );
    // So for now we set an X-Content-Length header to the actual file size
    expect(headResponse.headers.get('x-content-length')).toBe(
      String(fullFileBytes.size)
    );

    // Step 3: Fetch range "bytes=0-" and validate
    const rangeResponse1 = await fetch(url, {
      headers: { Range: 'bytes=0-' },
    });
    const range1Bytes = await rangeResponse1.blob();

    expect(rangeResponse1.status).toBe(200);
    expect(rangeResponse1.headers.get('accept-ranges')).toBe('bytes');
    expect(rangeResponse1.headers.get('content-type')).toBe('image/jpeg');
    expect(range1Bytes.size).toBe(fileSize);
    expect(rangeResponse1.headers.get('content-length')).toBe(String(fileSize));
    expect(range1Bytes).toEqual(fullFileBytes);

    // Step 4: Fetch range "bytes=0-999" and validate
    const rangeResponse2 = await fetch(url, {
      headers: { Range: 'bytes=0-999' },
    });
    const range2Bytes = await rangeResponse2.blob();
    expect(rangeResponse2.status).toBe(206);
    expect(rangeResponse2.headers.get('accept-ranges')).toBe('bytes');
    expect(rangeResponse2.headers.get('content-length')).toBe('1000');
    expect(range2Bytes.size).toBe(1000);
    expect(rangeResponse2.headers.get('content-range')).toBe(
      `bytes 0-999/${fileSize}`
    );
    expect(range2Bytes).toEqual(fullFileBytes.slice(0, 1000));
    expect(rangeResponse2.headers.get('content-type')).toBe('image/jpeg');

    // Step 5: Fetch range "bytes=1000-1999" and validate
    const rangeResponse3 = await fetch(url, {
      headers: { Range: 'bytes=1000-1999' },
    });
    const range3Bytes = await rangeResponse3.blob();

    expect(rangeResponse3.status).toBe(206);
    expect(rangeResponse3.headers.get('accept-ranges')).toBe('bytes');
    expect(rangeResponse3.headers.get('content-length')).toBe('1000');
    expect(range3Bytes.size).toBe(1000);
    expect(rangeResponse3.headers.get('content-range')).toBe(
      `bytes 1000-1999/${fileSize}`
    );
    expect(range3Bytes).toEqual(fullFileBytes.slice(1000, 2000));
    expect(rangeResponse3.headers.get('content-type')).toBe('image/jpeg');

    // Step 5: Fetch range "bytes=-1000" and validate
    const rangeResponse4 = await fetch(url, {
      headers: { Range: 'bytes=-1000' },
    });
    const range4Bytes = await rangeResponse4.blob();

    expect(rangeResponse4.status).toBe(206);
    expect(rangeResponse4.headers.get('accept-ranges')).toBe('bytes');
    expect(rangeResponse4.headers.get('content-length')).toBe('1000');
    expect(range4Bytes.size).toBe(1000);
    expect(rangeResponse4.headers.get('content-range')).toBe(
      `bytes ${fileSize - 1000}-${fileSize - 1}/${fileSize}`
    );
    expect(range4Bytes).toEqual(fullFileBytes.slice(-1000));
    expect(rangeResponse4.headers.get('content-type')).toBe('image/jpeg');

    // Step 7: Request invalid range
    const rangeResponse5 = await fetch(url, {
      headers: { Range: 'bytes=9999999-' },
    });
    const content = await rangeResponse5.text();
    expect(rangeResponse5.status).toBe(416);
    expect(rangeResponse5.statusText).toBe('Range Not Satisfiable');
    expect(rangeResponse5.headers.get('content-range')).toBe(
      `bytes */${fileSize}`
    );
    expect(content).toContain('Requested range is not satisfiable');
    expect(content).toContain(`${fileSize}`);
  });
});
