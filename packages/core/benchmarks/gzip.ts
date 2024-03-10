import { gzipString } from '../src/gzip/gzip.ts';
import { runBenchmarks } from './runBenchmarks.ts';

/*
Conclusion:
Gzip is a tradeoff between bandwidth vs. CPU time.

Gzipping HTML of various sizes on my MacBook M2:
Unzipped Size   Duration   Gzipped Size
1kb             8 µs       343 bytes
10kb            48 µs      3.2kb
100kb           463 µs     12kb
*/

function gzippedResponse(data: string) {
  return new Response(gzipString(data), {
    headers: {
      'Content-Encoding': 'gzip',
    },
  });
}

function normalResponse(data: string) {
  return new Response(data, {
    headers: {},
  });
}
const js = await fetch(
  'https://cdnjs.cloudflare.com/ajax/libs/primereact/10.3.1/api/api.min.js'
).then(res => res.text());
const css = await fetch(
  'https://cdnjs.cloudflare.com/ajax/libs/primereact/10.3.1/resources/themes/nova/theme.min.css'
).then(res => res.text());
const html = await fetch('https://www.npmjs.com/package/bunshine').then(res =>
  res.text()
);
const data1 = await fetch('https://jsonplaceholder.typicode.com/todos').then(
  res => res.json()
);
const data2 = await fetch('https://jsonplaceholder.typicode.com/posts/30').then(
  res => res.json()
);

const all = [
  ...Array(1).fill(css),
  ...Array(2).fill(html),
  ...Array(4).fill(js),
  ...Array(10).fill(data1),
  ...Array(100).fill(data2),
];

function testWithFakeData(
  payloads: string[],
  func: (data: string) => Response
) {
  for (const payload of payloads) {
    func(payload);
  }
}

await runBenchmarks(
  {
    'gizipping response string': () => testWithFakeData(all, gzippedResponse),
    'regular response string': () => testWithFakeData(all, normalResponse),
  },
  { time: 10000 }
);

const t1k = html.slice(1000, 2000);
const t10k = html.slice(1000, 11000);
const t100k = html.slice(1000, 101000);

await runBenchmarks(
  {
    '1kb': () => testWithFakeData([t1k], gzippedResponse),
    '10kb': () => testWithFakeData([t10k], gzippedResponse),
    '100kb': () => testWithFakeData([t100k], gzippedResponse),
  },
  { time: 4000 }
);

console.log(`1kb of gzipped html becomes ${gzipString(t1k).length} bytes`);
console.log(`10kb of gzipped html becomes ${gzipString(t10k).length} bytes`);
console.log(`100kb of gzipped html becomes ${gzipString(t100k).length} bytes`);
