import { defaultHashCalculator } from '../src/middleware/etags/etags.ts';
import { runBenchmarks } from './runBenchmarks.ts';

/*
Conclusions:

etag hash calculation is fast:
1k html:    1 µs
10k html:   3 µs
100k html: 24 µs
*/

// some data!
const html = await fetch('https://www.npmjs.com/package/bunshine').then(res =>
  res.text()
);
const t1k = html.slice(1000, 2000);
const t10k = html.slice(1000, 11000);
const t100k = html.slice(1000, 101000);

async function getResponse(input: string) {
  return new Response(input, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}

async function computeEtags(input: string) {
  await defaultHashCalculator(
    // @ts-ignore
    null,
    await getResponse(input)
  );
}

await runBenchmarks(
  {
    'etags 1k': () => computeEtags(t1k),
    'etags 10k': () => computeEtags(t10k),
    'etags 100k': () => computeEtags(t100k),
  },
  { time: 3000 }
);
