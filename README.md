# Bunshine

A Bun HTTP & WebSocket server that is a little ray of sunshine.

<img alt="Bunshine Logo" src="https://github.com/kensnyder/bunshine/raw/main/assets/bunshine-logo.png?v=0.13.1" width="200" height="187" />

[![NPM Link](https://img.shields.io/npm/v/bunshine?v=0.13.1)](https://npmjs.com/package/bunshine)
![Test Coverage: 95%](https://badgen.net/static/test%20coverage/95%25/green?v=0.13.1)
[![ISC License](https://img.shields.io/npm/l/bunshine.svg?v=0.13.1)](https://opensource.org/licenses/ISC)

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
8. Provide common middleware out of the box
9. Built-in gzip compression
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
9. [Routing examples](#routing-examples)
10. [Included middleware](#included-middleware)
    - [serveFiles](#servefiles)
    - [cors](#cors)
    - [devLogger & prodLogger](#devlogger--prodlogger)
    - [performanceHeader](#performanceheader)
    - [securityHeaders](#securityheaders)
11. [TypeScript pro-tips](#typescript-pro-tips)
12. [Roadmap](#roadmap)
13. [License](./LICENSE.md)

## Usage

## Basic example

```ts
import { HttpRouter } from 'bunshine';

const app = new HttpRouter();

app.get('/', c => {
  return new Response('Hello at ' + c.url.pathname);
});

app.listen({ port: 3100 });
```

## Full example

```ts
import { HttpRouter, redirect } from 'bunshine';

const app = new HttpRouter();

app.patch('/users/:id', async c => {
  await authorize(c.request.headers.get('Authorization'));
  const data = await c.request.json();
  const result = await updateUser(params.id, data);
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

app.listen({ port: 3100 });

function authorize(authHeader: string) {
  if (!authHeader) {
    throw redirect('/login');
  } else if (!jwtVerify(authHeader)) {
    throw redirect('/not-allowed');
  }
}
```

### What is `c` here?

`c` is a `Context` object that contains the request and params.

```ts
import { HttpRouter, type Context, type NextFunction } from 'bunshine';

const app = new HttpRouter();

app.get('/hello', (c: Context, next: NextFunction) => {
  // Properties of the Context object
  c.request; // The raw request object
  c.url; // The URL object
  c.params; // The request params from route placeholders
  c.server; // The Bun server instance (useful for pub-sub)
  c.app; // The HttpRouter instance
  c.locals; // A place to persist data between handlers for the duration of the request
  c.error; // Handlers registered with app.on500() can see this Error object
  c.ip; // The IP address of the client (not necessarily the end user)
  c.date; // The date of the request
  c.now; // The result of performance.now() at the start of the request
  // Convenience methods for creating Response objects with various content types
  // Note that responses are automatically gzipped if the client accepts gzip
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

app.listen({ port: 3100 });
```

See the [serveFiles](#serveFiles) section for more info.

## Writing middleware

Here are more examples of attaching middleware.

```ts
import { HttpRouter } from 'bunshine';

const app = new HttpRouter();

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

// Middleware before a given handler (as array)
app.get('/users/:id', [
  paramValidationMiddleware,
  async c => {
    const user = await getUser(c.params.id);
    return c.json(user);
  },
]);

// Middleware before a given handler (as args)
app.get('/users/:id', paramValidationMiddleware, async c => {
  const user = await getUser(c.params.id);
  return c.json(user);
});

app.get('/', c => c.text('Hello World!'));

app.listen({ port: 3100 });
```

Note that because every handler is treated like middleware,
you must register handlers in order of specificity. For example:

```ts
// This order matters
app.get('/users/me', handler1);
app.get('/users/:id', handler2);
app.get('*', http404Handler);
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
  // wait for other handlers to return a response
  const resp = next();
  // do stuff with response
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
app.listen({ port: 3100 });
```

## WebSockets

Setting up websockets at various paths is easy with the `socket` property.

```ts
import { HttpRouter } from 'bunshine';

const app = new HttpRouter();

// regular routes
app.get('/', c => c.text('Hello World!'));

// WebSocket routes
app.socket.at('/games/rooms/:room', {
  // Optional. Allows you to specify arbitrary data to attach to ws.data.
  upgrade: ({ request, params, url }) => {
    const cookies = req.headers.get('cookie');
    const user = getUserFromCookies(cookies);
    return { user };
  },
  // Optional. Allows you to deal with errors thrown by handlers.
  error: (ws, error) => {
    console.log('WebSocket error', error);
  },
  // Optional. Called when the client connects
  open(ws) {
    const room = ws.data.params.room;
    const user = ws.data.user;
    markUserEntrance(room, user);
    ws.send(getGameState(room));
  },
  // Optional. Called when the client sends a message
  message(ws, message) {
    const room = ws.data.params.room;
    const user = ws.data.user;
    const result = saveMove(room, user, message);
    ws.send(result);
  },
  // Optional. Called when the client disconnects
  close(ws, code, message) {
    const room = ws.data.params.room;
    const user = ws.data.user;
    markUserExit(room, user);
  },
});

// start the server
app.listen({ port: 3100 });

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

app.socket.at('/chat/:room', {
  upgrade: ({ request, params, url }) => {
    const cookies = request.headers.get('cookie');
    const username = getUsernameFromCookies(cookies);
    return { username };
  },
  open(ws) {
    const msg = `${ws.data.username} has entered the chat`;
    ws.subscribe('the-group-chat');
    ws.publish('the-group-chat', msg);
  },
  message(ws, message) {
    // the server re-broadcasts incoming messages to everyone
    ws.publish('the-group-chat', `${ws.data.username}: ${message}`);
  },
  close(ws, code, message) {
    const msg = `${ws.data.username} has left the chat`;
    ws.publish('the-group-chat', msg);
    ws.unsubscribe('the-group-chat');
  },
});

const server = app.listen({ port: 3100 });

// at a later time, publish a message from another source
server.publish(channel, message);
```

## Server-Sent Events

Server-Sent Events (SSE) are similar to WebSockets, but one way. The server can
send messages, but the client cannot. This is useful for streaming data to the
browser.

```ts
import { HttpRouter } from 'bunshine';

const app = new HttpRouter();

app.get('/stock/:symbol', c => {
  const symbol = c.params.symbol;
  return c.sse(send => {
    setInterval(async () => {
      const data = getPriceData(symbol);
      send('price', { gain: data.gain, price: data.price });
    }, 6000);
  });
});

// start the server
app.listen({ port: 3100 });

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
message that the browser will understand to mean "stop listening". Here is an
example:

```ts
import { HttpRouter } from 'bunshine';

const app = new HttpRouter();

app.get('/convert-video/:videoId', c => {
  const { videoId } = c.params;
  return c.sse(send => {
    const onProgress = percent => {
      send('progress', percent);
    };
    const onComplete = () => {
      send('progress', 'complete');
    };
    startVideoConversion(videoId, onProgress, onComplete);
  });
});

// start the server
app.listen({ port: 3100 });

//
// Browser side:
//
const conversionProgress = new EventSource('/convert-video/123');

conversionProgress.addEventListener('progress', e => {
  if (e.data === 'complete') {
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

## Routing examples

Bunshine uses the `path-to-regexp` package for processing path routes. For more
info, checkout the [path-to-regexp docs](https://www.npmjs.com/package/path-to-regexp).

### Path examples

| Path                   | URL                   | params                   |
| ---------------------- | --------------------- | ------------------------ |
| `'/path'`              | `'/path'`             | `{}`                     |
| `'/users/:id'`         | `'/users/123'`        | `{ id: '123' }`          |
| `'/users/:id/groups'`  | `'/users/123/groups'` | `{ id: '123' }`          |
| `'/u/:id/groups/:gid'` | `'/u/1/groups/a'`     | `{ id: '1', gid: 'a' }`  |
| `'/star/*'`            | `'/star/man'`         | `{ 0: 'man' }`           |
| `'/star/*/can'`        | `'/star/man/can'`     | `{ 0: 'man' }`           |
| `'/users/(\\d+)'`      | `'/users/123'`        | `{ 0: '123' }`           |
| `/users/(\d+)/`        | `'/users/123'`        | `{ 0: '123' }`           |
| `/users/([a-z-]+)/`    | `'/users/abc-def'`    | `{ 0: 'abc-def' }`       |
| `'/(users\|u)/:id'`    | `'/users/123'`        | `{ id: '123' }`          |
| `'/(users\|u)/:id'`    | `'/u/123'`            | `{ id: '123' }`          |
| `'/:a/:b?'`            | `'/123'`              | `{ a: '123' }`           |
| `'/:a/:b?'`            | `'/123/abc'`          | `{ a: '123', b: 'abc' }` |

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

app.listen({ port: 3100 });
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

app.listen({ port: 3100 });
```

How to respond to both GET and HEAD requests:

```ts
import { HttpRouter, serveFiles } from 'bunshine';

const app = new HttpRouter();

app.on(['HEAD', 'GET'], '/public/*', serveFiles(`${import.meta.dir}/public`));

app.listen({ port: 3100 });
```

How to alter the response:

```ts
import { HttpRouter, serveFiles } from 'bunshine';

const app = new HttpRouter();

const addFooHeader = async (_, next) => {
  const response = await next();
  response.headers.set('x-foo', 'bar');
  return response;
};

app.get('/public/*', addFooHeader, serveFiles(`${import.meta.dir}/public`));

app.listen({ port: 3100 });
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

app.listen({ port: 3100 });
```

All options for serveFiles:

| Option       | Default     | Description                                                                               |
| ------------ | ----------- | ----------------------------------------------------------------------------------------- |
| acceptRanges | `true`      | If true, accept ranged byte requests                                                      |
| dotfiles     | `"ignore"`  | How to handle dotfiles; allow=>serve normally, deny=>return 403, ignore=>run next handler |
| etag         | N/A         | Not yet implemented                                                                       |
| extensions   | `[]`        | If given, a list of file extensions to allow                                              |
| fallthrough  | `true`      | If false, issue a 404 when a file is not found, otherwise proceed to next handler         |
| immutable    | `false`     | If true, add immutable directive to Cache-Control header; must also specify maxAge        |
| index        | `[]`        | If given, a list of filenames (e.g. index.html) to look for when path is a folder         |
| lastModified | `true`      | If true, set the Last-Modified header                                                     |
| maxAge       | `undefined` | If given, add a Cache-Control header with max-age†                                        |

† _A number in milliseconds or [ms](https://www.npmjs.com/package/ms) compatible expression such as '30m' or '1y'._

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
app.use(cors({ origin: incomingOrigin => myGetOrigin(incomingOrigin) }));

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

app.listen({ port: 3100 });
```

Options details:

_origin_: A string, regex, array of strings/regexes, or a function that returns
_allowMethods_: an array of HTTP verbs to allow clients to make
_allowHeaders_: an array of HTTP headers to allow clients to send
_exposeHeaders_: an array of HTTP headers to expose to clients
_maxAge_: the number of seconds clients should cache the CORS headers
_credentials_: whether to allow credentials (cookies or auth headers)

### devLogger & prodLogger

`devLogger` outputs colorful logs in the form
`[timestamp] METHOD PATHNAME STATUS_CODE (RESPONSE_TIME)`.

For example: `[19:10:50.276Z] GET / 200 (5ms)`.

`prodLogger` outputs logs in JSON with the following shape:

Request log:

```json
{
  "date": "2021-08-01T19:10:50.276Z",
  "method": "GET",
  "pathname": "/",
  "runtime": "Bun 1.0.25",
  "machine": "server1",
  "pid": 1,
  "id": "ea98fe2e-45e0-47d1-9344-2e3af680d6a7"
}
```

Response log:

```json
{
  "date": "2021-08-01T19:10:50.276Z",
  "method": "GET",
  "pathname": "/",
  "status": 200,
  "runtime": "Bun 1.0.25",
  "machine": "server1",
  "pid": 1,
  "id": "ea98fe2e-45e0-47d1-9344-2e3af680d6a7",
  "took": 5
}
```

To use these loggers, simply attach them as middleware.

```ts
import { HttpRouter, devLogger, prodLogger } from 'bunshine';

const app = new HttpRouter();

const logger = process.env.NODE_ENV === 'development' ? devLogger : prodLogger;
app.use(logger());

app.listen({ port: 3100 });
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

app.listen({ port: 3100 });
```

### securityHeaders

You can add security-related headers to responses with the `securityHeaders`
middleware. For more information about security headers, checkout these
resources:

- [securityheaders.com](https://securityheaders.com)
- [MDN Security on the Web](https://developer.mozilla.org/en-US/docs/Web/Security)
- [MDN Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy)

```ts
import { HttpRouter, securityHeaders } from 'bunshine';

const app = new HttpRouter();

app.use(securityHeaders());
// The following are defaults that you can override
app.use(
  securityHeaders({
    contentSecurityPolicy: {
      frameSrc: ["'self'"],
      workerSrc: ["'self'"],
      connectSrc: ["'self'"],
      defaultSrc: ["'self'"],
      fontSrc: ['*'],
      imgSrc: ['*'],
      manifestSrc: ["'self'"],
      mediaSrc: ["'self' data:"],
      objectSrc: ["'self' data:"],
      prefetchSrc: ["'self'"],
      scriptSrc: ["'self'"],
      scriptSrcElem: ["'self' 'unsafe-inline'"],
      scriptSrcAttr: ["'none'"],
      styleSrcAttr: ["'self' 'unsafe-inline'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      sandbox: {},
    },
    crossOriginEmbedderPolicy: 'unsafe-none',
    crossOriginOpenerPolicy: 'same-origin',
    crossOriginResourcePolicy: 'same-origin',
    permissionsPolicy: {
      // only include special APIs that you use
      accelerometer: [],
      ambientLightSensor: [],
      autoplay: ['self'],
      battery: [],
      camera: [],
      displayCapture: [],
      documentDomain: [],
      encryptedMedia: [],
      executionWhileNotRendered: [],
      executionWhileOutOfViewport: [],
      fullscreen: [],
      gamepad: [],
      geolocation: [],
      gyroscope: [],
      hid: [],
      identityCredentialsGet: [],
      idleDetection: [],
      localFonts: [],
      magnetometer: [],
      midi: [],
      otpCredentials: [],
      payment: [],
      pictureInPicture: [],
      publickeyCredentialsCreate: [],
      publickeyCredentialsGet: [],
      screenWakeLock: [],
      serial: [],
      speakerSelection: [],
      storageAccess: [],
      usb: [],
      webShare: ['self'],
      windowManagement: [],
      xrSpacialTracking: [],
    },
    referrerPolicy: 'strict-origin',
    server: false,
    strictTransportSecurity: 'max-age=86400; includeSubDomains; preload',
    xContentTypeOptions: 'nosniff',
    xFrameOptions: 'SAMEORIGIN',
    xPoweredBy: false,
    xXssProtection: '1; mode=block',
  })
);

app.listen({ port: 3100 });
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
  // TypeScript now knows that c['0'] is a string
});

app.listen({ port: 3100 });
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
    const user = getUserFromCookies(cookies);
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
app.listen({ port: 3100 });
```

## Roadmap

- ✅ HttpRouter
- ✅ SocketRouter
- ✅ Context
- ✅ examples/server.ts
- ✅ middleware > serveFiles
- ✅ middleware > cors
- ✅ middleware > devLogger
- ✅ middleware > prodLogger
- ✅ middleware > performanceHeader
- ✅ middleware > securityHeaders
- ✅ middleware > trailingSlashes
- 🔲 middleware > directoryListing
- 🔲 middleware > rate limiter
- 🔲 document headers middleware
- 🔲 move securityHeaders to @bunshine/security-headers
- ✅ gzip compression
- ✅ options for serveFiles
- 🔲 tests for cors
- 🔲 tests for devLogger
- 🔲 tests for prodLogger
- 🔲 tests for gzip
- 🔲 tests for responseFactories
- ✅ tests for serveFiles
- 🔲 100% test coverage
- 🔲 add flags to bin/serve.ts with commander
- 🔲 document flags for `bunx bunshine serve`
- 🔲 more files in examples folder
- 🔲 example of mini app that uses bin/serve.ts (maybe our own docs?)
- 🔲 GitHub Actions to run tests and coverage
- 🔲 Fix TypeScript warnings
- 🔲 Support server clusters
- 🔲 Replace "ms" with a super simple implementation
- ✅ Export functions to gzip strings and files
- ✅ Gzip performance testing (to get min/max defaults)

## License

[ISC License](./LICENSE.md)
