import { describe, expect, it, spyOn } from 'bun:test';
import withTryCatch from './withTryCatch';

describe('withTryCatch utility', () => {
  it('should return normally', async () => {
    const fn = withTryCatch({
      label: 'test',
      defaultReturn: false,
      func: () => true,
    });
    expect(fn()).toBe(true);
  });
  it('should return normally - promise', async () => {
    const fn = withTryCatch({
      label: 'test',
      defaultReturn: false,
      func: () => Promise.resolve(true),
    });
    expect(await fn()).toBe(true);
  });
  it('should swallow thrown errors', async () => {
    const errorSpy = spyOn(console, 'error', () => {});
    const fn = withTryCatch({
      label: 'test',
      defaultReturn: 'hello',
      func: () => {
        throw new Error('My error!');
      },
    });
    expect(await fn()).toBe('hello');
    expect(errorSpy).toHaveBeenCalledWith('test: My error!');
    errorSpy.mockRestore();
  });
});
