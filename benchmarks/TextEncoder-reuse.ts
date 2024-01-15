import { runBenchmarks } from './runBenchmarks.ts';

/*
Conclusion:
Reusing one TextEncoder instance is
320x faster than instantiating a new TextEncoder every time
*/

const textEncoder = new TextEncoder();

function reuse(data: string) {
  return textEncoder.encode(data);
}

function alwaysNew(data: string) {
  const textEncoder = new TextEncoder();
  return textEncoder.encode(data);
}

const ascii = 'Bunshine 0123456789 {}[]\\|;\',./:"<>?~';
const accents = 'Ƀŭṇșḧḭȵė rocks';
const emoji = '☀️Bunshine on 🧅Bun';
const fakeData = [
  // short text
  ...Array(100).fill(ascii),
  ...Array(10).fill(accents),
  ...Array(1).fill(emoji),
  // medium text
  ...Array(100).fill(ascii.repeat(5)),
  ...Array(10).fill(accents.repeat(5)),
  ...Array(1).fill(emoji.repeat(5)),
  // long text
  ...Array(100).fill(ascii.repeat(150)),
  ...Array(10).fill(accents.repeat(150)),
  ...Array(1).fill(emoji.repeat(150)),
];

function testWithFakeData(func: (data: string) => Uint8Array) {
  for (const data of fakeData) {
    func(data);
  }
}

await runBenchmarks(
  {
    'reusing one instance': () => testWithFakeData(reuse),
    'instantiating every time': () => testWithFakeData(alwaysNew),
  },
  { time: 10000 }
);
