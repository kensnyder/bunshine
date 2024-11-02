import { promisify } from 'node:util';
import { brotliCompress, deflate, gzip } from 'node:zlib';
import { runBenchmarks } from './runBenchmarks.ts';

const brPromise = promisify(brotliCompress);
const gzipPromise = promisify(gzip);
const deflatePromise = promisify(deflate);

// some data!
const html = await fetch('https://www.npmjs.com/package/bunshine').then(res =>
  res.text()
);
const t1k = html.slice(1000, 2000);
const t10k = html.slice(1000, 11000);
const t100k = html.slice(1000, 101000);

/*
Conclusion:
Gzip is a tradeoff between bandwidth vs. CPU time.

Gzipping HTML of various sizes on my MacBook M2:
Unzipped Size   Duration   Gzipped Size
1kb             8 µs       343 bytes
10kb            48 µs      3.2kb
100kb           463 µs     12kb
*/

await savings();
await benchmarks();

async function benchmarks() {
  async function gzipResponse(data: Uint8Array) {
    return new Response(await gzipPromise(data), {
      headers: {
        'Content-Encoding': 'gzip',
      },
    });
  }

  async function deflateResponse(data: Uint8Array) {
    return new Response(await deflatePromise(data), {
      headers: {
        'Content-Encoding': 'deflate',
      },
    });
  }

  async function brotliResponse(data: Uint8Array) {
    return new Response(await brPromise(data), {
      headers: {
        'Content-Encoding': 'br',
      },
    });
  }

  async function normalResponse(data: Uint8Array) {
    return new Response(data, {
      headers: {},
    });
  }

  // more real data for the simulation
  const js = await fetch(
    'https://cdnjs.cloudflare.com/ajax/libs/primereact/10.3.1/api/api.min.js'
  ).then(res => res.text());
  const css = await fetch(
    'https://cdnjs.cloudflare.com/ajax/libs/primereact/10.3.1/resources/themes/nova/theme.min.css'
  ).then(res => res.text());

  const data1 = await fetch('https://jsonplaceholder.typicode.com/todos').then(
    res => res.text()
  );
  const data2 = await fetch(
    'https://jsonplaceholder.typicode.com/posts/30'
  ).then(res => res.text());

  const all = [
    ...Array(1).fill(css),
    ...Array(2).fill(html),
    ...Array(4).fill(js),
    ...Array(10).fill(data1),
    ...Array(100).fill(data2),
  ];

  async function testWithFakeData(
    payloads: string[],
    compressor: (data: Uint8Array) => Promise<Response>
  ) {
    const encoder = new TextEncoder();
    for (const payload of payloads) {
      const uint8 = encoder.encode(payload);
      await compressor(uint8);
    }
  }

  console.log('---');
  console.log('comparison of algorithms');
  await runBenchmarks(
    {
      'gzip response string': () => testWithFakeData(all, gzipResponse),
      'brotli response string': () => testWithFakeData(all, brotliResponse),
      'deflate response string': () => testWithFakeData(all, deflateResponse),
      'regular response string': () => testWithFakeData(all, normalResponse),
    },
    { time: 10000 }
  );

  console.log('---');
  console.log('gzip times for various sizes of html');
  await runBenchmarks(
    {
      '1kb': () => testWithFakeData([t1k], gzipResponse),
      '10kb': () => testWithFakeData([t10k], gzipResponse),
      '100kb': () => testWithFakeData([t100k], gzipResponse),
    },
    { time: 4000 }
  );

  console.log('---');
  console.log('deflate times for various sizes of html');
  await runBenchmarks(
    {
      '1kb': () => testWithFakeData([t1k], deflateResponse),
      '10kb': () => testWithFakeData([t10k], deflateResponse),
      '100kb': () => testWithFakeData([t100k], deflateResponse),
    },
    { time: 4000 }
  );

  console.log('---');
  console.log('brotli times for various sizes of html');
  await runBenchmarks(
    {
      '1kb': () => testWithFakeData([t1k], brotliResponse),
      '10kb': () => testWithFakeData([t10k], brotliResponse),
      '100kb': () => testWithFakeData([t100k], brotliResponse),
    },
    { time: 4000 }
  );
}

async function savings() {
  const getSize = async (
    text: string,
    compressor: (data: Uint8Array) => Promise<Buffer>
  ) => {
    const buffer = await compressor(new TextEncoder().encode(text));
    const ratio = ((buffer.length * 100) / text.length).toFixed(1);
    return ratio.padStart(4, ' ') + '%';
  };

  const gzSize = async (text: string) => getSize(text, gzipPromise);
  const brSize = async (text: string) => getSize(text, brPromise);
  const dfsize = async (text: string) => getSize(text, deflatePromise);

  // compare sizes
  console.log(`
---  
Comparison of html size after compression
Bytes    Gzip     Deflate  Brotli
1kb      ${await gzSize(t1k)}    ${await dfsize(t1k)}    ${await brSize(t1k)}
10kb     ${await gzSize(t10k)}    ${await dfsize(t10k)}    ${await brSize(t10k)}
100kb    ${await gzSize(t100k)}    ${await dfsize(t100k)}    ${await brSize(t100k)}
`);
}
