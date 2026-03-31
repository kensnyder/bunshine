const s = 1000;
const m = s * 60;
const h = m * 60;
const d = h * 24;
const w = d * 7;
const y = d * 365.25;

export default function ms(expression: string | number) {
  if (typeof expression === 'number') {
    // consider a numeric interval to be milliseconds
    return expression;
  }
  const match = /^(-?(?:\d+)?\.?\d+) *([a-zA-Z]+)$/i.exec(expression);
  if (!match) {
    throw new Error(
      `Invalid interval format "${expression}" expected expression like "1d" or "1h"`
    );
  }
  const n = parseFloat(match[1]);
  let type = match[2] === 'M' ? 'M' : match[2].toLowerCase();
  if (type.length > 2 && type.endsWith('s')) {
    type = type.slice(0, -1);
  }
  switch (type) {
    case 'year':
    case 'yr':
    case 'y':
      return n * y;
    case 'month':
    case 'mo':
    case 'M':
      return n * d * 30;
    case 'week':
    case 'w':
      return n * w;
    case 'day':
    case 'd':
      return n * d;
    case 'hour':
    case 'hr':
    case 'h':
      return n * h;
    case 'minute':
    case 'min':
    case 'm':
      return n * m;
    case 'second':
    case 'sec':
    case 's':
      return n * s;
    case 'millisecond':
    case 'msec':
    case 'ms':
      return n;
    default:
      throw new Error(
        `Invalid interval unit "${type}" expected unit like "d" or "day"`
      );
  }
}
