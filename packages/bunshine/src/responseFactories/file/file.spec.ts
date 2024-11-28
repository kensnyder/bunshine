import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from '../../HttpRouter/HttpRouter';

describe('c.file()', () => {
  let app: HttpRouter;
  let server: Server;
  beforeEach(() => {
    app = new HttpRouter();
    server = app.listen({ port: 0 });
  });
  afterEach(() => {
    server.stop(true);
  });
  it('should handle paths with disposition="attachment"', async () => {
    app.get('/home.html', c =>
      c.file(`${import.meta.dir}/../../../testFixtures/home.html`, {
        disposition: 'attachment',
      })
    );
    const resp = await fetch(`${server.url}home.html`);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Disposition')).toBe(
      'attachment; filename="home.html"'
    );
    const file = await resp.blob();
    const text = await file.text();
    expect(text).toBe('<h1>Welcome home</h1>\n');
  });
  it('should allow multiple headers with same name', async () => {
    app.get('/home.html', c => {
      return c.file(`${import.meta.dir}/../../../testFixtures/home.html`, {
        headers: new Headers([
          ['Hello', 'bun'],
          ['Hello', 'world'],
        ]),
      });
    });
    const resp = await fetch(`${server.url}home.html`);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Hello')).toBe('bun, world');
  });
  it('should handle BunFile with disposition="attachment"', async () => {
    app.get('/home.html', c => {
      const file = Bun.file(
        `${import.meta.dir}/../../../testFixtures/home.html`
      );
      return c.file(file, { disposition: 'attachment' });
    });
    const resp = await fetch(`${server.url}home.html`);
    expect(resp.status).toBe(200);
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
    expect(getResp.headers.get('content-type')).toInclude('text/html');
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
  // spot test some files from the file-type package test fixtures
  const fileTypes = {
    'fixture.jpg.data': 'image/jpeg',
    'fixture.mov.data': 'video/quicktime',
    'fixture.ogg.data': 'audio/ogg',
    'fixture.pdf.data': 'application/pdf',
    'fixture.png.data': 'image/png',
    'fixture-office365.pptx.data':
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'fixture-office365.docx.data':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'fixture-office365.xlsx.data':
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'fixture.woff2.data': 'font/woff2',
    'fixture-bali.tif': 'image/tiff',
    'fixture-ffe3.mp3.data': 'audio/mpeg',
    'fixture-mp4v2.mp4.data': 'video/mp4',
    'fixture.m4v.data': 'video/x-m4v',
    'fixture.ico.data': 'image/x-icon',
    'fixture-null.webm.data': 'video/webm',
  };
  for (const [name, mime] of Object.entries(fileTypes)) {
    it(`should detect mime from bytes - ${name}`, async () => {
      app.get(`/${name}`, c =>
        c.file(`${import.meta.dir}/../../../testFixtures/file-type/${name}`)
      );
      const resp = await fetch(`${server.url}${name}`);
      expect(resp.status).toBe(200);
      expect(resp.headers.get('Content-Type')).toInclude(mime);
    });
    it(`should detect mime from partial bytes - ${name}`, async () => {
      app.get(`/${name}`, c =>
        c.file(`${import.meta.dir}/../../../testFixtures/file-type/${name}`)
      );
      const resp = await fetch(`${server.url}${name}`, {
        headers: { Range: 'bytes=0-5000' },
      });
      expect(resp.status).toBeOneOf([206, 416, 200]);
      expect(resp.headers.get('Content-Type')).toInclude(mime);
    });
    it(`should detect mime from partial bytes Blob - ${name}`, async () => {
      app.get(`/${name}`, async c => {
        const file = Bun.file(
          `${import.meta.dir}/../../../testFixtures/file-type/${name}`
        );
        const buffer = await file.bytes();
        const blob = new Blob([buffer], { type: 'image/png' });
        return c.file(blob);
      });
      const resp = await fetch(`${server.url}${name}`, {
        headers: { Range: 'bytes=0-9' },
      });
      expect(resp.status).toBe(206);
      expect(resp.headers.get('Content-Type')).toInclude(mime);
      expect(resp.headers.get('Content-Length')).toBe('10');
    });
    it(`should detect mime from bytes 0-1 request - ${name}`, async () => {
      app.get(`/${name}`, c =>
        c.file(`${import.meta.dir}/../../../testFixtures/file-type/${name}`)
      );
      const resp = await fetch(`${server.url}${name}`, {
        headers: { Range: 'bytes=0-1' },
      });
      expect(resp.status).toBe(206);
      expect(resp.headers.get('Content-Type')).toInclude(mime);
    });
    it(`should detect mime from HEAD request`, async () => {
      app.headGet(`/${name}`, c =>
        c.file(`${import.meta.dir}/../../../testFixtures/file-type/${name}`)
      );
      const resp = await fetch(`${server.url}${name}`, { method: 'HEAD' });
      expect(resp.status).toBe(200);
      expect(resp.headers.get('Content-Type')).toInclude(mime);
    });
  }
  it('should detect mime from ArrayBuffer', async () => {
    app.get(`/video.mp4`, async c => {
      const file = Bun.file(
        `${import.meta.dir}/../../../testFixtures/file-type/fixture-mp4v2.mp4.data`
      );
      const buffer = await file.arrayBuffer();
      return c.file(buffer);
    });
    const resp = await fetch(`${server.url}video.mp4`);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Type')).toInclude('video/mp4');
  });
  it('should detect mime from Bunfile', async () => {
    app.get(`/my.pdf`, async c => {
      const file = Bun.file(
        `${import.meta.dir}/../../../testFixtures/file-type/fixture.pdf.data`
      );
      return c.file(file);
    });
    const resp = await fetch(`${server.url}my.pdf`);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Type')).toInclude('application/pdf');
  });
  it('should detect mime from Uint8Array', async () => {
    app.get(`/my.jpg`, async c => {
      const file = Bun.file(
        `${import.meta.dir}/../../../testFixtures/file-type/fixture.jpg.data`
      );
      const buffer = await file.bytes();
      return c.file(buffer);
    });
    const resp = await fetch(`${server.url}my.jpg`);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Type')).toInclude('image/jpeg');
  });
  it('should detect mime from plain Blob - GET', async () => {
    app.get(`/my.png`, async c => {
      const file = Bun.file(
        `${import.meta.dir}/../../../testFixtures/file-type/fixture.png.data`
      );
      const buffer = await file.bytes();
      const blob = new Blob([buffer], { type: 'image/png' });
      return c.file(blob);
    });
    const resp = await fetch(`${server.url}my.png`);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Type')).toInclude('image/png');
  });
  it('should detect mime from plain Blob - HEAD', async () => {
    app.headGet(`/favicon.ico`, async c => {
      const file = Bun.file(
        `${import.meta.dir}/../../../testFixtures/file-type/fixture.ico.data`
      );
      const buffer = await file.bytes();
      const blob = new Blob([buffer], { type: 'image/x-icon' });
      return c.file(blob);
    });
    const resp = await fetch(`${server.url}favicon.ico`, { method: 'HEAD' });
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Type')).toInclude('image/x-icon');
  });
  it('should return 404 on bad input', async () => {
    app.headGet(`/video.mov`, async c => {
      // @ts-expect-error
      return c.file(['foo']);
    });
    const resp = await fetch(`${server.url}video.mov`);
    expect(resp.status).toBe(404);
    expect(await resp.text()).toContain('File not found');
  });
  it('should allow disposition of attachment for Uint8Array', async () => {
    app.get(`/font.woff2`, async c => {
      const file = Bun.file(
        `${import.meta.dir}/../../../testFixtures/file-type/fixture.woff2.data`
      );
      const buffer = await file.bytes();
      return c.file(buffer, { disposition: 'attachment' });
    });
    const resp = await fetch(`${server.url}font.woff2`);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Type')).toInclude('font/woff2');
    expect(resp.headers.get('Content-Disposition')).toBe('attachment');
  });
  it('should allow disposition of attachment for Bunfile', async () => {
    app.get(`/video.webm`, async c => {
      const file = Bun.file(
        `${import.meta.dir}/../../../testFixtures/file-type/fixture-null.webm.data`
      );
      return c.file(file, { disposition: 'attachment' });
    });
    const resp = await fetch(`${server.url}video.webm`);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Type')).toInclude('video/webm');
    expect(resp.headers.get('Content-Disposition')).toBe(
      'attachment; filename="fixture-null.webm.data"'
    );
  });
  it('should allow disposition of form-data for Uint8Array', async () => {
    app.get(`/my.tiff`, async c => {
      const file = Bun.file(
        `${import.meta.dir}/../../../testFixtures/file-type/fixture-bali.tif`
      );
      const buffer = await file.bytes();
      return c.file(buffer, { disposition: 'form-data' });
    });
    const resp = await fetch(`${server.url}my.tiff`);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Type')).toInclude('image/tiff');
    expect(resp.headers.get('Content-Disposition')).toBe('form-data');
  });
  it('should allow overriding content-type', async () => {
    app.get(`/podcast.ogg`, async c => {
      const file = Bun.file(
        `${import.meta.dir}/../../../testFixtures/file-type/fixture.ogg.data`
      );
      const buffer = await file.bytes();
      return c.file(buffer, { headers: { 'Content-Type': 'audio/ogg' } });
    });
    const resp = await fetch(`${server.url}podcast.ogg`);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Type')).toInclude('audio/ogg');
  });
});
