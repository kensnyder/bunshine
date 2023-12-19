// import { LRUCache } from 'lru-cache';

type Match<Payload> = {
  index: number;
  payload: Payload;
} | null;

interface Leaf<Payload> {
  match: (segment: string, params: Record<string, string>) => Match<Payload>;
}

type StarProps<Payload> = { index: number; payload: Payload };

class StarLeaf<Payload> implements Leaf<Payload> {
  props: StarProps<Payload>;
  constructor(props: StarProps<Payload>) {
    this.props = props;
  }
  match(segment: string, params: Record<string, string>): Match<Payload> {
    let i = 0;
    while (String(i) in params) {
      i++;
    }
    params[String(i)] = segment;
    return {
      index,
      payload: this.props.payload,
    };
  }
}

type NamedProps<Payload> = {
  index: number;
  paramName: string;
  payload: Payload;
};

class NamedLeaf<Payload> implements Leaf<Payload> {
  props: NamedProps<Payload>;
  segmentHandlers: Array<(seg: string) => Record<string, string> | null> = [];
  constructor(props: NamedProps<Payload>) {
    this.props = props;
    if (this.props.paramName.includes('/')) {
      let starCount = 0;
      const segments = this.props.paramName.split('/');
      for (const segment of segments) {
        if (segment === '*') {
          const key = String(starCount++);
          this.segmentHandlers.push(seg => ({ [key]: seg }));
          continue;
        }
        const matches = segment.match(/^:(\d+)/);
        if (matches) {
          const key = matches[1];
          this.segmentHandlers.push(seg => ({ [key]: seg }));
          continue;
        }
        const segName = segment;
        this.segmentHandlers.push(seg => {
          if (seg === segName) {
            return {};
          }
          return null;
        });
      }
    }
  }
  match(segment: string, params: Record<string, string>): Match<Payload> {
    if (this.segmentHandlers.length === 0) {
      params[this.props.paramName] = segment;
    } else {
      for (const segmentHandler of this.segmentHandlers) {
        const match = segmentHandler(segment);
      }
    }
    return {
      index,
      payload: this.props.payload,
    };
  }
}

type RegexProps<Payload> = {
  index: number;
  regex: RegExp;
  payload: Payload;
};

class RegexLeaf<Payload> implements Leaf<Payload> {
  props: RegexProps<Payload>;
  constructor(props: RegexProps<Payload>) {
    this.props = props;
  }
  match(segment: string, params: Record<string, string>): Match<Payload> {
    const matches = segment.match(this.props.regex);
    if (!matches) {
      return null;
    }
    for (let i = 0, len = matches.length; i < len; i++) {
      params[String(i)] = matches[i];
    }
    return {
      index,
      payload: this.props.payload,
    };
  }
}

type LiteralProps<Payload> = {
  index: number;
  literal: string;
  payload: Payload;
};

class LiteralLeaf<Payload> implements Leaf<Payload> {
  props: LiteralProps<Payload>;
  constructor(props: LiteralProps<Payload>) {
    this.props = props;
  }
  match(segment: string, params: Record<string, string>): Match<Payload> {
    if (segment !== this.props.literal) {
      return null;
    }
    return {
      index,
      payload: this.props.payload,
    };
  }
}

type Branch<Payload> = Record<string, Node<Payload>>;

let index = 0;
export class Node<Payload> {
  depth: number;
  branches: Branch<Payload> = {};
  leaves: Array<Leaf<Payload>> = [];
  constructor(depth: number = 0) {
    this.depth = depth;
  }
  add(path: string | RegExp, payload: Payload) {
    if (path instanceof RegExp) {
      this.leaves.push(
        new RegexLeaf<Payload>({
          index: index++,
          regex: path,
          payload,
        })
      );
      return;
    }
    if (path.startsWith('/')) {
      path = path.slice(1);
    }
    if (path === '*') {
      this.leaves.push(
        new StarLeaf<Payload>({
          index: index++,
          payload,
        })
      );
      return;
    }
    const slashIdx = path.indexOf('/');
    if (slashIdx === -1) {
      const matches = path.match(/^:(\w+)/);
      if (matches) {
        this.leaves.push(
          new NamedLeaf<Payload>({
            index: index++,
            paramName: matches[1],
            payload,
          })
        );
      } else {
        this.leaves.push(
          new LiteralLeaf<Payload>({ index: index++, literal: path, payload })
        );
      }
      return;
    }
    const branchName = path.slice(0, slashIdx);
    const segments = path.slice(slashIdx + 1);
    const child = new Node<Payload>(this.depth + 1);
    child.add(segments, payload);
    this.branches[branchName] = child;
  }
  match(segments: string[], params: Record<string, string>) {
    const found: Array<Found<Payload>> = [];
    if (segments.length === 1) {
      for (const leaf of this.leaves) {
        const match = leaf.match(segments[0], params);
        if (!match) {
          continue;
        }
        found.push({
          index: match.index,
          payload: match.payload,
          params,
        });
      }
    } else if (this.branches[segments[0]]) {
      found.push(
        ...this.branches[segments[0]].match(segments.slice(1), { ...params })
      );
    } else {
      const joined = segments.join('/');
      for (const leaf of this.leaves) {
        const match = leaf.match(joined, params);
        if (!match) {
          continue;
        }
        found.push({
          index: match.index,
          payload: match.payload,
          params,
        });
      }
    }
    return found;
  }
}

type Found<Payload> = {
  index: number;
  payload: Payload;
  params: Record<string, string>;
};

export class RouteMatcher<Payload> {
  node: Node<Payload>;
  constructor() {
    this.node = new Node<Payload>(0);
  }
  add(path: string, payload: Payload) {
    this.node.add(path, payload);
  }
  match(path: string) {
    const segments = path.split('/');
    if (path.startsWith('/')) {
      segments.shift();
    }
    const found = this.node.match(segments, {});
    found.sort((a, b) => {
      return a.index - b.index;
    });
    return found.map(f => ({
      payload: f.payload,
      params: f.params,
    }));
  }
}
