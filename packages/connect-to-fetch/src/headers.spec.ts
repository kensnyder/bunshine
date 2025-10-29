import { describe, expect, it } from 'bun:test';
import { flattenHeaders } from './headers';

describe('flattenHeaders', () => {
  it('should allow empty headers', async () => {
    const flat = flattenHeaders({});
    expect(flat).toEqual([]);
  });
  it('should set basic headers', async () => {
    const flat = flattenHeaders({
      'Content-Type': 'text/html',
      'X-Test': 'true',
    });
    expect(flat).toEqual([
      ['Content-Type', 'text/html'],
      ['X-Test', 'true'],
    ]);
  });
  it('should set array-based headers', async () => {
    const flat = flattenHeaders({
      'Content-Type': 'text/html',
      Link: ['one', 'two'],
    });
    expect(flat).toEqual([
      ['Content-Type', 'text/html'],
      ['Link', 'one'],
      ['Link', 'two'],
    ]);
  });
  it('should ignore undefined headers', async () => {
    const flat = flattenHeaders({
      'Content-Type': 'text/html',
      'x-undefined': undefined,
    });
    expect(flat).toEqual([['Content-Type', 'text/html']]);
  });
});
