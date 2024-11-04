# Bunshine

A Bun HTTP & WebSocket server that is a little ray of sunshine.

<img alt="Bunshine Logo" src="https://github.com/kensnyder/bunshine/raw/main/assets/bunshine-logo.png?v=3.0.0" width="200" height="187" />

[![NPM Link](https://img.shields.io/npm/v/bunshine?v=3.0.0)](https://npmjs.com/package/bunshine)
[![Language](https://badgen.net/static/language/TS?v=3.0.0)](https://github.com/search?q=repo:kensnyder/bunshine++language:TypeScript&type=code)
![Test Coverage: 96%](https://badgen.net/static/test%20coverage/92%25/green?v=3.0.0)
[![Gzipped Size](https://badgen.net/bundlephobia/minzip/bunshine?label=minzipped&v=3.0.0)](https://bundlephobia.com/package/bunshine@3.0.0)
[![Dependency details](https://badgen.net/bundlephobia/dependency-count/bunshine?v=3.0.0)](https://www.npmjs.com/package/bunshine?activeTab=dependencies)
[![Tree shakeable](https://badgen.net/bundlephobia/tree-shaking/bunshine?v=3.0.0)](https://www.npmjs.com/package/bunshine)
[![ISC License](https://badgen.net/github/license/kensnyder/bunshine?v=3.0.0)](https://opensource.org/licenses/ISC)

## Installation

```shell
bun add bunshine
```

_Or to run Bunshine on Node,
[install Nodeshine](https://npmjs.com/package/nodeshine)._

## Motivation

1. Use bare `Request` and `Response` objects
2. Support for routing `WebSocket` requests
3. Support for Server Sent Events
4. Support ranged file downloads (e.g. for video streaming)
5. Be very lightweight
6. Treat every handler like middleware
7. Support async handlers
8. Provide common middleware out of the box (cors, prodLogger, headers, compression, etags)
9. Support traditional routing syntax
10. Make specifically for Bun
11. Comprehensive unit tests
12. Support for `X-HTTP-Method-Override` header

## Table of Contents

1. [Basic example](#basic-example)
2. [Full example](#full-example)
3. [Serving static files](#serving-static-files)
4. [Writing middleware](#writing-middleware)
5. [Throwing responses](#throwing-responses)
6. [WebSockets](#websockets)
7. [WebSocket pub-sub](#websocket-pub-sub)
8. [Server Sent Events](#server-sent-events)
9. [Route Matching](#route-matching)
10. [Included middleware](#included-middleware)
    - [serveFiles](#servefiles)
    - [responseCache](#responseCache)
    - [compression](#compression)
    - [cors](#cors)
    - [devLogger & prodLogger](#devlogger--prodlogger)
    - [performanceHeader](#performanceheader)
    - [etags](#etags)
11. [TypeScript pro-tips](#typescript-pro-tips)
12. [Roadmap](#roadmap)
13. [License](./LICENSE.md)

## Upgrading from 1.x to 2.x

RegExp symbols are not allowed in route definitions to avoid ReDoS vulnerabilities.

## Upgrading from 2.x to 3.x

- The `securityHeaders` middleware has been dropped. Use a library such as
  [@side/fortifyjs](https://www.npmjs.com/package/@side/fortifyjs) instead.
- The `serveFiles` middleware no longer accepts options for `etags` or `gzip`.
  Instead, compose the `etags` and `compression` middlewares:
  `app.headGet('/files/*', etags(), compression(), serveFiles(...))`

## Basic example

```ts
import { HttpRouter } from 'bunshine';

const app = new HttpRouter();

app.get('/', c => {
  return new Response('Hello at ' + c.url.pathname);
});

app.listen({ port: 3100, reusePort: true });
```

## Full example

```ts
import { HttpRouter, redirect, compression } from 'bunshine';

const app = new HttpRouter();
app.use(compresion());

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

app.on404(c => {
  // called when no handlers match the requested path
  return c.text('Page Not found', { status: 404 });
});

app.on500(c => {
  // called when a handler throws an error
  console.error('500', c.error);
  return c.json({ error: 'Internal server error' }, { status: 500 });
});

app.listen({ port: 3100, reusePort: true });

function authorize(authHeader: string) {
  if (!authHeader) {
    throw redirect('/login');
  } else if (!jwtVerify(authHeader)) {
    throw redirect('/not-allowed');
  }
}
```

You can also make a path-specific error catcher like this:

```ts
import { HttpRouter, redirect, compression } from 'bunshine';

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
import { HttpRouter, type Context, type NextFunction } from 'bunshine';

const app = new HttpRouter();

app.get('/hello', (c: Context, next: NextFunction) => {
  // Properties of the Context object
  c.request; // The raw Request object
  c.url; // The URL object (get url string with c.url.href, or query with c.url.searchParams)
  c.params; // The request params from route placeholders
  c.server; // The Bun server instance (useful for pub-sub)
  c.app; // The HttpRouter instance
  c.locals; // A place to persist data between handlers for the duration of the request
  c.error; // An error object available to handlers registered with app.on500()
  c.ip; // The IP address of the client or load balancer (not necessarily the end user)
  c.date; // The date of the request
  c.now; // The result of performance.now() at the start of the request

  // Convenience methods for creating Response objects with various content types
  c.json(data, init);
  c.text(text, init);
  c.js(jsText, init);
  c.xml(xmlText, init);
  c.html(htmlText, init);
  c.css(cssText, init);
  c.file(path, init);

  // Create a redirect Response
  c.redirect(url, status);
});
```

## Serving static files

Serving static files is easy with the `serveFiles` middleware. Note that ranged
requests are supported, so you can use this for video streaming or partial
downloads.

```ts
import { HttpRouter, serveFiles } from 'bunshine';

const app = new HttpRouter();

app.get('/public/*', serveFiles(`${import.meta.dir}/public`));

app.listen({ port: 3100, reusePort: true });
```

See the [serveFiles](#serveFiles) section for more info.

Also note you can serve files with bunshine anywhere with `bunx bunshine serve`.
It currently uses the default `serveFiles()` options.

## Writing middleware

Here are more examples of attaching middleware.

```ts
import { HttpRouter } from 'bunshine';

const app = new HttpRouter();

// handler not affected by middleware defined below
app.get('/healthcheck', c => c.text('200 OK'));

// Run before each request
app.use(c => {
  if (!isAllowed(c.request.headers.get('Authorization'))) {
    // redirect instead of running other middleware or handlers
    return c.redirect('/login', { status: 403 });
  }
  // continue to other handlers
});

// Run after each request
app.use(async (c, next) => {
  // wait for response from other handlers
  const resp = await next();
  // peek at status and log if 403
  if (resp.status === 403) {
    logThatUserWasForbidden(c.request.url);
  }
  // return the response from the other handlers
  return resp;
});

// Run before AND after each request
app.use(async (c, next) => {
  logRequest(c.request);
  const resp = await next();
  logResponse(resp);
  return resp;
});

// Middleware at a certain path
app.get('/admin', c => {
  if (!isAdmin(c.request.headers.get('Authorization'))) {
    return c.redirect('/login', { status: 403 });
  }
});

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

// handler affected by middleware defined above
app.get('/', c => c.text('Hello World!'));

app.listen({ port: 3100, reusePort: true });
```

Note that because every handler is treated like middleware,
you must register handlers in order of desired specificity. For example:

```ts
// This order matters
app.get('/users/me', handler1);
app.get('/users/:id', handler2); // runs only if id is not "me" or handler1 doesn't respond
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
// logs 1, 2, 3, 4, then 5
```

### What does it mean that "every handler is treated like middleware"?

If a handler does not return a `Response` object or return a promise that does
not resolve to a `Response` object, then the next matching handler will be
called. Consider the following:

```ts
import { HttpRouter, type Context, type NextFunction } from 'bunshine';

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
import { HttpRouter, type Context, type NextFunction } from 'bunshine';

const app = new HttpRouter();

// ❌ Incorrect use of next
app.get('/hello', (c: Context, next: NextFunction) => {
  const resp = next();
});

// ✅ Correct use of next
app.get('/hello', async (c: Context, next: NextFunction) => {
  // wait for other handlers to return a response
  const resp = await next();
  // do stuff with response
});
```

And finally, it means that `.use()` is just a convenience function for
registering middleware. Consider the following:

```ts
import { HttpRouter } from 'bunshine';

const app = new HttpRouter();

// The following 2 are the same
app.use(middlewareHandler);
app.all('*', middlewareHandler);
```

This all-handlers-are-middleware behavior complements the way that handlers
and middleware can be registered. Consider the following:

```ts
import { HttpRouter } from 'bunshine';

const app = new HttpRouter();

// middleware can be inserted with parameters
app.get('/admin', getAuthMiddleware('admin'), middleware2, handler);

// Bunshine accepts any number of middleware functions in parameters or arrays
// so the following are equivalent
app.get('/posts', middleware1, middleware2, handler);
app.get('/users', [middleware1, middleware2, handler]);
app.get('/visitors', [[middleware1, [middleware2, handler]]]);
```

## Throwing responses

You can throw a `Response` object from anywhere in your code to send a response.
Here is an example:

```ts
import { HttpRouter } from 'bunshine';

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

## WebSockets

Setting up websockets at various paths is easy with the `socket` property.

```ts
import { HttpRouter } from 'bunshine';

const app = new HttpRouter();

// regular routes
app.get('/', c => c.text('Hello World!'));

// WebSocket routes
type ParamsShape = { room: string };
type DataShape = { user: User };
app.socket.at<ParmasShape, DataShape>('/games/rooms/:room', {
  // Optional. Allows you to specify arbitrary data to attach to ws.data.
  upgrade: sc => {
    const cookies = sc.request.headers.get('cookie');
    const user = getUserFromCookies(cookies);
    return { user };
  },
  // Optional. Allows you to deal with errors thrown by handlers.
  error: (sc, error) => {
    console.log('WebSocket error', error.message);
  },
  // Optional. Called when the client connects
  open(sc) {
    const room = sc.params.room;
    const user = sc.data.user;
    markUserEntrance(room, user);
    ws.send(getGameState(room));
  },
  // Optional. Called when the client sends a message
  message(sc, message) {
    const room = sc.params.room;
    const user = sc.data.user;
    const result = saveMove(room, user, message.json());
    // send accepts strings, Buffers, ArrayBuffers
    // and anything else will be serialized to JSON
    ws.send(result);
  },
  // Optional. Called when the client disconnects
  // List of codes and messages: https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code
  close(sc, code, message) {
    const room = sc.params.room;
    const user = sc.data.user;
    markUserExit(room, user);
  },
});

// start the server
app.listen({ port: 3100, reusePort: true });

//
// Browser side:
//
const gameRoom = new WebSocket('ws://localhost:3100/games/rooms/1?user=42');
gameRoom.onmessage = e => {
  // receiving messages
  const data = JSON.parse(e.data);
  if (data.type === 'GameState') {
    setGameState(data);
  } else if (data.type === 'GameMove') {
    playMove(data);
  }
};
gameRoom.onerror = handleGameError;
// send message to server
gameRoom.send(JSON.stringify({ type: 'GameMove', move: 'rock' }));
```

## WebSocket pub-sub

And WebSockets make it super easy to create a pub-sub system with no external
dependencies.

```ts
import { HttpRouter } from 'bunshine';

const app = new HttpRouter();

app.get('/', c => c.text('Hello World!'));

type ParamsShape = { room: string };
type DataShape = { username: string };
app.socket.at<ParamsShape, DataShape>('/chat/:room', {
  upgrade: c => {
    const cookies = c.request.headers.get('cookie');
    const username = getUsernameFromCookies(cookies);
    return { username };
  },
  open(sc) {
    const msg = `${sc.data.username} has entered the chat`;
    sc.subscribe(`chat-room-${sc.params.room}`);
    sc.publish(`chat-room-${sc.params.room}`, msg);
  },
  message(sc, message) {
    // the server re-broadcasts incoming messages
    // to each connection's message handler
    const fullMessage = `${sc.data.username}: ${message}`;
    sc.publish(`chat-room-${sc.params.room}`, fullMessage);
    sc.send(fullMessage);
  },
  close(sc, code, message) {
    const msg = `${sc.data.username} has left the chat`;
    sc.publish(`chat-room-${sc.params.room}`, msg);
    sc.unsubscribe(`chat-room-${sc.params.room}`);
  },
});

const server = app.listen({ port: 3100, reusePort: true });

// at a later time, you can also publish a message from another part of your code
server.publish(channel, message);
```

## Server-Sent Events

Server-Sent Events (SSE) are similar to WebSockets, but one way. The server can
send messages, but the client cannot. This is useful for streaming data to the
browser.

```ts
import { HttpRouter } from 'bunshine';

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
Creating an `EventSource` object will open a connection to the server, and if
the server closes the connection, the browser will automatically reconnect.

So if you want to tell the browser you are done sending events, send a
message that your client-side code will understand to mean "stop listening".
Here is an example:

```ts
import { HttpRouter } from 'bunshine';

const app = new HttpRouter();

app.get<{ videoId: string }>('/convert-video/:videoId', c => {
  const { videoId } = c.params;
  return c.sse(send => {
    const onProgress = percent => {
      send('progress', { percent });
    };
    const onComplete = () => {
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

Bunshine v1 used the `path-to-regexp` package for processing path routes.
Due to a discovered
[RegExp Denial of Service vulnerability](https://security.snyk.io/vuln/SNYK-JS-PATHTOREGEXP-7925106),
Bunshine v2+ no longer uses
[path-to-regexp docs](https://www.npmjs.com/package/path-to-regexp).

### Support

Bunshine supports the following route matching features:

- Named placeholders using colons (e.g. `/posts/:id`)
- End wildcards using stars (e.g. `/assets/*`)
- Middle non-slash wildcards using stars (e.g. `/assets/*/*.css`)
- Static paths (e.g. `/posts`)

Support for other behaviors can lead to a Regular Expression Denial of service
vulnerability where an attacker can request long URLs and tie up your server
CPU with backtracking regular expression searches.

### Path examples

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

### Special Characters

Note that all regular-expression special characters including
`\ ^ $ * + ? . ( ) | { } [ ]` will be escaped. If you need any of these
behaviors, you'll need to pass in a `RegExp`.

For example, the dot in `/assets/*.js` will not match all characters--only dots.

### Not supported

Support for regex-like syntax has been dropped in v2 due to the aforementioned
[RegExp Denial of Service vulnerability](https://security.snyk.io/vuln/SNYK-JS-PATHTOREGEXP-7925106).
For cases where you need to limit by character or specify optional segments,
you'll need to pass in a `RegExp`. Be sure to check your `RegExp` with a ReDoS
checker such as [Devina](https://devina.io/redos-checker) or
[redos-checker on npm](https://www.npmjs.com/package/redos-detector).

| Example             | Explaination                              | Equivalent RegExp        |
| ------------------- | ----------------------------------------- | ------------------------ |
| `/users/([a-z-]+)/` | Character classes are not supported       | `^\/users\/([a-z-]+)$`   |
| `/users/(\\d+)`     | Character class escapes are not supported | `^/\/users\/(\d+)$`      |
| `/(users\|u)/:id`   | Pipes are not supported                   | `^\/(users\|u)/([^/]+)$` |
| `/:a/:b?`           | Optional params are not supported         | `^\/([^/]*)\/(.*)$`      |

If you want to double check all your routes, you can use code like the following:

```ts
import { HttpRouter } from 'bunshine';
import { isSafe } from 'redos-detector';

const app = new HttpRouter();
app.get('/', home);
// ... all my routes

// detectPotentialDos() calls console.warn with() details of each unsafe pattern
app.matcher.detectPotentialDos(isSafe);
```

### HTTP methods

```ts
import { HttpRouter } from 'bunshine';

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

## Included middleware

### serveFiles

Serve static files from a directory. As shown above, serving static files is
easy with the `serveFiles` middleware. Note that ranged requests are
supported, so you can use it for video streaming or partial downloads.

```ts
import { HttpRouter, serveFiles } from 'bunshine';

const app = new HttpRouter();

app.get('/public/*', serveFiles(`${import.meta.dir}/public`));

app.listen({ port: 3100, reusePort: true });
```

How to respond to both GET and HEAD requests:

```ts
import { HttpRouter, serveFiles } from 'bunshine';

const app = new HttpRouter();

app.on(['HEAD', 'GET'], '/public/*', serveFiles(`${import.meta.dir}/public`));
// or
app.headGet('/public/*', serveFiles(`${import.meta.dir}/public`));

app.listen({ port: 3100, reusePort: true });
```

How to alter the response provided by another handler:

```ts
import { HttpRouter, serveFiles } from 'bunshine';

const app = new HttpRouter();

const addFooHeader = async (_, next) => {
  const response = await next();
  response.headers.set('x-foo', 'bar');
  return response;
};

app.get('/public/*', addFooHeader, serveFiles(`${import.meta.dir}/public`));

app.listen({ port: 3100, reusePort: true });
```

serveFiles accepts an optional second parameter for options:

```ts
import { HttpRouter, serveFiles } from 'bunshine';

const app = new HttpRouter();

app.get(
  '/public/*',
  serveFiles(`${import.meta.dir}/public`, {
    extensions: ['html', 'css', 'js', 'png', 'jpg', 'gif', 'svg', 'ico'],
    index: true,
  })
);

app.listen({ port: 3100, reusePort: true });
```

All options for serveFiles:

| Option       | Default     | Description                                                                               |
| ------------ | ----------- | ----------------------------------------------------------------------------------------- |
| acceptRanges | `true`      | If true, accept ranged byte requests                                                      |
| dotfiles     | `"ignore"`  | How to handle dotfiles; allow=>serve normally, deny=>return 403, ignore=>run next handler |
| extensions   | `[]`        | If given, a list of file extensions to allow                                              |
| fallthrough  | `true`      | If false, issue a 404 when a file is not found, otherwise proceed to next handler         |
| maxAge       | `undefined` | If given, add a Cache-Control header with max-age†                                        |
| immutable    | `false`     | If true, add immutable directive to Cache-Control header; must also specify maxAge        |
| index        | `[]`        | If given, a list of filenames (e.g. index.html) to look for when path is a folder         |
| lastModified | `true`      | If true, set the Last-Modified header                                                     |

† _A number in milliseconds or expression such as '30min', '14 days', '1y'._

### responseCache

Simple caching can be accomplished with the `responseCache()` middleware. It
saves responses to a cache you supply, based on URL. This can be useful for
builds, where your assets aren't changing. In the example below, `lru-cache` is
used to store assets in memory. Any cache that implements `has(url: string)`,
`get(url: string)` and `set(url: string, resp: Response)` methods can be used.
Your cache can also serialize responses to save them to an external system.
Keep in mind that your `set()` function will receive a `Response` object and
your `get()` function should be an object with a `clone()` method that returns
a `Response` object.

```ts
import { LRUCache } from 'lru-cache';
import { HttpRouter, responseCache, serveFiles } from 'bunshine';

const app = new HttpRouter();
app.headGet(
  '/public/*',
  responseCache(new LRUCache({ max: 100 })),
  serveFiles(`${import.meta.dir}/build/public`)
);
```

### compression

To add Gzip compression:

```ts
import { HttpRouter, compression, serveFiles } from 'bunshine';

const app = new HttpRouter();

app.get('/public/*', compression(), serveFiles(`${import.meta.dir}/public`));

app.listen({ port: 3100, reusePort: true });
```

The compression middleware takes an object with options:

```ts
type CompressionOptions = {
  prefer: 'br' | 'gzip' | 'none'; // default gzip
  br: BrotliOptions; // default from node:zlib
  gzip: ZlibCompressionOptions; // default from node:zlib
  minSize: number; // files smaller than this will not be compressed
  maxSize: number; // files larger than this will not be compressed
};
```

### cors

To add CORS headers to some/all responses, use the `cors` middleware.

```ts
import { HttpRouter, cors } from 'bunshine';

const app = new HttpRouter();

// cors origin examples
app.use(cors({ origin: '*' }));
app.use(cors({ origin: true }));
app.use(cors({ origin: 'https://example.com' }));
app.use(cors({ origin: /^https:\/\// }));
app.use(cors({ origin: ['https://example.com', 'https://stuff.com'] }));
app.use(cors({ origin: ['https://example.com', /https:\/\/stuff.[a-z]+/i] }));
app.use(cors({ origin: incomingOrigin => incomingOrigin })); // This may be preferred to *
app.use(cors({ origin: incomingOrigin => getAllowedOrigins(incomingOrigin) }));

// All options
app.use(
  cors({
    origin: 'https://example.com',
    allowMethods: ['GET', 'POST'],
    allowHeaders: ['X-HTTP-Method-Override', 'Authorization'],
    exposeHeaders: ['X-Response-Id'],
    maxAge: 86400,
    credentials: true,
  })
);

// and of course, cors can be attached at a specific path
app.all('/api', cors({ origin: '*' }));

// then add your endpoints
app.get('/api/hello', c => c.json({ hello: 'world' }));

app.listen({ port: 3100, reusePort: true });
```

Options details:

_origin_: A string, regex, array of strings/regexes, or a function that returns the desired origin header
_allowMethods_: an array of HTTP verbs to allow clients to make
_allowHeaders_: an array of HTTP headers to allow clients to send
_exposeHeaders_: an array of HTTP headers to expose to clients
_maxAge_: the number of seconds clients should cache the CORS headers
_credentials_: whether to allow clients to send credentials (e.g. cookies or auth headers)

### devLogger & prodLogger

`devLogger` outputs colorful logs in the form below.

```text
[timestamp] METHOD PATHNAME STATUS_CODE (RESPONSE_TIME)

example:
[19:10:50.276Z] GET /api/users/me 200 (5ms)
```

`prodLogger` outputs logs in JSON with the following shape:

Request log:

```json
{
  "msg": "--> GET /",
  "type": "request",
  "date": "2021-08-01T19:10:50.276Z",
  "id": "ea98fe2e-45e0-47d1-9344-2e3af680d6a7",
  "host": "example.com",
  "method": "GET",
  "pathname": "/",
  "runtime": "Bun v1.1.33",
  "poweredBy": "Bunshine v3.0.0",
  "machine": "server1",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "pid": 123
}
```

Response log:

```json
{
  "msg": "200 GET /",
  "type": "response",
  "date": "2021-08-01T19:10:50.286Z",
  "id": "ea98fe2e-45e0-47d1-9344-2e3af680d6a7",
  "host": "example.com",
  "method": "GET",
  "pathname": "/",
  "runtime": "Bun v1.1.3",
  "poweredBy": "Bunshine v3.0.0",
  "machine": "server1",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "pid": 123,
  "took": 5
}
```

Note that `id` correlates between a request log and response log.

To use these loggers, simply attach them as middleware.

```ts
import { HttpRouter, devLogger, prodLogger } from 'bunshine';

const app = new HttpRouter();

const logger = process.env.NODE_ENV === 'development' ? devLogger : prodLogger;
app.use(logger());
// or at a specific path
app.use('/api/*', logger());

app.listen({ port: 3100, reusePort: true });
```

### performanceHeader

You can add an X-Took header with the number of milliseconds it took to respond.

```ts
import { HttpRouter, performanceHeader } from 'bunshine';

const app = new HttpRouter();

// Add X-Took header
app.use(performanceHeader());
// Or use a custom header name
app.use(performanceHeader('X-Time-Milliseconds'));

app.listen({ port: 3100, reusePort: true });
```

### etags

You can add etag headers and respond to `If-None-Match` headers.

```ts
import { HttpRouter, etags } from 'bunshine';

const app = new HttpRouter();

app.use(etags());
app.get('/resource1', c => c.text(someBigThing));

app.listen({ port: 3100, reusePort: true });
```

## TypeScript pro-tips

Bun embraces TypeScript and so does Bunshine. Here are some tips for getting
the most out of TypeScript.

### Typing URL params

You can type URL params by passing a type to any of the route methods:

```ts
import { HttpRouter } from 'bunshine';

const app = new HttpRouter();

app.post<{ id: string }>('/users/:id', async c => {
  // TypeScript now knows that c.params.id is a string
});

app.get<{ 0: string }>('/auth/*', async c => {
  // TypeScript now knows that c.params['0'] is a string
});

app.listen({ port: 3100, reusePort: true });
```

### Typing WebSocket data

```ts
import { HttpRouter } from 'bunshine';

const app = new HttpRouter();

// regular routes
app.get('/', c => c.text('Hello World!'));

type User = {
  nickname: string;
  email: string;
  first: string;
  last: string;
};

// WebSocket routes
app.socket.at<{ room: string }, { user: User }>('/games/rooms/:room', {
  upgrade: ({ request, params, url }) => {
    // Typescript knows that ws.data.params.room is a string
    const cookies = req.headers.get('cookie');
    const user: User = getUserFromCookies(cookies);
    // here user is typed as User
    return { user };
  },
  open(ws) {
    // TypeScript knows that ws.data.params.room is a string
    // TypeScript knows that ws.data.user is a User
  },
  message(ws, message) {
    // TypeScript knows that ws.data.params.room is a string
    // TypeScript knows that ws.data.user is a User
  },
  close(ws, code, message) {
    // TypeScript knows that ws.data.params.room is a string
    // TypeScript knows that ws.data.user is a User
  },
});

// start the server
app.listen({ port: 3100, reusePort: true });
```

## Examples of common use cases

```ts
import { HttpRouter } from 'bunshine';

const app = new HttpRouter();

// block dotfile access (e.g. .env, .git, .svn, .htaccess)
app.get(/^\./, c => c.text('Not found', { status: 404 }));
// block URLs that end with .env and other dumb endings
app.all(/\.(env|bak|old|tmp|backup|log|ini|conf)$/, respondWith404);
// block WordPress URLs such as /wordpress/wp-includes/wlwmanifest.xml
app.all(/(^wordpress\/|\/wp-includes\/)/, respondWith404);
// block Other language URLs such as /phpinfo.php and /admin.cgi
app.all(/^[^/]+\.(php|cgi)$/, respondWith404);
// block Commonly probed application paths
app.all(/^(phpmyadmin|mysql|cgi-bin|cpanel|plesk)/i, respondWith404);

// add CSP
app.headGet(async (c, next) => {
  const resp = await next();
  if (
    response.headers.get('content-type')?.includes('text/html') &&
    !response.headers.has('Content-Security-Headers')
  ) {
    resp.headers.set(
      'Content-Security-Headers',
      "frame-src 'self'; frame-ancestors 'self'; worker-src 'self'; connect-src 'self'; default-src 'self'; font-src *; img-src *; manifest-src 'self'; media-src 'self' data:; object-src 'self' data:; prefetch-src 'self'; script-src 'self'; script-src-elem 'self' 'unsafe-inline'; script-src-attr 'none'; style-src-attr 'self' 'unsafe-inline'; base-uri 'self'; form-action 'self'"
    );
  }
  return resp;
});
// modify CSP at a certain route
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
app.get('/api/*', async (c, next) => {
  const authValue = c.request.headers.get('Authorization');
  c.locals.auth = {
    identity: await getUser(authValue),
    permission: await getPermissions(authValue),
  };
  // return nothing so that subsequent handlers get called
});

// Destructure context object
app.get('/api/*', async ({ url, request, text }) => {
  // do stuff with url and request
  return text('my text response');
});
```

## Decisions

The following decisions are based on scripts in /benchmarks:

- bound-functions.ts - The Context object created for each request has its
  methods automatically bound to the instance. It is convenient for developers
  and adds only a tiny overhead.
- inner-functions.ts - The Context is a class, not a set of functions in an
  enclosure which saves about 3% of time.
- compression.ts - gzip is the default preferred format for the compression
  middleware. Deflate provides no advantage, and Brotli provides 2-8% additional
  size savings at the cost of 7-10x as much CPU time as gzip. Brotli takes on
  the order of 100ms to compress 100kb of html, compared to sub-milliseconds
  for gzip.
- etags - etag calculation is very fast. On the order of tens of microseconds
  for 100kb of html.
- lru-matcher.ts - The default LRU cache size used for the router is 4000.
  Cache sizes of 4000+ are all about 1.4x faster than no cache.
- response-reencoding.ts - Both the etags middleware and compression middleware
  convert the response body to an ArrayBuffer, process it, then create a new
  Response object. The decode/reencode process takes only 10s of microseconds.
- TextEncoder-reuse.ts - The Context object's response factories (c.json(),
  c.html(), etc.) reuse a single TextEncoder object. That gains about 18% which
  turns out to be only on the order of 10s of nanoseconds.
- timer-resolution.ts - performance.now() is faster than Date.now() even though
  it provides additional precision. The performanceHeader uses performance.now()
  when it sets the X-Took header, which is rounded to 3 decimal places.

Some additional design decisions:

- I decided to use LRUCache and a custom router. I looked into trie routers and
  compile RegExp routers, but they didn't easily support the concept of matching
  multiple handlers and running each one in order of registration. Bunshine v1
  did use `path-to-regexp`, but that recently stopped supporting `*` in route
  registration.

## Roadmap

- ✅ HttpRouter
- ✅ SocketRouter
- ✅ Context
- ✅ examples/server.ts
- ✅ middleware > compression
- ✅ middleware > cors
- ✅ middleware > devLogger
- ✅ middleware > etags
- ✅ middleware > headers
- ✅ middleware > performanceHeader
- ✅ middleware > prodLogger
- ✅ middleware > responseCache
- ✅ middleware > serveFiles
- ✅ middleware > trailingSlashes
- 🔲 document the headers middleware
- ✅ options for serveFiles
- ✅ tests for cors
- 🔲 tests for devLogger
- 🔲 tests for prodLogger
- 🔲 tests for responseFactories
- ✅ tests for serveFiles
- 🔲 100% test coverage
- 🔲 support and document flags to bin/serve.ts with commander
- 🔲 more files in examples folder
- 🔲 example of mini app that uses bin/serve.ts (maybe our own docs?)
- 🔲 GitHub Actions to run tests and coverage
- ✅ Replace "ms" with a small and simple implementation

## License

[ISC License](./LICENSE.md)
