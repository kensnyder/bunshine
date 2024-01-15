import { gzipString } from '../src/gzip/gzip.ts';
import { runBenchmarks } from './runBenchmarks.ts';

/*
Conclusion:
Gzip is 2.94x slower than regular responses and uses more CPU.
Choosing it is a tradeoff between bandwidth vs. speed+CPU time.
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
const html = await fetch('https://www.npmjs.com/package/bunshine');
const data1 = await fetch('https://jsonplaceholder.typicode.com/todos').then(
  res => res.json()
);
const data2 = await fetch('https://jsonplaceholder.typicode.com/posts/30').then(
  res => res.json()
);

const payloads = [
  // short text
  ...Array(1).fill(css),
  ...Array(2).fill(js),
  ...Array(10).fill(html),
  ...Array(100).fill(data1),
  ...Array(100).fill(data2),
];

function testWithFakeData(func: (data: string) => Response) {
  for (const payload of payloads) {
    func(payload);
  }
}

await runBenchmarks(
  {
    'gizipping response string': () => testWithFakeData(gzippedResponse),
    'regular response string': () => testWithFakeData(normalResponse),
  },
  { time: 10000 }
);
