import { describe, expect, it } from 'bun:test';
import ms from './ms';

describe('ms', () => {
  it('should parse milliseconds', () => {
    expect(ms('10milliseconds')).toBe(10);
    expect(ms('10milliseconds')).toBe(10);
    expect(ms('10msecs')).toBe(10);
    expect(ms('10msec')).toBe(10);
    expect(ms('10ms')).toBe(10);
  });
  it('should parse seconds', () => {
    expect(ms('5.5seconds')).toBe(5500);
    expect(ms('5.5second')).toBe(5500);
    expect(ms('5.5secs')).toBe(5500);
    expect(ms('5.5sec')).toBe(5500);
    expect(ms('5.5s')).toBe(5500);
  });
  it('should parse minutes', () => {
    expect(ms('-2minutes')).toBe(-2 * 60 * 1000);
    expect(ms('-2minute')).toBe(-2 * 60 * 1000);
    expect(ms('-2mins')).toBe(-2 * 60 * 1000);
    expect(ms('-2min')).toBe(-2 * 60 * 1000);
    expect(ms('-2m')).toBe(-2 * 60 * 1000);
  });
});
