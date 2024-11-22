import { describe, expect, it } from 'bun:test';
import parseRangeHeader from './parseRangeHeader';

describe('parseRangeHeader', () => {
  it('should handle null header', () => {
    const result = parseRangeHeader({
      rangeHeader: null,
      totalFileSize: 1000,
    });
    expect(result).toEqual({
      slice: null,
      contentLength: 1000,
      status: 200,
    });
  });
  it('should handle empty header', () => {
    const result = parseRangeHeader({
      rangeHeader: '',
      totalFileSize: 1000,
    });
    expect(result).toEqual({
      slice: null,
      contentLength: 1000,
      status: 200,
    });
  });
  it('should return 416 on invalid header', () => {
    const result = parseRangeHeader({
      rangeHeader: 'foobar',
      totalFileSize: 1000,
    });
    expect(result).toEqual({
      slice: null,
      contentLength: null,
      status: 416,
    });
  });
  it('should return 416 on invalid byte range', () => {
    const result = parseRangeHeader({
      rangeHeader: 'bytes=a-z',
      totalFileSize: 1000,
    });
    expect(result).toEqual({
      slice: null,
      contentLength: null,
      status: 416,
    });
  });
  it('should return 416 on out-of-bounds byte range', () => {
    const result = parseRangeHeader({
      rangeHeader: 'bytes=0-5000',
      totalFileSize: 1000,
    });
    expect(result).toEqual({
      slice: null,
      contentLength: null,
      status: 416,
    });
  });
  it('should return 200 on full byte range', () => {
    const result = parseRangeHeader({
      rangeHeader: 'bytes=0-999',
      totalFileSize: 1000,
    });
    expect(result).toEqual({
      slice: null,
      contentLength: 1000,
      status: 200,
    });
  });
  it('should return 206 on first bytes', () => {
    const result = parseRangeHeader({
      rangeHeader: 'bytes=0-99',
      totalFileSize: 1000,
    });
    expect(result).toEqual({
      slice: { start: 0, end: 99 },
      contentLength: 100,
      status: 206,
    });
  });
  it('should return 206 on middle bytes', () => {
    const result = parseRangeHeader({
      rangeHeader: 'bytes=100-199',
      totalFileSize: 1000,
    });
    expect(result).toEqual({
      slice: { start: 100, end: 199 },
      contentLength: 100,
      status: 206,
    });
  });
  it('should return 206 on end bytes', () => {
    const result = parseRangeHeader({
      rangeHeader: 'bytes=900-999',
      totalFileSize: 1000,
    });
    expect(result).toEqual({
      slice: { start: 900, end: 999 },
      contentLength: 100,
      status: 206,
    });
  });
  it('should return 206 on open-ended request', () => {
    const result = parseRangeHeader({
      rangeHeader: 'bytes=900-',
      totalFileSize: 1000,
      defaultChunkSize: 1000,
    });
    expect(result).toEqual({
      slice: { start: 900, end: 999 },
      contentLength: 100,
      status: 206,
    });
  });
  it('should return 206 on open-ended request (chunk is smaller)', () => {
    const result = parseRangeHeader({
      rangeHeader: 'bytes=900-',
      totalFileSize: 1000,
      defaultChunkSize: 10,
    });
    expect(result).toEqual({
      slice: { start: 900, end: 909 },
      contentLength: 10,
      status: 206,
    });
  });
  it('should return 206 on last bytes', () => {
    const result = parseRangeHeader({
      rangeHeader: 'bytes=-100',
      totalFileSize: 1000,
    });
    expect(result).toEqual({
      slice: { start: 900, end: 999 },
      contentLength: 100,
      status: 206,
    });
  });
});
