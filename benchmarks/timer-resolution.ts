import { runBenchmarks } from './runBenchmarks.ts';

/*
Conclusion:
performance.now() is actually 3.7x faster than +new Date,
taking about 28 nanoseconds.

Also, Converting a Date object to a number takes about 50 nanoseconds.
*/

function perf() {
  return performance.now();
}

function plusDate() {
  return +new Date();
}

function date() {
  return new Date();
}

await runBenchmarks(
  {
    'performance.now()': perf,
    '+new Date()': plusDate,
    'new Date()': date,
  },
  { time: 1000 }
);
