# Bunshine

A Bun HTTP & WebSocket server that is a little ray of sunshine.

<img alt="Bunshine Logo" src="https://github.com/kensnyder/bunshine/raw/main/packages/bunshine/assets/bunshine-logo.png?v=3.1.2" width="200" height="187" />

[![NPM Link](https://img.shields.io/npm/v/bunshine?v=3.1.2)](https://npmjs.com/package/bunshine)
[![Language: TypeScript](https://badgen.net/static/language/TS?v=3.1.2)](https://github.com/search?q=repo:kensnyder/bunshine++language:TypeScript&type=code)
[![Code Coverage](https://codecov.io/gh/kensnyder/bunshine/graph/badge.svg?token=4LLWB8NBNT&v=3.1.2)](https://codecov.io/gh/kensnyder/bunshine)
![Tree shakeable](https://badgen.net/static/tree%20shakeable/yes/green?v=3.1.2)
[![ISC License](https://badgen.net/github/license/kensnyder/bunshine/packages/bunshine?v=3.1.2)](https://opensource.org/licenses/ISC)

## Installation

```shell
bun add bunshine-payload-magic
```

## Motivation

Add some of Express's body-parser features to Bunshine.

## Table of Contents

1. [Basic example](#basic-example)
1. [ISC License](./LICENSE.md)

## Basic example

```ts
import { HttpRouter } from 'bunshine';
import { payloadMagic } from 'bunshine-payload-magic';

const app = new HttpRouter();
app.use(payloadMagic());

app.get('/api/*', c => {
  c.cookies;
  c.body;
  c.query;
});

app.listen({ port: 3100, reusePort: true });
```
