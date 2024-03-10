import {
  Bench,
  type Fn,
  type Options,
  type Task,
  type TaskResult,
} from 'tinybench';
import type { Merge } from 'type-fest';

type CompletedTask = Merge<Task, { result: TaskResult }>;

export async function runBenchmarks<Signature extends Function = () => any>(
  tasks: Record<string, Signature>,
  options: Options
) {
  const bench = new Bench(options);
  let count = 0;
  for (const [name, fn] of Object.entries(tasks)) {
    bench.add(name, fn as unknown as Fn);
    count++;
  }

  process.stdout.write('Warming up...');
  await bench.warmup();
  console.log('DONE');
  if (options.time) {
    process.stdout.write(
      `Running ${count} tests for ${options.time}ms each...`
    );
  } else if (options.iterations) {
    process.stdout.write(
      `Running ${count} tests ${options.iterations} times each...`
    );
  }
  await bench.run();
  console.log('DONE');

  _displayResults(bench.tasks);
}

function _displayResults(tasks: Task[]) {
  const table: Array<{
    Rank: string;
    Speed: string;
    'Task Name': string;
    'Avg Time': string;
    Margin: string;
    Samples: string;
  }> = [];
  const completed: CompletedTask[] = [];
  for (const task of tasks) {
    if (task.result !== undefined) {
      completed.push(task as CompletedTask);
    }
  }
  completed.sort((a, b) => b.result.hz - a.result.hz);
  let rank = 1;
  let last = completed[completed.length - 1];
  for (const task of completed) {
    table.push({
      Rank: '#' + rank++,
      Speed: _calcSpeed(task.result.hz, last.result.hz),
      'Task Name': task.name,
      'Avg Time': _formatTime(task.result.mean),
      Margin: `±${task.result.rme.toFixed(2)}%`,
      Samples: task.result.samples.length.toLocaleString(),
    });
  }
  console.table(table);
}

function _formatTime(ms: number) {
  if (ms > 60000) {
    return (ms / 60000).toFixed(3) + ' m';
  } else if (ms > 1000) {
    return (ms / 1000).toFixed(3) + ' s';
  } else if (ms < 0.001) {
    return (ms * 1000000).toFixed(3) + ' ns';
  } else if (ms < 1) {
    return (ms * 1000).toFixed(3) + ' µs';
  } else {
    return ms.toFixed(3) + ' ms';
  }
}

function _calcSpeed(thisHz: number, slowestHz: number) {
  return (thisHz / slowestHz).toFixed(2) + 'x';
}
