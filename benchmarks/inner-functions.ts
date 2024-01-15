import { runBenchmarks } from './runBenchmarks.ts';

/*
Conclusion:
classes are
1.03x faster than inner functions
*/

class TheClass {
  max: number;
  constructor({ max }: { max: number }) {
    this.max = max;
  }
  addUp() {
    let sum = 0;
    for (let i = 0; i < this.max; i++) {
      sum += i;
    }
    return sum;
  }
  noop() {}
}

await runBenchmarks(
  {
    'inner functions': () => {
      const spec = { max: 10000 };
      function addUp() {
        let sum = 0;
        for (let i = 0; i < spec.max; i++) {
          sum += i;
        }
        return sum;
      }
      function noop() {}
      addUp();
    },
    classes: () => {
      const spec = { max: 10000 };
      const theClass = new TheClass(spec);
      theClass.addUp();
    },
  },
  { time: 15000 }
);
