import { LRUCache } from 'lru-cache';
import RouteMatcher from '../RouteMatcher/RouteMatcher';

export default class MatcherWithCache<
  Target = any,
> extends RouteMatcher<Target> {
  cache: LRUCache<string, any>;
  constructor(size: number = 4000) {
    super();
    this.cache = new LRUCache<string, any>({ max: size });
  }
  match(method: string, subject: string, fallbacks?: Target[]) {
    const key = `${method}:${subject}`;
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    const result = super.match(method, subject, fallbacks);
    this.cache.set(key, result);
    return result;
  }
}
