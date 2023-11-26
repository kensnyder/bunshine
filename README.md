<img alt="Bunshine Logo" src="https://github.com/kensnyder/bunshine/raw/main/assets/bunshine-logo.png?v=0.9.3" width="200" height="187" />

[![NPM Link](https://img.shields.io/npm/v/bunshine?v=0.9.3)](https://npmjs.com/package/bunshine)
[![ISC License](https://img.shields.io/npm/l/bunshine.svg?v=0.9.3)](https://opensource.org/licenses/ISC)

# Bunshine

A Bun HTTP & WebSocket server that is a little ray of sunshine.

`bun install bunshine`

## Motivation

1. Use bare `Request` and `Response` objects
2. Support for routing `WebSocket` requests
3. Support for Server Sent Events
4. Support ranged file downloads (e.g. for video streaming)
5. Be very lightweight
6. Treat every handler function like middleware
7. Support async handlers
8. Provide common middleware out of the box
9. Make specifically for Bun
10. Comprehensive unit tests
11. Support for `X-HTTP-Method-Override` header

## Table of Contents

1. Basic example
2. Full example
3. Serving static files
4. Middleware
5. WebSockets
6. WebSocket pub-sub
7. Server Sent Events
8. Routing examples
9. Middleware
10. Roadmap
11. License

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
import { HttpRouter, json, redirect } from 'bunshine';

const app = new HttpRouter();

app.patch('/users/:id', async ({ request, params, url }) => {
  await authorize(request.headers.get('Authorization'));
  const data = await request.json();
  const result = await updateUser(params.id, data);
  if (result === 'not found') {
    return json({ error: 'User not found' }, { status: 404 });
  } else if (result === 'error') {
    return json({ error: 'Error updating user' }, { status: 500 });
  } else {
    return json({ error: false });
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

TODO

### What does it mean that "every handler is treated like middleware"?

TODO

## Serving static files

```ts
import { HttpRouter, serveFiles } from 'bunshine';

const app = new HttpRouter();

app.use(serveFiles(`${import.meta.dir}/public`));

app.listen({ port: 3100 });
```

## Middleware

```ts
import { HttpRouter } from 'bunshine';

const app = new HttpRouter();

// Run before each request
app.use(c => {
  if (!isAllowed(c.request.headers.get('Authorization'))) {
    // redirect instead of running other middleware or handlers
    return c.redirect('/login', { status: 403 });
  }
});

// Run after each request
app.use(async (c, next) => {
  const resp = await next();
  if (resp.status === 403) {
    logThatUserWasForbidden(c.request.url);
  }
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

## WebSockets

```ts
import { HttpRouter } from 'bunshine';

const app = new HttpRouter();

// regular routes
app.get('/', c => c.text('Hello World!'));

// WebSocket routes
app.socket.at<{ user: string }>('/games/rooms/:room', {
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
// sending messages
gameRoom.send(JSON.stringify({ type: 'GameMove', move: 'rock' }));
```

## WebSocket pub-sub

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

## Server Sent Events

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

## Routing examples

Bunshine uses the `path-to-regexp` package for processing path routes. For more
info, checkout the [path-to-regexp docs](https://www.npmjs.com/package/path-to-regexp).

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

## Middleware

### serveFiles

Serve static files from a directory.

```ts
import { HttpRouter, serveFiles } from 'bunshine';

const app = new HttpRouter();

app.get('/public', serveFiles(`${import.meta.dir}/public`));

app.listen({ port: 3100 });
```

### cors

To Document

### devLogger

To Document

### performanceLogger

To Document

### prodLogger

To Document

### securityHeaders

To Document

## Roadmap

- ✅ HttpRouter
- ✅ SocketRouter
- ✅ Context
- ✅ middleware > serveFiles
- ✅ middleware > cors
- ✅ middleware > devLogger
- ✅ middleware > prodLogger
- 🔲 middleware > performanceLogger
- 🔲 middleware > securityHeaders
- 🔲 examples/server.ts
- 🔲 GitHub Actions to run tests and coverage

## License

[ISC License](./LICENSE.md)
