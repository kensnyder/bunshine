export type RangeInformation = {
  rangeHeader?: string | null | false;
  totalFileSize: number;
  defaultChunkSize?: number;
};

export default function parseRangeHeader({
  rangeHeader,
  totalFileSize,
  defaultChunkSize = 3 * 1024 ** 2, // 3MB chunk if byte range is open ended
}: RangeInformation) {
  if (!rangeHeader) {
    // range header missing or empty
    return { slice: null, contentLength: totalFileSize, status: 200 };
  }
  if (totalFileSize === 0) {
    // server should respond with "content-range: bytes */0"
    return { slice: null, contentLength: 0, status: 416 };
  }
  // only support single ranges
  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/i);
  if (!match || (match[1] === '' && match[2] === '')) {
    // server can decide whether to return 416 or ignore presence of range header
    return { slice: null, contentLength: null, status: 416 };
  }
  let start: number;
  let end: number;
  if (match[1] === '') {
    // e.g. bytes=-100
    start = totalFileSize - parseInt(match[2]);
    end = totalFileSize - 1;
  } else if (match[2] === '') {
    // e.g. bytes=100-
    start = parseInt(match[1]);
    end = Math.min(start + defaultChunkSize - 1, totalFileSize - 1);
  } else {
    // e.g. bytes=100-199 or bytes=0-199
    start = parseInt(match[1]);
    end = parseInt(match[2]);
  }
  if (start > totalFileSize - 1 || end > totalFileSize - 1) {
    return { slice: null, contentLength: null, status: 416 };
  }
  if (start === 0 && end === totalFileSize - 1) {
    return { slice: null, contentLength: totalFileSize, status: 200 };
  }
  return { slice: { start, end }, contentLength: end - start + 1, status: 206 };
}
