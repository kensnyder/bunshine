# remix-adapter-bunshine

Use Bunshine with Remix, using Vite compiler

[![NPM Link](https://img.shields.io/npm/v/connect-to-fetch?v=1.0.0-rc.1)](https://npmjs.com/package/connect-to-fetch)
[![Language: TypeScript](https://badgen.net/static/language/TS?v=1.0.0-rc.1)](https://github.com/search?q=repo:kensnyder/bunshine++language:TypeScript&type=code)
![No Dependencies](https://badgen.net/static/dependencies/0)
[![Code Coverage](https://codecov.io/gh/kensnyder/connect-to-fetch/graph/badge.svg?token=&v=1.0.0-rc.1)](https://codecov.io/gh/kensnyder/bunshine)
![Tree shakeable](https://badgen.net/static/tree%20shakeable/yes/green?v=1.0.0-rc.1)
[![ISC License](https://badgen.net/github/license/kensnyder/bunshine/packages/connect-to-fetch?v=1.0.0-rc.1)](https://opensource.org/licenses/ISC)

<img alt="Bunshine Logo" src="https://github.com/kensnyder/bunshine/raw/main/packages/bunshine/assets/bunshine-logo.png?v=a" width="200" height="187" />

## Installation

```shell
bun add remix-adapter-bunshine
```

## Usage

Setup in a server.ts file.

```ts
import { remixAdapterVite } from 'remix-adapter-bunshine';
import { HttpRouter, performanceHeader, etags, compression } from 'bunshine';

const app = new HttpRouter();
app.use(etags());
app.use(compression());
app.use(performanceHeader());
await remixAdapterBunshine({
  app,
  mode: process.env.NODE_ENV,
  buildPath: `${import.meta.dir}/build`,
  logger: true,
});
app.listen({ port: 3002 });
app.emitUrl({ verbose: true });
```

Then in package.json, update "dev" under "scripts" to be:

```bash
bun server.ts
```
