type Registration<T> = {
  matcher: (subject: string) => null | Record<string, string>;
  methodFilter: (subject: string) => boolean;
  target: T;
};

type Result<T> = Array<[T, Record<string, string>]>;

export default class RouteMatcher<Target extends any> {
  registered: Registration<Target>[] = [];
  match(method: string, subject: string, fallbacks?: Target[]) {
    const matched: Result<Target> = [];
    for (const reg of this.registered) {
      if (!reg.methodFilter(method)) {
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
  add(method: string, path: string | RegExp, target: Target): this {
    let methodFilter: (method: string) => boolean;
    if (method === 'ALL') {
      methodFilter = () => true;
    } else {
      // must be a string
      methodFilter = m => m === method;
    }
    if (path instanceof RegExp) {
      this.registered.push({
        methodFilter,
        matcher: subject => {
          const match = subject.match(path);
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
    } else if (path === '/*') {
      this.registered.push({
        methodFilter,
        matcher: subject => ({ '0': subject.slice(1) }),
        target,
      });
      return this;
    } else if (path === '*') {
      this.registered.push({
        methodFilter,
        matcher: subject => ({ '0': subject }),
        target,
      });
      return this;
    }
    // if (path.split('*').length > 1) {
    //   throw new Error('Only one wildcard is allowed');
    // }
    let matchIdx = 0;
    const segments: string[] = [];
    const keys: Array<string | number> = [];
    const parts = path.split(/(\*|:\w+)/);
    const prefix = parts[0];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === '*') {
        const isEndStar =
          i === parts.length - 2 && parts[parts.length - 1] === '';
        segments.push(isEndStar ? '(.+)' : '([^/]+)');
        keys.push(matchIdx++);
      } else if (part.at(0) === ':') {
        keys.push(part.slice(1));
        segments.push('([^/]+)');
      } else {
        segments.push(part);
      }
    }
    if (segments.length === 0) {
      this.registered.push({
        methodFilter,
        matcher: subject => (subject === path ? {} : null),
        target,
      });
      return this;
    }
    const regex = new RegExp(`^${segments.join('')}$`);
    this.registered.push({
      methodFilter,
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
    // else {
    //   const prefix = segments[0];
    //   const keys: string[] = [];
    //   let regExp: string;
    //   let idx = 0;
    //   for (const segment of segments.slice(1)) {
    //
    //   }
    //   const matcher = (subject: string) => {
    //     if (!subject.startsWith(prefix)) {
    //       return null;
    //     }
    //
    //   }
    //   return this;
    // }
  }
}

//
//
//
//
//
//
// function always(requestPath: string) {
//   return {
//     path: '*',
//     index: 0,
//     params: { 0: requestPath },
//   };
// }
//
// function normalizePath(path: string | RegExp) {
//   if (path instanceof RegExp) {
//     return path;
//   }
//   let i = 0;
//   path = path.replace(/\/\*\?/g, () => {
//     return `/{*slash_wildcard_${i++}}`;
//   });
//   path = path.replace(/\/\*/g, () => {
//     return `/*slash_wildcard_${i++}`;
//   });
//   return path;
// }
//
// function normalizeParams(params: Record<string, string>) {
//   const normalizedParams: Record<string, string> = {};
//   for (const key in params) {
//     if (!Object.prototype.hasOwnProperty.call(params, key)) {
//       continue;
//     }
//     const keyMatch = key.match(/^slash_wildcard_(\d+)$/);
//     if (keyMatch) {
//       normalizedParams[keyMatch[1]] = Array.isArray(params[key])
//         ? params[key][0]
//         : params[key];
//     } else {
//       normalizedParams[key] = params[key];
//     }
//   }
//   return normalizedParams;
// }
//
// export default class PathMatcher<Target extends any> {
//   registered: Registration<Target>[] = [];
//   add(path: string | RegExp, target: Target) {
//     const effectivePath = normalizePath(path);
//     const matcher =
//       effectivePath === '*'
//         ? always
//         : match(effectivePath, {
//             decode: decodeURIComponent,
//             sensitive: true,
//           });
//     this.registered.push({
//       // @ts-expect-error
//       matcher,
//       target,
//     });
//   }
//   match(
//     path: string,
//     filter?: (target: Target) => boolean,
//     fallbacks?: Function[]
//   ) {
//     const matched: Array<{ target: any; params: Record<string, string> }> = [];
//     for (const reg of this.registered) {
//       const result = reg.matcher(path);
//       if (result && (!filter || filter(reg.target))) {
//         matched.push({
//           target: reg.target,
//           params: normalizeParams(result.params),
//         });
//       }
//     }
//     if (fallbacks) {
//       for (const fb of fallbacks) {
//         matched.push({ target: { handler: fb }, params: {} });
//       }
//     }
//     return matched;
//   }
// }
