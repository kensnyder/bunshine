import { runBenchmarks } from './runBenchmarks.ts';

/*
Conclusions:
The cost of a single performance.now() call is in the tens of nanoseconds.

performance.now() is actually 2.11x faster than +new Date,
with Date.now() in second place, 1.91x faster than +new Date.

Also, converting a Date object to a number takes around 50 nanoseconds.
*/

await runBenchmarks(
  {
    'performance.now()': () => performance.now(),
    'Date.now()': () => Date.now(),
    '+new Date()': () => +new Date(),
    'new Date()': () => new Date(),
  },
  { time: 2000 }
);
