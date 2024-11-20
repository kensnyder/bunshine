# connect-to-fetch

Use Connect-style Node handlers with Fetch environments such as `Bun.serve`, `Deno.serve`, and Cloudflare Workers

## Motivation

Use Vite's connect middleware with `Bun.serve`.

## Usage

With Bun directly:

```ts
import { connectToFetch } from 'connect-to-fetch';

Bun.serve({
  fetch: connectToFetch(connectMiddleware1, connectMiddleware2),
});

// OR an Array

Bun.serve({
  fetch: connectToFetch([connectMiddleware1, connectMiddleware2]),
});
```

With Bunshine directly:

```ts
import { HttpRouter, performanceHeader } from 'bunshine';
import { connectToBunshine } from 'bunshine-connect';

const app = new HttpRouter();
app.get('/build/*', performanceHeader(), connectToBunshine(connectMiddlewares));
app.get('/other-stuff', otherStuff);
```

## Testing

Tests use `Bun.serve`, so you'll need to have Bun installed to test.
