# connect-to-fetch

Use Connect-style Node handlers with Fetch environments such as `Bun.serve` and
`Deno.serve`.

[![NPM Link](https://img.shields.io/npm/v/connect-to-fetch?v=1.0.0)](https://npmjs.com/package/connect-to-fetch)
[![Language: TypeScript](https://badgen.net/static/language/TS?v=1.0.0)](https://github.com/search?q=repo:kensnyder/bunshine++language:TypeScript&type=code)
![No Dependencies](https://badgen.net/static/dependencies/0)
[![Code Coverage](https://codecov.io/gh/kensnyder/connect-to-fetch/graph/badge.svg?token=&v=1.0.0)](https://codecov.io/gh/kensnyder/bunshine)
![Tree shakeable](https://badgen.net/static/tree%20shakeable/yes/green?v=1.0.0)
[![ISC License](https://badgen.net/github/license/kensnyder/bunshine/packages/connect-to-fetch?v=1.0.0)](https://opensource.org/licenses/ISC)

## Motivation

Use Vite's dev-server middleware with `Bun.serve`.

## Installation

```shell
bun add connect-to-fetch
```

## Usage

Pass one or more handlers or middleware to `connectToFetch`:

```ts
import { connectToFetch } from 'connect-to-fetch';

const getResponse = connectToFetch(myConnectHandler);

Bun.serve({
  async fetch(request: Request) {
    try {
      return await getResponse(request);
    } catch (e) {
      const error = e as Error;
      if (error.message === 'UNHANDLED') {
        return new Response('Not Found', { status: 404 });
      }
      console.error(error);
      return new Response('Server Error', { status: 500 });
    }
  },
});
```

## Prior art

Adapted from [vike-node](https://github.com/vikejs/vike-node), MIT License.

## Testing

Tests use `Bun.serve`, so you'll need to have Bun installed to test.

## History

[Changelog](./CHANGELOG.md)
