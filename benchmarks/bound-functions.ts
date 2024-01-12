import { bench, group, run } from 'mitata';

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

// These 2 approaches perform within 1% to 3% of each other
group('2 functions', () => {
  bench('bound class', () => {
    const spec = { max: 10000 };
    const theClass = new TheClassBound(spec);
    theClass.addUp();
  });
  bench('class', () => {
    const spec = { max: 10000 };
    const theClass = new TheClass(spec);
    theClass.addUp();
  });
});

await run();
