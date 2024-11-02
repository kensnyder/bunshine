import { runBenchmarks } from './runBenchmarks.ts';

/*
Conclusions:

Decoding and reencoding Response objects takes a matter of microseconds:
  1k string:  1 µs
 10k string:  3 µs
100k string: 24 µs
*/

// some data!
const html = await fetch('https://www.npmjs.com/package/bunshine').then(res =>
  res.text()
);
const t1k = html.slice(1000, 2000);
const t10k = html.slice(1000, 11000);
const t100k = html.slice(1000, 101000);

async function encode(input: string) {
  return new Response(input, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}

async function reencode(input: string) {
  const resp = await encode(input);
  const body = await resp.arrayBuffer();
  resp.headers.set('Some-header', 'some-value');
  return new Response(body, {
    headers: resp.headers,
    status: resp.status,
    statusText: resp.statusText,
  });
}

console.log('encoding 1k string');
await runBenchmarks(
  {
    'encode 1k': () => encode(t1k),
    'reencode 1k': () => reencode(t1k),
  },
  { time: 2000 }
);

console.log('encoding 10k string');
await runBenchmarks(
  {
    'encode 10k': () => encode(t10k),
    'reencode 10k': () => reencode(t10k),
  },
  { time: 3000 }
);

console.log('encoding 100k string');
await runBenchmarks(
  {
    'encode 100k': () => encode(t100k),
    'reencode 100k': () => reencode(t100k),
  },
  { time: 5000 }
);
