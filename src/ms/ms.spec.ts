import { describe, expect, it } from 'bun:test';
import ms from './ms';

describe('ms', () => {
  it('should parse milliseconds', () => {
    expect(ms('10 milliseconds')).toBe(10);
    expect(ms('10milliseconds')).toBe(10);
    expect(ms('10milliseconds')).toBe(10);
    expect(ms('10msecs')).toBe(10);
    expect(ms('10msec')).toBe(10);
    expect(ms('10ms')).toBe(10);
  });
  it('should parse seconds', () => {
    expect(ms('5.5 seconds')).toBe(5500);
    expect(ms('5.5seconds')).toBe(5500);
    expect(ms('5.5second')).toBe(5500);
    expect(ms('5.5secs')).toBe(5500);
    expect(ms('5.5sec')).toBe(5500);
    expect(ms('5.5s')).toBe(5500);
  });
  it('should parse minutes', () => {
    expect(ms('-2 minutes')).toBe(-2 * 60 * 1000);
    expect(ms('-2minutes')).toBe(-2 * 60 * 1000);
    expect(ms('-2minute')).toBe(-2 * 60 * 1000);
    expect(ms('-2mins')).toBe(-2 * 60 * 1000);
    expect(ms('-2min')).toBe(-2 * 60 * 1000);
    expect(ms('-2m')).toBe(-2 * 60 * 1000);
  });
  it('should parse hours', () => {
    expect(ms('88 hours')).toBe(88 * 60 * 60 * 1000);
    expect(ms('88hours')).toBe(88 * 60 * 60 * 1000);
    expect(ms('88hour')).toBe(88 * 60 * 60 * 1000);
    expect(ms('88hrs')).toBe(88 * 60 * 60 * 1000);
    expect(ms('88hr')).toBe(88 * 60 * 60 * 1000);
    expect(ms('88h')).toBe(88 * 60 * 60 * 1000);
  });
  it('should parse days', () => {
    expect(ms('30 days')).toBe(30 * 24 * 60 * 60 * 1000);
    expect(ms('30days')).toBe(30 * 24 * 60 * 60 * 1000);
    expect(ms('30day')).toBe(30 * 24 * 60 * 60 * 1000);
    expect(ms('30d')).toBe(30 * 24 * 60 * 60 * 1000);
  });
  it('should parse weeks', () => {
    expect(ms('2 weeks')).toBe(14 * 24 * 60 * 60 * 1000);
    expect(ms('2weeks')).toBe(14 * 24 * 60 * 60 * 1000);
    expect(ms('2week')).toBe(14 * 24 * 60 * 60 * 1000);
    expect(ms('2w')).toBe(14 * 24 * 60 * 60 * 1000);
  });
  it('should parse months', () => {
    expect(ms('6 months')).toBe(6 * 30 * 24 * 60 * 60 * 1000);
    expect(ms('6months')).toBe(6 * 30 * 24 * 60 * 60 * 1000);
    expect(ms('6month')).toBe(6 * 30 * 24 * 60 * 60 * 1000);
    expect(ms('6mo')).toBe(6 * 30 * 24 * 60 * 60 * 1000);
    expect(ms('6M')).toBe(6 * 30 * 24 * 60 * 60 * 1000);
  });
  it('should parse years', () => {
    expect(ms('2 years')).toBe(2 * 365.25 * 24 * 60 * 60 * 1000);
    expect(ms('2years')).toBe(2 * 365.25 * 24 * 60 * 60 * 1000);
    expect(ms('2year')).toBe(2 * 365.25 * 24 * 60 * 60 * 1000);
    expect(ms('2yr')).toBe(2 * 365.25 * 24 * 60 * 60 * 1000);
    expect(ms('2y')).toBe(2 * 365.25 * 24 * 60 * 60 * 1000);
  });
  it('should parse years', () => {
    const thrower = () => ms('2 foo');
    expect(thrower).toThrow();
  });
});
