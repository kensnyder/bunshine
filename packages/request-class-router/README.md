# request-class-router

An HTTP router for runtimes with fetch-based routers such as Bun, Deno, and Cloudflare Workers.

<img alt="request-class-router Logo" src="https://github.com/kensnyder/request-class-router/raw/main/packages/request-class-router/assets/request-class-router-logo.png?v=1.0.0" width="200" height="187" />

[![NPM Link](https://img.shields.io/npm/v/request-class-router?v=1.0.0)](https://npmjs.com/package/request-class-router)
[![Language: TypeScript](https://badgen.net/static/language/TS?v=1.0.0)](https://github.com/search?q=repo:kensnyder/request-class-router++language:TypeScript&type=code)
[![Code Coverage](https://codecov.io/gh/kensnyder/request-class-router/graph/badge.svg?token=4LLWB8NBNT&v=1.0.0)](https://codecov.io/gh/kensnyder/request-class-router)
![Tree shakeable](https://badgen.net/static/tree%20shakeable/yes/green?v=1.0.0)
[![ISC License](https://badgen.net/github/license/kensnyder/request-class-router?v=1.0.0)](https://opensource.org/licenses/ISC)

## Installation

```shell
bun add request-class-router
```

## Motivation

1. Use bare `Request` and `Response` objects
2. Integrated support for **Server Sent Events**
3. Be very **lightweight**
4. **Elegantly** treat every handler like middleware
5. Support **async handlers**
6. Support **traditional routing** syntax
7. Comprehensive **unit tests**
8. Support for `X-HTTP-Method-Override` header

## Table of Contents

1. [Basic example](#basic-example)
2. [Full example](#full-example)
3. [Writing middleware](#writing-middleware)
4. [Throwing responses](#throwing-responses)
5. [Server Sent Events](#server-sent-events)
6. [Route Matching](#route-matching)
7. [TypeScript pro-tips](#typescript-pro-tips)
8. [Change Log](./CHANGELOG.md)
9. [ISC License](./LICENSE.md)

## Basic example

```ts
import { HttpRouter } from 'request-class-router';

const app = new HttpRouter();

app.get('/', c => {
  return new Response('Hello at ' + c.url.pathname);
});

// Listen with your Request class compatible server:
// Bun
Bun.serve({ fetch: app.fetch });
// Deno
Deno.serve({ handler: app.fetch });
// Cloudflare Workers
export default app.fetch;
```

## Full example

```ts
import { HttpRouter, redirect, compression } from 'request-class-router';

const app = new HttpRouter();

app.patch('/users/:id', async c => {
  await authorize(c.request.headers.get('Authorization')); // see implementation below
  const data = await c.request.json();
  const result = await updateUser(params.id, data); // made-up function
  if (result === 'not found') {
    return c.json({ error: 'User not found' }, { status: 404 });
  } else if (result === 'error') {
    return c.json({ error: 'Error updating user' }, { status: 500 });
  } else {
    return c.json({ error: false });
  }
});

app.onNotFound(c => {
  // alias: on404
  // called when no handlers match the requested path
  return c.text('Page Not found', { status: 404 });
});

app.onError(c => {
  // alias: on500
  // called when a handler throws an error
  console.error('500', c.error);
  return c.json({ error: 'Internal server error' }, { status: 500 });
});

function authorize(authHeader: string) {
  if (!authHeader) {
    throw redirect('/login');
  } else if (!jwtVerify(authHeader)) {
    throw redirect('/not-allowed');
  }
}

// Bun
Bun.serve({ fetch: app.fetch });
// Deno
Deno.serve({ fetch: app.fetch });
// Cloudflare Workers
export default app.fetch;
```

You can also make a path-specific error catcher like this:

```ts
import { HttpRouter, redirect, compression } from 'request-class-router';

const app = new HttpRouter();

app.get('/api/*', async (c, next) => {
  try {
    return await next();
  } catch (e) {
    // do something with error
    // maybe return json
  }
});

// attach other routes
app.get('/api/v1/posts', handler);
```

### What is `c` here?

`c` is a `Context` object that contains the request and params.

```ts
import {
  HttpRouter,
  type Context,
  type NextFunction,
} from 'request-class-router';

const app = new HttpRouter();

app.get('/hello', (c: Context, next: NextFunction) => {
  // Properties of the Context object
  c.request; // The raw Request object
  c.url; // The URL object (get url string with c.url.href, or query with c.url.searchParams)
  c.params; // The request params from route placeholders
  c.server; // The Bun server instance (useful for pub-sub)
  c.app; // The HttpRouter instance
  c.locals; // A place to persist data between handlers for the duration of the request
  c.error; // An error object available to handlers registered with app.onError()
  c.ip; // The IP address of the client or load balancer (not necessarily the end user)
  c.date; // The Date of the request
  c.now; // The result of performance.now() at the start of the request

  // To respond, return a Response object:
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-type': 'application/json' },
  });

  // Or create Response objects with convenience functions:
  return c.json(data, init); // data to pass to JSON.stringify
  return c.text(text, init); // plain text
  return c.js(jsText, init); // plain-text js
  return c.xml(xmlText, init); // plain-text xml
  return c.html(htmlText, init); // plain-text html
  return c.css(cssText, init); // plain-text css
  return c.file(pathOrSource, init); // file path, BunFile or binary source

  // above init is the Web Standards ResponseInit:
  type ResponseInit = {
    headers?: Headers | Record<string, string> | Array<[string, string]>;
    status?: number;
    statusText?: string;
  };

  // Create a redirect Response:
  return c.redirect(url, status); // status defaults to 302 (Temporary Redirect)
});
```

And `c` is destructureable. For example, you can write:

```ts
import { HttpRouter } from 'request-class-router';

const app = new HttpRouter();

app.get('/', ({ url, text }) => {
  return text('Hello at ' + url.pathname);
});

app.listen({ port: 3100, reusePort: true });
```

## Writing middleware

Here are more examples of attaching middleware.

```ts
import { HttpRouter } from 'request-class-router';

const app = new HttpRouter();

// handler not affected by middleware defined below
app.get('/healthcheck', c => c.text('200 OK'));

// Run before each request
app.use(c => {
  if (isBot(c.request.headers.get('User-Agent'))) {
    return c.text('Bots are forbidden', { status: 403 });
  }
  // continue to other handlers
});

// Run code after each request
app.use(async (c, next) => {
  // wait for response from other handlers
  const resp = await next();
  // peek at status and log if 403
  if (resp.status === 403) {
    logThatUserWasForbidden(c.request.url);
  }
  // pass the response to other handlers
  return resp;
});

// Run code before AND after each request
app.use(async (c, next) => {
  logRequest(c.request);
  const resp = await next();
  logResponse(resp);
  return resp;
});

// Middleware at a certain path
const requireAdmin: Middleware = c => {
  if (!isAdmin(c.request.headers.get('Authorization'))) {
    return c.redirect('/login', { status: 403 });
  }
};
app.get('/admin', requireAdmin);

// Middleware before a given handler (as args)
app.get('/users/:id', paramValidationMiddleware, async c => {
  const user = await getUser(c.params.id);
  return c.json(user);
});

// Middleware before a given handler (as array)
app.get('/users/:id', [
  paramValidationMiddleware({ id: zod.number() }),
  async c => {
    const user = await getUser(c.params.id);
    return c.json(user);
  },
]);

// define a handler function to be used in multiple places
const ensureSafeData = async (_, next) => {
  const unsafeResponse = await next();
  const text = await unsafeResponse.text();
  const scrubbed = scrubSensitiveData(text);
  return new Response(scrubbed, {
    headers: unsafeResponse.headers,
    status: unsafeResponse.status,
    statusText: unsafeResponse.statusText,
  });
};

// all routes that start with /api will get ensureSafeData applied
app.get('/api/*', ensureSafeData);
app.get('/api/v1/users/:id', getUser);

app.listen({ port: 3100, reusePort: true });
```

Note that because every handler is treated like middleware,
you must register handlers in order of desired specificity. For example:

```ts
// This order matters
app.get('/users/me', handler1);
app.get('/users/:id', handler2); // runs only if handler1 doesn't respond
app.get('*', http404Handler);
```

And to illustrate the wrap-like behavior of `await`ing the `next` function:

```ts
app.get('/', async (c, next) => {
  console.log(1);
  const resp = await next();
  console.log(5);
  return resp;
});
app.get('/', async (c, next) => {
  console.log(2);
  const resp = await next();
  console.log(4);
  return resp;
});
app.get('/', async (c, next) => {
  console.log(3);
  return c.text('Hello');
});
app.get('/', async (c, next) => {
  console.log('never');
  return c.text('Hello2');
});
// logs 1, 2, 3, 4, then 5

// Same goes for a list of handlers:
app.get('/', runs1stAnd5th, runs2ndAnd4th, runs3rd);
```

### What does it mean that "every handler is treated like middleware"?

If a handler does not return a `Response` object or return a promise that does
not resolve to a `Response` object, then the next matching handler will be
called. Consider the following:

```ts
import {
  HttpRouter,
  type Context,
  type NextFunction,
} from 'request-class-router';

const app = new HttpRouter();

// ❌ Incorrect asynchronous handler
app.get('/hello', (c: Context, next: NextFunction) => {
  setTimeout(() => {
    next(new Response('Hello World!'));
  }, 1000);
});

// ✅ Correct asynchronous handler
app.get('/hello', async (c: Context) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(new Response('Hello World!'));
    }, 1000);
  });
});
```

It also means that the `next()` function is async. Consider the following:

```ts
import {
  HttpRouter,
  type Context,
  type NextFunction,
} from 'request-class-router';

const app = new HttpRouter();

// ❌ Incorrect use of next()
app.get('/hello', (c: Context, next: NextFunction) => {
  const resp = next();
  // oops! resp is a Promise
});

// ✅ Correct use of next()
app.get('/hello', async (c: Context, next: NextFunction) => {
  // wait for other handlers to return a response
  const resp = await next();
  // do stuff with response
});
```

And it means that `.use()` is just a convenience function for registering
middleware. Consider the following:

```ts
import { HttpRouter } from 'request-class-router';

const app = new HttpRouter();

// The following 2 are the same
app.use(middlewareHandler);
app.all('*', middlewareHandler);
```

This all-handlers-are-middleware behavior complements the way that handlers
and middleware can be registered. Consider the following:

```ts
import { HttpRouter } from 'request-class-router';

const app = new HttpRouter();

// middleware can be inserted as parameters to app.get()
app.get('/admin', getAuthMiddleware('admin'), middleware2, handler);

// request-class-router accepts middleware as arguments or arrays, ultimately flattening to one array
// so the following are equivalent
app.get('/posts', middleware1, middleware2, handler);
app.get('/users', [middleware1, middleware2], handler);
app.get('/visitors', [[middleware1, [middleware2, handler]]]);

// Why might this flattening behavior be useful?
// You can group multiple middlewares into one array and pass it to route definitions
const adminMiddleware = [getAuthCookie, checkPermissions];
app.get('/admin/posts', adminMiddleware, getPosts);
```

## Throwing responses

You can throw a `Response` object from anywhere in your code to send a response.
Here is an example:

```ts
import { HttpRouter } from 'request-class-router';

const app = new HttpRouter();

async function checkPermission(request: Request, action: string) {
  const authHeader = request.headers.get('Authorization');
  if (!(await hasPermission(authHeader, action))) {
    throw c.redirect('/home');
  } else if (hasTooManyRequests(authHeader)) {
    throw c.json({ error: 'Too many requests' }, { status: 429 });
  }
}

app.post('/posts', async c => {
  await checkPermissions(c.request, 'create-post');
  // code here will only run if checkPermission hasn't thrown a Response
});

// start the server
app.listen({ port: 3100, reusePort: true });
```

Throwing a `Response` effectively skips the currently running handler/middleware
and passes control to the next handler. That way thrown responses will be passed
to subsequent middleware such as loggers.

## Server-Sent Events

Server-Sent Events (SSE) are similar to WebSockets, but one way. The server can
send messages, but the client cannot. This is useful for streaming data to the
browser.

```ts
import { HttpRouter } from 'request-class-router';

const app = new HttpRouter();

app.get<{ symbol: string }>('/stock/:symbol', c => {
  const symbol = c.params.symbol;
  return c.sse(send => {
    setInterval(async () => {
      const data = await getPriceData(symbol);
      send('price', { gain: data.gain, price: data.price });
    }, 6000);
  });
});

// start the server
app.listen({ port: 3100, reusePort: true });

//
// Browser side:
//
const livePrice = new EventSource('http://localhost:3100/stock/GOOG');

livePrice.addEventListener('price', e => {
  const { gain, price } = JSON.parse(e.data);
  document.querySelector('#stock-GOOG-gain').innerText = gain;
  document.querySelector('#stock-GOOG-price').innerText = price;
});
```

Note that with SSE, the client must ultimately decide when to stop listening.
Creating an `EventSource` object in the browser will open a connection to the
server, and if the server closes the connection, a browser will automatically
reconnect.

So if you want to tell the browser you are done sending events, send a
message that your client-side code will understand to mean "stop listening".
Here is an example:

```ts
import { HttpRouter } from 'request-class-router';

const app = new HttpRouter();

app.get<{ videoId: string }>('/convert-video/:videoId', c => {
  const { videoId } = c.params;
  return c.sse(send => {
    const onProgress = percent => {
      send('progress', { percent });
    };
    const onComplete = () => {
      // Browser code will close connection when percent is 100
      send('progress', { percent: 100 });
    };
    startVideoConversion(videoId, onProgress, onComplete);
  });
});

// start the server
app.listen({ port: 3100, reusePort: true });

//
// Browser side:
//
const conversionProgress = new EventSource('/convert-video/123');

conversionProgress.addEventListener('progress', e => {
  const data = JSON.parse(e.data);
  if (data.percent === 100) {
    conversionProgress.close();
  } else {
    document.querySelector('#progress').innerText = e.data;
  }
});
```

You may have noticed that you can attach multiple listeners to an `EventSource`
object to react to multiple event types. Here is a minimal example:

```ts
//
// Server side
//
app.get('/hello', c => {
  const { videoId } = c.params;
  return c.sse(send => {
    send('event1', 'data1');
    send('event2', 'data2');
  });
});

//
// Browser side:
//
const events = new EventSource('/hello');
events.addEventListener('event1', listener1);
events.addEventListener('event2', listener2);
```

## Route Matching

request-class-router supports the following route matching features:

- Named placeholders using colons (e.g. `/posts/:id`)
- End wildcards using stars (e.g. `/assets/*`)
- Middle (non-slash) wildcards using stars (e.g. `/assets/*/*.css`)
- Static paths (e.g. `/posts`)

Support for RegExp symbols such as `.+` can lead to a Regular Expression Denial
of Service (ReDoS) vulnerability where an attacker can request long URLs and
tie up your server CPU with backtracking regular-expression searches.

### Supported path examples

| Path                 | URL                 | params                  |
| -------------------- | ------------------- | ----------------------- |
| `/path`              | `/path`             | `{}`                    |
| `/users/:id`         | `/users/123`        | `{ id: '123' }`         |
| `/users/:id/groups`  | `/users/123/groups` | `{ id: '123' }`         |
| `/u/:id/groups/:gid` | `/u/1/groups/a`     | `{ id: '1', gid: 'a' }` |
| `/star/*`            | `/star/man`         | `{ 0: 'man' }`          |
| `/star/*`            | `/star/man/can`     | `{ 0: 'man/can' }`      |
| `/star/*/can`        | `/star/man/can`     | `{ 0: 'man' }`          |
| `/star/*/can/*`      | `/star/man/can/go`  | `{ 0: 'man', 1: 'go' }` |

### Special characters are not supported

Note that all regular-expression special characters including
`\ ^ $ * + ? . ( ) | { } [ ]` will be escaped. If you need any of these
behaviors, you'll need to pass in a `RegExp`. But be sure to check your
`RegExp` with a ReDoS such as [Devina](https://devina.io/redos-checker) or
[redos-checker on npm](https://www.npmjs.com/package/redos-detector).

For example, the dot in `/assets/*.js` will not match all characters--only dots.

### Examples of unsupported routes

Support for regex-like syntax has been dropped in request-class-router v2 due to the
aforementioned RegExp Denial of Service (ReDoS) vulnerability.
For cases where you need to limit by character or specify optional segments,
you'll need to pass in a `RegExp`. Be sure to check your `RegExp` with a ReDoS
checker such as [Devina](https://devina.io/redos-checker) or
[redos-checker on npm](https://www.npmjs.com/package/redos-detector).

| Example                | Explaination                              | Equivalent Safe RegExp   |
| ---------------------- | ----------------------------------------- | ------------------------ |
| `/users/([a-z-]+)/` ❌ | Character classes are not supported       | `^\/users\/([a-z-]+)$`   |
| `/users/(\\d+)` ❌     | Character class escapes are not supported | `^/\/users\/(\d+)$`      |
| `/(users\|u)/:id` ❌   | Pipes are not supported                   | `^\/(users\|u)/([^/]+)$` |
| `/:a/:b?` ❌           | Optional params are not supported         | `^\/([^/]*)\/(.*)$`      |

If you want to double-check all your routes at runtime, you can install
`redos-detector` and use request-class-router's `detectPotentialDos` function:

```ts
import { HttpRouter } from 'request-class-router';
import { isSafe } from 'redos-detector';

const app = new HttpRouter();
app.get('/', home);
// ... all my routes

// detectPotentialDos() calls console.warn() with details of each unsafe pattern
app.matcher.detectPotentialDos(isSafe);
```

### HTTP methods

```ts
import { HttpRouter } from 'request-class-router';

const app = new HttpRouter();

app.head('/posts/:id', doesPostExist);
app.get('/posts/:id', getPost);
app.post('/posts/:id', addPost);
app.patch('/posts/:id', editPost);
app.put('/posts/:id', upsertPost);
app.trace('/posts/:id', tracePost);
app.delete('/posts/:id', deletePost);
app.options('/posts/:id', getPostCors);

// special case for specifying both head and get
app.headGet('/files/*', serveFiles(`${import.meta.dir}/files`));

// any list of multiple verbs (must be uppercase)
app.on(['POST', 'PATCH'], '/posts/:id', addEditPost);

// regular expression matchers are supported
app.get(/^\/author\/([a-z]+)$/i, getPost);

app.listen({ port: 3100, reusePort: true });
```

## TypeScript pro-tips

Bun embraces TypeScript and so does request-class-router. Here are some tips for getting
the most out of TypeScript.

### Typing URL params

You can specify URL param types by passing a type to any of the route methods:

```ts
import { HttpRouter } from 'request-class-router';

const app = new HttpRouter();

app.post<{ id: string }>('/users/:id', async c => {
  // TypeScript now knows that c.params.id is a string
});

app.get<{ 0: string }>('/auth/*', async c => {
  // TypeScript now knows that c.params['0'] is a string
});

app.listen({ port: 3100, reusePort: true });
```

### Typing middleware

```ts
import { type Middleware } from 'request-class-router';

function myMiddleware(options: Options): Middleware {
  return (c, next) => {
    // TypeScript infers c and next because of Middleware type
  };
}
```

## Examples of common http server setup

```ts
import { HttpRouter, type Middleware } from 'request-class-router';

const app = new HttpRouter();

// how to read query params
app.get('/', c => {
  c.url.searchParams; // URLSearchParams object
  Object.fromEntries(c.url.searchParams); // as plain object (but repeated keys are dropped)
  for (const [key, value] of c.url.searchParams) {
    // iterate params
  }
});

// Or set c.query via middleware
app.use(c => {
  c.query = Object.fromEntries(c.url.searchParams);
});

// how to read json payload
app.post('/api/user', async c => {
  const data = await c.request.json();
});

// Or set c.body via middleware
app.on(['POST', 'PUT', 'PATCH'], async c => {
  if (c.request.headers.get('Content-Type')?.includes('application/json')) {
    c.body = await c.request.json();
  }
});

// create small functions that always return the same thing
const respondWith404 = c => c.text('Not found', { status: 404 });
// block dotfile access (e.g. .env, .git, .svn, .htaccess)
app.get(/^\./, respondWith404);
// block URLs that end with .env and other dumb endings
app.all(/\.(env|bak|old|tmp|backup|log|ini|conf)$/, respondWith404);

// middleware to add CSP
app.use(async (c, next) => {
  const resp = await next();
  if (
    resp.headers.get('content-type')?.includes('text/html') &&
    !resp.headers.has('Content-Security-Headers')
  ) {
    resp.headers.set(
      'Content-Security-Headers',
      "frame-src 'self'; frame-ancestors 'self'; worker-src 'self'; connect-src 'self'; default-src 'self'; font-src *; img-src *; manifest-src 'self'; media-src 'self' data:; object-src 'self' data:; prefetch-src 'self'; script-src 'self'; script-src-elem 'self' 'unsafe-inline'; script-src-attr 'none'; style-src-attr 'self' 'unsafe-inline'; base-uri 'self'; form-action 'self'"
    );
  }
  return resp;
});
// Later modify CSP at a certain route
app.headGet('/embeds/*', async (c, next) => {
  const resp = await next();
  const csp = response.headers.get('Content-Security-Headers');
  if (csp) {
    resp.headers.set(
      'Content-Security-Headers',
      csp.replace(/frame-ancestors .+?;/, 'frame-ancestors *;')
    );
  }
  return resp;
});

// Persist data in c.locals
app.all('/api/*', async (c, next) => {
  const authValue = c.request.headers.get('Authorization');
  // subsequent handler will have access to this auth information
  c.locals.auth = {
    identity: await getUser(authValue),
    permission: await getPermissions(authValue),
  };
  // return nothing so that subsequent handlers get called
});

// Middleware to cast incoming json payload to zod schema
function castSchema(zodSchema: ZodObject): Middleware {
  return async c => {
    const result = zodSchema.safeParse(await c.json());
    if (result.error) {
      return c.text(result.error, { status: 400 });
    }
    c.locals.safePayload = result.data;
  };
}

app.post('/api/users', castSchema(userCreateSchema), createUser);

// Destructure context object
app.get('/api/*', async ({ url, request, json }) => {
  // do stuff with url and request
  return json({ message: `my json response at ${url.pathname}` });
});

// listen on random port
app.listen({ port: 0, reusePort: true });
```

## License

[ISC License](./LICENSE.md)
