import { FileRouteShape } from '../HttpRouter/HttpRouter';

type Registration<T> = {
  matcher: (subject: string) => null | Record<string, string>;
  pattern: string;
  regex: RegExp;
  methodFilter: null | ((subject: string) => boolean);
  target: T;
};

type Result<T> = Array<[T, Record<string, string>]>;

export default class RouteMatcher<Target extends any> {
  registered: Registration<Target>[] = [];
  match(method: string, subject: string, fallbacks?: Target[]) {
    const matched: Result<Target> = [];
    for (const reg of this.registered) {
      if (reg.methodFilter && !reg.methodFilter(method)) {
        continue;
      }
      const params = reg.matcher(subject);
      if (params) {
        matched.push([reg.target, params]);
      }
    }
    if (fallbacks) {
      for (const fb of fallbacks) {
        matched.push([fb, {}]);
      }
    }
    return matched;
  }
  add(method: string, pattern: string | RegExp, target: Target): this {
    let methodFilter: null | ((method: string) => boolean);
    if (method === 'ALL') {
      methodFilter = null;
    } else {
      // must be a string
      methodFilter = m => m === method;
    }
    if (pattern instanceof RegExp) {
      this.registered.push({
        methodFilter,
        pattern: String(pattern),
        regex: pattern,
        matcher: subject => {
          const match = subject.match(pattern);
          if (!match) {
            return null;
          }
          let idx = 0;
          const params: Record<string, string> = {};
          for (const m of match.slice(1)) {
            params[idx++] = m;
          }
          return params;
        },
        target,
      });
      return this;
    } else if (pattern === '/*') {
      this.registered.push({
        methodFilter,
        pattern,
        regex: /^\/(.+)$/,
        matcher: subject => ({ '0': subject.slice(1) }),
        target,
      });
      return this;
    } else if (pattern === '*') {
      this.registered.push({
        methodFilter,
        pattern,
        regex: /^(.+)$/,
        matcher: subject => ({ '0': subject }),
        target,
      });
      return this;
    }
    let matchIdx = 0;
    const segments: string[] = [];
    const keys: Array<string | number> = [];
    // split on * or :name, capturing the delimiter and the character after it
    const parts = pattern.split(/(\*(.|$)|:\w+(\W|$))/);
    // we have a fixed path
    if (parts.length === 1) {
      this.registered.push({
        methodFilter,
        pattern,
        regex: new RegExp(`^${regexEsc(pattern)}$`),
        matcher: subject => (subject === pattern ? {} : null),
        target,
      });
      return this;
    }
    // we have some capturing patterns
    const prefix = parts[0];
    for (let i = 0; i < parts.length; i += 4) {
      segments.push(regexEsc(parts[i] || ''));
      if (parts[i + 1] === undefined) {
        // no other capturing patterns
        break;
      }
      const [segment, key] = getPathSegment(
        parts[i + 1],
        parts[i + 2] || parts[i + 3]
      );
      segments.push(segment);
      keys.push(key || matchIdx++);
    }
    const regex = new RegExp(`^${segments.join('')}$`);
    this.registered.push({
      methodFilter,
      pattern,
      regex,
      matcher: subject => {
        if (!subject.startsWith(prefix)) {
          return null;
        }
        const match = subject.match(regex);
        if (!match) {
          return null;
        }
        const params: Record<string, string> = {};
        let idx = 1;
        for (const key of keys) {
          params[key] = match[idx++];
        }
        return params;
      },
      target,
    });
    return this;
  }
  detectPotentialDos(detector: any, config?: any) {
    for (const reg of this.registered) {
      if (detector(reg.regex, config).safe === false) {
        console.warn(
          `Bunshine: Potential ReDoS detected for pattern "${reg.pattern}" => ${reg.regex.source}`
        );
      }
    }
  }
  /**
   * Sort routes by specificity.
   * @example: /users/me has higher specificity than /users/:id.
   * If the latter were registered first, the former would never be invoked.
   * @param a The first route
   * @param b The second route
   */
  static sortBySpecificity(a: FileRouteShape, b: FileRouteShape) {
    const A = analyzeSpecificity(a.path);
    const B = analyzeSpecificity(b.path);
    // Fewer params is more specific
    if (A.paramsCount !== B.paramsCount) {
      return A.paramsCount - B.paramsCount;
    }
    // More static content length is more specific
    if (A.routeLength !== B.routeLength) {
      return B.routeLength - A.routeLength;
    }
    // More segments is more specific
    if (A.segmentCount !== B.segmentCount) {
      return B.segmentCount - A.segmentCount;
    }
    // Stable tie-breaker: alphabetical order
    return a.path.localeCompare(b.path);
  }
}

function regexEsc(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getPathSegment(identifier: string, delimiter: string) {
  if (identifier.at(-1) === delimiter) {
    identifier = identifier.slice(0, -1);
  }
  if (delimiter === ']') {
    delimiter = '\\]';
  }
  const classes = delimiter === undefined ? '.' : `[^${delimiter}]`;
  const escapedDelimiter = regexEsc(delimiter || '');
  const segment = `(${classes}+)${escapedDelimiter}`;
  const name = identifier.slice(1);
  return [segment, name];
}

// Higher specificity means:
// - fewer parameter segments (e.g., :id)
// - more and longer static segments
// - more segments when other metrics tie
function analyzeSpecificity(p: string) {
  const segments = p.split('/').filter(Boolean);
  let paramsCount = 0;
  let staticCount = 0;
  let routeLength = 0;
  for (const s of segments) {
    if (s.startsWith(':')) {
      paramsCount++;
    } else {
      staticCount++;
      routeLength += s.length;
    }
  }
  return {
    paramsCount,
    staticCount,
    routeLength,
    segmentCount: segments.length,
  };
}
