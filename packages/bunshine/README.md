# Bunshine

A Bun HTTP & WebSocket server that is a little ray of sunshine.

<img alt="Bunshine Logo" src="https://github.com/kensnyder/bunshine/raw/main/packages/bunshine/assets/bunshine-logo.png?v=3.6.1" width="200" height="187" />

[![NPM Link](https://img.shields.io/npm/v/bunshine?v=3.6.1)](https://npmjs.com/package/bunshine)
[![Language: TypeScript](https://badgen.net/static/language/TS?v=3.6.1)](https://github.com/search?q=repo:kensnyder/bunshine++language:TypeScript&type=code)
[![Code Coverage](https://codecov.io/gh/kensnyder/bunshine/graph/badge.svg?token=4LLWB8NBNT&v=3.6.1)](https://codecov.io/gh/kensnyder/bunshine)
![Tree shakeable](https://badgen.net/static/tree%20shakeable/yes/green?v=3.6.1)
[![ISC License](https://badgen.net/github/license/kensnyder/bunshine?v=3.6.1)](https://opensource.org/licenses/ISC)

## Installation

```shell
bun add bunshine
```

## Required Bun Versions

- Bunshine v3.6 and onward require Bun 1.3+
- Bunshine v2.0 through v3.5 require Bun 1.1.43+
- Bunshine v1.0 requires Bun v1.0+

## Motivation

1. Use bare `Request` and `Response` objects
2. Integrated support for routing `WebSocket` requests
3. Integrated support for **Server Sent Events**
4. Support **ranged file downloads** (e.g. for video streaming)
5. Be very **lightweight**
6. **Elegantly** treat every handler like middleware
7. Support **async handlers**
8. Provide **common middleware** out of the box (cors, prodLogger, headers,
   compression, etags)
9. Support **traditional routing** syntax
10. Make specifically for **Bun**
11. Comprehensive **unit tests**
12. Support for `X-HTTP-Method-Override` header

## Table of Contents

1. [Basic example](#basic-example)
2. [Full example](#full-example)
3. [SSL](#ssl)
4. [Serving static files](#serving-static-files)
5. [Writing middleware](#writing-middleware)
6. [Throwing responses](#throwing-responses)
7. [WebSockets](#websockets)
8. [WebSocket pub-sub](#websocket-pub-sub)
9. [Server Sent Events](#server-sent-events)
10. [Route Matching](#route-matching)
11. [Included middleware](#included-middleware)
    - [serveFiles](#servefiles)
    - [compression](#compression)
    - [trailingSlashes](#trailingslashes)
    - [cors](#cors)
    - [devLogger & prodLogger](#devlogger--prodlogger)
    - [headers](#headers)
    - [performanceHeader](#performanceheader)
    - [etags](#etags)
    - [Recommended Middleware](#recommended-middleware)
12. [File-based routing](#file-based-routing)
13. [TypeScript pro-tips](#typescript-pro-tips)
14. [Examples of common http server setup](#examples-of-common-http-server-setup)
15. [Design Decisions](#design-decisions)
16. [Roadmap](#roadmap)
17. [Change Log](./CHANGELOG.md)
18. [ISC License](./LICENSE.md)

## Upgrading from 1.x to 2.x

`RegExp` symbols are not allowed in route definitions to avoid ReDoS
vulnerabilities.

## Upgrading from 2.x to 3.x

- The `securityHeaders` middleware has been discontinued. Use a library such as
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
  c.error; // An error object available to handlers registered with app.onError()
  c.ip; // The IP address of the client or load balancer (not necessarily the end user)
  c.date; // The Date of the request
  c.now; // The result of Date.now() at the start of the request

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
  console.log(c.took()); // milliseconds since request was received

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
import { HttpRouter } from 'bunshine';

const app = new HttpRouter();

app.get('/', ({ url, text }) => {
  return text('Hello at ' + url.pathname);
});

app.listen({ port: 3100, reusePort: true });
```

## SSL

Supporting HTTPS is simple on Bun and Bunshine. For details on all supported
options, see the [Bun docs on TLS](https://bun.sh/docs/api/http#tls).

You can obtain free SSL certificates from a service such as
[Let's Encrypt](https://letsencrypt.org/getting-started/).

```ts
import { HttpRouter } from 'bunshine';

const app = new HttpRouter();
const server = app.listen({
  port: 443, // works on any port
  reusePort: true,
  tls: {
    key: Bun.file(`${import.meta.dir}/certs/my.key`),
    cert: Bun.file(`${import.meta.dir}/certs/my.crt`),
    ca: Bun.file(`${import.meta.dir}/certs/ca.pem`), // optional
  },
});
app.get('/', () => new Response('hello from https'));

const resp = await fetch('https://localhost');
```

## Serving static files

Serving static files is easy with the `serveFiles` middleware. Note that ranged
requests are supported, so you can use Bunshine for video streaming and partial
downloads.

```ts
import { HttpRouter, serveFiles } from 'bunshine';

const app = new HttpRouter();

app.get('/public/*', serveFiles(`${import.meta.dir}/public`));

app.listen({ port: 3100, reusePort: true });
```

See the [serveFiles](#serveFiles) section for more info.

Also note you can serve files with Bunshine anywhere with `bunx bunshine .`.
It currently uses the default `serveFiles()` options.

If you want to manually manage serving a file, you can use the following approach.

```ts
import { HttpRouter, serveFiles } from 'bunshine';

const app = new HttpRouter();

app.get('/assets/:name.png', c => {
  const name = c.params.name;
  const filePath = `${import.meta.dir}/assets/${name}.png`;
  // you can pass a string path
  return c.file(filePath);
  // Bunshine will set Content-Type based on the file contents or string file extension
});

app.get('/build/:hash.map', c => {
  const hash = c.params.hash;
  const filePath = `${import.meta.dir}/assets/${name}.mystuff`;
  // or you can pass a BunFile
  return c.file(Bun.file(filePath), {
    // You can override Content-type for non-standard mime types
    headers: { 'Content-type': 'application/json' },
  });
});

app.get('/profile/*.jpg', async c => {
  // or you can pass a Buffer or Uint8Array
  const intArray = getBytesFromExternal(c.params[0]);
  return c.file(bytes);
});

app.get('/files/*', async c => {
  // c.file() accepts some options:
  return c.file(path, {
    disposition, // Use a Content-Disposition header with "inline", "attachment" or "form-data"
    headers, // additional headers to add
    sendLastModified, // unless false, will report file modification date (For paths or BunFile objects)
    acceptRanges, // unless false, will support partial (ranged) downloads
    chunkSize, // Size for ranged downloads when client doesn't specify chunk size. Defaults to 1MB
  });
});
```

## Writing middleware

Here are more examples of attaching middleware.

```ts
import { HttpRouter } from 'bunshine';

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

// middleware can be inserted as parameters to app.get()
app.get('/admin', getAuthMiddleware('admin'), middleware2, handler);

// Bunshine accepts middleware as arguments or arrays, ultimately flattening to one array
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

Throwing a `Response` effectively skips the currently running handler/middleware
and passes control to the next handler. That way thrown responses will be passed
to subsequent middleware such as loggers.

## WebSockets

Setting up websockets is easy by registering handlers for one or more routes
using the `app.socket.at()` function.

```ts
import { HttpRouter, SocketMessage } from 'bunshine';

const app = new HttpRouter();

// register regular routes on app.get()/post()/etc
app.get('/', c => c.text('Hello World!'));

// Register WebSocket routes with app.socket.at()
type ParamsShape = { room: string };
type DataShape = { user: User };
app.socket.at<ParmasShape, DataShape>('/games/rooms/:room', {
  // Optional. Allows you to specify arbitrary data to attach to ws.data.
  upgrade: c => {
    // upgrade is called on first connection, before HTTP 101 is issued
    const cookies = c.request.headers.get('cookie');
    const user = getUserFromCookies(cookies);
    return { user };
  },
  // Optional. Allows you to deal with errors thrown by handlers.
  error: (sc, error) => {
    console.log('WebSocket error', error.message);
  },
  // Optional. Called when the client connects
  open(sc) {
    // open is called once client has successfully upgraded to a Socket connection
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
  close(sc, code, reason) {
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

### Are sockets magical?

They're simpler than you think. What Bun does internally:

- Responds to a regular HTTP request with HTTP 101 (Switching Protocols)
- Tells the client to make socket connection on another port
- Keeps connection open and sends/receives messages
- Keeps objects in memory to represent each connected client
- Tracks topic subscription and un-subscription for each client

In Node, the process is complicated because you have to import and orchestrate
http/https, and net. But Bun provides Bun.serve() which handles everything.
Bunshine is a wrapper around Bun.serve that adds routing and convenience
functions.

With Bunshine you don't need to use Socket.IO or any other framework.
Connecting from the client requires no library either. You can simply
create a `new WebSocket()` object and use it to listen and send data.

Bun also includes built-in subscription and broadcasting for pub-sub
applications. See [below](#websocket-pub-sub) for pub-sub examples using
Bunshine.

### Socket Context properties

```ts
import { Context, HttpRouter, NextFunction, SocketContext } from 'bunshine';

const app = new HttpRouter();

// WebSocket routes
type ParamsShape = { room: string };
type DataShape = { user: User };
app.socket.at<ParmasShape, DataShape>('/games/rooms/:room', {
  // Optional. Allows you to specify arbitrary data to attach to ws.data.
  upgrade: (c: Context, next: NextFunction) => {
    // Functions are type annotated for illustrations, but is not neccessary
    // c and next here are the same as regular http endpoings
    return data; // data returned becomes available on sc.data
  },
  // Optional. Called when the client sends a message
  message(sc, message) {
    sc.url; // the URL object for the request
    sc.server; // Same as app.server
    sc.params; // Route params for the request (in this case { room: string; })
    sc.data; // Any data you return from the upgrade handler
    sc.remoteAddress; // the client or load balancer IP Address
    sc.readyState; // 0=connecting, 1=connected, 2=closing, 3=close
    sc.binaryType; // nodebuffer, arraybuffer, uint8array
    sc.send(message, compress /*optional*/); // compress is optional
    //   message can be string, data to be JSON.stringified, or binary data such as Buffer or Uint8Array.
    //   compress can be true to compress message
    sc.close(status /*optional*/, reason /*optional*/); // status and reason are optional
    //   status can be a valid WebSocket status number (in the 1000s)
    //   reason can be text to tell client why you are closing
    sc.terminate(); // terminates socket without telling client why
    sc.subscribe(topic); // The name of a topic to subscribe this client
    sc.unsubscribe(topic); // Name of topic to unsubscribe
    sc.isSubscribed(topic); // True if subscribed to that topic name
    sc.cork(topic); // Normally there is no reason to use this function
    sc.publish(topic, message, compress /*optional*/); // Publish message to all subscribed clients
    sc.ping(data /*optional*/); // Tell client to stay connected
    sc.pong(data /*optional*/); // Way to respond to client request to stay connected

    message.raw(); // get the raw string or Buffer of the message
    message.text(encoding /*optional*/); // get message as string
    `${message}`; // will do the same as .text()
    message.buffer(); // get data as Buffer
    message.arrayBuffer(); // get data as array buffer
    message.readableStream(); // get data as a ReadableStream object
    message.json(); // parse data with JSON.parse()
    message.type; // message, ping, or pong
  },
  // called when a handler throws any error
  error: (sc: SocketContext, error: Error) => {
    // sc is the same as above
  },
  // Optional. Called when the client disconnects
  // List of codes and messages: https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code
  close(sc: SocketContext, code: number, reason: string) {
    // sc is the same as above
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
    // so you need to call sc.publish() and sc.send()
    const fullMessage = `${sc.data.username}: ${message.text()}`;
    sc.publish(`chat-room-${sc.params.room}`, fullMessage);
    sc.send(fullMessage);
  },
  close(sc, code, reason) {
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
Creating an `EventSource` object in the browser will open a connection to the
server, and if the server closes the connection, a browser will automatically
reconnect.

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

Bunshine v1 used the `path-to-regexp` package for processing path routes.
Due to a discovered
[RegExp Denial of Service (ReDoS) vulnerability](https://security.snyk.io/vuln/SNYK-JS-PATHTOREGEXP-7925106)
Bunshine v2+ no longer uses `path-to-regexp` because the new, safer version
imposes disruptive limitations such as no support for unnamed wildcards.

### What is supported

Bunshine supports the following route matching features:

- Named placeholders using colons (e.g. `/posts/:id`)
- End wildcards using stars (e.g. `/assets/*`)
- Middle (non-slash) wildcards using stars (e.g. `/assets/*/*.css`)
- Static paths (e.g. `/posts`)

Support for RegExp symbols such as `\d+` can lead to a Regular Expression Denial
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

Support for regex-like syntax has been dropped in Bunshine v2 due to the
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
`redos-detector` and use Bunshine's `detectPotentialDos` function:

```ts
import { HttpRouter } from 'bunshine';
import { isSafe } from 'redos-detector';

const app = new HttpRouter();
app.get('/', home);
// ... all my routes

// detectPotentialDos() calls console.warn() with details of each unsafe pattern
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

Serve static files from a directory. Note that ranged requests are
supported, so you can use it to serve video streams and support partial
downloads.

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

app.headGet('/public/*', serveFiles(`${import.meta.dir}/public`));
// or
app.on(['HEAD', 'GET'], '/public/*', serveFiles(`${import.meta.dir}/public`));

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
    index: ['index.html'],
  })
);

app.listen({ port: 3100, reusePort: true });
```

All options for serveFiles:

| Option       | Default     | Description                                                                               |
| ------------ | ----------- | ----------------------------------------------------------------------------------------- |
| acceptRanges | `true`      | If true, accept ranged byte requests                                                      |
| dotfiles     | `"ignore"`  | How to handle dotfiles; allow=>serve normally, deny=>return 403, ignore=>run next handler |
| extensions   | `[]`        | If given, a whitelist of file extensions to allow                                         |
| fallthrough  | `true`      | If false, issue a 404 when a file is not found, otherwise proceed to next handler         |
| maxAge       | `undefined` | If given, add a Cache-Control header with max-age†                                        |
| immutable    | `false`     | If true, add immutable directive to Cache-Control header; must also specify maxAge        |
| index        | `[]`        | If given, a list of filenames (e.g. index.html) to look for when path is a folder         |
| lastModified | `true`      | If true, set the Last-Modified header based on the filesystem's last modified date        |
| exceptWhen   | () => false | If function returns true, run next handler instead of serving file                        |

† _A number in milliseconds or expression such as '30min', '14 days', '1y'._

### compression

P
To add Gzip compression:

```ts
import { HttpRouter, compression, serveFiles } from 'bunshine';

const app = new HttpRouter();

// compress all payloads
app.use(compression());

// compress only certain payloads
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
  exceptWhen?: (context: Context, response: Response) => boolean; // avoids compression if function returns true
};
```

### trailingSlashes

Use the `trailingSlashes` middleware to make sure all URLs have consistent
slash naming for caching, analytics and SEO purposes.

```ts
import { HttpRouter, cors } from 'bunshine';

const app = new HttpRouter();

// use 'add' to add trailing slashes or 'remove' to strip trailing slashes
app.use(trailingSlashes('remove'));

// other routes here
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

_origin_: A string, regex, array of strings/regexes, or a function that returns
the desired origin header
_allowMethods_: an array of HTTP verbs to allow clients to make
_allowHeaders_: an array of HTTP headers to allow clients to send
_exposeHeaders_: an array of HTTP headers to expose to clients
_maxAge_: the number of seconds clients should cache the CORS headers
_credentials_: whether to allow clients to send credentials (e.g. cookies or
auth headers)

### headers

The `headers` middleware adds headers to outgoing responses.

```ts
import { HttpRouter, headers } from '../index';

const app = new HttpRouter();

const htmlSecurityHeaders = headers({
  'Content-Security-Policy': `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;`,
  'Referrer-Policy': 'strict-origin',
  'Permissions-Policy':
    'accelerometer=(), ambient-light-sensor=(), autoplay=(*), battery=(), camera=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), gamepad=(), geolocation=(), gyroscope=(), hid=(), idle-detection=(), local-fonts=(), magnetometer=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-create=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=(), web-share=(self)',
});

app.get('/login', htmlSecurityHeaders, loginHandler);
app.get('/cms/*', htmlSecurityHeaders);

const neverCache = headers({
  'Cache-control': 'no-store, must-revalidate',
  Expires: '0',
});
app.get('/api/*', neverCache);
```

You can also use pass a function as a second parameter to `headers`, to only
apply
the given headers under certain conditions.

```ts
import { HttpRouter, headers } from '../index';

const app = new HttpRouter();

const htmlSecurityHeaders = headers(
  {
    'Content-Security-Policy': `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;`,
    'Referrer-Policy': 'strict-origin',
    'Permissions-Policy':
      'accelerometer=(), ambient-light-sensor=(), autoplay=(*), battery=(), camera=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), gamepad=(), geolocation=(), gyroscope=(), hid=(), idle-detection=(), local-fonts=(), magnetometer=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-create=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=(), web-share=(self)',
  },
  (c, response) => response.headers.get('content-type')?.includes('text/html')
);

app.use(htmlSecurityHeaders);
```

### devLogger & prodLogger

`devLogger` outputs colorful logs to `process.stdout` in the format below.

```text
[timestamp] METHOD PATHNAME STATUS_CODE (RESPONSE_TIME)

example:
[19:10:50.276Z] GET /api/users/me 200 (5ms)
```

Screenshot:

<img alt="devLogger" src="https://github.com/kensnyder/bunshine/raw/main/assets/devLogger-screenshot.png?v=3.6.1" width="524" height="78" />

`prodLogger` outputs logs to `process.stdout` in JSON format with the following shape:

Request log:

```json
{
  "msg": "--> GET /home",
  "type": "request",
  "date": "2021-08-01T19:10:50.276Z",
  "id": "ea98fe2e-45e0-47d1-9344-2e3af680d6a7",
  "host": "example.com",
  "method": "GET",
  "pathname": "/home",
  "runtime": "Bun v1.1.34",
  "poweredBy": "Bunshine v3.6.1",
  "machine": "server1",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "pid": 123
}
```

Response log:

```json
{
  "msg": "200 GET /home",
  "type": "response",
  "date": "2021-08-01T19:10:50.286Z",
  "id": "ea98fe2e-45e0-47d1-9344-2e3af680d6a7",
  "host": "example.com",
  "method": "GET",
  "pathname": "/home",
  "runtime": "Bun v1.1.34",
  "poweredBy": "Bunshine v3.6.1",
  "machine": "server1",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "pid": 123,
  "took": 5
}
```

Note that `id` correlates between a request and its response.

To use these loggers, simply attach them as middleware.

```ts
import { HttpRouter, devLogger, prodLogger } from 'bunshine';

const app = new HttpRouter();

const logger = process.env.NODE_ENV === 'development' ? devLogger : prodLogger;
// attach very first to log all requests
app.use(logger());
// OR attach only to a specific path
app.get('/api/*', logger());
api.get('/api/users/:id', getUser);

app.listen({ port: 3100, reusePort: true });
```

Both `devLogger` and `prodLogger` accept options to specify a writer and
the ability to avoid logging certain requests.

```ts
import { HttpRouter, devLogger, prodLogger } from 'bunshine';

const app = new HttpRouter();

const logger = process.env.NODE_ENV === 'development' ? devLogger : prodLogger;

app.use(
  logger({
    writer: (message: string) => {
      // whatever logging methodology you want to use
      loggingSystem.save(message);
    },
    exceptWhen: (context: Context, response: Response | null) => {
      if (response === null) {
        // we have a request; should we log it?
        if (context.url.pathname === 'super-secret') {
          return false;
        }
      } else {
        // we have a response; should we log it?
        if (response.getHeader('stealth-mode')) {
          return false;
        }
      }
    },
  })
);

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

You can add Etag headers and respond to `If-None-Match` headers.

```ts
import { HttpRouter, etags } from 'bunshine';

const app = new HttpRouter();

app.use(etags());
app.get('/resource1', c => c.text(someCacheableThing));

app.listen({ port: 3100, reusePort: true });
```

`etags()` accepts several options. For example:

```ts
import { HttpRouter, etags } from 'bunshine';

const app = new HttpRouter();

app.use(
  etags({
    // avoid hashing payloads larger than 500MB (default is 2GB)
    maxSize: 500 * 1024 * 1024,
    // custom hash calculator
    calculator: async (c: Context, response: Response) => {
      const buffer = await resp.arrayBuffer();
      const hash = myHashMaker(buffer);
      return { buffer, hash };
    },
    // specify when not to send an Etag
    exceptWhen: (context: Context, response: Response) => {
      // return false if you want to avoid sending an etag
    },
  })
);

app.listen({ port: 3100, reusePort: true });
```

Note: Please register `etags()` before `compression()`.

It's important to generate the ETag after compressing the response. This
ensures that the ETag reflects the exact version of the compressed content sent
to the client. If you generate the ETag before compression, it will correspond
to the uncompressed content, leading to mismatches when clients compare ETags
for cached compressed responses.

### Recommended Middleware

Most applications will want a full-featured set of middleware. Below is the
recommended middleware in recommended order.

```ts
import { HttpRouter, compression, etags, performanceHeader } from 'bunshine';

const app = new HttpRouter();

// use etag headers
app.use(etags());
// add total execution time in milliseconds
app.use(performanceHeader());
// log all requests
app.use(process.env.NODE_ENV === 'development' ? devLogger() : prodLogger());
// strip trailing slashes
app.use(trailingSlashes('remove'));
// compress all payloads
app.use(compression());
```

Note: Please register `etags()` before `compression()`.

It's important to generate the ETag after compressing the response. This
ensures that the ETag reflects the exact version of the compressed content sent
to the client. If you generate the ETag before compression, it will correspond
to the uncompressed content, leading to mismatches when clients compare ETags
for cached compressed responses.

## TypeScript pro-tips

Bun embraces TypeScript and so does Bunshine. Here are some tips for getting
the most out of TypeScript.

### Typing URL params

You can specify URL param types by passing a type to any of the route methods:

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
  close(ws, code, reason) {
    // TypeScript knows that ws.data.params.room is a string
    // TypeScript knows that ws.data.user is a User
  },
});

// start the server
app.listen({ port: 3100, reusePort: true });
```

### Typing middleware

```ts
import { type Middleware } from 'bunshine';

function myMiddleware(options: Options): Middleware {
  return (c, next) => {
    // TypeScript infers c and next because of Middleware type
  };
}
```

## Examples of common http server setup

```ts
import { HttpRouter, type Middleware } from 'bunshine';

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

## File-based routing

Bunshine supports file routing. Example:

```ts
import { HttpRouter } from 'bunshine';

const app = new HttpRouter();
app.registerFileRoutes({ path: `${import.meta.dir}/routes` });
```

Then in the `./routes` directory, each file can register routes corresponding
to one or more http methods. In other words, if the file exports handlers such as
GET, POST, PATCH, etc., each function will be registered with the corresponding
method with a path according to the file name.

Rules about file names:

1. File extension is ignored
2. Dots in filenames represent path slashes (e.g.) `users.me.ts` => "/users/me"
3. Routes in folders will be expanded (e.g.) `users/me.ts` => "/users/me"
4. "$" are converted to dynamic segments (e.g.) `users.$id.ts` => "/users/:id"
5. Routes are automatically sorted by specificity (e.g.) route order will
   be "users/me" then "users/:id", otherwise the former will never match

```ts
// ./routes/api.users.$userId.ts
import type { Handler } from 'bunshine';

// Provide generic shape for Handler if you want intellisense on dynamic params
export const GET: Handler<{ userId: string }> = async c => {
  return c.json(lookupUser(c.params.userId));
};

// Exports can also be arrays, allowing middleware to be specified
export const POST: Handler<{ userId: string }> = [
  authMiddleware,
  async c => {
    const res = await updateUser(c.params.userId, await c.request.json());
    return c.json(lookupUser(c.params.userId));
  },
];
```

## Design Decisions

The following decisions are based on scripts in /benchmarks:

- `bound-functions.ts` - The Context object created for each request has its
  methods automatically bound to the instance. It is convenient for developers
  and adds only a tiny overhead.
- `inner-functions.ts` - Context is a class, not a set of functions in a
  closure, which saves about 3% of time.
- `compression-speed.ts` - gzip is the default preferred format for the compression
  middleware. Deflate provides no advantage, and Brotli provides 2-8% additional
  size savings at the cost of 100x as much CPU time as gzip. Brotli takes on
  the order of 100ms to compress 100kb of html, compared to sub-milliseconds
  for gzip.
- `etags-speed.ts` - etag calculation is very fast. On the order of tens of
  microseconds for 100kb of html.
- `lru-matcher.ts` - The default LRU cache size used for the router is 4000.
  Cache sizes of 4000+ are all about 1.4x faster than no cache.
- `response-reencoding.ts` - Both the etags middleware and compression
  middleware convert the response body to an `ArrayBuffer`, process it, then
  create a new `Response` object. The decode/reencode process takes only 10s of
  microseconds.
- `TextEncoder-reuse.ts` - The Context object's response factories (`c.json()`,
  `c.html()`, etc.) reuse a single `TextEncoder` object. That gains about 18%
  which turns out to be only on the order of 10s of nanoseconds.

Some additional design decisions:

- I decided to use LRUCache and a custom router. I looked into trie routers and
  compile RegExp routers, but they didn't easily support the concept of matching
  multiple handlers and running each one in order of registration. Bunshine v1
  did use `path-to-regexp`, but that recently stopped supporting many common
  route definitions.
- Handlers must use `Request` and `Response` objects. We all work with these
  modern APIs every time we use `fetch`. Cloudflare Workers, Deno, Bun, and
  other runtimes decided to use bare `Request` and `Response` objects for their
  standard libraries. Someday Node may add support too. Frameworks like Express
  and Hono are nice, but take some learning to understand their proprietary APIs
  for creating responses, sending responses, and setting headers.
- Handlers receive a raw `URL` object. `URL` objects are a fast and standardized
  way to parse incoming URLs. The router only needs to know the path, and so
  does no other processing for query parameters, ports, and so on. There are many
  approaches to parse query parameters; Bunshine is agnostic. Use
  `c.url.searchParams` however you like.

## Roadmap

- ✅ HttpRouter
- ✅ SocketRouter
- ✅ Context
- ✅ ./examples/kitchen-sink.ts
- 🔲 more examples in ./examples
- ✅ middleware > compression
- ✅ middleware > cors
- ✅ middleware > devLogger
- ✅ middleware > etags
- ✅ middleware > headers
- ✅ middleware > performanceHeader
- ✅ middleware > prodLogger
- ✅ middleware > serveFiles
- ✅ middleware > trailingSlashes
- ✅ document the headers middleware
- ✅ options for serveFiles
- ✅ tests for cors
- 🔲 tests for devLogger
- 🔲 tests for prodLogger
- ✅ tests for responseFactories
- ✅ tests for serveFiles
- 🔲 100% test coverage
- 🔲 support and document flags to bin/serve.ts with commander
- 🔲 example of mini app that uses bin/serve.ts (maybe our own docs?)
- ✅ GitHub Actions to run tests and coverage
- ✅ Replace "ms" with a small and simple implementation

## License

[ISC License](./LICENSE.md)
