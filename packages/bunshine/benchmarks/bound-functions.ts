import { runBenchmarks } from './runBenchmarks.ts';

/*
Conclusion:
Class functions are
1.03x faster than bound functions
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

class TheClassBound {
  max: number;
  constructor({ max }: { max: number }) {
    this.max = max;
  }
  addUp = () => {
    let sum = 0;
    for (let i = 0; i < this.max; i++) {
      sum += i;
    }
    return sum;
  };
  noop = () => {};
}

await runBenchmarks(
  {
    'bound functions': () => {
      const spec = { max: 10000 };
      const theClass = new TheClassBound(spec);
      theClass.addUp();
    },
    'class functions': () => {
      const spec = { max: 10000 };
      const theClass = new TheClass(spec);
      theClass.addUp();
    },
  },
  { time: 5000 }
);
