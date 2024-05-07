#!/usr/bin/env bun

import fs from 'fs/promises';
import { devLogger, HttpRouter, prodLogger, serveFiles } from '../index.ts';

const folder = Bun.argv[2] || process.cwd();

if (!(await fs.exists(folder))) {
  console.error(`Folder "${folder}" does not exist.`);
  process.exit(1);
}

const app = new HttpRouter();
app.use(Bun.env.NODE_ENV === 'production' ? prodLogger() : devLogger());
app.headGet(
  '*',
  serveFiles(folder, {
    index: ['index.html'],
    gzip: {
      cache: false,
    },
  })
);
app.listen();

console.log(`☀️ Bunshine serving static files at ${app.server!.url}`);

// TODO: copy to clipboard
// console.log(`Copied local address to clipboard.`);

process.on('beforeExit', () => {
  if (app.server) {
    console.log('☀️ Gracefully shutting down.');
    app.server.stop();
  }
});
process.on('SIGINT', () => {
  if (app.server) {
    console.log('☀️ Force closing all open sockets.');
    app.server.stop(true);
  }
  process.exit(0);
});
