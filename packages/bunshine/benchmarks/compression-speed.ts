import { promisify } from 'node:util';
import { brotliCompress, deflate, gzip, zstdCompress } from 'node:zlib';
import { runBenchmarks } from './runBenchmarks';

/*
Conclusion:
zstd is the best tradeoff between bandwidth vs. CPU time.

Data: comparison of algorithm speed across range of payload sizes
┌───┬──────┬──────────┬─────────────────────────┬────────────┬────────┬─────────┐
│   │ Rank │ Speed    │ Task Name               │ Avg Time   │ Margin │ Samples │
├───┼──────┼──────────┼─────────────────────────┼────────────┼────────┼─────────┤
│ 0 │ #1   │ 5282.53x │ regular response string │ 226.388 µs │ ±0.51% │ 44,173  │
│ 1 │ #2   │ 200.57x  │ zstd response string    │ 5.366 ms   │ ±0.34% │ 1,864   │
│ 2 │ #3   │ 96.68x   │ deflate response string │ 11.106 ms  │ ±0.36% │ 901     │
│ 3 │ #4   │ 95.90x   │ gzip response string    │ 11.203 ms  │ ±0.40% │ 893     │
│ 4 │ #5   │ 1.00x    │ brotli response string  │ 1.072 s    │ ±0.33% │ 64      │
└───┴──────┴──────────┴─────────────────────────┴────────────┴────────┴─────────┘
Data: comparison of algorithm payload size savings
┌───┬───────┬───────┬─────────┬────────┬───────┐
│   │ bytes │ gzip  │ deflate │ brotli │ zstd  │
├───┼───────┼───────┼─────────┼────────┼───────┤
│ 0 │ 1kb   │ 36.0% │ 34.8%   │ 25.6%  │ 36.8% │
│ 1 │ 10kb  │ 35.3% │ 35.1%   │ 29.5%  │ 36.4% │
│ 2 │ 100kb │ 14.0% │ 14.0%   │ 11.4%  │ 16.1% │
└───┴───────┴───────┴─────────┴────────┴───────┘

Notes:
Brotli provides 2-8% size savings but at the cost of about 96x as much CPU time.
zstd is about 2x as fast as gzip and provides only 13%-1% less size savings
*/

const brPromise = promisify(brotliCompress);
const gzipPromise = promisify(gzip);
const deflatePromise = promisify(deflate);
const zstdPromise = promisify(zstdCompress);

// some data!
const html = await fetch('https://www.npmjs.com/package/bunshine').then(res =>
  res.text()
);
const t1k = html.slice(1000, 2000);
const t10k = html.slice(1000, 11000);
const t100k = html.slice(1000, 101000);

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

  async function zstdResponse(data: Uint8Array) {
    return new Response(await zstdPromise(data), {
      headers: {
        'Content-Encoding': 'zstd',
      },
    });
  }

  async function normalResponse(data: Uint8Array) {
    // @ts-ignore Uint8Array does work in Bun
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
  console.log('comparison of algorithm speed');
  await runBenchmarks(
    {
      'gzip response string': () => testWithFakeData(all, gzipResponse),
      'deflate response string': () => testWithFakeData(all, deflateResponse),
      'brotli response string': () => testWithFakeData(all, brotliResponse),
      'zstd response string': () => testWithFakeData(all, zstdResponse),
      'regular response string': () => testWithFakeData(all, normalResponse),
    },
    { time: 10000 }
  );

  const toTest = {
    gzip: gzipResponse,
    deflate: deflateResponse,
    brotli: brotliResponse,
    zstd: zstdResponse,
    uncompressed: normalResponse,
  };

  for (const [label, resp] of Object.entries(toTest)) {
    console.log('---');
    console.log(`${label} times for various sizes of html`);
    await runBenchmarks(
      {
        '1kb': () => testWithFakeData([t1k], resp),
        '10kb': () => testWithFakeData([t10k], resp),
        '100kb': () => testWithFakeData([t100k], resp),
      },
      { time: 4000 }
    );
  }
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
  const dfSize = async (text: string) => getSize(text, deflatePromise);
  const zsSize = async (text: string) => getSize(text, zstdPromise);

  // compare sizes
  console.log('---\nComparison of html size after compression');
  console.table([
    {
      bytes: '1kb',
      gzip: await gzSize(t1k),
      deflate: await dfSize(t1k),
      brotli: await brSize(t1k),
      zstd: await zsSize(t1k),
    },
    {
      bytes: '10kb',
      gzip: await gzSize(t10k),
      deflate: await dfSize(t10k),
      brotli: await brSize(t10k),
      zstd: await zsSize(t10k),
    },
    {
      bytes: '100kb',
      gzip: await gzSize(t100k),
      deflate: await dfSize(t100k),
      brotli: await brSize(t100k),
      zstd: await zsSize(t100k),
    },
  ]);
}
